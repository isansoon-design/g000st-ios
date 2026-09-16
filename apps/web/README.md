# g000st Web

The Next.js web application contains the user experience and admin dashboard. It consumes the
same versioned API contract as the Expo application.

## Setup

Run these commands from the repository root:

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

The development server opens at `http://localhost:3000` by default. Keep real Firebase and API
credentials only in `.env.local`; environment files are intentionally excluded from Git.
The checked-in example points local frontend requests to the hosted staging API.

## Checks

```bash
npm run typecheck:web
npm run build:web
```

## Main areas

- `app/(auth)` — authentication and recovery flows.
- `app/(user)` — user dashboard, private chat, social feed, contacts, and profile.
- `app/(admin)` — administration dashboard, users, reports, and settings.
- `lib` and `app/api` — shared client integrations and typed API access.
- `components` — reusable UI shared across routes.

Authentication is being aligned around a shareable 50-character Public ID and a separate secret
50-character Recovery ID. The web and mobile clients must implement the same product behavior
and API contract while using platform-appropriate layout primitives.
