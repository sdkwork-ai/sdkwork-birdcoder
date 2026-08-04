# SDKWork BirdCoder PRD

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-08-04
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, FRONTEND_SPEC.md, PAGINATION_SPEC.md, SECURITY_SPEC.md

## 1. Background And Problem

BirdCoder provides an AI-assisted coding workbench without becoming another
system of record for every capability visible in its UI. Earlier design work
created overlapping Workspace, Project, AI-session, messaging, Skill, and
runtime-location concepts. Because the application has not launched, keeping
those overlaps would add permanent coupling without a compatibility benefit.

The product now composes independent SDKWork capabilities through their public
SDKs. The Rust gateway owns only application System metadata. PC owns
presentation and local host capabilities, not remote business aggregates.

## 2. Target Users

| User | Outcome |
| --- | --- |
| PC developer | Organize canonical Agents Workspaces and Projects, see current cross-application AI Session activity, edit files, run local terminals, and operate Git from one workbench. |
| Team developer | Use Agents Workspace/Project scope with IAM organization authorization and no BirdCoder-owned duplicate aggregate. |
| Operator | Deploy and observe a stateless BirdCoder gateway without a BirdCoder database lifecycle. |
| Security reviewer | Trace every fact to one owner and verify that local paths, credentials, and human messages do not cross incorrect boundaries. |

## 3. Goals And Non-Goals

Goals:

- Use canonical Agents Workspace and Project identifiers across PC workflows.
- Ensure each signed-in user has one idempotently initialized default Workspace.
- Scope Project listing, creation, and import to the selected Workspace.
- Use the Agents Session, Turn, Session Item, Interaction, and Runtime Binding
  lifecycle for every AI assistant workflow.
- Converge owner-scoped Session activity across BirdCoder, Codex, Claude Code,
  OpenCode, Gemini, and future providers without a BirdCoder activity authority.
- Keep human IM communication semantically and operationally distinct.
- Keep Skill lifecycle in Skills and consume it through its generated SDK.
- Keep directory mounts, filesystem access, Git, worktrees, and terminals
  local to PC host adapters.
- Let a developer explicitly choose local or cloud execution for a new Agents
  Session, and support a reviewed Task override, without inferring execution
  from browser/desktop or standalone/cloud deployment shape.
- Keep the Rust gateway stateless and its BirdCoder-owned API minimal.
- Fail closed when an owner capability or required composition contract is
  unavailable.

Non-goals:

- Maintaining a BirdCoder-owned Workspace, Project, Session, message, Skill, or
  runtime-location system of record.
- Retaining pre-launch compatibility data, route aliases, dual identifiers, or
  synchronized copies.
- Treating a local directory path or opaque runtime id as authorization for
  remote code execution.
- Emulating a missing document composition type with a different composition
  slot.
- Claiming Flutter completion from this Rust-and-PC delivery. H5 changes remain
  limited to compatibility with the canonical Agents Session Item contract.
- Scheduling Kernel placement, calling Sandbox directly, or enabling cloud
  execution before the protected Agents, Kernel, Sandbox, storage, security,
  SLO, and release gates are accepted and proven.

## 4. User Scenarios

1. A signed-in user receives an idempotently initialized default Agents
   Workspace, selects a Workspace in the Header, and lists or creates only its
   canonical Agents Projects. The same Header creates and renames Workspaces
   and archives or deletes empty non-default Workspaces.
2. The PC client selects an Agents Project, creates an Agents Session with the
   same `projectId`, and writes the opaque local runtime reference through
   Agents `sessionRuntimeBindings`.
3. The assistant transcript renders Agents Session Items. A human conversation
   uses IM Conversation and Message APIs and is not used as transcript storage.
4. A Tauri user selects a local directory. PC records a subject-scoped device
   mount keyed by the canonical `projectId`; native paths remain inside the
   host boundary.
5. Terminal, filesystem, Git, and worktree actions resolve the authorized local
   mount and fail closed when it is missing or stale.
6. A Drive sandbox directory is imported once through the Agents Project
   import command under the selected Workspace. A project uses an Agents
   `drive/drive` composition slot for sandbox storage and `document/documents`
   slots for project documents. PC resolves
   document references through the injected Documents App SDK and owns no
   document binding, content, version, or projection authority.
