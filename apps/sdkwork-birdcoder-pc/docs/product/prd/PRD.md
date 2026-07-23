# SDKWork BirdCoder PC Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-23
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md

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
- Render Session Items without a local transcript authority.
- Bind a Session to an opaque local runtime id through Agents.
- Authorize a local directory on the current device and use it for filesystem,
  Git, worktree, and terminal actions.
- Use Skills and other platform capabilities through their owner SDKs.

## Product Boundaries

- IAM organization scope replaces workbench Workspace grouping.
- PC does not create a BirdCoder Project or second Project id.
- Device mounts are subject-scoped local capability material.
- Native paths and execution handles do not enter server APIs.
- Sandbox composition uses Agents `drive/drive`.
- Project document composition is explicitly unavailable until Agents adds
  `document/documents`.
- Missing owner SDK connectivity, local permission, mount, runtime binding, or
  composition support fails closed.

## Acceptance

- PC typecheck and architecture gates pass without compatibility fields.
- Owner SDK calls use the shared TokenManager and correct connectivity plane.
- Project and Session views preserve canonical identifiers.
- Local storage contains no Project, Session, Conversation, Message, or Skill
  business record.
- Filesystem and execution actions never use process-CWD or unrelated-mount
  fallback.

## References

- [Repository PRD](../../../../../docs/product/prd/PRD.md)
- [PC architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Runtime bindings and device mounts](../../../../../docs/guides/operator/runtime-bindings-and-device-mounts.md)
