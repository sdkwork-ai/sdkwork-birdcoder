# REQ-2026-0003 Cross-Application Session Activity Inbox

Status: accepted
Owner: SDKWork maintainers
Source: customer
Priority: P0
Updated: 2026-07-27
Specs: REQUIREMENTS_SPEC.md, DOMAIN_SPEC.md, API_SPEC.md, SDK_SPEC.md, PAGINATION_SPEC.md, FRONTEND_SPEC.md, SECURITY_SPEC.md, DOCUMENTATION_SPEC.md

## Problem

A Session can execute in Codex, Claude Code, OpenCode, Gemini, BirdCoder, or
another application while BirdCoder is displaying the same owner-scoped
Session inventory. The durable Session record does not advance for every Turn,
Interaction, Runtime Binding, or Session user-state change. Refreshing only
when the Session version changes therefore leaves managed running Sessions
shown as ready and can hide them behind idle Sessions. Provider-native
observation is a separate, query-time signal: by itself it cannot make an old
Session enter the snapshot head.

The correction must not create another Session authority in BirdCoder. Activity
must converge from `sdkwork-agents`, remain correct across providers and
applications, expire uncertain provider evidence, and preserve user-owned UI
selection during background synchronization.

## Required Outcome

- The Agents App API paginated Session Activity summary is the canonical
  owner-scoped list snapshot for cross-application current state.
- Each summary composes the durable Session, latest relevant Turn,
  deterministic pending Interaction, current Runtime Binding, Session user
  state, provider session identity, owner fact versions, freshness, and effective
  presentation phase. No server-monotonic aggregate activity revision is
  assumed.
- The cross-application main path advances through Agents-managed Turn,
  Interaction, Runtime Binding, or Session user-state authority. Another
  application must record that lifecycle through Agents for an older Session to
  become newly eligible at the snapshot head.
- Codex, Claude Code, OpenCode, Gemini, and future providers use the same
  summary contract. Provider-specific evidence remains behind Agents runtime
  adapters and collectors, enriches only rows already selected in the current
  page, and cannot independently insert or reorder an old Session at the head.
- `stale`, `unsupported`, and `unavailable` provider observations fail closed to
  an unknown unavailable state. Unknown runtime state is not presented as a
  label, icon, or reserved slot. No file modification timestamp or static
  history entry is treated as live execution.
- A finite `freshUntil` is materialized as stale when it expires. A durable
  managed Turn in `running` state is not assigned an invented client TTL; its
  owning lifecycle or lease reconciliation must terminate it.
- BirdCoder consumes the owner snapshot through its generated Agents SDK and
  keeps only a disposable, subject-and-Workspace-scoped in-memory projection.
- Cross-tab or cross-process coordination broadcasts a scoped invalidation
  signal only. Receivers re-read the owner snapshot; Session records,
  transcripts, tokens, and provider payloads are never broadcast.
- Background refresh never replaces an explicit Session selection. The newest
  synchronized Session is a default only when the target Project has no current
  or explicit selection.
- Every Code and Studio Session row presents the provider badge as its leftmost
  visual item and places a known runtime-status icon at the far right. Busy
  states animate; attention, failure, and stale states are static. An
  `unknown`, `null`, or absent runtime status is completely silent and reserves
  no status-slot space. Title content consumes only the remaining width and
  truncates; time or rendered status text lives in a separate right-aligned
  trailing metadata region immediately before the runtime icon. Studio does not
  place this metadata beneath the title.
- Global views collect the complete currently loaded inventory, then filter,
  globally sort, and finally render or virtualize the visible window.

## Non-Goals

- A BirdCoder Session Activity database, durable cache, event log, replica, or
  second synchronization authority.
- Broadcasting owner records or provider payloads between browser contexts.
- Inferring live state from provider history files, working-tree changes, or
  process-independent timestamps.
- Treating a continuation cursor as a durable change-feed watermark.
- Silently changing provider session identity ownership or migrating a
  provider-agnostic provider Session key.

## Acceptance Criteria

