# SDKWork BirdCoder PC Architecture Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-27
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

Session creation and local execution context use:

1. the selected canonical `projectId`;
2. a subject-scoped `ProjectDeviceMountRegistry` record;
3. the Agents Session;
4. Agents `sessionRuntimeBindings` with the opaque Tauri runtime id.

The Session list uses the Agents App API Session Activity summary rather than
inferring state from the Session version. The owner snapshot composes Session,
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

Production launch remains blocked until Agents and Kernel maintainers approve
evidence for a bounded indexed PostgreSQL P1 head projection, collision-safe
tenant/organization/provider/runtime/provider Session identity, Project deletion
tombstone and pagination behavior, and a persisted server-monotonic aggregate
activity revision if the contract declares one. The PC client does not claim
those owner concerns are closed.

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

Canonical `turnId` groups transcript rows when available. A user-to-user
boundary is the rendering-only fallback. Turn position, disclosure state, and
active-tail state remain memory-only UI facts and are never persisted. The
shared presentation follows the OpenCode App hierarchy without importing its
SolidJS components, SDK types, session authority, or theme packages.

## Verification

```bash
pnpm --dir apps/sdkwork-birdcoder-pc lint
pnpm --dir apps/sdkwork-birdcoder-pc test
pnpm --dir apps/sdkwork-birdcoder-pc check
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentSessionActivity.test.ts workspaceSessionInboxCoordinator.test.ts sessionInbox.test.ts
node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx
```

The app-local commands verify only the PC source graph and its source-linked
SDK dependencies. Cross-surface aggregation remains a repository-root concern.
