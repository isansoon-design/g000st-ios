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