1. BirdCoder refreshes the Agents Session Activity summary from a null cursor,
   follows bounded `nextCursor` pages when required, and does not use a Session
   version as the sole activity change detector.
2. A Session executing in another application is projected as running without
   requiring BirdCoder to have initiated the Turn when that application has
   recorded the managed Turn, Interaction, Runtime Binding, or user-state
   lifecycle through Agents.
3. Codex and Claude Code Sessions inside one authorized owner scope retain
   their canonical provider, model, runtime, Project, and Session identities;
   cross-tenant provider Session identity is not claimed complete by this requirement.
4. `queued` and `running` phases map to animated `initializing` and `streaming`
   presentation; no wait state animates as busy.
5. Approval, tool, and user-question waits map to distinct static attention
   presentation; failed state is explicit.
6. Expired, stale, unsupported, or unavailable activity does not leave a
   permanent spinner and cannot be presented as known ready state.
7. The status slot is the first Session-row visual slot, precedes provider
   identity, and reserves the same dimensions for active and idle rows.
8. An explicit Code or Studio Session selection survives background inventory
   and activity refresh.
9. Smart sorting uses the complete currently loaded inventory and places busy
   Sessions ahead of idle Sessions independently of Project-local render
   windows.
10. Cross-context messages contain only a validated scope key and invalidation
    kind; every receiver re-fetches authority data.
11. Browser or Tauri persistence contains no Session Activity summary or
    provider activity observation.
12. Owner API, workbench synchronization, status mapping, row presentation,
    selection stability, pagination, and documentation checks pass.

## Launch Blockers

The requirement and architecture direction are accepted, but production launch
remains blocked until Agents and Kernel maintainers review and close all of the
following with owner-side contracts, migrations, and executable evidence:

1. The PostgreSQL P1 path has a bounded indexed Session Activity head
   projection and production query-plan evidence; an in-memory index or a
   source-level query assertion is not sufficient.
2. Provider Session identity is scoped across tenant, organization, provider,
   runtime, and provider Session dimensions without cross-tenant or cross-provider
   collision; no raw `providerSessionId` global uniqueness assumption remains.
3. Project deletion has an explicit Session Activity tombstone and pagination
   contract. Current Session tombstone behavior does not prove Project deletion
   behavior.
4. If consumers require an aggregate activity revision, Agents exposes a
   server-monotonic contract with persistence and ordering evidence. Until then,
   BirdCoder must compare the returned owner fact versions and snapshot fields
   without describing them as one monotonic revision.

Provider collector registration is also not a substitute for an indexed
managed activity write. Unregistered, unavailable, or non-indexable
provider-only observation fails closed and cannot be used to claim complete
cross-application head discovery.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Cohesion | Agents owns the complete activity projection and provider evidence contract. |
| Consistency | Poll, resume, explicit invalidation, and freshness expiry converge for Sessions selected by the managed authority head. |
| Performance | Owner cursor pagination, bounded hydration, request deduplication, and final render virtualization are preserved. |
| Reliability | Superseded requests cannot overwrite newer state; failures back off and resume on visibility or connectivity recovery. |
| Security | Subject and Workspace scope bind every read and invalidation; content, credentials, and provider payloads never enter the invalidation channel. |
| Accessibility | Status meaning is available without animation or color alone, and idle rows retain stable geometry. |

## Traceability

- [ADR-20260727](../../architecture/decisions/ADR-20260727-cross-application-session-activity-inbox.md)
- [REQ-2026-0002](REQ-2026-0002-domain-ownership-convergence.md)
- [Product requirements](../prd/PRD.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [PC product supplement](../../../apps/sdkwork-birdcoder-pc/docs/product/prd/PRD.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)

## Verification

```bash
pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentSessionActivity.test.ts workspaceSessionInboxCoordinator.test.ts sessionInbox.test.ts
node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx
node scripts/code-session-executing-ui-contract.test.mjs
node scripts/studio-chat-header-contract.test.mjs
pnpm check:agents-birdcoder-alignment
pnpm typecheck
pnpm lint
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm docs:build
```
