# ADR-20260727 Owner-Composed Cross-Application Session Activity Inbox

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-27
Updated: 2026-07-30
Requirement: [REQ-2026-0003](../../product/requirements/REQ-2026-0003-cross-application-session-activity-inbox.md)
Specs: ARCHITECTURE_DECISION_SPEC.md, DOMAIN_SPEC.md, API_SPEC.md, SDK_SPEC.md, PAGINATION_SPEC.md, FRONTEND_SPEC.md, SECURITY_SPEC.md

## Context

Session list state is assembled from more than the Session aggregate. A
managed Turn, pending Interaction, Runtime Binding, or Session user-state
change can advance while the Session version is unchanged. BirdCoder
previously refreshed a Session inventory and could skip an existing row solely
because that version matched. A Session running through another application's
Agents-managed lifecycle could consequently remain visually ready.

Provider activity observation does not have the same indexing semantics. It is a
query-time enrichment for a row already selected by the managed authority
head; provider-only activity cannot make an older Session enter or reorder that
head.

Solving that defect inside an icon component, by inspecting provider files, or
by persisting a BirdCoder activity cache would make different views disagree
and would violate the Agents single-write authority.

## Decision

`sdkwork-agents` owns the current-state Session Activity summary exposed by the
App API at `GET /app/v3/api/ai/session_activity_summaries`. The resource is a
bounded, owner-scoped, cursor-paginated snapshot. It is neither a second
Session aggregate nor a durable change feed.

| Boundary | Decision |
| --- | --- |
| Head source of truth | Agents Session, latest relevant Turn, pending Interaction, current Runtime Binding, and Session user state |
| Provider enrichment | Fresh provider activity evidence may refine only a row already selected in the current page; it cannot create head eligibility or order |
| Owner projection | Agents computes provider identity, owner fact versions, freshness, activity time, and effective presentation phase; no server-monotonic aggregate activity revision is claimed |
| BirdCoder integration | Generated Agents SDK behind an injected service port; normal Project and Session refresh is read-only, while explicit folder import or re-import invokes `projectSessions.synchronize` before re-reading the owner inventory |
| Provider identity | Tenant, organization, owner, engine-qualified provider binding, provider, and provider session identifier; the baseline constrains stored owner/binding/provider/session-identifier uniqueness |
| Title authority | Provider inventory may refresh a `provider` title; explicit user rename changes authority to `user` and wins over later inventories |
| BirdCoder state | Disposable in-memory projection scoped by authenticated subject and Agents Workspace |
| Refresh | Start at a null cursor; follow `nextCursor` only for the current bounded traversal |
| Cross-context coordination | Broadcast a validated scope-key invalidation only, then re-read Agents |
| Selection | Explicit user selection is independent UI state and survives background refresh |
| Presentation | Provider badge is leftmost, the title truncates in remaining space, right-aligned trailing metadata carries time/status text, and a known runtime icon is rightmost; unknown or absent runtime status is silent and reserves no icon slot |

## Snapshot And Convergence

A refresh cycle starts from the owner snapshot head. Head eligibility and order
come only from Agents-managed Session, Turn, Interaction, Runtime Binding, and
Session user-state facts. BirdCoder merges returned rows by canonical Project
and Session identifiers and applies their returned fact versions and fields
even when the Session version itself did not change. It does not assume one
server-monotonic activity revision. Superseded requests are discarded at
commit time. Polling pauses while offline or hidden, backs off after failures,
and refreshes immediately after connectivity, visibility, or a scoped
invalidation resumes.

After the owner has selected the current page, a registered provider adapter
may add verifiable provider evidence for those rows. That enrichment cannot make
an older provider-only Session appear at the head. Missing collector
registration, an unavailable lookup, or provider evidence without a
corresponding indexed managed authority write fails closed to unsupported,
unavailable, stale, or unknown.

The in-memory projection is never persisted or treated as authority. A browser
context may notify another context that a subject-and-Workspace scope is dirty,
but the message cannot contain Session records, transcript content, tokens,
provider observations, or provider payloads. The receiver obtains the current
state from Agents.

The owner cursor orders a bounded traversal; it is not retained as an event
watermark. Moving heads converge when the next cycle starts again with a null
cursor.

## Freshness And Presentation

| Effective state | Session-list presentation |
| --- | --- |
| `queued` | Animated busy, displayed as `initializing` |
| `running` | Animated busy, displayed as `streaming` |
| Approval, tool, or user input wait | Static attention with the specific wait meaning |
| `failed` | Static explicit failure |
| Expired or `stale` evidence | Static neutral `stale` |
| `unknown`, `null`, unsupported, unavailable, or absent runtime evidence | No runtime label, icon, or reserved status-slot space |
| Ready, idle, completed, cancelled, closed, archived, or a deleted Session row when returned | No busy animation |

Only fresh provider evidence may enrich the effective phase of a row already
returned by the managed head. It cannot create head eligibility, reorder an old
Session, or replace the durable lifecycle. The workbench materializes
`freshUntil` expiry so icon state, smart sort, filters, and action guards observe
one effective status. It does not invent a fixed expiry for a durable managed
Turn that remains `running`; lease or stale-Turn reconciliation belongs to the
owner lifecycle. Provider history file modification times are not activity
evidence.