7. An operator deploys the Rust gateway without a BirdCoder database,
   migration, backup volume, or server-side project directory.
8. A developer starts or continues a Session in another supported application.
   That application records its managed lifecycle through Agents Turn,
   Interaction, Runtime Binding, or Session user-state authority. BirdCoder
   refreshes the Agents Session Activity snapshot, shows the provider first and
   a known busy or attention state at the row end, preserves the developer's explicit
   selection, and expires uncertain page-local provider evidence to a neutral
   state.
9. A developer creates a new coding Session and chooses local or cloud
   execution. Local execution resolves an authorized opaque device mount before
   Session persistence and keeps project bytes local. Cloud remains visibly
   unavailable until Agents proves a reviewed Kernel placement and isolated
   Sandbox capability for the requested policy; there is no fallback between
   targets.
10. While a Session Turn is active, a developer submits, edits, reorders, or
    removes later inputs. Agents persists those inputs in FIFO order and the
    next eligible input executes only after the preceding Turn reaches an
    authoritative terminal state. The queue survives BirdCoder restarts,
    reconnects, and window changes without duplicating accepted Turns.

## 5. Functional Requirements

1. BirdCoder owns only System descriptor, health, route, and runtime metadata.
2. The server owns no business table or database lifecycle.
3. PC Workspace and Project operations use the generated Agents App SDK;
   Project inventory, creation, and import require the selected `workspaceId`.
4. PC AI workflows use canonical Agents Sessions and Session Items without a
   local Session or transcript authority.
5. Project and Session Activity refreshes use the generated Agents App SDK.
   The Session Activity read endpoint is side-effect free; the Workspace
   Session Inbox periodically reads its cursor snapshot to converge the
   list with the managed authority head. To keep the list consistent with
   provider-owned Sessions (Codex, Claude Code, OpenCode, Gemini threads),
   the inbox also issues bounded `projectSessions.synchronize` calls for the
   projects it has loaded: per-project provider inventory synchronization is
   deduplicated by a shared cache, limited by a per-cycle time budget, and
   never blocks the activity read. The backend serves repeat synchronize
   outcomes from a process-local refresh cache aligned with the client-side
   deduplication TTL, so the background loop never re-scans the provider
   session store in steady state; a manual project refresh treats the import
   as best-effort and continues with the persisted inventory when the import
   fails or exceeds its budget, so a slow provider store scan never fails the
   refresh. The command returns synchronized, skipped, and failed counts plus
   bounded aggregate issues, so malformed provider records do not discard
   valid imports and incomplete inventories stay observable.
   The disposable in-memory projection incorporates Turn, Interaction, Runtime
   Binding, user-state, provider identity, activity fact-version, and freshness
   changes even when the Session version is unchanged. Browser and desktop
   clients never send local paths, directory names, or fingerprints to this
   owner operation. Provider observation only enriches rows already selected by
   the managed authority head and cannot make an older Session enter that head.
6. Provider inventory synchronization identifies a provider session identifier within the
   tenant, organization, owner, engine-qualified provider binding, provider,
   and provider Session scope. The Agents baseline enforces the stored
   owner/binding/provider/session-identifier uniqueness constraint. Provider titles
   remain refreshable only while `titleSource` is `provider`; an explicit user
   rename changes the authority to `user` and survives later inventories.
7. Session creation records runtime association through the Agents runtime
   binding resource when local execution context is required.
8. Skill workflows use the Skills SDK. Human messaging belongs to IM and uses
   the IM SDK when that separate product capability is enabled.
9. Tauri device state accepts only the explicit settings, project-mount, and
   installation-identity namespaces.
10. Sandbox composition uses `drive/drive`; document composition accepts only
   canonical `document/documents` slots and fails closed before a Documents
   SDK call when the slot pairing or reference is invalid.
11. Frontend features consume injected owner clients or ports and do not
    implement raw transport or local SDK forks.
12. Cross-context Session synchronization broadcasts only a scoped
    invalidation; receivers re-read Agents, and background refresh does not
    replace an explicit Session selection.
13. Code and Studio present provider identity as the leftmost visual item and a
    known runtime-status icon at the far right. Only initializing and streaming
    animate; waits, failure, and stale presentation remain static. Unknown,
    `null`, or absent runtime status has no label, icon, or reserved slot. Time
    or rendered status text occupies a separate right-aligned trailing metadata
    region; the title truncates in the remaining width and Studio does not put
    time below it.
