# g000st API

Versioned API extension for the existing g000st backend. Both the Next.js website and the Expo
mobile app consume the same `/api/v1` contract.

This service is introduced alongside the existing `g000st-web` process. The existing check,
claim, feed, and Stripe behavior is not removed during the migration.

## Local checks

Install once and run checks from the repository root:

```bash
npm ci
npm run typecheck:api
npm run test:api
npm run build:api
```

## Staging

Staging binds to `127.0.0.1:3100` and uses an isolated Firestore collection prefix. It is not
publicly routed until its auth flows pass real integration tests.

Never commit `.env`, a Firebase service account, Recovery IDs, or session tokens.

## Follow a Social post publisher

`POST /api/v1/social/posts/:postId/camp` requires an authenticated session and a UUID
post ID. It toggles the existing follow relationship with the post's actual publisher,
including anonymous posts, and returns `{ "camped": true }` or `{ "camped": false }`.
It does not return the publisher's ID or change the post's visible author identity.
Missing or invisible posts return `POST_NOT_FOUND`; following yourself returns
`INVALID_CAMP_TARGET`. Existing account activity and blocking checks still apply.

### Support chat (API v1)

Administrators configure the support account in **Client Desk → Inbox · Support → Contact us · Chat account**. Select a personal, active account using its Public ID or Recovery ID. Recovery IDs are verified on the server without creating a session; only the resolved Public ID is stored. Saving a null identifier disables support chat.

- `GET /api/v1/admin/support` (admin): `{ version: 1, publicId: string | null }`.
- `PUT /api/v1/admin/support` (admin): body `{ identifier: string | null, kind: "public" | "recovery" }`; returns `{ version: 1, publicId: string | null }`.
- `POST /api/v1/communication/support/conversation` (signed in): returns `{ version: 1, conversationId: string }`. The server selects the recipient from configuration and creates or reuses the standard private conversation for the current acting identity. Normal messaging permissions and retention rules apply. Missing or inactive support accounts return `503 SUPPORT_UNAVAILABLE`.

Web and mobile expose the authenticated `/contact-us` page in the sidebar. Support replies use the existing chat interface and message notifications.
