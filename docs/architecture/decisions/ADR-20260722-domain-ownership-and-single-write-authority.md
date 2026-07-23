# ADR-20260722 Owner-Composed Stateless Workbench

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-22
Updated: 2026-07-23
Requirement: [REQ-2026-0002](../../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Specs: ARCHITECTURE_DECISION_SPEC.md, DOMAIN_SPEC.md, API_SPEC.md, SDK_SPEC.md, DATABASE_SPEC.md, SECURITY_SPEC.md

## Context

BirdCoder is an application workbench assembled from independent SDKWork
capabilities. A local Workspace/Project model, second AI Session hierarchy,
assistant-message table, copied Skill lifecycle, or server project-path service
would duplicate established owners and force long-term synchronization.

The application has not launched. There is no production compatibility or
historical data requirement that justifies preserving those designs.

## Decision

BirdCoder becomes a stateless composition host:

| Boundary | Decision |
| --- | --- |
| Server persistence | Zero BirdCoder business tables and no database lifecycle |
| BirdCoder App API | Four read-only System operations |
| Backend/Open API | No BirdCoder operations |
| Permissions | Four System read permissions |
| Project | Canonical Agents `AgentProject` and `projectId` |
| Grouping scope | IAM organization context; no workbench Workspace aggregate |
| AI execution | Agents Session, Turn, Session Item, Interaction, and Runtime Binding |
| Skills | `sdkwork-skills` |
| Human communication | IM Conversation, Message, Member, and ReadCursor |
| Device capability | PC/Tauri local mount, filesystem, Git, worktree, terminal, and allowlisted device state |

The transition is a direct replacement. It introduces no projection, alias,
shadow record, synchronized cache authority, dual write, compatibility facade,
or cross-domain foreign key.

## Semantic Separation

An AI assistant transcript entry advances or records an Agents execution
lifecycle. It is a Session Item associated with a Session and Turn.

An IM Message represents human or channel communication with membership,
delivery, and read-cursor semantics. IM may correlate a Message with an Agent
invocation through stable identifiers, but neither module persists the other's
record. Dependency direction remains:

```text
BirdCoder -> Agents -> Kernel
BirdCoder -> IM -> Agents
Agents -/-> IM
```

## PC Composition

- Every Project workflow uses the Agents App SDK and one canonical
  `projectId`.
- Session creation uses the same `projectId` and records an opaque local
  runtime reference through Agents `sessionRuntimeBindings`.
- `ProjectDeviceMountRegistry` remains a subject-scoped PC capability keyed by
  that `projectId`.
- Sandbox composition uses the canonical Agents `drive/drive` slot.
- Document composition is unavailable until Agents supports
  `document/documents`; BirdCoder must not coerce another slot type.
- Native paths and execution handles remain in Tauri. The Rust gateway exposes
  no Project, Git, filesystem, terminal, mount, or runtime-location business
  API.

## Alternatives Rejected

### Retain A BirdCoder Project Wrapper

Rejected because it creates a second identifier and lifecycle around the
canonical Agents aggregate.

### Persist A Local Read Authority

Rejected because it requires synchronization, replay, stale-read policy, and
recovery semantics for facts BirdCoder does not own. Disposable in-memory UI
mapping is sufficient.

### Put Assistant Content In IM

Rejected because Session execution state and human message delivery have
different invariants and owners.

### Keep A Server Project-Path Registry

Rejected because the current product only implements local PC execution.
Remote execution, target enrollment, and source synchronization belong to
Agents, Kernel, and provider infrastructure.

## Consequences

- BirdCoder server deployment is stateless and horizontally replaceable.
- Owner services and SDK endpoints are explicit runtime dependencies.
- PC cannot continue when a required owner API or local mount is unavailable;
  affected operations fail closed.
- Device recovery requires user-authorized directory reselection.
- Adding a new composition type requires an upstream Agents contract before PC
  integration.
- Generated BirdCoder SDKs remain small and System-only.

## Verification

- Machine contracts agree on 0/4/0/0 operations/tables and 4 permissions.
- Rust assembly and generated SDK tests prove the System-only owner surface.
- PC architecture and type checks prove canonical Agents Project and Session
  use.
- Device-state tests prove the local allowlist.
- Reverse scans classify only deliberate negative-test patterns as retained
  legacy terms.
- Documentation build and standards validation pass.

## Supersession

This ADR is the only active BirdCoder domain-ownership decision. Any earlier
proposal for a BirdCoder database, Workspace/Project authority, distributed
project-path authority, or second AI Session/message system is superseded and
removed from active documentation.
