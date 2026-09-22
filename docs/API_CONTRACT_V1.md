# g000st Mobile API Contract — Draft v1

This is the mobile contract for extending the existing backend. It is not a proposal to
replace or rebuild that backend. Endpoint names can be mapped to existing server naming
before implementation, but the security semantics below must remain the same.

## Identity model

- `publicId`: exactly 50 characters and safe to share. It identifies a user to other users.
- `recoveryId`: exactly 50 characters, secret, and used only to recover/sign in to the account.
- The two IDs must never be equal.
- The backend returns the plaintext `recoveryId` only once, immediately after registration.
- The mobile app stores session tokens in SecureStore. It does not persist the Recovery ID.

## `POST /auth/register`

Request body:

```json
{
  "requestedPublicId": "optional-50-character-value"
}
```

If `requestedPublicId` is omitted, the server generates the Public ID. If it is present and
already reserved, the server returns `409 PUBLIC_ID_UNAVAILABLE`.

Successful response (`201`):

```json
{
  "user": { "publicId": "50-character-public-id" },
  "recoveryId": "50-character-private-recovery-id",
  "session": {
    "accessToken": "opaque-or-jwt-access-token",
    "refreshToken": "rotating-refresh-token",
    "expiresAt": 1789478400000
  }
}
```

`expiresAt` is a Unix timestamp in milliseconds.

## `POST /auth/sessions`

Request body:

```json
{
  "recoveryId": "50-character-private-recovery-id"
}
```

Successful response (`200`) returns `user` and `session` in the same shapes shown above,
without returning the Recovery ID.

## `POST /auth/token/refresh`

Request body:

```json
{
  "refreshToken": "rotating-refresh-token"
}
```

Successful response (`200`):

```json
{
  "session": {
    "accessToken": "new-access-token",
    "refreshToken": "new-rotating-refresh-token",
    "expiresAt": 1789478400000
  }
}
```

The server invalidates the old refresh token after rotation.

## Error shape

All non-2xx JSON responses use:

```json
{
  "code": "STABLE_MACHINE_CODE",
  "message": "Safe user-facing message"
}
```

Expected codes include `INVALID_RECOVERY_ID`, `PUBLIC_ID_UNAVAILABLE`, `RATE_LIMITED`,
`SESSION_EXPIRED`, and `VALIDATION_ERROR`.

## Backend security requirements

- Never write Recovery IDs, access tokens, or refresh tokens to application/proxy logs.
- Store a slow cryptographic hash of the Recovery ID, not its plaintext value.
- Rate-limit registration, recovery attempts, and token refresh by IP and account signals.
- Rotate refresh tokens and detect replay of an invalidated token family.
- Require TLS and reject requests over plaintext HTTP outside local development.
- Private-chat authorization must be enforced on the server for every read and write.

## Social API

All Social routes require `Authorization: Bearer <accessToken>` and are rooted at
`/api/v1/social`. The server, not the client, enforces ownership and anonymous-author privacy.

- `GET /posts?limit=20&cursor=...&ownerId=...`: cursor-paginated feed or one user's posts.
- `POST /posts`: creates a post from `{ clientPostId, content, visibility, media? }`.
- `GET|PATCH|DELETE /posts/:postId`: reads or changes a post; mutation requires ownership.
- `POST /posts/:postId/like`: atomically toggles the current user's reaction.
- `GET|POST /posts/:postId/comments`: lists or creates comments.
- `DELETE /posts/:postId/comments/:commentId`: owner-only comment deletion.
- `POST /uploads`: creates a signed image/video upload for a client-generated post UUID.
- `GET /profiles/:publicId`, `PUT /profile`: reads or updates the optional Social profile.
- `POST /profiles/:publicId/camp`: toggles Camp for an active user.
- `GET /alerts`, `POST /alerts/read`: lists and marks Social alerts.
- `POST /reports`: creates a moderation report without exposing it to other users.

`visibility` is `anonymous` or `public`. For anonymous posts/comments the API omits the owner's
Public ID and returns `Anonymous`; clients must not infer identity from local state. Images are
uploaded directly to configured S3-compatible storage with a short-lived signed PUT URL, promoted
only when the post is created, and returned through short-lived signed download URLs. A post accepts
up to two images or exactly one video, never a mixed batch; every file is limited to 5 MB in both
the route validation and media service.

## Mobile API

The Mobile feature is three independent concerns with different trust boundaries, so it is split
across three route roots: `/api/v1/billing` (money), `/api/v1/telephony` (Telnyx-mediated external
calls/SMS), and `/api/v1/calling` (free in-app audio/video calling, built independently of Telnyx).
All routes below require `Authorization: Bearer <accessToken>` and enforce ownership via the
authenticated caller's own Public ID, except the two provider webhook routes (verified by the
provider's own request signature instead of a bearer token) and the `/billing/admin/*` routes
(bearer token **plus** an `admin` account role).

There is exactly **one** phone number for the whole platform (client-owned, configured server-side),
used as the caller ID / sender ID for every user's outbound external call and SMS. There is no
per-user number. External calls and SMS are **outbound-only** — the platform never receives a call
or message from the public phone network, so there is no inbound-routing concept to design around a
shared caller ID. In-app calling (a g000st user calling another g000st user, audio or video) is a
completely separate, always-free capability that never touches billing.

### Billing

