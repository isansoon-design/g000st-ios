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
