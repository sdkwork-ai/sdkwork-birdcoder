# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-31
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

### Hybrid Execution Extension

The product dimensions are orthogonal:

| Dimension | Examples | Authority |
| --- | --- | --- |
| Client runtime target | browser, desktop, server | BirdCoder composition |
| Deployment profile | standalone, cloud | deployment composition |
| Session execution target | candidate `LOCAL`, `CLOUD` | Agents product contract |
| Coordination mode | single, cluster | Kernel runtime |
| Provider transport | Local, Hybrid, Remote mechanisms | Kernel provider integration |
| Capacity placement | node, reservation, pool allocation | Sandbox |

No value is inferred from another. In particular, desktop is not synonymous
with local execution and web is not cloud placement evidence.

The current pre-launch implementation supports only a fail-closed local slice:
PC resolves the opaque device mount before it creates the Agents Session and
compensates an incomplete Session if the transitional combined Runtime Binding
fails. The client-created binding is not commercial placement evidence and is
retired by the reviewed Agents orchestration cutover.

The proposed commercial dependency direction is:

```text
BirdCoder -> Agents execution intent/orchestration
          -> Kernel placement/lease/routing
          -> Sandbox admission/pool/isolation/attachment/cleanup
```

BirdCoder has no direct Kernel or Sandbox dependency. Cloud availability must
come from an authenticated, versioned, expiring Agents capability derived from
live reviewed Kernel and Sandbox evidence. The current hard-disabled cloud
gate cannot be enabled by build configuration or deployment profile.

The extension is governed by
[REQ-2026-0006](../../product/requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md),
[ADR-20260730](../decisions/ADR-20260730-hybrid-execution-boundaries.md), and
[REVIEW-20260730](../../engineering/reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md).

### Coding And Work Mode Provider Admission

The left sidebar keeps one Birdcoder header and one persisted mode selector.
Coding Mode presents the coding-oriented Project and Session navigation. Work
Mode presents the WorkBuddy-inspired task, assistant, project, expert/skill/
connector, automation, and space navigation. Both modes continue to consume
the same canonical Agents Project and Session facts.

Provider admission is an explicit allowlist over the generated Agents
agent-engine catalog:

| Mode | Required tier | Engine ID | Agent ID |
| --- | --- | --- | --- |
| Coding | `t1-code` | `codex` | `agent.codex` |
| Coding | `t1-code` | `claude-code` | `agent.claude-code` |
| Coding | `t1-code` | `gemini` | `agent.gemini` |
| Coding | `t1-code` | `opencode` | `agent.opencode` |
| Work | `t2-autonomous` | `openclaw` (OpenClaw) | `agent.openclaw` |
| Work | `t2-autonomous` | `hermes` (Hermes Agent) | `agent.hermes` |

An entry is available for task creation only when `engineId`, `agentId`, and
`tier` all match the selected row and the live catalog publishes a usable
model. Unknown or partially specified entries, an identity with the wrong
tier, and later Providers that have not been deliberately assigned to a mode
are excluded. Persisted values outside `coding | work` normalize to Coding.
Session lists, search results, context-menu engine choices, and task creation
apply the same admission boundary.

Provider menu visibility is a separate presentation contract. Coding shows
catalog-admitted Providers. Work always shows the two allowlisted choices,
OpenClaw and Hermes Agent, so an empty catalog does not hide the supported
installation path. A non-admitted Work row is labelled not installed and
opens an installation dialog instead of creating a Session.

The installation path is desktop-only and fail-closed. A Work Provider id is
mapped inside infrastructure to one fixed official HTTPS installer plan;
arbitrary command text is never accepted from the component. OpenClaw is
pinned to `2026.7.2` and skips onboarding. Hermes Agent is pinned to commit
`cff9728587da4f3c0beed0786f9bea528e489f13` and skips setup. Both plans are
noninteractive, invoke the existing `desktop_local_shell_exec` Tauri boundary,
and reject unknown ids before invoking the host. Browser mode returns
`desktop-required`.

A successful installer exit is not availability authority. BirdCoder clears
and reloads the generated Agents agent-engine catalog, then enables task
creation only if the exact Work identity and usable model are published. It
does not synthesize a catalog entry. The exact visibility, mapping, installer
authorities, baselines, arguments, and post-install rule are machine-governed
by `specs/agents-birdcoder-alignment.spec.json` and checked by
`pnpm check:agents-birdcoder-alignment`.

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