14. The Header renders Workspace selection on the left and the selected
    Workspace's Project inventory on the right.
15. Project inventory uses server-side Workspace scope, query search, and
    case-insensitive `name_exact` lookup. Project Session inventory remains
    bounded offset pagination. Session transcripts use opaque keyset cursors;
    clients request the newest page with `sort=-sequence`, restore chronological
    presentation order, and advance only with `pageInfo.nextCursor`. PC keeps a
    bounded in-memory transcript and preserves the expanded window when late
    Agent or Provider metadata enriches the selected Session.
16. Unsupported future Session Item roles or kinds remain visible through a
    bounded unsupported-content presentation instead of being misclassified as
    assistant output or silently discarded.
17. Rust, PC, documentation, contracts, generated SDKs, and runtime behavior
    remain mutually consistent. This delivery does not add H5, Flutter, or
    other client presentation work.
18. Execution target is distinct from client runtime target, deployment
    profile, Kernel coordination mode, Provider transport, and Sandbox
    capacity placement. BirdCoder consumes only the generated Agents product
    contract and never writes resolved placement facts.
19. Session is the canonical agent-continuation term throughout BirdCoder.
    Codex `thread`, `threadId`, and `findInThread` names remain confined to the
    raw Codex provider adapter and protocol fixtures, where they are converted
    to Agents Session identity, `providerSessionId`, and Session-named
    application commands. BirdCoder introduces no Thread DTO, store, service,
    event, route, persistence model, or UI terminology. Find, archive, rename,
    pin, and navigation operate on the current Session or its existing user
    state.
20. Agents owns the durable Turn input queue for each owner-scoped Agent and
    Session. BirdCoder consumes it through the generated Agents App SDK and
    retains only a bounded, disposable projection. Claiming is atomic and
    fenced; dispatch uses the queue-owned idempotency key and payload hash.
    Failed heads pause FIFO execution until retry, edit, or removal. Clear
    removes queued and failed entries while preserving an executing lease;
    Session deletion removes the owned queue. Logout clears only the local
    projection, and focus, visibility, connectivity, or cross-window
    invalidation causes an authoritative re-read.

## 6. Quality, Security, And Commercial Gates

| Gate | Required outcome |
| --- | --- |
| Cohesion | Every business fact has one owner with its own API, SDK, persistence, and lifecycle. |
| Coupling | Integration uses generated owner SDKs, stable identifiers, and explicit ports. |
| Security | Authorization fails closed; local paths, tokens, and device-state payloads do not enter server APIs or logs. |
| Performance | Owner-side pagination is preserved; Session Item reads use keyset cursors and bounded latest/history windows; the Turn input queue and its PC projection have explicit entry and UTF-8 byte budgets with incremental per-scope accounting; transcript retention, provider payload traversal, and live runtime-event processing have explicit character, node, item, and frame budgets; loaded Sessions are globally filtered and sorted before render virtualization. |
| Reliability | Missing mounts, runtime bindings, topology, unsupported composition types, and stale or unavailable activity fail closed; background refresh preserves explicit selection; queue claims are atomic, leased, fenced, and idempotent across restart, reconnect, and multiple windows. |
| Reproducibility | API assembly and SDK generation are repeatable and generated files are not hand-edited. |
| Operations | The gateway deploys statelessly with health, readiness, metrics, rollback, and dependency diagnostics. |
| Release | Rust, PC, API, SDK, IAM, architecture, documentation, and security gates pass with no accepted debt list; REQ-2026-0003 owner launch blockers are closed by Agents/Kernel review and executable evidence. |

## 7. Delivery Scope

The current delivery scope is:

- Rust assembly, gateway, System routes, and Tauri host;
- PC browser and desktop packages;
- BirdCoder System-only App SDK;
- owner SDK integration for Agents, Skills, IAM, Drive, and Documents, plus
  the explicit IM ownership boundary for any future human messaging feature;
- architecture, operations, and release documentation for those surfaces.

The current implementation delivery includes the fail-closed local selection
and mount-before-Session preflight only. Cloud execution data-plane delivery is
governed by REQ-2026-0006 and remains outside the enabled product until every
owner gate is accepted and proven.

