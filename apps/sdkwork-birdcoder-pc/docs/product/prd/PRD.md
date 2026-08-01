# SDKWork BirdCoder PC Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-31
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, FRONTEND_SPEC.md, PAGINATION_SPEC.md

This document narrows the
[repository PRD](../../../../../docs/product/prd/PRD.md) to PC behavior.

## Scope

PC provides Project navigation, editor, terminal, Git/worktree, filesystem,
multiwindow, and AI-assisted coding workflows for browser and Tauri hosts.

AI workflows use Agents Project, Session, Turn, Session Item, Interaction, and
Runtime Binding resources. Human communication, when enabled, uses IM
Conversation and Message resources. A shared visual chat surface does not merge
their business semantics.

## User Outcomes

- Select or create one canonical Agents Project.
- Create and continue Agents Sessions under the same `projectId`.
- See owner-scoped Session activity from BirdCoder, Codex, Claude Code,
  OpenCode, Gemini, and future providers in one synchronized Inbox.
- Render Session Items without a local transcript authority.
- Render Codex, Claude Code, OpenCode, and Gemini Session Items through one
  provider-neutral turn hierarchy with semantic tools, reasoning, lifecycle,
  interactions, resources, and file-change presentation.
- Queue later Turn inputs while a Session is busy, manage them by stable
  identity, and resume FIFO execution after restart or reconnect.
- Bind a Session to an opaque local runtime id through Agents.
- Authorize a local directory on the current device and use it for filesystem,
  Git, worktree, and terminal actions.
- Use Skills and other platform capabilities through their owner SDKs.

## Product Boundaries

- Agents `AgentWorkspace/workspaceId` is the workbench grouping identity. IAM
  organization is authorization and subject scope and never replaces
  Workspace identity.
- PC does not create a BirdCoder Project or second Project id.
- PC consumes the paginated Agents Session Activity summary through the
  generated owner SDK and keeps only a disposable in-memory projection.
  Project and Session refreshes are read-only. Only explicit folder import or
  re-import synchronizes provider inventory, and the command never accepts
  paths or directory fingerprints from the client.
- Cross-application head eligibility is driven by Agents-managed Turn,
  Interaction, Runtime Binding, and Session user-state facts. Provider-native
  observation only enriches rows already returned in the current page and
  cannot make an older Session enter or reorder the head.
- Cross-tab or cross-process Session coordination broadcasts scoped
  invalidation only. It does not broadcast or persist Session records,
  transcripts, tokens, or provider payloads.
- Agents owns the owner-scoped durable Turn input queue. PC persists every busy
  submission through the generated Agents App SDK before clearing the composer
  and keeps only a bounded in-memory projection. Atomic claim, fencing token,
  queue-owned idempotency key, and payload hash prevent duplicate execution
  across browser windows and delivery retries. PC supplies a stable queue entry
  ID for uncertain create retries, uses latest-wins hydration plus mutation
  fencing, and pauses local claims while any queue entry is being edited.
- Background synchronization preserves explicit Session selection. A
  synchronized newest Session is only a default when the target Project has no
  current or explicit selection.
- Device mounts are subject-scoped local capability material.
- Native paths and execution handles do not enter server APIs.
- Sandbox composition uses Agents `drive/drive`.
- Project document composition uses Agents `document/documents`; document
  content and lifecycle remain in Documents.
- Missing owner SDK connectivity, local permission, mount, runtime binding, or
  composition support fails closed.

## Acceptance

- PC-scoped lint, tests, production build, and architecture gates pass without
  compatibility fields or delegation to a repository-wide mobile gate. The
  production browser artifact is previewed on isolated ports and must complete
  IAM sign-in plus Markdown, TypeScript highlighting, and Mermaid rendering
  without page, console, or script-load errors.
- Owner SDK calls use the shared TokenManager and correct connectivity plane.
- Project and Session views preserve canonical identifiers.
- Session is the only agent-continuation name in PC application code and UI.
  Codex Thread terminology is accepted only as raw adapter input and is
  converted to Session identity and `providerSessionId` before it reaches
  shell, UI, stores, services, events, or authored contracts.