Project and Session list refreshes traverse the activity snapshot with a null
cursor. The background Workspace Session Inbox additionally runs a bounded,
deduplicated, time-budgeted per-project provider synchronization pass
(`projectSessions.synchronize`) so provider-owned Sessions converge without
blocking the activity read; the backend serves repeat synchronizations from a
60-second process-local refresh cache aligned with the client-side
deduplication TTL, so the background loop never re-scans the provider session
store (JSONL files on disk) in steady state. A manual project refresh treats
the provider import as best-effort and continues with the persisted inventory
when the import fails or exceeds its budget, so a slow provider store scan
never fails the refresh. The explicit local folder import or re-import
command requires the synchronization outcome and surfaces import failures.
The synchronize partial result retains successful reconciliation while
reporting bounded skipped/failed issue aggregates. Reconciliation is
intentionally per-session atomic rather than batch-transactional: inventory
rows and transcript items upsert idempotently by stable keys, so an
interrupted or partially failed run converges on the next pass; a single
malformed item can never block the whole batch from converging. An activity
cursor is not a durable change-feed watermark.
Head eligibility and ordering come from Agents-managed Session, Turn,
Interaction, Runtime Binding, and Session user-state facts. Query-time provider
observation may enrich only rows already selected in the current page;
provider-only activity cannot insert or reorder an old Session at the head. The coordinator
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

### Session Naming And Provider Protocol Normalization

`Session` is the only BirdCoder and SDKWork domain name for an agent work
continuation. BirdCoder source, commands, events, stores, services, view models,
UI copy, and authored contracts must not introduce a parallel `Thread` concept.
Codex protocol names such as `thread`, `threadId`, and `findInThread` are
provider-native transport details. They may be read only inside the Codex
provider adapter or its raw protocol fixtures and must be translated at that
boundary to canonical Agents Session identity, `providerSessionId`, and
Session-named application commands such as `findInSessionTranscript`.

Archive, rename, pin, navigation, transcript lookup, and transcript search all
operate on the existing Agents Session and Session user-state contracts. The
adapter conversion must not create a Thread DTO, store, service, identifier,
route, or persistence authority in BirdCoder. Provider-native field names may
be retained only when exact raw payload fidelity is required and must not cross
the adapter's provider-neutral output boundary.

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

Session Item reads use the owner-declared P1 keyset contract. The PC consumer
requests newest-first pages with `sort=-sequence`, validates cursor mode, page
size, continuation progress, and terminal `nextCursor: null`, then restores
chronological display order. Initial/latest refresh is bounded to eight
50-item pages and earlier-message loading advances through at most three
duplicate-only pages per user action. Invalid metadata is rejected before any
partial transcript commit.

The PC Projects Store retains at most 500 items and 4 MiB of estimated
structured content per Session. Estimation is iterative, cycle-aware, and
bounded to 65,536 visited nodes, so deeply nested provider metadata neither
recurses on the JavaScript stack nor requires a full JSON string allocation.
History loading is additionally capped at ten cumulative pages of new
earlier-message progress per Session across all scroll-to-top gestures, and
the whole scope projection enforces a 50,000-item global transcript ceiling:
the lowest-priority populated Sessions lose their transcript items first
(their inventory row survives and a later refresh restores the transcript
from the owner SDK), so many populated Sessions can never accumulate
unbounded transcript memory. Cache trimming retains Sessions
priority-first and partially retains an over-capacity Project instead of
dropping it as a whole, so leftover session capacity is never wasted.
The progressive renderer starts with the latest 48 messages. Its state commits
the stable Project and Session identity before remote prepend; later Agent or
Provider metadata enrichment cannot reset the expanded window or its scroll
anchor.

Turn submission uses the generated Agents App SDK stream with
`event_protocol=kernel-v1`. The PC service validates monotonic runtime-event
sequence, Session/Turn/provider identities, JSON shape, and per-event plus
whole-Turn character/node budgets without exposing raw Kernel events to feature
or React packages. Generated completion Session Items remain the transcript
authority. Cumulative assistant text is paced on animation frames with a
bounded timer fallback and drains within eight frames before durable completion
reconciliation.

### Durable Turn Input Queue

The owner-scoped Agents Turn input queue is the only persistence and ordering
authority for inputs submitted while a Session Turn is active. BirdCoder calls
the generated `turnInputQueueEntries` SDK surface through its injected Session
service; UI and Workbench packages do not construct transport clients or store
queue records in browser or Tauri persistence.

```text
UnifiedChat busy submission
  -> generated Agents App SDK create
  -> durable owner-scoped FIFO entry
  -> atomic claim with lease + fencing token
  -> existing Turn stream with queue idempotencyKey + payloadHash
  -> authoritative Turn reconciliation
  -> next FIFO claim or failed-head pause
```

