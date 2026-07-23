# SDKWork BirdCoder PC Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-22
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md

This document narrows the root [BirdCoder PRD](../../../../../docs/product/prd/PRD.md)
to browser and Tauri behavior. The root PRD remains the product Canon.

## PC Surface Scope

The PC surface provides the coding workbench, project navigation, editor,
terminal, Git, and AI-assisted coding workflows. Browser and Tauri share the
same feature services and owner SDK contracts; Tauri adds explicitly injected
local filesystem and terminal capabilities.

AI-assisted coding uses the Agents aggregate end to end. BirdCoder selects an
Agents Project, creates or selects an Agents Session, submits Turns, and renders
Session Items. The Agents Session id is the only AI-session identity. Provider,
model, native-session, runtime binding, interaction, artifact, and checkpoint
facts remain owned by `sdkwork-agents`.

## Product Boundaries

- BirdCoder owns workspace, project, runtime-location, document-binding, and
  sandbox-binding behavior only.
- A BirdCoder project may keep the stable default Agents Project id required to
  enter the assistant workflow; it does not persist a Session or transcript.
- AI transcript items are Agents Session Items. Human Conversation, Message,
  Member, and ReadCursor workflows, when enabled, use `sdkwork-im` and remain a
  different business capability.
- Skill packages and installations use `sdkwork-skills`; saved prompts use
  `sdkwork-prompts`; document content uses `sdkwork-documents`.
- Browser code never receives provider credentials, plaintext remote project
  roots, or native provider-session authority.

## Acceptance

The PC surface must consume generated owner SDKs or approved composed services,
share the application TokenManager for authenticated App SDKs, keep local host
capabilities behind typed adapters, and fail closed when an authorized runtime
location is unavailable. It must not add raw HTTP, copied DTOs, local business
persistence, transcript projections, or a compatibility Session facade.

## Canonical References

- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [API reference](../../../../../docs/reference/api-reference.md)
