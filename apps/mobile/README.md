# g000st Mobile

Native g000st mobile application built with Expo SDK 56 and strict TypeScript.

## Requirements

- Node.js 20.19 or newer
- Xcode 26.4 or newer for local iOS builds
- Android SDK API 36 for local Android builds
- A development build (Expo Go is not sufficient for all native modules)

## Setup

```bash
cp .env.example .env.local
npm ci
npx expo start --dev-client
```

The default API base URL is `https://g000st.com/api/v1`. Override it locally with
`EXPO_PUBLIC_API_URL` in `.env.local`.

## Checks

```bash
npm run typecheck
npm run lint
npm run doctor
```

## Structure

```text
src/app/          Expo Router routes only
src/api/          Axios instance and typed resource functions
src/domain/       Shared domain types
src/features/     Feature-owned UI, hooks, validation and use-cases
src/services/     Device and persistence adapters
src/providers/    Application providers
legacy/           Previous WebView implementation and source reference
docs/             Analysis and migration plan
```

## Authentication contract

- `Public ID`: 50 characters, shareable and searchable.
- `Recovery ID`: a separate 50-character secret used to restore account access.
- Session tokens are stored in Expo SecureStore.
- The app does not create a successful local/demo session when the API is unavailable.

The backend endpoints expected by the first mobile slice are documented by the typed resource
functions in `src/api/auth.ts`. They will remain unavailable until the server-side authentication
phase is deployed. The draft contract in `docs/API_CONTRACT_V1.md` extends the existing backend;
it does not replace or rebuild it.

## SDK 56 note

Expo Doctor currently reports the known Hermes V1 memory regression inherited from React
Native 0.85 when Reanimated/Worklets are present. The project intentionally remains on SDK 56
to match the agreed requirement. Before a production build, choose either the Expo-recommended
SDK 57 patch line or the slower SDK 56 legacy-Hermes source-build workaround after device
profiling; this warning must not be ignored for release.

## Legacy project

The original iOS WebView wrapper from the repository is preserved under `legacy/ios-webview`.
When present locally, the analyzed `appfg000st.html` mobile source is kept under `legacy/source`
as a visual and behavioral reference. That directory is intentionally ignored because the
client-provided file contains environment configuration that was not part of this repository.
