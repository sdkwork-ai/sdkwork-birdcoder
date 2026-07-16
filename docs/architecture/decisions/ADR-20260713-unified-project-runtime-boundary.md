# ADR-20260713-unified-project-runtime-boundary

Status: superseded by [ADR-20260716: Distributed project runtime locations](ADR-20260716-distributed-project-runtime-locations.md)
Owner: SDKWork maintainers
Date: 2026-07-13
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `API_SPEC.md`, `SECURITY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`

## Context

The browser, Tauri desktop host, and remote server previously allowed one
project concept to carry unrelated meanings: remote project metadata, a
client-local path, a browser directory handle, and a server working directory.
That leaks device paths into remote contracts, makes browser imports look like
server files, and prevents the server from deriving an isolated project root.

Cloud execution and project publishing also lacked the durable scheduler,
strong runner isolation, and deployment executor required to make those claims
safe.

## Decision

BirdCoder uses the following independent concepts:

| Concept | Owner | Boundary |
| --- | --- | --- |
| Project | Server | Tenant/user/workspace-scoped metadata, ACL, source identity, and opaque project id. It never stores a client path. |
| ClientMount | Browser or Tauri device | Browser `FileSystemDirectoryHandle` with permission state, or a Tauri-authorized native directory path. It is never sent through an SDK, API request, API response, telemetry, remote cache, or server log. |
| ProjectWorkspaceRoot | Server | Private path derived from authenticated tenant/user/workspace context and server-issued identifiers. It is never returned by an API. |
| ExecutionLocation | Session admission | `local-host` or `cloud-workspace`, independent from the deployment profile. Current remote execution is unavailable until an isolated runner exists. |
| DeploymentProfile | Deployment | `standalone` or `cloud`; runtime target is separately `browser`, `desktop`, `server`, or `container`. |

Browser folder access uses the File System Access API. A restored handle is
stored only through IndexedDB structured cloning, then checked with
`queryPermission({ mode: 'readwrite' })`; recovery never calls
`requestPermission` automatically. A denied or unavailable permission requires
an explicit user reauthorization or rebind, and the browser never fabricates a
local path.

Tauri keeps a native path only in the host-private `local_store_*` SQLite KV
store. The record key is scoped by a hash of deployment realm, tenant,
organization, user, and project. That scope keeps records out of other active
subjects, but the SQLite value is plaintext at rest; this decision does not
claim encryption. Neither device capability is serialized into a remote project
request.

Remote projects use server-derived roots beneath the configured server project
workspace root. Tenant, organization, user, workspace, project, Git worktree,
and future execution state stay isolated. Cloud code execution and actual
project deployment return a typed unavailable result until the durable,
strongly isolated runner and deployment executor have evidence.

## Alternatives

| Alternative | Decision |
| --- | --- |
| Store a local path on the Project record | Rejected. It exposes device topology and is meaningless in browsers or other devices. |
| Treat browser handles as server paths | Rejected. Browser handles are capability objects, not portable filesystem identifiers. |
| Fall back from a remote project to the local process cwd | Rejected. It crosses user/device boundaries and can execute against an unintended directory. |
| Accept cloud execution or publish requests before an isolated runner/executor exists | Rejected. Metadata-only success would misrepresent delivery and weaken containment. |

## Consequences

- Browser and Tauri share project metadata and SDK contracts while keeping
  mount implementation in host adapters.
- Import, Git, and upload server workflows use server-owned roots only.
- Operators must configure a private server workspace root and access controls
  separately from PostgreSQL metadata storage.
- Existing pre-launch path-bearing public fields are intentionally removed;
  there is no compatibility bridge for client-local filesystem paths.
- Mount recovery exposes only a safe display name and mount status to product
  UI state. It does not expose a browser handle or native absolute path.
- Remote terminal, filesystem, run, cloud execution, and project deployment
  surfaces remain explicitly unavailable until their server-side capability is
  implemented and verified.

## Verification

- Project API/OpenAPI/SDK contract checks reject client root/site path fields.
- Client mount tests distinguish selected, cancelled, unsupported, permission
  recovery, and explicit rebinding outcomes.
- Repository tests verify server roots are derived from authenticated context
  and opaque identifiers, not request paths.
- Runtime admission and deployment service tests return typed unavailable
  results before a cloud runner or deployment executor is available.
- `pnpm check:multi-mode`, `pnpm check:server`, API envelope checks, and the
  repository documentation gate remain required before release promotion.

## Supersedes / Superseded By

Supersedes undocumented path-carrying project behavior. Superseded by
[ADR-20260716: Distributed project runtime locations](ADR-20260716-distributed-project-runtime-locations.md).
