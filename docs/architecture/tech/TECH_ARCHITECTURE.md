# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `DESKTOP_APP_ARCHITECTURE_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `API_SPEC.md`, `CONFIG_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`

## 1. Architecture Overview

BirdCoder has one PC React renderer and one application-service model. Browser
and Tauri differ only at the host-capability boundary; they do not fork project
contracts, API clients, or feature services.

```text
Browser or Tauri renderer
  -> PC React features and application services
  -> Project service -> composed @sdkwork/birdcoder-app-sdk -> BirdCoder server
  -> Runtime file-system service -> Browser or Tauri device adapter

BirdCoder server
  -> authenticated project/workspace metadata and authorization
  -> server-derived private workspace root when server-owned storage is needed
  -> no client path, browser handle, or Tauri mount value
```

The persistent boundary is deliberately split:

| Concept | Owner | May cross the network? | Meaning |
| --- | --- | --- | --- |
| Remote Project | BirdCoder server | Yes, through the composed app SDK | Metadata, ACL, workspace identity, lifecycle state, and opaque project id. |
| Device-private Project Mount | Current browser or Tauri device | No | A user-selected local folder capability for local IDE operations. |
| Server Project Workspace Root | BirdCoder server | No | A server-private location derived from authenticated scope and opaque server identifiers. |
| Execution location | Session admission | Yes, as a capability choice | `local-host` or a future isolated remote runner; it is not a deployment profile. |
| Deployment profile | Deployment configuration | Yes, as public non-secret configuration | `standalone` or `cloud`, with a separate runtime target. |

`rootPath`, `sitePath`, native absolute paths, browser handles, and server
workspace roots are not remote-project fields. A local folder is not a portable
project identity and never becomes an implicit upload, remote filesystem, or
server working directory.

## 2. Current Implementation Truth

| Capability | State | Production truth |
| --- | --- | --- |
| Browser and Tauri project control plane | Implemented | Both use the composed BirdCoder app SDK and the same project service contract. |
| Device-private project mounts | Implemented | Browser handles remain in IndexedDB; Tauri paths remain in host-private SQLite and are never remote project fields. |
| SQLite standalone persistence | Implemented | Generated SQLite DDL includes inline foreign keys and runtime connections enable foreign-key enforcement. SQLite remains single-node storage. |
| PostgreSQL control-plane persistence | Implemented, release-gated | Production repositories use SQLx `AnyPool`; CI live smoke covers generated DDL, repository pagination and scope, transactions, and foreign keys against PostgreSQL. |
| Multi-replica realtime and rate limiting | Implemented, profile-gated | The HA values profile requires Redis for realtime and shared rate-limit counters; Redis failures fail closed for protected commerce traffic. |
| Cloud execution | Blocked | No production remote runner is enabled. Remote execution remains unavailable until isolation, scheduling, recovery, and capacity evidence pass review. |
| Public commercial release | Blocked | All four application manifests remain `DRAFT` and `preLaunch`; real signed artifacts, checksums, SBOM, rollback, and capacity evidence are required. |

HTTP OpenAPI and route-catalog counts describe contract coverage only. synthetic smoke fixtures are contract evidence only; they are not installed-runtime, capacity, security, or release-artifact evidence.

## 3. Unified Renderer And Host Capabilities

The renderer calls narrow application ports instead of platform APIs directly.
Project data flows through the app service and the composed
`@sdkwork/birdcoder-app-sdk`; file operations flow through
`RuntimeFileSystemService`. The host adapter is selected at runtime:

| Host | Local-folder capability | Durable mount record | Recovery behavior |
| --- | --- | --- | --- |
| Browser | File System Access API `FileSystemDirectoryHandle` | IndexedDB structured clone | Read the saved handle, call `queryPermission({ mode: 'readwrite' })`, and restore only when granted. |
| Tauri | Authorized native directory bridge | Host-private `local_store_*` SQLite KV | Resolve the host-local record and remount through the native bridge. |

Browser persistence never serializes a handle to JSON and never invents a
native path. Permission recovery does not call `requestPermission`; the user
must explicitly reauthorize or select a folder again when the browser reports
that permission is unavailable.

Tauri stores an absolute path only inside the host-private local-store SQLite
KV database. The record is scoped by a hash of the deployment realm, tenant,
organization, user, and project id. It is private to the operating-system
account and logically isolated by the active IAM scope, but it is plaintext
data at rest. BirdCoder does not claim encryption at rest for this store. A
future secure-store/keychain-backed design is required before making an
encryption claim.

Only a safe mount status and display name leave the mount registry. Paths and
handles are excluded from React state intended for project metadata, SDK/API
DTOs, telemetry, remote caches, and server logs. A session, tenant,
organization, or user change clears in-memory mounts, watchers, pollers, and
file caches before a new subject can use the file-system service.

## 4. Project, API, And Server Ownership

Remote project operations use the generated BirdCoder app SDK through the
composed consumer facade. SDK construction stays in bootstrap, and feature
services do not construct raw HTTP requests or manually attach credentials.
SDKWork-owned API operations use the standard response envelope and typed
problem details described by `API_SPEC.md`.

The server authorizes every remote project and workspace operation with the
typed IAM context. Tenant, organization, user/membership, workspace, project,
and worktree identifiers are authorization inputs; a request-supplied path is
not. When a server operation needs storage, it derives a private root from
that context and server-issued identifiers under the configured server-owned
workspace root. It does not accept, return, or log a client filesystem path.