Code and Studio use the same accessible status component. The provider badge is
the first visual item in the row. A present, known runtime-status icon is the
rightmost item. A separate `data-session-trailing-metadata="true"` region uses
automatic left margin, end justification, and right-aligned text for time or
rendered status text; the title truncates in the remaining width. Studio does
not stack time beneath the title. Only busy states animate. `unknown`, `null`,
or absent runtime status returns no label, icon, or reserved status-slot space.

## Inventory And Selection

Global chronological and provider views apply this order:

```text
complete currently loaded inventory
  -> filter
  -> global smart or chronological sort
  -> render or virtualize the visible window
```

Project expansion and server continuation control loading, not global ranking
of rows already in memory. Background synchronization cannot switch the
selected Session. A synchronized newest Session may initialize selection only
when the target Project has no current or explicit user choice.

## Alternatives Rejected

### Infer Activity From The Session Version

Rejected because managed Turn, Interaction, binding, and user-state facts can
change independently. Page-local provider enrichment may also refine a
returned row, but it is not a head change detector.

### Detect Provider History Files In BirdCoder

Rejected because static inventory and file timestamps do not prove live
execution and provider-specific logic belongs behind Agents adapters.

### Broadcast Or Persist The Snapshot

Rejected because copied records create another security and consistency
boundary. Invalidation plus an owner re-read is sufficient.

### Let Each Surface Derive Its Own Status

Rejected because Code, Studio, sorting, filtering, and action guards would
diverge as freshness expires.

## Consequences

- Cross-application managed lifecycle facts can converge without a BirdCoder
  business store.
- Activity refresh may advance a row when its managed Turn, Interaction,
  Runtime Binding, or Session user-state changes even if the Session version is
  unchanged.
- Unknown provider state is finite and silent; it cannot become a permanent
  spinner, unavailable-status label, icon, reserved slot, or fabricated ready
  state.
- Provider collectors are runtime dependencies. Until Codex app-server,
  Claude hook, OpenCode event, Gemini AgentEvent, or equivalent ingestion is
  registered, the owner snapshot must report unsupported or unavailable rather
  than guess. Registration alone does not make provider observation an indexed
  head signal.
- Workspace identity remains Agents `AgentWorkspace/workspaceId`. IAM
  organization is authorization and subject scope and never replaces Workspace
  grouping.

## Launch Blockers

This decision's identity, title-authority, explicit synchronization, and
greenfield baseline work are implemented. It does not claim production
operations evidence, live migration evidence, or distributed synchronization
ownership. Production launch requires Agents and Kernel maintainer review and
executable evidence for all remaining items:

1. A bounded, indexed PostgreSQL P1 Session Activity head projection with its
   schema/index migration and production query-plan evidence.
2. A live PostgreSQL migration and query-plan proof for the owner-scoped
   provider identity constraint and the activity projection. The implemented
   baseline and source contracts do not demonstrate a deployed database.
3. An explicit Project deletion tombstone and pagination contract. A deleted
   Session row does not prove deleted-Project coverage.
4. Durable distributed runtime routing and synchronization-job ownership. The
   present provider inventory is bounded but runs synchronously on the selected
   runtime host and is not a cross-node durable job.
5. A persisted, server-monotonic aggregate activity revision if such a revision
   is part of the consumer contract. Until it exists, clients use returned
   owner fact versions and fields without claiming monotonic aggregate order.

Provider-only activity that has no Agents-managed Turn, Interaction, Runtime
Binding, or Session user-state update remains outside head discovery. It must
fail closed rather than be presented as a complete cross-application result.

## Verification

- Existing Agents API tests cover owner scope, opaque cursor binding, explicit
  import-only synchronization behavior, bounded synchronized/skipped/failed
  accounting and aggregate issues, provider title authority, provider identity
  deduplication, deterministic pending Interaction selection, current Runtime
  Binding behavior, user-state ordering, and freshness semantics for the
  implemented projection. They do not close the launch blockers above.
- BirdCoder workbench tests prove snapshot merging, request deduplication,
  invalidation-only coordination, retry/resume behavior, and freshness expiry.
- Code, Studio, and UI contracts prove provider-first and trailing-status order,
  busy-only animation, static attention/failure/stale states, silent unknown or
  absent runtime state, and accessible labels for rendered status icons.
- Session Inbox tests prove loaded-inventory filtering and global sorting.
- Documentation standards and build checks prove requirement, ADR, PRD, and
  architecture traceability.
- Launch evidence must additionally include PostgreSQL migration/index/query-plan
  proof, distributed synchronization ownership evidence, Project deletion
  tombstone tests, and any declared server-monotonic revision contract.

## Supersession

This ADR narrows
[ADR-20260722](ADR-20260722-domain-ownership-and-single-write-authority.md)
for Session Activity synchronization. It does not change Agents ownership or
BirdCoder's stateless server boundary.
