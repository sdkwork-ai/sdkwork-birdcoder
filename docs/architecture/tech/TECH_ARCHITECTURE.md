# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, API_SPEC.md, DATABASE_SPEC.md, SDK_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, CONFIG_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, DEPLOYMENT_SPEC.md

## 1. Architecture Overview

BirdCoder has one PC React renderer and one application-service model. Browser
and Tauri differ at the host-capability boundary, while projects, locations,
authorization, and API contracts remain a single application model.

BirdCoder runtime profiles resolve from `SDKWORK_APP_ROOT` or
`SDKWORK_BIRDCODER_APP_ROOT`. `SDKWORK_IAM_APP_ROOT` remains the sibling `sdkwork-iam` catalog/database-assets root
and must never be selected as the BirdCoder application root.

Flow:

    Browser or Tauri renderer
      -> PC features and application services
      -> composed @sdkwork/birdcoder-app-sdk
      -> Project service and ProjectRuntimeLocation service
      -> target-aware resolver or host capability adapter

    BirdCoder control plane
      -> authenticated Project and workspace metadata
      -> ProjectRuntimeLocation records with encrypted target paths
      -> target identity, health, capability, Git snapshot, and preference state
      -> internal target resolver for verified server or runner actions

One Project can have multiple ProjectRuntimeLocation records. A location is
the only persistent authority for one physical project root on one target.
Project identity is deliberately not overloaded with a single path.

| Concept | Owner | Network behavior | Meaning |
| --- | --- | --- | --- |
| Project | Project service | Normal app API and composed SDK | Shared identity, workspace, ACL, lifecycle, and non-location metadata. |
| ProjectRuntimeLocation | Project service | Separate, permissioned app API resources | One target-specific root, location kind, encrypted path, capability, health, Git snapshot, and audit state. |
| Runtime target | Runtime control plane | Registered target identity and internal resolver | Desktop, server workspace, runner, container, or remote workspace authority that verifies and uses a location. |
| Local project binding | Browser or Tauri host | Never a generic remote API response | Current-device capability material used to resolve a browser handle or local native root. |
| Location preference | Project service | Permissioned app API resource | Subject, project, and capability selection for terminal, Git, or build. |
| Deployment profile | Deployment configuration | Public non-secret configuration | standalone or cloud, independent from a runtime location. |

Absolute paths are neither generic Project fields nor public response values.
Registration receives a typed write-only path over protected transport; the
control plane encrypts it before persistence. Only the authenticated owning
target can decrypt and canonicalize it for an authorized action.

### Coding-Session Lifecycle Boundary

Coding turns execute through the SDKWork kernel facade and the BirdCoder kernel
bridge; application code does not call Provider SDKs directly. The P0 provider
set is `codex`, `claude-code`, `gemini`, and `opencode`. A new logical coding
session is created from an explicit provider/model selection, whose resulting
`engineId` and `modelId` are immutable.

`codingSessionId` is the BirdCoder logical identity. The first successful turn
may return a raw provider `nativeSessionId`; later native detail/resume work
uses that raw ID plus the persisted `engineId`, and the binding cannot be
reassigned to a different provider conversation. The detailed ownership and
current implementation limits are documented in the
[engine session reference](../../reference/engine-sdk-integration.md).

New coding-session creation also requires an explicit terminal-capable
`runtimeLocationId`. The logical session persists that exact location identity
alongside its immutable provider/model pair. Turn execution, recovery, and
native-session list/detail routes use the stored binding, not a mutable
current-subject preference or a project-only root lookup. Historic sessions
without this binding remain readable but fail closed with typed unavailable
errors for execution and native discovery. Provider-reported `native_cwd` is
target-private matching evidence only; it is never public API data or an
execution authority.

## 2. Current Implementation Truth

| Capability | State | Production truth |
| --- | --- | --- |
| Browser and Tauri project control plane | Implemented | Both use the composed BirdCoder app SDK and the same project service contract. |
| Browser folder capability | Implemented | File System Access directory handles remain in IndexedDB and cannot become OS paths or remote executable locations. |
| Tauri local binding | Implemented and converging | Host-private storage remains the current-device capability cache; import and terminal resolution must converge on runtime-location identity and never use process cwd fallback. |
| Distributed ProjectRuntimeLocation data model | In progress | The server-owned location model supersedes project-only paths and local-KV-only path authority. Location responses remain redacted. |
| Server and runner target resolver | In progress | A pending or unverified record does not authorize remote terminal, Git, build, worktree, file, or deployment actions. |
| SQLite standalone persistence | Implemented | Generated SQLite DDL includes foreign keys and runtime connections enable foreign-key enforcement. SQLite remains single-node storage. |
| PostgreSQL control-plane persistence | Implemented, release-gated | Production repositories use SQLx AnyPool; live smoke covers schema, pagination, scope, transactions, and foreign keys. |
| Multi-replica realtime and rate limiting | Implemented, profile-gated | HA configuration requires Redis for realtime and shared rate-limit counters. |
| Cloud execution | Blocked | No production remote runner is enabled until isolation, scheduling, recovery, and capacity evidence pass review. |
| Public commercial release | Blocked | Application manifests remain draft and pre-launch until real signed artifacts, checksums, SBOM, rollback, and capacity evidence exist. |