Flutter remains outside this cutover and cannot be used as evidence that the
current migration is complete. H5 evidence is limited to its assistant Session
Item consumer and does not claim full cross-surface feature parity.

## 8. Linked Requirements

- [REQ-2026-0002 Domain ownership convergence](../requirements/REQ-2026-0002-domain-ownership-convergence.md)
- [REQ-2026-0003 Cross-application Session Activity Inbox](../requirements/REQ-2026-0003-cross-application-session-activity-inbox.md)
- [REQ-2026-0005 PC Appearance Settings](../requirements/REQ-2026-0005-pc-appearance-settings.md)
- [REQ-2026-0006 Hybrid local and cloud Agent execution](../requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md)
- [REQ-2026-0007 Durable Turn input queue](../requirements/REQ-2026-0007-durable-turn-input-queue.md)
- [REQ-2026-0008 Codex desktop observable parity](../requirements/REQ-2026-0008-codex-desktop-observable-parity.md)
- [ADR-20260722 Owner-composed stateless workbench](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260727 Owner-composed cross-application Session Activity Inbox](../../architecture/decisions/ADR-20260727-cross-application-session-activity-inbox.md)
- [ADR-20260730 Hybrid execution ownership and placement boundaries](../../architecture/decisions/ADR-20260730-hybrid-execution-boundaries.md)
- [ADR-20260731 Durable Turn input queue](../../architecture/decisions/ADR-20260731-durable-turn-input-queue.md)
- [Direct cutover record](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)

## 9. Open Questions

No product-ownership boundary is open for the current Rust-and-PC cutover.
Provider-identity design and the greenfield PostgreSQL baseline are implemented.
They have source and contract-test evidence, but no configured live database was
reset or migrated during this work. Production launch remains blocked on the
following owner operational evidence in
[REQ-2026-0003](../requirements/REQ-2026-0003-cross-application-session-activity-inbox.md):

- bounded indexed PostgreSQL P1 Session Activity head projection;
- live PostgreSQL migration and query-plan evidence for the owner-scoped
  provider identity constraint and activity projection (the baseline has never
  run against a live database, and the head query orders by a computed
  `activity_at` column that cannot use the lateral indexes);
- Project deletion tombstone and pagination semantics;
- durable distributed runtime routing and synchronization-job ownership
  (the model-configuration profile store is a node-local SQLite file, so
  multi-node configuration is node-local; `projectSessions.synchronize` runs
  synchronously inside the HTTP request with provider discovery and the
  reconciliation sweeps outside the time budget); and
- a persisted server-monotonic aggregate activity revision if the contract
  requires one.

The repository technical-debt quality gate also remains a release blocker until
the retired Workspace/IDE service types identified by that gate are removed.
They are outside the Session authority and are not a reason to reintroduce a
BirdCoder-owned Session store.

The present provider inventory is bounded and executes synchronously on the
runtime host selected by Agents. It is not a distributed durable job. These
items require Agents and Kernel maintainer review. Provider-only observation is
page-local enrichment and does not close head discovery. Additional composition
kinds must likewise be added by their owning modules before PC can consume
them; BirdCoder does not invent aliases or compatibility slots.

Hybrid execution additionally has protected open decisions recorded in
[REVIEW-20260730](../../engineering/reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md),
including public target naming and inheritance, local Agents persistence,
placement/provider binding separation, Kernel/Sandbox ports and fencing,
cloud Workspace byte authority, isolation provider, quotas, SLOs, topology,
migration, and release evidence. These questions block cloud implementation
and commercial readiness claims.

BirdCoder-side reliability hardening completed during the pre-launch audit is
closed and covered by tests: git subprocess timeouts and bounded output,
bounded host commands (config read/write, listings, revision probes),
transactional installation identity, repository-bounded git exclude writes,
the five-scope Projects Store cache ceiling under active listeners, bounded
tool-content stringification, queue position validation, offset-list page
rejection semantics, web-mode refresh-token non-persistence, removal of
unwired stub exports and dead native shells, and the implemented stateless
gateway profile without a Deploy database configuration (the gateway remains
a non-database-owning process and deliberately does not enable the SDKWork
process-shared pool, per `scripts/server-observability-contract.test.mjs`).
The Flutter mobile surface has migrated its chat page from IM semantics to the
canonical Agents Session Item contract in code; it still does not constitute
release evidence for this Rust-and-PC cutover per Section 7.