- `Ctrl/Cmd+F` searches only the current Session transcript, resets when the
  selected Session changes, highlights visible matches with a distinct active
  result, caps retained matches at 150, and uses Session-named commands and
  state. Enter/Shift+Enter and next/previous controls wrap through results;
  Escape closes the bar and restores focus. Project-wide file search remains a
  separate `Ctrl/Cmd+Shift+F` command.
- Codex, Claude Code, and other provider Sessions share one activity contract;
  stale, unsupported, unavailable, or expired provider evidence is neutral and
  never leaves a permanent running animation.
- Codex, Claude Code, OpenCode, and Gemini transcripts share one message and
  turn presentation contract. Provider protocol differences stay behind
  adapters, while provider identity remains contextual metadata rather than a
  separate transcript skin.
- Provider session identity, database uniqueness baseline, and title authority
  are implemented by Agents: provider titles refresh only while provider-owned;
  user renames survive inventory synchronization. Production acceptance remains
  blocked on REQ-2026-0003 PostgreSQL migration/query-plan evidence, Project
  deletion tombstone pagination, distributed synchronization-job ownership, and
  any declared server-monotonic activity revision. Agents and Kernel maintainers
  must review and close those operational owner contracts.
- Code and Studio Session rows place the provider badge at the left edge and a
  known runtime-status icon at the far right. Busy states animate; waits,
  failure, and stale remain static. Unknown, `null`, or absent runtime status is
  silent and reserves no status-slot space. A separate right-aligned trailing
  metadata region owns time/status text, while the title truncates in remaining
  space; Studio does not stack time below the title.
- Global Session views filter and sort the complete currently loaded inventory
  before rendering or virtualization.
- Session Item history uses opaque keyset cursors and bounded newest/history
  windows. Earlier-message failure remains visible with an in-context retry;
  unknown future content remains visible as unsupported rather than being
  mislabeled as assistant output.
- The transcript keeps at most 500 items and 4 MiB of estimated structured
  content per Session. Deep provider payloads are measured iteratively under a
  node budget, and the progressive latest-48 window is keyed only by stable
  Project and Session identity so metadata enrichment cannot collapse history.
- Turn streaming uses the generated Agents SDK `kernel-v1` protocol. Runtime
  events are validated for order, identity, JSON shape, and aggregate budgets
  inside the service boundary; React receives provider-neutral Session Items,
  never raw Kernel events. The durable completion remains authoritative.
- Queue hydration runs at startup and after focus, visibility, connectivity,
  or cross-window invalidation. A completed Turn advances FIFO; uncertain
  delivery remains executing for owner reconciliation; a rejected dispatch is
  marked failed once and pauses the head until retry, edit, or removal.
  Executing entries cannot be edited, reordered, or removed. Clear preserves
  the executing entry, Session deletion purges its queue, and logout clears
  only the disposable PC projection.
- Local storage contains no Project, Session, Conversation, Message, or Skill
  business record.
- Filesystem and execution actions never use process-CWD or unrelated-mount
  fallback.

## References

- [Repository PRD](../../../../../docs/product/prd/PRD.md)
- [PC architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Cross-application Session Activity requirement](../../../../../docs/product/requirements/REQ-2026-0003-cross-application-session-activity-inbox.md)
- [Cross-application Session Activity ADR](../../../../../docs/architecture/decisions/ADR-20260727-cross-application-session-activity-inbox.md)
- [Provider-neutral transcript requirement](../../../../../docs/product/requirements/REQ-2026-0004-provider-neutral-session-transcript.md)
- [Provider-neutral transcript ADR](../../../../../docs/architecture/decisions/ADR-20260728-provider-neutral-session-transcript.md)
- [Durable Turn input queue ADR](../../../../../docs/architecture/decisions/ADR-20260731-durable-turn-input-queue.md)
- [Runtime bindings and device mounts](../../../../../docs/guides/operator/runtime-bindings-and-device-mounts.md)