HTTP OpenAPI and route-catalog counts describe contract coverage only. Synthetic
smoke fixtures are not installed-runtime, capacity, security, or
release-artifact evidence.

## 3. Location Data And Lifecycle

The durable data relationship is:

    Project
      -> ProjectRuntimeLocation [0..n]
           -> runtime target or device identity
           -> encrypted absolute path and stable fingerprint
           -> verified Git and worktree snapshot
           -> capability and health state
      -> ProjectRuntimeLocationPreference [0..n]
           -> subject + capability -> runtimeLocationId

ProjectRuntimeLocation must carry the complete data required to identify one
root while preserving confidentiality:

- tenant, organization, project, owner/data-scope, and target identity;
- location kind, path flavor, logical root locator, safe display name, and
  stable path fingerprint;
- encrypted absolute path with encryption/key-version metadata;
- lifecycle, health, verification time, version, audit, and deletion state;
- capability status for terminal, Git, build, and file-system operations;
- worktree actions and snapshots derive from the Git capability; worktree is
  not a separate runtime-location capability or preference;
- credential-free Git remote identity plus verified branch, revision, and
  worktree snapshot.

Core query, authorization, lifecycle, and capability fields are relational
columns. They are not hidden in generic JSON metadata. Tenant-leading indexes
serve location list, preference, target-health, and duplicate-detection query
shapes. Every interactive list is SQL-paginated.

Path lifecycle is explicit:

1. Registration accepts a write-only absolute path from an authenticated
   desktop or trusted target and stores ciphertext.
2. The record begins pending verification. It cannot authorize remote
   execution solely because a path was registered.
3. The owning target proves its identity, canonicalizes the root, checks
   capability and repository state, then writes safe verification metadata.
4. Rebind replaces a root only through an explicit operation. It clears stale
   verification and Git snapshot state before the new root can be used.
5. Revoke, detach, or delete removes the location from preference resolution
   and preserves the audit/lifecycle policy.

## 4. API, SDK, And Resolver Ownership

The workspace app-api owns project runtime-location resources. It uses typed
request bodies, standard SDKWork envelopes, ProblemDetail failures, SQL-backed
pagination, stable permissions, idempotency for registration and commands, and
optimistic concurrency for mutable location and preference state.

Flow:

    Tauri import
      -> typed write-only location registration
      -> encrypted server persistence
      -> current-device local binding
      -> pending verification

    Desktop terminal
      -> project and terminal capability
      -> local runtime-location resolver
      -> current-device native binding
      -> canonical local cwd
      -> terminal request

    Server or runner action
      -> project + runtimeLocationId
      -> project ACL + target binding + capability + health check
      -> internal target-owned decrypt and canonical-root resolver
      -> Git, build, worktree, or file action

Location list and detail DTOs return safe identifiers, labels, target metadata,
capabilities, health, and verified Git summary. They never return plaintext
absolutePath, cwd, rootPath, sitePath, browser handles, secrets, or
credential-bearing remote URLs. The generated app SDK unwraps the standard
response data and is consumed only through the composed
@sdkwork/birdcoder-app-sdk facade.

Every terminal, Git (including worktree), build, and file-system execution
request must carry an explicit `runtimeLocationId` before touching a
filesystem. A subject-and-capability preference may help a client choose a
location, but it must be resolved into and persisted or sent as an exact
identifier before execution; it is never a hidden server root fallback.
Coding-session/provider execution follows the same rule through its immutable
session binding. Worktree uses the Git capability rather than a separate
preference. Generic Project-only root resolution and process-current-directory
fallback are prohibited. Until an action is migrated, it must fail closed rather
than infer a root.

## 5. Browser And Desktop Host Capabilities

The renderer calls narrow application ports rather than platform APIs
directly. Project and runtime-location data flow through injected services and
the composed app SDK. Filesystem operations flow through a host adapter.

