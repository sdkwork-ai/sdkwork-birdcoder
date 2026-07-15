# Application Modes

BirdCoder keeps one renderer and project service model while separating
delivery topology, IAM deployment binding, and device-local folder capability.

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

## Project And Folder Modes

The remote Project always remains server metadata with an opaque id. Browser
and Tauri may bind that id to a folder on the current device, but the binding
never becomes a server path or remote project field.

- Browser uses a `FileSystemDirectoryHandle` stored with IndexedDB structured
  cloning. Recovery checks permission without prompting; denied permission
  requires explicit rebind.
- Tauri keeps the native path in its host-private local-store SQLite KV
  registry. The record is scoped to the active IAM tenant, organization, user,
  realm, and project, and is plaintext at rest.
- A remote `server` or `cloud` deployment receives neither kind of mount. It
  derives server-owned storage from trusted authorization context.

`BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT` is a local development bootstrap
option only. It is not a remote project API field or a server workspace root.
