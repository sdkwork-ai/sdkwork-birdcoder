# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-28
Specs: ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, API_SPEC.md, SDK_SPEC.md, PAGINATION_SPEC.md, FRONTEND_SPEC.md, DATABASE_SPEC.md, SECURITY_SPEC.md, CONFIG_SPEC.md, DEPLOYMENT_SPEC.md

## 1. Architecture Overview

BirdCoder is a stateless coding-workbench composition host. The Rust gateway
owns four System reads and mounts approved dependency assemblies without
claiming their API or data ownership. The PC composition root constructs
generated owner SDK clients with the shared TokenManager and injects them into
feature services.

```text
PC browser/Tauri
  -> feature service or typed host port
  -> generated owner SDK client
  -> BirdCoder System API or dependency-owned API
  -> owning domain service and persistence
```

There is no BirdCoder server business database and no second Workspace,
Project, Session, transcript, or runtime-location aggregate. Canonical Workspace
and Project aggregates live in `sdkwork-agents`. The Agents Session Activity
summary is the canonical cross-application list snapshot; PC consumes it as a
disposable in-memory projection.

## 2. Technology Choices

| Area | Choice | Boundary |
| --- | --- | --- |
| Server | Rust, Axum, composed route assemblies | Stateless BirdCoder System host |
| Desktop | Tauri and Rust host commands | Device-private filesystem, Git, terminal, and device state |
| PC renderer | React and TypeScript package families | UI and in-memory view adaptation |
| Remote integration | Generated SDKWork owner SDKs | No raw HTTP or local generated fork |
| Local persistence | Tauri SQLite and browser capability storage | Device state only, never remote business authority |
| Contracts | Root/module specs, OpenAPI, native manifests | Machine authority; docs are narrative |

## 3. Data And Lifecycle

### Server Data

BirdCoder server business tables: **0**. The Rust gateway has no BirdCoder
database pool, DDL, migration, seed, drift, backup, or restore lifecycle.
Dependency modules retain their own persistence, which is outside this
project's database design.

### PC Device State

The Tauri host owns one local SQLite table:

| Table | Allowed purpose | Forbidden purpose |
| --- | --- | --- |
| `device_state_entry` | Application settings, subject-scoped project device mounts, desktop runtime-location installation identity | Project, Session, Conversation, Message, transcript, Skill, or any server business aggregate |

Its complete physical shape is:

| Column | SQLite type | Constraint |
| --- | --- | --- |
| `scope` | `TEXT` | `NOT NULL` |
| `key` | `TEXT` | `NOT NULL` |
| `value` | `TEXT` | `NOT NULL`, maximum 256 KiB |
| `updated_at` | `TEXT` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` |

The composite primary key is `PRIMARY KEY (scope, key)`. The command layer
and SQLite constraint accept only these scope/key pairs:

| Scope | Key |
| --- | --- |
| `settings` | `app` |
| `project-device-mounts` | a 64-character lowercase SHA-256 digest |
| `desktop-runtime-location-identity` | `installation.v1` |

The file defaults to
`birdcoder-device-state.sqlite3` and may be overridden only for PC/Tauri with
`SDKWORK_BIRDCODER_DEVICE_STATE_FILE`.

Browser directory handles may use browser-local capability storage. They are
not SQL business records and cannot be converted into native or remote paths.

### Domain Facts

| Facts | System of record |
| --- | --- |
| Workspace, Project, composition, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, Checkpoint | `sdkwork-agents` |
| Skill package, version, artifact, capability, installation | `sdkwork-skills` |
| Human Conversation, Message, Member, ReadCursor | `sdkwork-im` |
| Authentication, organization scope, membership, role, permission, audit | `sdkwork-iam` |
| Drive and sandbox data | `sdkwork-drive` |
| Document identity and content | `sdkwork-documents` |

AI assistant content follows the Agents execution lifecycle. IM facts follow
human communication delivery and read-state lifecycles. Similar presentation
does not make the records interchangeable.

## 4. API, SDK, And Rust Composition

The BirdCoder App API owns exactly four operations:

| Resource | Operation |
| --- | --- |
| System descriptor | retrieve |
| System health | retrieve |
| System routes | list |
| System runtime | retrieve |

Backend API and Open API each contain zero BirdCoder operations. The four
matching permissions live in `specs/iam.module.manifest.json`.

The standalone assembly combines the BirdCoder System router with approved
owner assemblies, including Agents. Runtime mounting is executable composition,
not contract ownership. Only the four System operations enter the BirdCoder
OpenAPI and generated App SDK.

The generated client boundary is:

```text
runtime composition
  -> owner SDK client + TokenManager + owner endpoint
  -> feature service/port
  -> UI