- `GET /billing/skus` → `{ skus: [{ id, kind: "sms" | "voice_minutes", quantity, priceCents, currency, label }] }`. A small fixed catalog of prepaid bundles (fresh ids such as `sms-5`, `voice-10m`, `voice-30m` — never reuse legacy plan names).
- `POST /billing/checkout-sessions` — body `{ skuId, returnTo: "mobile" | "web" }` → `201 { checkoutUrl, checkoutSessionId }`. `returnTo` selects the success/cancel URL from a server-side allow-list; the client never supplies a raw redirect URL. Errors: `400 UNKNOWN_SKU`, `429 RATE_LIMITED`, `503 BILLING_UNAVAILABLE`. This only creates a Stripe Checkout session — no balance changes here.
- `POST /billing/webhooks/stripe` — Stripe → server, no bearer token, raw-body signature verification via the `stripe` SDK. Always `200 { received: true }` once verified (processing is idempotent per Stripe event); `400 INVALID_SIGNATURE` and **no ledger write** when verification fails.
- `GET /billing/balance` → `{ balance: { voiceSecondsRemaining, smsRemaining, updatedAtMs } }`. Tracked in seconds so partial minutes bill exactly.
- `GET /billing/ledger?limit=20&cursor=...` → cursor-paginated ledger entries, `kind` one of `purchase | call_consumption | sms_consumption | admin_adjustment`. Same cursor convention as `GET /social/posts`.
- `GET /billing/admin/users/:publicId` (admin) → `{ balance }`.
- `GET /billing/admin/users/:publicId/ledger?cursor&limit` (admin) → same ledger entry shape as above — never call or message content, only counts/durations/references.
- `POST /billing/admin/users/:publicId/adjust` (admin) — body `{ voiceSecondsDelta, smsDelta, reason }` → appends an `admin_adjustment` ledger entry tagged with the acting admin's own Public ID.

### Telephony (Telnyx — external calls and SMS only)

- `POST /telephony/webrtc-credential` → `{ credential: { sipUsername, sipPassword, loginToken, expiresAtMs, clientState } }`. Short-lived, per-user Telnyx WebRTC login credential; the client uses this to register directly with Telnyx's WebRTC gateway (`@telnyx/webrtc` on web, the RN SDK on mobile) and **places the call itself** — there is no server-side Call Control dial. `clientState` is an **opaque, server-HMAC-signed token** (not the raw Public ID) that the client must pass through verbatim as `newCall()`'s `clientState` option; Telnyx echoes it back on every Call Control webhook for that call (requires the Connection's *Advanced → Events* option enabled in Telnyx Mission Control), and the server verifies the signature before trusting it for billing attribution. It is never constructed or decoded client-side — a client-supplied raw Public ID would let one user get calls billed to another. The raw Telnyx API key never reaches a client.
- `POST /telephony/calls` — body `{ toE164 }` → `201 { authorized: true }`. A pre-flight balance check only, called just before the client places the call itself via the WebRTC SDK — it never talks to Telnyx and creates no call record (the record is created reactively from the `call.initiated` webhook, once Telnyx has actually assigned a `call_control_id`). Errors: `402 INSUFFICIENT_BALANCE`.
- `POST /telephony/webhooks/calls` — Telnyx Call Control webhook (`call.initiated`, `call.answered`, `call.hangup`) for calls the client placed via WebRTC, Ed25519-signature-verified. `call.initiated` creates the call history record (attributing it via `client_state`); debits the ledger on `call.hangup` using the answered→hangup duration; idempotent per `call_control_id`.
- `GET /telephony/calls?limit=20&cursor=...` → cursor-paginated external call history.
- `POST /telephony/sms` — body `{ toE164, body }` → `201 { message: { id, toE164, body, status, createdAtMs } }`. Checked against the SMS balance before sending. Errors: `402 INSUFFICIENT_BALANCE`, `502 PROVIDER_ERROR`.
- `POST /telephony/webhooks/sms` — Telnyx outbound delivery-status webhook only, Ed25519-signature-verified. There is no inbound-message webhook; none is needed since SMS is outbound-only.
- `GET /telephony/sms?limit=20&cursor=...` → cursor-paginated outbound SMS history.

### Calling (in-app, custom-built, audio + video, always free)

- `POST /calling/turn-credential` → `{ credential: { urls, username, credential, expiresAtMs } }`. Short-lived TURN relay credentials from the managed TURN provider, used only when a direct peer-to-peer connection fails. Public STUN needs no credential.
- `wss://.../api/v1/calling/socket?token=<accessToken>` — a signaling relay, not a REST endpoint. The server authenticates the connection the same way any bearer-token route does, then relays small JSON control messages (`call-invite`, `call-offer`, `call-answer`, `ice-candidate`, `call-reject`, `call-end`) to the addressed Public ID's open socket. The sender's own Public ID is always taken from the authenticated connection, never from client-supplied message content. If the target has no open socket, the server falls back to a push notification carrying just enough data to raise a native incoming-call UI. No media and no call content passes through this server.
- `GET /calling/history?limit=20&cursor=...` → cursor-paginated, unbilled call log (peer, duration, audio/video, missed/answered) for the caller's own history — this never interacts with the billing ledger.

### Cross-cutting rules

- Balance, consumption, and entitlements are computed and stored **only** in the backend, from a ledger of auditable events — never trusted from or computed by a client.
- A purchase only ever credits a balance after a signature-verified Stripe webhook confirms payment; a successful Checkout redirect on its own grants nothing.
- In-app calling never calls into the billing service under any code path — the module boundary between `calling` and `billing` is the enforcement mechanism for "in-app is always free," not a policy flag that could be toggled incorrectly.
- New error codes: `UNKNOWN_SKU`, `INVALID_SIGNATURE`, `BILLING_UNAVAILABLE`, `INSUFFICIENT_BALANCE`, `PROVIDER_ERROR`, `CALL_NOT_FOUND`, `ADMIN_REQUIRED`.