BirdCoder keeps at most 32 entries per Session projection, 32 Session scopes,
4 MiB of exact UTF-8 string data per scope, and 16 MiB total in process memory.
Per-scope and global counters avoid rescanning unrelated Session projections.
Startup, focus,
visibility, connectivity, and `BroadcastChannel` invalidation re-read Agents;
cross-window messages contain only Agent/Session identity and source identity,
never queue content. A generation fence discards responses from a previously
selected Session. Same-Session requests are latest-wins, and a mutation epoch
fences refresh results from authoritative local mutation and claim updates.
Any open queue edit pauses that window before its next claim.

Before create, BirdCoder generates a stable `queueEntryId`. Retries of the
same uncertain create reuse it, while different or already successful actions
receive new IDs. The queue ID and Turn idempotency pair prevent duplicate
accepted Turns across response loss and reconciliation.

The server claim operation serializes windows and reconciles the prior claimed
entry before advancing. Completed Turns delete the entry; failed or cancelled
Turns create a failed head; a live Turn or unexpired lease reports busy. An
expired lease without an accepted Turn returns the entry to queued state with
an increased fencing token. Transport uncertainty remains executing for later
reconciliation, while pre-acceptance rejection invokes the fenced fail command
exactly once.

Queued and failed entries support optimistic-version edit, reorder, removal,
and retry. Executing entries reject those mutations. Clear removes only queued
and failed entries and preserves an executing lease. Deleting the owning
Session removes its queue. Logout erases only the disposable PC projection;
the next authenticated hydration restores durable entries.

Full Diff review uses a provider-neutral responsive layout resolver. The normal
three-pane layout remains at readable widths; constrained layouts collapse the
file explorer before enforcing a 320-pixel chat column, and critically narrow
layouts hide the chat surface while keeping it mounted so Composer state is
preserved until the Diff closes.

#### Commercial Readiness Gaps

Provider identity, bounded periodic synchronization, title authority, and the greenfield
PostgreSQL uniqueness baseline are implemented. Provider identity is scoped by
tenant, organization, owner, engine-qualified provider binding, provider, and
provider session identifier; provider titles update only while provider-owned, and
an explicit user rename wins over later inventory. The read endpoint is
side-effect free, and client paths, directory names, and fingerprints never
cross the owner SDK boundary. The Workspace Session Inbox issues deduplicated,
time-budgeted `projectSessions.synchronize` calls for the projects it has
loaded (with backend fingerprint-based incremental reconciliation), so
provider-owned Sessions converge without blocking the activity read.

Session lifecycle reliability hardening is in place: session soft-delete and
turn-input-queue purge execute in one database transaction (no partial
delete), audit persistence is best-effort with structured failure logging so
an unavailable audit sink cannot corrupt the client-visible business outcome,
and offset list pagination rejects pages beyond 10,000 (previously an
unbounded page parameter could overflow offset arithmetic). The session
activity head query now has composite lateral indexes
(`ai_agent_turn/interaction/resource_user_state` × `(tenant, organization,
session, updated_at, id)`, plus the interaction kind variant) shipped in both
the baseline and migration `0004`.

This consumer architecture is not commercial-production complete until Agents
and Kernel maintainers approve executable evidence for: a bounded indexed
PostgreSQL P1 head projection (the lateral indexes above bound per-row lookups
but a materialized head projection is still open); live PostgreSQL migration
and query-plan evidence for its activity and identity constraints; Project
deletion tombstone and pagination semantics; durable distributed runtime
routing and synchronization-job ownership; and a persisted server-monotonic
aggregate activity revision only if that revision becomes a product contract.
The current inventory is bounded but executes synchronously on the selected
runtime host. Until those items close, provider-only activity cannot be
described as complete head discovery, and clients use returned owner fact
versions without claiming monotonic aggregate order.

Audit evidence recorded for the owner-side open items (owned by
`sdkwork-agents`, not by this repository): the PostgreSQL baseline has never
been executed against a live database (no CI job runs the `postgres-sync`
feature), the activity head query orders by a computed `activity_at` column
that cannot use the lateral indexes, the model-configuration profile store is
a node-local SQLite file with unencrypted secret bindings (multi-node
configuration is therefore node-local), and `projectSessions.synchronize`
runs synchronously inside the HTTP request with provider discovery and the
two reconciliation sweeps outside the time budget. These items remain with
the Agents maintainers and gate commercial availability exactly as listed
above.

