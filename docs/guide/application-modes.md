# Application Modes

BirdCoder keeps one product surface but supports multiple delivery modes through a unified host and release architecture.

## Delivery Modes

- `web`: browser-hosted workspace
- `desktop`: packaged Tauri host
- `server`: native host that serves the built web assets
- `container`: Docker-oriented deployment bundle
- `kubernetes`: Helm-compatible deployment bundle

## Identity Deployment Modes

BirdCoder standardizes runtime identity deployment through three canonical lanes:

| Deployment mode | Standard command family | Standard runtime shape |
| --- | --- | --- |
| `desktop-local` | `pnpm dev:local`, `pnpm tauri:dev`, `pnpm tauri:dev:local`, `pnpm desktop:dev:local` | Desktop host embeds the coding server and uses a local sqlite-backed user center |
| `server-private` | `pnpm dev`, `pnpm dev:private`, `pnpm tauri:dev:private`, `pnpm web:dev:private`, `pnpm server:dev`, `pnpm server:dev:private` | Web or desktop clients connect to a private BirdCoder server that exposes the canonical auth facade |
| `cloud-saas` | `pnpm dev:cloud`, `pnpm tauri:dev:cloud`, `pnpm web:dev:cloud`, `pnpm server:dev:cloud` | BirdCoder server keeps the same auth facade but delegates identity to `sdkwork-cloud-app-api` |

## User-Center Provider Modes

Provider binding is standardized separately from deployment mode so the frontend never changes routes when the authority changes:

| Provider kind | Standard command family | Authority behavior |
| --- | --- | --- |
| `builtin-local` | Default `desktop-local` and `server-private` commands | Local sqlite authority with seeded bootstrap account, starter workspace project, local OAuth samples, and fixed dev verify-code support |
| `external-user-center` | `pnpm dev:external`, `pnpm tauri:dev:external`, `pnpm desktop:dev:external`, `pnpm web:dev:external`, `pnpm server:dev:external` | BirdCoder server keeps `/api/app/v1/auth/*` and related facade routes but resolves identity from a third-party bridge |
| `sdkwork-cloud-app-api` | `pnpm dev:cloud`, `pnpm tauri:dev:cloud`, `pnpm web:dev:cloud`, `pnpm server:dev:cloud` | BirdCoder server delegates identity and membership to the cloud `sdkwork-cloud-app-api` authority |

## Standard

Each mode shares the same release profile, checksum finalization, release notes flow, and machine-readable manifest contract.
Across all delivery and provider modes, BirdCoder keeps the same frontend-facing facade routes:

- `/api/app/v1/auth/*`
- `/api/app/v1/user/profile`
- `/api/app/v1/vip/info`

That route invariant is the core standard for the sample app: deployment topology and provider authority may change, but the BirdCoder UI and service layer stay branch-free.

For builtin-local startup, BirdCoder also seeds one starter project under a deterministic absolute directory beside the sqlite authority file unless `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` overrides the location.
