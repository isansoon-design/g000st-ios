# g000st

The g000st monorepo keeps the three product surfaces aligned:

- `apps/mobile` — Expo SDK 56 application for iOS and Android.
- `apps/web` — Next.js user website and admin dashboard.
- `apps/api` — versioned Node.js API shared by mobile and web.
- `docs` — architecture, migration, and API contract documentation.

The client-provided HTML files and the previous native iOS wrapper are preserved on the
`archive/pre-monorepo-2026-09-16` branch. They are intentionally absent from `main`.

Never commit local environment files, Firebase service accounts, Recovery IDs, or session
tokens. Each app includes its own `.env.example` with non-secret configuration names.

## Common commands

```bash
npm run dev:mobile
npm run dev:web
npm run dev:api
npm run typecheck
npm run test:api
```

Install all workspace dependencies from the repository root with `npm ci`. The root lockfile
keeps mobile, web, API, and future shared packages reproducible together.