`SDKWORK_APP_ROOT` or `SDKWORK_BIRDCODER_APP_ROOT` selects the BirdCoder
application profile. `SDKWORK_IAM_APP_ROOT` remains the sibling `sdkwork-iam` catalog/database-assets root; it is never a BirdCoder profile root or project workspace root.

This prevents two common errors:

- a browser directory handle being mistaken for a server filesystem location;
- a Tauri device path leaking into another device, user, project mirror, SDK
  response, or server process.

## 5. Isolation And Runtime Truth

Remote users have independent project metadata authorization and must have
independent server workspace and runtime bindings. A server-owned workspace
root is not a shared client mount: its layout, ACLs, process credentials,
temporary files, provider state, and logs must be derived from the authorized
tenant/organization/user/workspace/project binding. User-controlled path
segments and process-current-directory fallbacks are prohibited.

`SDKWORK_BIRDCODER_PROVIDER_RUNNER_ROOT` identifies a server-owned project
workspace base. It is not a client-mount import channel and does not enable
remote arbitrary-code execution. Current server configuration deliberately
reports code execution as unavailable for production remote `server` and
`container` targets, and for the `cloud` profile. A remote execution feature
may be enabled only after a durable scheduler, authorized runner lifecycle,
strong isolation, secret boundary, resource limits, and recovery evidence are
implemented. Until then, remote file, terminal, run, and deployment actions
must return a typed unavailable outcome rather than falling back to a process
directory or another user's storage.

## 6. Runtime Packaging And Readiness

| Package or runtime | Readiness | Required promotion evidence |
| --- | --- | --- |
| Browser bundle | Pre-launch | Production build, SDK contract tests, browser recovery tests, checksum, SBOM, and smoke evidence. |
| Windows Tauri desktop | Pre-launch | Signed installer, trust verification, mount isolation, local terminal limits, upgrade, and rollback smoke. |
| Standalone server | Pre-launch | Generated OpenAPI parity, SQLite and PostgreSQL repository tests, backup/restore, security, and sustained-load evidence. |
| Kubernetes HA control plane | Pre-launch | PostgreSQL and Redis failover, three-replica smoke, HPA/PDB behavior, immutable image digest, backup restore, and capacity evidence. |
| Cloud execution | Blocked | Isolated runner, durable scheduler, resource quotas, secret brokering, recovery, and abuse testing. |

Default Kubernetes values intentionally run one control-plane replica. Scale-out
requires `values-postgresql-ha.yaml`, external PostgreSQL and Redis, protected
secrets, and successful target-environment live smokes. A route being present in
OpenAPI does not enable a blocked runtime capability.

## 7. Deployment And Runtime Topology

| Deployment | Runtime target | Supported responsibility | Execution truth |
| --- | --- | --- | --- |
| Windows local IDE | `standalone` + `desktop` | Tauri host, same renderer, device-private folder mount, embedded local services | Local-host operations are bounded by the selected local mount. |
| Browser IDE against a private server | `standalone` + `server` | Remote project metadata/control plane and browser-local folder capabilities | The server must not execute against a client folder; remote execution is unavailable. |
| Tauri IDE against a private server | `standalone` + `server` | Same remote project/control-plane API plus a device-private Tauri mount | The desktop path stays on the device and is never sent to the server. |
| Remote cloud control plane | `cloud` + `server` or `container` | Authenticated metadata/control-plane deployment with PostgreSQL and explicit origins | A cloud runner is not currently enabled; no encrypted-workspace claim is made. |

`standalone` and `cloud` are the only deployment profiles. `browser`,
`desktop`, `server`, and `container` are runtime targets, not additional
profiles. Cloud validation requires a non-loopback bind, explicit non-wildcard
origins, PostgreSQL, and a protected database URL. Detailed operator steps are
in [deployment operations](../../guides/operator/deployment-operations.md) and
the [Windows Server guide](../../guides/operator/windows-server-control-plane.md).

## 8. Security And Privacy

- Backend authorization, not client UI state, enforces tenant, organization,
  membership, project, and workspace isolation.
- Device mount paths, browser handles, credentials, server roots, and runtime
  secrets are not API response fields and must be redacted from diagnostics.
- Browser and Tauri use the same IAM session model, but local mount recovery is
  scoped to the active authenticated subject and deployment realm.
- Browser-visible `VITE_*` configuration is public configuration only. Database
  URLs, tokens, private keys, and provider credentials belong in protected
  server or host storage.
- CORS origins are explicit in remote deployments; wildcard origins are not a
  cloud configuration option.

## 9. Architecture Decision Index

- [ADR-20260713: Unified project/runtime boundary](../decisions/ADR-20260713-unified-project-runtime-boundary.md)
- [Runtime topology contract](../topology-standard.md)
- [Environment reference](../../reference/environment.md)

## 10. Verification

```bash
pnpm.cmd check:file-system-boundary
pnpm.cmd check:project-inventory-standard
pnpm.cmd check:desktop
pnpm.cmd check:server
pnpm.cmd check:multi-mode
node ..\sdkwork-specs\tools\check-repository-docs-standard.mjs --root . --profile application
pnpm.cmd docs:build
```

The API/SDK checks required by `API_SPEC.md` and
`APP_SDK_INTEGRATION_SPEC.md` remain release gates whenever remote project
contracts or client service integration change.