```

No layer may substitute raw HTTP, manual auth headers, hand-written envelope
parsing, a copied DTO, or another project's private source.

## 5. Workspace, Project, Composition, And Session Flow

The former BirdCoder Workspace is removed as a local authority. Agents
`AgentWorkspace` and `AgentProject` are the only Workspace and Project
aggregates. IAM organization scope remains authorization context, not a
replacement Workspace identity.

```text
Agents AgentWorkspace (canonical workspaceId; one default per user)
  -> Agents AgentProject (canonical projectId)
       -> composition slots
       -> Session
            -> Turn
            -> Session Item
            -> Interaction
            -> Session Runtime Binding
```

PC ensures, creates, retrieves, lists, renames, archives, and deletes Workspaces
through the Agents App SDK, renders Workspace selection on the left side of the
Header, and lists only Projects in the selected Workspace on its right. The
default Workspace cannot be archived or deleted, and non-default Workspaces
must contain no non-deleted Projects before either transition. PC creates,
imports, lists, updates, archives, and deletes Projects through the same SDK.
Every UI and device-mount reference uses the returned `workspaceId` and
`projectId`; there is no alias, dual ID, or mapping table. Drive sandbox imports
use the Agents Project import command.
Local folder paths and browser handles never cross the PC host boundary.

When a Session needs local execution context:

1. PC resolves the active subject's device mount for the canonical
   `projectId`.
2. PC creates the Agents Session with that same `projectId`.
3. PC creates or resolves the Agents `sessionRuntimeBindings` record using
   the opaque runtime location id from the local host identity.
4. Native paths remain in the Tauri boundary.
5. A missing mount, id, permission, or binding fails closed.

### Session Activity Inbox

The Agents App API operation
`GET /app/v3/api/ai/session_activity_summaries` is the owner-scoped,
cursor-paginated current-state projection for Session lists. Each row composes
the durable Session, latest relevant Turn, deterministic pending Interaction,
current Runtime Binding, owner Session user state, provider session identity,
owner fact versions, freshness, and effective presentation phase. No
server-monotonic aggregate activity revision is assumed. Managed Turn,
Interaction, Runtime Binding, or user-state activity may therefore advance even
when the Session version is unchanged.

```text
Agents Session Activity summary
  -> generated Agents SDK and injected Session service
  -> subject-and-Workspace-scoped workbench coordinator
  -> disposable Projects Store projection
  -> Code and Studio Session lists
```

Every refresh starts with a null cursor and may follow `nextCursor` only for
that bounded traversal. A cursor is not a durable change-feed watermark. Head
eligibility and ordering come from Agents-managed Session, Turn, Interaction,
Runtime Binding, and Session user-state facts. Query-time provider observation
may enrich only rows already selected in the current page; provider-only
activity cannot insert or reorder an old Session at the head. The coordinator
deduplicates subscribers, discards superseded responses, pauses while offline
or hidden, backs off after failure, and refreshes on resume or a scoped
invalidation.

Browser contexts broadcast only
`workspace-session-inbox.invalidate` plus a validated scope key. They never
broadcast Session rows, transcripts, tokens, provider observations, or provider
payloads. Receivers re-read Agents. The Projects Store projection remains
in-memory and is not a persistence or synchronization authority.

Fresh provider evidence may refine the effective phase of a row already
returned by the managed head. It cannot establish head eligibility or replace
the durable lifecycle. Unregistered, unavailable, non-indexable, expired, or
stale evidence fails closed to neutral stale or unknown presentation. File
modification timestamps and static provider history are not live activity. The
workbench materializes finite freshness expiry centrally; it does not assign an
invented TTL to a durable managed Turn that remains running.

Code and Studio render the provider badge as the leftmost visual item and a
present, known runtime-status icon at the far right. `queued` and `running` map
to animated initializing and streaming states. Approval, tool, and user-input
waits are static attention; failed is static failure; stale is static neutral.
Unknown, `null`, or absent runtime status has no label, icon, or reserved slot.
The title truncates in the remaining width. Time or rendered status text is in
an auto-aligned, end-justified trailing metadata region immediately before the
rightmost runtime icon; Studio does not render time beneath the title. Global
views form the complete currently loaded inventory, then filter,
globally sort, and finally render or virtualize. Background synchronization
never replaces an explicit Session selection.

### Provider-Neutral Transcript And Attachments

Codex, Claude Code, OpenCode, and Gemini payloads enter provider adapters and
then one shared Session Item presentation model. React renderers do not read
provider transport DTOs. Turn grouping prefers the canonical `turnId`; fallback
grouping is rendering-only and stays in memory.

```text
File/Image/Audio
  -> Drive App SDK uploader
  -> driveSpaceId + driveNodeId + canonical Drive URI
  -> Agents App SDK Turn driveRefs
  -> canonical Session Item resources
  -> render-time temporary Drive grant
