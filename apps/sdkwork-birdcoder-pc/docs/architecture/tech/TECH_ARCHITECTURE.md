# SDKWork BirdCoder PC Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-31
Specs: DOCUMENTATION_SPEC.md, ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, FRONTEND_SPEC.md, PAGINATION_SPEC.md

This document narrows the
[repository technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
to PC. The repository document remains the architecture Canon.

## Composition Root

The PC shell/runtime owns route bootstrap, runtime configuration, the shared
TokenManager, generated owner SDK clients, and browser/Tauri host adapters.
Features receive typed services or ports. They do not construct HTTP clients,
read private environment values, set authentication headers, or import
generated transport internals.

## Connectivity

| Plane | Clients |
| --- | --- |
| BirdCoder application ingress | Four-operation BirdCoder System SDK |
| Platform gateway or owner override | Agents, Skills, IAM, Drive, Documents, Messaging, Membership, Order, Prompts |

Browser development may use the declared platform proxy. Desktop requires an
explicit platform endpoint. An unavailable required plane fails before feature
bootstrap.

## Workspace, Project, And Session

```text
Agents Workspace (workspaceId; default initialized per user)
  -> Agents Project (projectId)
       -> composition slot
       -> Session
            -> Turn
            -> Session Item
            -> Interaction
            -> Runtime Binding
```

PC view models preserve the owner `workspaceId`, `projectId`, and Session
identifiers. The Header renders Workspace selection first and the selected
Workspace's Project selector second. Workspace bootstrap is an Agents SDK
operation; there is no BirdCoder Workspace authority, second Project id,
parallel Session id, persistent transcript view, or mapping facade.

Session is also the mandatory PC naming boundary. Codex `thread`, `threadId`,
and `findInThread` are raw provider protocol names and may exist only in the
Codex adapter or exact protocol fixtures. The adapter immediately converts
them to the Agents Session identity, `providerSessionId`, and Session-named PC
commands such as `findInSessionTranscript`. Shell, UI, stores, services, events,
view models, and authored contracts must not define a Thread model or leak
Codex protocol terminology. Archive, rename, pin, navigation, and transcript
find reuse the canonical Session and Session user-state capabilities.

Session creation and local execution context use:

1. the selected canonical `projectId`;
2. a subject-scoped `ProjectDeviceMountRegistry` record;
3. the Agents Session;
4. Agents `sessionRuntimeBindings` with the opaque Tauri runtime id.

The Session list reads the side-effect-free Agents App API Session Activity
summary rather than inferring state from the Session version. It does not run
provider reconciliation. The explicit folder import/re-import workflow alone
invokes the generated Project Session synchronization command and then performs
a read-only refresh; partial skipped/failed issue aggregates are presented
without discarding successfully imported Sessions.
The owner snapshot composes Session,
latest relevant Turn, pending Interaction, current Runtime Binding, Session
user state, provider session identity, owner fact versions, freshness, and the
effective presentation phase. No server-monotonic aggregate activity revision
is assumed. Codex, Claude Code, OpenCode, Gemini, and future providers consume
one service port, but cross-application head advancement requires a managed
Turn, Interaction, Runtime Binding, or Session user-state update in Agents.

The workbench coordinator scopes each in-memory projection by authenticated
subject and Agents Workspace. It starts refresh cycles at the snapshot head,
deduplicates subscribers, suppresses superseded responses, backs off after
failures, and refreshes after connectivity, visibility, or scoped invalidation
resumes. Cross-context messages carry invalidation only; receivers re-read
Agents and never exchange Session rows, transcripts, tokens, or provider
payloads.

The managed authority facts determine head eligibility and order. A registered
provider adapter may enrich only rows already selected in the current page;
provider-only observation cannot make an older Session enter or reorder the
head. Missing collector registration, unavailable lookup, or evidence that
has no corresponding indexed managed authority write fails closed.

Finite provider freshness expires centrally to stale or unknown. Unsupported or
unavailable provider evidence also remains neutral; PC does not use provider
history file timestamps as live activity. A durable managed Turn in running
state retains owner lifecycle authority and does not receive an invented PC
timeout.

Agents implements provider Session identity with a tenant, organization, owner,
engine-qualified binding, provider, and provider session identifier scope, plus an
owner-scoped baseline uniqueness constraint. Provider titles synchronize only
while provider-owned; user renames retain title authority. Production launch
remains blocked until Agents and Kernel maintainers approve evidence for a
bounded indexed PostgreSQL P1 head projection, live migration/query-plan proof,
Project deletion tombstone and pagination behavior, durable distributed
synchronization-job ownership, and a persisted server-monotonic aggregate
activity revision if the contract declares one. The PC client does not claim
those operational owner concerns are closed.

Code and Studio rows place provider identity at the left edge and a present,
known runtime-status icon at the far right. Initializing and streaming animate;
approval, tool, and user-input waits are static attention; failed is static
failure; stale is static neutral. Unknown, `null`, or absent runtime status has
no label, icon, or reserved slot. The title truncates in remaining space; a
separate auto-aligned, end-justified trailing metadata region owns time/status
text immediately before the rightmost runtime icon. Studio does not stack time
below the title. Global lists collect the complete
currently loaded inventory before filter, global sort, and render
virtualization. A background refresh never replaces an explicit Session
selection.

## Host Boundary

Browser directory handles stay in browser capability storage. Tauri commands
own native directory selection, canonicalization, filesystem operations, Git,
worktrees, terminals, and allowlisted device state.

The Tauri SQLite table `device_state_entry` is not a business store. It cannot
contain Project, Session, Conversation, Message, Skill, transcript, or owner
SDK response records. Missing or unauthorized local capability fails closed.

## Composition Slots

- Sandbox: Agents `drive/drive`, with Drive as the target owner.
- Document: Agents `document/documents`; Documents owns content, versions,
  permissions, and lifecycle, while Agents stores only target references.

PC does not cast or serialize an unsupported slot value to bypass the owner
contract.

## Data Naming And Ownership

PC owns no business tables. Agents Workspace, Project, and Session records remain in the
`sdkwork-agents` database authority and are outside the BirdCoder database
design. The PC surface does not define aliases, persistent projections,
compatibility tables, or an additional Workspace, Project, Session,
Conversation, Message, or transcript authority. The disposable Session
Activity view is in memory and is never a read authority. Drive sandbox import
sends only the selected Workspace and Drive resource identifiers to Agents;
local paths and handles remain device-local.

Human communication remains the `sdkwork-im` Conversation/Message domain and
must never be represented as an Agents Session Item. Product AI Skills remain
owned by `sdkwork-skills`. The only PC physical table is the allowlisted local
`device_state_entry` host store described above; it is not synchronized as a
business record.

## Provider-Neutral Transcript Presentation

The PC transcript consumes only the disposable Agents Session Item view. Its
provider integration is split into protocol adapters, a presentation profile
registry, and shared React renderers. OpenCode parts, Codex items, Claude
content blocks, and Gemini events normalize before they reach user, assistant,
reasoning, tool, lifecycle, interaction, task, resource, or file-change
components.

Session Item transport uses opaque keyset cursors. Latest hydration requests
`sort=-sequence`, validates cursor progress and terminal metadata, and restores
chronological presentation order. Earlier-message loading is cancellable,
bounded, deduplicated, and exposes a persistent inline retry state. Unknown
future runtime roles or kinds use the unsupported-content renderer and are not
coerced into Assistant presentation.

The in-memory Projects Store retains no more than 500 items and 4 MiB of
estimated structured content for one Session. The estimator uses an iterative,
cycle-aware traversal capped at 65,536 nodes rather than recursive descent or
full JSON serialization. The transcript initially renders the latest 48
messages; its window state commits a stable `projectId + sessionId` scope before
remote prepend, so late Agent or Provider metadata cannot reset expanded
history. Session changes still initialize a new bounded latest window.

Turn streaming stays behind the injected Agents Session service. The generated
SDK requests `event_protocol=kernel-v1`; the adapter validates event sequence,
Session/Turn/provider identity, JSON shape, a 4 MiB per-event payload ceiling,
and 8 MiB/131,072-node whole-Turn budgets. Raw Kernel events do not cross the
service port. React receives cumulative assistant text for transient pacing and
reconciles only against authoritative completion Session Items. Animation-frame
pacing has a timer fallback and completes its drain within eight frames.

## Durable Turn Input Queue

UnifiedChat persists each busy-state submission through the injected Agents
Session service before clearing the composer. The service delegates to the
generated Agents App SDK `turnInputQueueEntries` surface. Agents owns queue
storage, owner authorization, FIFO position, mutation versions, leases,
fencing tokens, idempotency keys, payload hashes, and Turn reconciliation; PC
owns only interaction state and a bounded in-memory projection.

The Workbench queue controller hydrates at mount and after online, focus,
visibility, or validated `BroadcastChannel` invalidation. It limits the
projection to 32 entries per Session, 32 Session scopes, 4 MiB per Session,
and 16 MiB overall. Cross-window messages carry no content. A Session identity
generation fence rejects late refresh, claim, dispatch, and error effects from
the previously selected Session. Logout clears the projection but does not
delete the durable queue.

When no Turn is busy, the controller atomically claims the next entry with a
30-second lease, then submits the original Agent, Session, runtime binding,
model, access mode, client request identity, and the queue-owned
`idempotencyKey + payloadHash` pair through the existing Turn stream. A
completed dispatch immediately claims again so the owner can reconcile and
advance. Uncertain acceptance pauses for bounded reconciliation; rejected
pre-acceptance delivery is fenced into `failed` once. Owner outcomes `busy`,
`active_turn`, and `blocked` never dispatch another input.

Only queued or failed entries can be edited, reordered, removed, or retried,
using their stable `queueEntryId` and expected version. An executing entry is
immutable. A failed head pauses FIFO until an explicit retry, edit, or removal.
Clear preserves executing work, while deleting the owning Session purges the
queue. These semantics are defined in
[ADR-20260731](../../../../../docs/architecture/decisions/ADR-20260731-durable-turn-input-queue.md).

Canonical `turnId` groups transcript rows when available. A user-to-user
boundary is the rendering-only fallback. Turn position, disclosure state, and
active-tail state remain memory-only UI facts and are never persisted. The
shared presentation follows the OpenCode App hierarchy without importing its
SolidJS components, SDK types, session authority, or theme packages.

The production Vite artifact is a separately verified runtime boundary. Its
Rolldown chunk ownership uses entries-aware dependency merging for named
product and vendor groups, with `@mermaid-js` parser modules isolated at a
higher priority. The release gate parses every emitted JavaScript asset with
the TypeScript Compiler API and rejects any strongly connected component in
the complete static import/re-export graph, including self-imports. The entry
asset remains independently budgeted and no JavaScript asset may exceed 700
KiB. The production browser smoke builds the artifact with an isolated mock
application ingress before previewing it on fresh ports. It signs in through
IAM, opens the Claude Session, waits for Markdown, syntax-highlighting, and
Mermaid lazy renderers, and fails on any page exception, console error, or
failed script response.

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test
pnpm --dir apps/sdkwork-birdcoder-pc check
pnpm test:browser:smoke
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentSessionActivity.test.ts workspaceSessionInboxCoordinator.test.ts sessionInbox.test.ts
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentTurnInputQueue.test.ts agentTurnInputQueueHook.test.tsx
node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx
```

The app-local commands verify only the PC source graph and its source-linked
SDK dependencies. Cross-surface aggregation remains a repository-root concern.
