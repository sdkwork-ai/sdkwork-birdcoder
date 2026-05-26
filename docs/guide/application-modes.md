# Application Modes

BirdCoder keeps one product surface while separating delivery topology from SDKWork IAM deployment mode.

## Delivery Modes

- `web`: browser-hosted workspace
- `desktop`: packaged Tauri host
- `server`: native host that serves the built web assets
- `container`: Docker-oriented deployment bundle
- `kubernetes`: Helm-compatible deployment bundle

## IAM Deployment Modes

BirdCoder standardizes runtime IAM deployment through three canonical lanes:

| Deployment mode | Standard command family | Standard runtime shape |
| --- | --- | --- |
| `desktop-local` | `pnpm dev:local`, `pnpm tauri:dev`, `pnpm tauri:dev:local`, `pnpm desktop:dev:local` | Desktop host embeds the coding server and uses local SDKWork IAM storage |
| `server-private` | `pnpm dev`, `pnpm dev:private`, `pnpm tauri:dev:private`, `pnpm web:dev:private`, `pnpm server:dev`, `pnpm server:dev:private` | Web or desktop clients connect to a private BirdCoder server exposing the canonical SDKWork IAM facade |
| `cloud-saas` | `pnpm dev:cloud`, `pnpm tauri:dev:cloud`, `pnpm web:dev:cloud`, `pnpm server:dev:cloud` | BirdCoder server keeps the same app facade while using the cloud SDKWork IAM authority |

## Standard Routes

Each delivery mode shares the same release profile, checksum finalization, release notes flow, and machine-readable manifest contract. Each IAM deployment mode keeps the same frontend-facing app API routes:

- `/app/v3/api/auth/*`
- `/app/v3/api/iam/users/current`
- `/app/v3/api/memberships/current`
- `/app/v3/api/memberships/package_groups`

That route invariant is the core standard for the sample app: deployment topology may change, but the BirdCoder UI and service layer stay branch-free and consume SDKWork IAM through the generated app SDK surface.

For local startup, BirdCoder also seeds one starter project under a deterministic absolute directory beside the sqlite authority file unless `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` overrides the location.