```

Composer `File` objects, object URLs, progress, AbortControllers, and signed
download URLs are transient. Immediate and queued Turn dispatch both preserve
the ordered `driveRefs`; no signed URL is written into Session text or local
device state. Four feature-level upload slots bound simultaneous files while
the Drive SDK owns chunk concurrency.

Provider projections retain at most 32 Session Item resources and 256 file
changes. File-change paths, individual text fields, total retained text,
Restore parsing, and full Diff rendering have shared defensive budgets.
Oversized snapshots are omitted rather than truncated into restorable data.
Transcript synchronization hashes message content into a fixed-size signature
so streaming updates do not retain a second full message copy.

Full Diff review uses a provider-neutral responsive layout resolver. The normal
three-pane layout remains at readable widths; constrained layouts collapse the
file explorer before enforcing a 320-pixel chat column, and critically narrow
layouts hide the chat surface while keeping it mounted so Composer state is
preserved until the Diff closes.

#### Launch Blockers

This consumer architecture is not production-complete until Agents and Kernel
maintainers approve executable evidence for: a bounded indexed PostgreSQL P1
head projection; collision-safe tenant/organization/provider/runtime/provider
Session identity; Project deletion tombstone and pagination semantics; and a
persisted server-monotonic aggregate activity revision if that revision is
declared part of the contract. Until those items close, provider-only activity
cannot be described as complete head discovery, and clients use returned owner
fact versions without claiming monotonic aggregate order.

## 6. PC Host And Composition Boundaries

`ProjectDeviceMountRegistry` is the only PC project-to-local-directory
registry. It is subject-scoped and keyed by canonical `projectId`.

| Capability | Owner and behavior |
| --- | --- |
| Native path selection and canonicalization | Tauri host |
| Filesystem read/write | PC host adapter after mount validation |
| Git and worktree processes | PC/Tauri local Git capability |
| Terminal process and cwd | PC/Tauri terminal capability after mount validation |
| Sandbox composition | Agents composition slot `drive/drive` |
| Document composition | Agents `document/documents` slot plus injected Documents App SDK; invalid pairing fails closed before transport |

BirdCoder does not expose remote Git, project-path, mount, or runtime-location
registration APIs. A local mount or opaque runtime id does not authorize remote
execution. Agents, Kernel, and provider runtimes own any future remote execution
and target validation.

## 7. Security, Performance, And Observability

- `IamAuthorizationPolicy` evaluates every protected System permission and
  denies missing scopes; development mode has no empty-scope bypass.
- SDK clients share the application TokenManager; tokens and auth headers do
  not enter feature code.
- Tauri local-store commands validate scope, key, value size, active subject,
  and path capability.
- Native paths, tokens, credentials, device-state values, Session content, and
  human messages are excluded from normal logs, traces, metrics, and release
  evidence.
- List operations use the owner API's bounded pagination. PC derives only
  disposable in-memory views and does not build replayed read authorities.
- Session Activity invalidation messages contain scope only. Activity rows,
  transcripts, credentials, and provider-native payloads stay on owner SDK
  reads and never enter cross-context messaging or local persistence.
- Metrics identify bounded route templates and dependency health, not tenant,
  user, Project, Session, message, path, or mount values.

## 8. Deployment And Runtime Topology

| Profile and target | BirdCoder state | Capability |
| --- | --- | --- |
| `standalone + desktop` | Local Tauri device state only | Local filesystem, Git, worktree, and terminal through host adapters |
| `standalone + browser` | Browser-local capability handles only | Browser workbench; no native path |
| `standalone + server` | None | Stateless System API and composed owner routes |
| `cloud + server/container` | None | Stateless ingress; no project directory or remote runner |

In standalone, `application.public-ingress` serves BirdCoder System operations
and every selected dependency owner contribution through one listener. In
cloud, `platform.api-gateway` or an explicit owner override serves dependency
SDKs while BirdCoder APIs remain on the application ingress. Missing required
topology or a dependency assembly initialization failure stops bootstrap.
Server and container profiles contain no BirdCoder database or PC device-state
setting.

## 9. Architecture Decision Index

- [ADR-20260722 Owner-composed stateless workbench](../decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260727 Owner-composed cross-application Session Activity Inbox](../decisions/ADR-20260727-cross-application-session-activity-inbox.md)
- [Runtime topology](../topology-standard.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)

## 10. Verification

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm api:assembly:validate
pnpm check:sdk-family-standard
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm check:server
pnpm typecheck
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm docs:build
```
