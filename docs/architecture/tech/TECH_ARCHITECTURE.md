# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-22
Specs: ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, API_SPEC.md, DATABASE_SPEC.md, SDK_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, CONFIG_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, DEPLOYMENT_SPEC.md

## 1. Architecture Overview

BirdCoder is the coding-workbench application, not a multi-domain platform
monolith. Browser and Tauri differ at the host-capability boundary, while the
workbench owns only workspace, project, runtime-location, document-binding,
and sandbox-binding facts. Agents (`sdkwork-agents`), Skills (`sdkwork-skills`),
Prompts, IM (`sdkwork-im`), IAM, Documents, Deployments, Models, Settings, and
commerce capabilities remain independent systems of record and are integrated
through their canonical SDK families and declared runtime ports.

BirdCoder runtime profiles resolve from `SDKWORK_APP_ROOT` or
`SDKWORK_BIRDCODER_APP_ROOT`. `SDKWORK_IAM_APP_ROOT` remains the sibling `sdkwork-iam` catalog/database-assets root
and must never be selected as the BirdCoder application root.

Flow:

    Browser, Tauri, H5, or Flutter client
      -> feature service or host capability port
      -> runtime-composed owner SDK clients
      -> BirdCoder workbench API or dependency-owned API
      -> owning application service and repository

    BirdCoder workbench
      -> Workspace and Project identity
      -> default Agents Project stable id
      -> ProjectRuntimeLocation with encrypted target paths
      -> project-to-Document and project-to-Sandbox stable bindings
      -> internal target resolver for verified host actions

One Project can have multiple ProjectRuntimeLocation records. A location is
the only persistent authority for one physical project root on one target.
Project identity is deliberately not overloaded with a single path.

| Concept | Owner | Network behavior | Meaning |
| --- | --- | --- | --- |
| Project | Project service | Normal app API and composed SDK | Shared identity, workspace, ACL, lifecycle, and non-location metadata. |
| Agent Project | Agents | Agents App SDK | Root for Sessions, Turns, Session Items, Interactions, artifacts, checkpoints, and execution policy. BirdCoder stores only its stable project id. |
| ProjectRuntimeLocation | Project service | Separate, permissioned app API resources | One target-specific root, location kind, encrypted path, capability, health, Git snapshot, and audit state. |
| Runtime target | Runtime control plane | Registered target identity and internal resolver | Desktop, server workspace, runner, container, or remote workspace authority that verifies and uses a location. |
| Local project binding | Browser or Tauri host | Never a generic remote API response | Current-device capability material used to resolve a browser handle or local native root. |
| Location preference | Project service | Permissioned app API resource | Subject, project, and capability selection for terminal, Git, or build. |
| Deployment profile | Deployment configuration | Public non-secret configuration | standalone or cloud, independent from a runtime location. |

Absolute paths are neither generic Project fields nor public response values.
Registration receives a typed write-only path over protected transport; the
control plane encrypts it before persistence. Only the authenticated owning
target can decrypt and canonicalize it for an authorized action.

### Agent Session Lifecycle Boundary

All AI coding and assistant workflows use the Agents aggregate:

    Agent Project -> Session -> Turn -> Session Item -> Interaction

BirdCoder creates or selects an Agent Project through the Agents App SDK and
stores only that project's stable `projectId` on the workbench
Project. Agents owns the Session id, immutable provider/model binding, provider
native-session identity, runtime-location binding, turn lease and idempotency,
Session Items, interactions, artifacts, checkpoints, and replayable outcomes.
BirdCoder does not create another session identifier or persist a transcript
copy.

The P0 provider set remains `codex`, `claude-code`, `gemini`, and `opencode`.
Provider SDKs are called only behind Agents and Kernel adapters. A new Session
requires an explicit terminal-capable BirdCoder `runtimeLocationId`; Agents
stores that stable cross-domain reference and calls the authorized BirdCoder
runtime-location port when execution needs a target root. It never receives a
plaintext root through a public DTO. Provider-reported CWD remains target-private
matching evidence and is not an execution authority.

AI assistant content is modeled exclusively as Agents Session Items within the
Session/Turn/Interaction lifecycle. Human communication uses IM Conversation,
Message, Member, and ReadCursor semantics. IM may invoke Agents through its
public contract, while Agents never depends on IM. The two domains share stable
correlation identifiers only; neither stores or synchronizes the other's facts.

## 2. Current Implementation Truth

