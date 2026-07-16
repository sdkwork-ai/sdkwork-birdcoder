# SDKWork BirdCoder PC Product Supplement

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder-pc
Updated: 2026-07-16
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md

This is a PC-surface supplement, not a competing product Canon. Product scope,
outcomes, requirements, and release gates remain in the root
[BirdCoder PRD](../../../../../docs/product/prd/PRD.md).

## PC Surface Scope

The PC surface presents the same BirdCoder application model in browser and
Tauri modes. Tauri may read provider-native session details through its
authorized local host boundary; browser mode does not gain provider SDK access
or a desktop filesystem capability from the renderer.

## Coding-Session Experience

The workbench starts a new coding session from an explicit P0 provider and
model selection: codex, claude-code, gemini, or opencode. The resulting
engine/model pair belongs to that newly created logical session and is not
changed in place. A different selection creates another session.

The UI keeps BirdCoder's codingSessionId as the application identity. For a
bound native conversation, desktop detail reads use the persisted engineId and
raw nativeSessionId, then project the result back onto the logical session. A
native binding is never replaced with a different provider conversation.

## Canonical References

- [Root PRD](../../../../../docs/product/prd/PRD.md)
- [Root technical architecture](../../../../../docs/architecture/tech/TECH_ARCHITECTURE.md)
- [Engine SDK integration](../../../../../docs/reference/engine-sdk-integration.md)
- [API reference](../../../../../docs/reference/api-reference.md)
