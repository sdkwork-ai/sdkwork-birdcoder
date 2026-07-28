# SDKWork BirdCoder PC Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-27
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
- Cross-application head eligibility is driven by Agents-managed Turn,
  Interaction, Runtime Binding, and Session user-state facts. Provider-native
  observation only enriches rows already returned in the current page and
  cannot make an older Session enter or reorder the head.
- Cross-tab or cross-process Session coordination broadcasts scoped
  invalidation only. It does not broadcast or persist Session records,
  transcripts, tokens, or provider payloads.
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
  compatibility fields or delegation to a repository-wide mobile gate.
- Owner SDK calls use the shared TokenManager and correct connectivity plane.
- Project and Session views preserve canonical identifiers.
- Codex, Claude Code, and other provider Sessions share one activity contract;
  stale, unsupported, unavailable, or expired provider evidence is neutral and
  never leaves a permanent running animation.
- Codex, Claude Code, OpenCode, and Gemini transcripts share one message and
  turn presentation contract. Provider protocol differences stay behind
  adapters, while provider identity remains contextual metadata rather than a
  separate transcript skin.
- Production acceptance remains blocked on the REQ-2026-0003 PostgreSQL P1
  indexed head, collision-safe cross-tenant provider Session identity, Project deletion
  tombstone, and any declared server-monotonic activity revision. Agents and
  Kernel maintainers must review and close those owner contracts.
- Code and Studio Session rows place the provider badge at the left edge and a
  known runtime-status icon at the far right. Busy states animate; waits,
  failure, and stale remain static. Unknown, `null`, or absent runtime status is
  silent and reserves no status-slot space. A separate right-aligned trailing
  metadata region owns time/status text, while the title truncates in remaining
  space; Studio does not stack time below the title.
- Global Session views filter and sort the complete currently loaded inventory
  before rendering or virtualization.
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
- [Runtime bindings and device mounts](../../../../../docs/guides/operator/runtime-bindings-and-device-mounts.md)
