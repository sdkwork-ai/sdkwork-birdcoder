# SDKWork BirdCoder PC Workbench Specs

This directory indexes the local contract for `@sdkwork/birdcoder-pc-workbench`.
The machine authority is [component.spec.json](./component.spec.json); global rules
remain in [sdkwork-specs](../../../../../../sdkwork-specs/README.md).

## Owned Boundary

The package owns coding-workbench UI, UI state, terminal presentation, and
bounded device-local workbench settings. It consumes business facts through
injected services and owner-generated SDKs.

## Session List Presentation

Session rows are memory-only projections of `sdkwork-agents` facts. The
owner-scoped, cursor-paginated Session Activity summary composes Session,
latest relevant Turn, pending Interaction, current Runtime Binding, Session
user state, provider session identity, owner fact versions, freshness, and
effective phase. No server-monotonic aggregate activity revision is assumed. A
row is merged when managed authority facts change even if the Session version
is unchanged. Each refresh cycle starts at the snapshot head; a cursor is
continuation for that traversal, not a durable change-feed watermark.

Agents-managed Session, Turn, Interaction, Runtime Binding, and Session
user-state facts determine head eligibility and order. Provider-native
observation is page-local enrichment for a row already selected by that head;
it cannot make an older Session enter or reorder the head. Missing collector
registration, unavailable lookup, or non-indexable provider-only evidence fails
closed to unsupported, unavailable, stale, or unknown.

The synchronization coordinator is scoped by authenticated subject and Agents
Workspace. It deduplicates subscribers, rejects superseded responses at Store
commit, backs off after failures, pauses while hidden or offline, and refreshes
on resume or explicit invalidation. Cross-context coordination broadcasts only
a validated scope-key invalidation. Receivers re-read Agents; Session rows,
transcripts, tokens, provider observations, and provider payloads are neither
broadcast nor persisted. The Projects Store view is disposable and never an
authority.

Finite `freshUntil` expiry is materialized in the workbench so sorting,
filtering, action guards, Code, and Studio use one effective status. Stale,
unsupported, unavailable, or expired provider evidence becomes neutral unknown
or stale; provider history file timestamps are not live evidence. A durable
managed Turn that remains running is not assigned an invented client timeout.

Code and Studio consume the shared PC UI runtime-status slot: `initializing`
and `streaming` are animated busy states; approval, tool, and user-question
waits are static attention states; `failed` is explicit; `stale` is static
neutral. Provider identity is the leftmost visual item and a known runtime icon
is trailing. `unknown`, `null`, or absent runtime status has no label, icon, or
reserved slot.

The workbench contract does not claim that the PostgreSQL P1 indexed head,
cross-tenant provider Session identity, Project deletion tombstone, or a
server-monotonic aggregate activity revision is complete. Those remain
REQ-2026-0003 launch blockers requiring Agents and Kernel maintainer review and
owner-side executable evidence.

Global Session views build the complete currently loaded candidate inventory,
then filter, globally sort, and finally virtualize rendered rows. Per-project
server pagination remains a separate continuation concern and must not hide an
already loaded running or pinned Session. Inventory synchronization does not
replace an explicit Session selection; synchronized latest Session selection is
only a default when the target project has no current or explicit selection.

## Project Git Overview Subscription

`./workbench/projectGitOverviewSubscription` owns Git overview request
deduplication, timeout handling, cache lifetime, and typed state transitions. Its
inputs are surface activation, project identity, and an injected Git overview
source. Project-path resolution and persisted mount recovery remain inside the
Git runtime service. Its output is a subscription with discriminated
`idle`, `loading`, repository-status, and `error` snapshots. React hooks and UI
surfaces adapt this contract but do not own Git process detection.

## Local Settings

`./storage/localStore` stores only non-sensitive presentation and device settings
such as workbench preferences, bounded run configurations, and recovery UI state.
It does not store IAM credentials, projects, agent sessions, assistant items,
prompts, skills, documents, or any server-owned business record.

## Terminal Governance Diagnostics

Terminal launch preflight keeps at most 100 normalized diagnostics in process
memory. The buffer is cleared whenever the application session changes and is
never written to Web Storage or the native SQLite key-value store. It is a
short-lived troubleshooting surface, not the terminal audit authority; durable
governance records require an owner-defined `sdkwork-terminal` service port.

## Verification

- `pnpm --filter @sdkwork/birdcoder-pc-workbench typecheck`
- `node scripts/local-store-contract.test.ts`
- `node scripts/run-config-contract.test.ts`
- `pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentSessionActivity.test.ts workspaceSessionInboxCoordinator.test.ts sessionInbox.test.ts`
- `node scripts/run-local-tsx.mjs scripts/session-list-presentation-contract.test.tsx`
- `node scripts/run-local-tsx.mjs apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/projectGitOverviewSubscription.test.ts`
- `node scripts/terminal-governance-runtime-contract.test.ts`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