| Capability | State | Production truth |
| --- | --- | --- |
| Domain ownership | Canonical and enforced | `specs/domain-ownership.spec.json` defines the ten-table workbench store and owner-only API boundary. BirdCoder contains no dependency-owned persistence or API authority. |
| Agents session authority | Canonical and enforced | Agents is the only system of record for AI Sessions, Turns, Session Items, Interactions, artifacts, checkpoints, and provider runtime bindings. |
| Skills authority | Canonical and enforced | Skills is the only system of record for skill packages, immutable artifacts, normalized capabilities, and installations. |
| Human IM boundary | Canonical and enforced | IM Conversation/Message facts are separate from Agent Session Items. Each fact has one owner and no synchronized persistent copy. |
| Browser and Tauri project control plane | Implemented | Both use the composed BirdCoder app SDK and the same project service contract. |
| Browser folder capability | Implemented | File System Access directory handles remain in IndexedDB and cannot become OS paths or remote executable locations. |
| Tauri local binding | Implemented | Host-private storage is current-device capability material. Import and terminal resolution use runtime-location identity and never use process-CWD fallback. |
| Distributed ProjectRuntimeLocation data model | Implemented | The server-owned location model is the only distributed location authority; project-only paths and local-KV-only authority are absent. Location responses remain redacted. |
| Server and runner target resolver | Fail-closed | Supported server actions require a verified target-owned location. Isolated runner execution remains unavailable until separately promoted with isolation and capacity evidence. |
| SQLite standalone persistence | Implemented | Generated SQLite DDL includes foreign keys and runtime connections enable foreign-key enforcement. SQLite remains single-node storage. |
| PostgreSQL control-plane persistence | Implemented, release-gated | The canonical process `DatabasePool` dispatches to typed SQLx `PgPool` repositories; live smoke covers schema, pagination, scope, transactions, and foreign keys. |
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

BirdCoder owns one App API authority for workbench-specific workspace, project,
runtime-location, sandbox-binding, Git/host coordination, and system descriptor
operations. It owns no Backend API or Open API operations. IAM, Agents, Skills,
IM, Documents, Deployments, Models, Settings, and commerce operations remain in
their owner OpenAPI authorities and SDK families even when a standalone
BirdCoder process embeds their executable route assemblies.

The current machine-contract snapshot is 10 BirdCoder tables, 39 App API
operations, 0 Backend API operations, 0 Open API operations, and 33 BirdCoder
IAM permissions. The authoritative inventories remain
`specs/domain-ownership.spec.json`, the BirdCoder App API OpenAPI document, and
`specs/iam.module.manifest.json`; this document does not duplicate their item
lists.

Dependency SDK consumption, runtime mounting, and API ownership are separate
facts. A dependency may be mounted by the standalone runtime without appearing
in the BirdCoder-generated SDK. Feature packages receive owner clients or
service ports from runtime/core composition; they do not use raw HTTP, manual
auth headers, generated transport internals, or copied DTOs.

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
Agents execution follows the same rule through its immutable Session binding.
Worktree uses the Git capability rather than a separate
preference. Generic Project-only root resolution and process-current-directory
fallback are prohibited. An unsupported action fails closed rather than
inferring a root.

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

## 6. Canonical Ownership And Dependency Direction

| Capability | System of record | BirdCoder integration |
| --- | --- | --- |
| Workspace, Project, Document Binding, Runtime Location, Sandbox Binding, and Git orchestration | BirdCoder coding workbench | BirdCoder App SDK and the ten-table workbench store. |
| Agent Project, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, and Checkpoint | Agents | Agents App SDK; BirdCoder stores only the stable Agent Project reference. |
| Skill package, version, artifact, capability, installation, and execution metadata | Skills | Skills App SDK. |
| Saved Prompt identity, content, and lifecycle | Prompts | Prompts App SDK. |
| Document identity and content | Documents | Documents App SDK; BirdCoder stores only a stable document binding. |
| Human Conversation, Message, Member, and ReadCursor | IM | IM SDK; AI Session Items never enter IM persistence. |
| Authentication, authorization, tenancy, organization, and audit | IAM | IAM SDK/runtime and the application TokenManager. |

BirdCoder has no persistent cross-domain read model. Online reads query the
canonical owner through its generated SDK and use bounded owner-side indexes
and pagination. UI adaptation is process-memory presentation state only and is
discarded on reload. Cross-domain links are stable opaque identifiers without
shared tables, cross-domain foreign keys, copied OpenAPI, handwritten HTTP,
manual authentication headers, synchronized caches, compatibility facades, or
multiple write paths. Generated SDK output is rebuilt from the owner OpenAPI
authority and is never hand-edited.

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

- [ADR-20260722: Domain ownership and single-write authority](../decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260716: Distributed project runtime locations](../decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [ADR-20260719: Repository pool driver closure](../decisions/ADR-20260719-birdcoder-repository-pool-driver-migration.md)
- [Runtime topology contract](../topology-standard.md)
- [Environment reference](../../reference/environment.md)

## 10. Verification

    pnpm check:domain-ownership
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