| Host | Local capability | Durable local binding | Runtime-location behavior |
| --- | --- | --- | --- |
| Browser | File System Access API directory handle | IndexedDB structured clone | A handle remains browser-local, requires permission recovery, and cannot become a native path or executable target. |
| Tauri | Authorized native directory bridge | Host-private local-store record scoped to active subject and project | The adapter resolves the current-device canonical cwd for local actions and associates it with runtime-location semantics without requesting a server path reveal. |
| Server or container | Future service-owned workspace and target resolver | Managed database and protected runtime storage | Not enabled in the current release: a configured workspace base is not enrollment. A future target may resolve only its own verified location through an internal, authenticated resolver. |
| Isolated runner | Runner agent and workspace volume | Managed runner control-plane state | Not enabled until runner isolation and lifecycle evidence are accepted. |

Tauri local storage can retain an OS-private path binding for native access, but
it is a cache/capability materialization, not the distributed system of record.
The server record is the location authority; the target binding is still
required to prove that the current device owns the canonical path. A local
persist failure must fail import rather than leave restart-unsafe state.

## 6. Legacy Path Convergence

The following are migration inputs, not long-term competing authorities:

| Legacy source | Target authority |
| --- | --- |
| studio_project.site_path | Retired field; do not reuse. |
| Tauri local-store path record | Current-device binding associated with a runtime location. |
| Server-derived ProjectWorkspaceRootResolver | Retired as an implicit execution source. Server-workspace enrollment and a trusted target-owned resolver are pending; current server actions fail closed. |
| Coding-session config rootPath or root_path | Retired as execution input; new sessions persist runtimeLocationId, while historic unbound sessions are readable but non-executable. |
| Provider native-session cwd | Target-private observation for scoped matching only; never generic project metadata, public API data, or execution authority. |
| Project-only Git root resolution | Location-aware Git resolver with explicit runtimeLocationId. |

BirdCoder is pre-launch. It removes obsolete public path behavior directly,
while any durable data backfill remains idempotent, observable, bounded, and
safe to retry. No generated SDK output is hand-edited; OpenAPI and route
authority changes are regenerated through the standard SDK workflow.

## 7. Isolation, Security, Privacy, And Observability

- Backend authorization, not UI state, enforces tenant, organization,
  membership, project, subject, target, capability, and location isolation.
- Absolute paths and path-derived host topology are sensitive data. They are
  encrypted at rest, write-only at the app API edge, masked from exports, and
  absent from normal logs, traces, errors, metrics, and audit payloads.
- A target never trusts a renderer-supplied filesystem path. It resolves its
  registered runtimeLocationId, verifies target ownership and lease, and
  canonicalizes before use.
- Git credentials, tokens, private keys, and credential-bearing remote URLs
  are never persisted in location snapshots or returned to clients.
- Security-sensitive registration, rebind, verification, preference, and
  target lifecycle actions require permission checks, audit, and appropriate
  rate-limit/idempotency behavior.
- Diagnostics use traceId, locationId, projectId, and safe target identifiers.
  They do not use plaintext paths as labels or high-cardinality metric values.

## 8. Deployment And Runtime Topology

| Deployment | Runtime target | Location behavior | Execution truth |
| --- | --- | --- | --- |
| Windows local IDE | standalone + desktop | Tauri creates a desktop location and a current-device local binding. | Local actions use the canonical local binding only. |
| Browser IDE against a private server | standalone + server | Browser handles remain local; server locations belong to trusted server targets. | Browser cannot create a native path or remote execution grant. |
| Tauri IDE against a private server | standalone + server | Desktop registration persists an encrypted location plus local binding. | The desktop does not receive server path reveals; server actions require target resolver evidence. |
| Remote cloud control plane | cloud + server or container | Locations are tenant-scoped control-plane records tied to trusted server/runner targets. | A cloud runner remains unavailable until separately promoted. |

standalone and cloud are the only deployment profiles. browser, desktop,
server, and container are runtime targets, not profiles.

## 9. Architecture Decision Index

- [ADR-20260716: Distributed project runtime locations](../decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [ADR-20260713: Unified project/runtime boundary (superseded)](../decisions/ADR-20260713-unified-project-runtime-boundary.md)
- [Runtime topology contract](../topology-standard.md)
- [Environment reference](../../reference/environment.md)

## 10. Verification

    pnpm db:validate
    pnpm test:migration-replay
    pnpm test:rust-workspace-project-schema-parity-contract
    pnpm check:web-framework-standard
    pnpm sdk:generate
    node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
    node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
    node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
    node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
    pnpm check:terminal-surface-standard
    pnpm check:project-git-header-controls
    pnpm check:desktop
    pnpm check:server
    pnpm check:multi-mode
    node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
    pnpm docs:build