The repository technical-debt quality gate for retired Workspace/IDE service
types is closed: the retired crate, package, and `database/` directory
skeletons were removed, the orphaned App SDK offset-pagination test and
stale release OpenAPI artifacts (which still advertised retired
`workspaces`/`projects`/`git` routes and permissions absent from
`specs/iam.module.manifest.json`) were purged, and release artifacts are
now pinned to the authoritative OpenAPI by a parity contract
(`scripts/release/openapi-artifact-parity-contract.test.mjs`). The rule that
BirdCoder has no Workspace, Project, or Session business authority is
preserved.

The embedded desktop gateway asserts an explicit IAM authentication path
before serving protected routes: an operator-configured
`SDKWORK_DATABASE_URL` selects database-backed sessions, otherwise the
local development authentication fallback is enabled for loopback local
login, and a state with neither fails closed with a diagnostic instead of
silently returning 401 on every protected route. The desktop WebView also
enforces a Content-Security-Policy (mirroring the renderer's HTML meta
policy) as a defense-in-depth layer, and browser-local session persistence
never stores the rotating refresh token — long-lived credentials are
persisted only through the OS-level keyring-backed secure port and fail
closed in-memory otherwise.

The gateway also mounts the SDKWork Deployments owner module as one of its
owner API contributions when a workspace PostgreSQL profile is configured
(`SDKWORK_DATABASE_URL` or a structured `SDKWORK_DATABASE_*` field). The
Deployments module owns its own database and lifecycle
(`sdkwork-deployments`); BirdCoder's stateless-ownership promise is unchanged
— the gateway holds no BirdCoder business table and delegates the Deployments
module's database bootstrap to that module's own migration entry point before
serving. Deploying the gateway without a Deploy database configuration is the
implemented stateless profile: the gateway skips the Deployments migration and
route mounting entirely and serves without inventing a development database
(`crates/sdkwork-api-birdcoder-standalone-gateway/src/lib.rs`). This carve-out
is deliberate and machine-checked: the gateway is not a database-owning
process (owner modules own their pools and lifecycles per-module), so it does
not enable the SDKWork process-shared database pool and keeps no
`specs/process-database-pool.spec.json`; the stateless posture is enforced by
`scripts/server-observability-contract.test.mjs`.

Host reliability hardening is in place on the desktop host: git subprocesses
run under a wall-clock timeout (60s default, 300s for diff commands) with
bounded trailing-output retention (128 KiB default, 2 MiB for diffs), the
diff response caps untracked files folded into one response (256), and
git-owned `info/exclude` metadata is only read under a byte budget and must
resolve inside the repository boundary. `user_home_config` reads and writes
are bounded (8 MiB / 64 MiB), directory listings and revision probes carry
explicit entry/path caps, and the desktop installation identity is read and
written inside one SQLite transaction so concurrent callers cannot rotate it.

Client-side reliability hardening: the Projects Store cache now enforces its
five-scope ceiling even when every scope has an active listener (listeners
receive a reset snapshot before a forced LRU eviction), structured tool
content is measured before it is stringified so a large provider payload
cannot allocate a full copy, queue positions are validated before projection,
and offset-list page requests are rejected (not silently clamped) when
`page_size` exceeds 200 or `page` is below 1, aligning with
`PAGINATION_SPEC.md` §10.1. H5 web sessions never persist the rotating refresh
token (browser storage is readable by any script); native Capacitor sessions
keep it in OS keychain/keystore-backed storage, mirroring the PC keyring
posture.

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
execution. Agents, Kernel, and provider hosts own any future remote execution
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
setting. The SQLite boundary is one-directional and enforced by
`SDKWORK_DATABASE_SPEC.md` §8: client-local SQLite (`SDKWORK_DATABASE_SQLITE_URL`,
rusqlite plus sqlx-sqlite in the Tauri host) holds device state only, while the
authoritative Agents PostgreSQL profile is the only persistence authority.
Server and container processes must never set the SQLite URL, and the Agents
service deliberately has no SQLite adapter: implementing a second service-side
engine would duplicate the PostgreSQL contract without a product or spec basis.

## 9. Architecture Decision Index

- [ADR-20260722 Owner-composed stateless workbench](../decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260727 Owner-composed cross-application Session Activity Inbox](../decisions/ADR-20260727-cross-application-session-activity-inbox.md)
- [ADR-20260728 Provider-neutral Session transcript](../decisions/ADR-20260728-provider-neutral-session-transcript.md)
- [ADR-20260731 Durable Turn input queue](../decisions/ADR-20260731-durable-turn-input-queue.md)
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
pnpm test:browser:smoke
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm docs:build
```
