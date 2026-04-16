# BirdCoder Multi-Engine Official SDK Design

## Goal

Define a production-grade middle layer for `Codex`, `Claude`, `Gemini`, and `OpenCode` that uses official SDKs whenever they exist, combines official protocols when SDK coverage is incomplete, and exposes one canonical BirdCoder coding-runtime surface.

## Approved direction

Use a canonical runtime facade with provider-specific adapters.

- Do not build a fake one-size-fits-all provider SDK
- Do not let product packages integrate providers directly
- Do unify runtime semantics such as session, turn, event, artifact, approval, and resume
- Do preserve provider-specific advanced capabilities behind an explicit extension lane

## Official integration baseline

| Engine | Official package | Primary mode | Notes |
| --- | --- | --- | --- |
| Codex | `@openai/codex-sdk` | stable SDK | thread/turn/item/event model |
| Claude | `@anthropic-ai/claude-agent-sdk` | stable SDK | `query()` stable, session preview available |
| Gemini | `@google/gemini-cli-sdk` | stable SDK lane | agent/session/tool/skill model |
| OpenCode | `@opencode-ai/sdk` | stable SDK | client/server/openapi model |

## Architecture

The middle layer is split into:

1. canonical runtime facade
2. provider adapters
3. transport layer
4. capability and policy layer
5. extension/raw lane

## Canonical domain model

BirdCoder standardizes:

- `EngineDescriptor`
- `EngineSession`
- `EngineTurn`
- `EngineMessage`
- `EngineEvent`
- `EngineArtifact`
- `ApprovalCheckpoint`
- `CapabilitySnapshot`

Canonical event kinds:

- `session.started`
- `turn.started`
- `message.delta`
- `message.completed`
- `tool.call.requested`
- `tool.call.progress`
- `tool.call.completed`
- `artifact.upserted`
- `approval.required`
- `operation.updated`
- `turn.completed`
- `turn.failed`

## Package strategy

Introduce the `@sdkwork/birdcoder-engine*` package family and demote the current `@sdkwork/birdcoder-chat*` packages to compatibility facades.

## Contract set

Each provider package must implement:

- `EngineAdapter`
- `SessionAdapter`
- `EventNormalizer`
- `ArtifactProjector`
- `ApprovalAdapter`
- `ExtensionAdapter`
- `HealthAdapter`

## Provider rules

### Codex

Preserve threads, turns, items, structured output, and resume semantics.

### Claude

Use Agent SDK as the primary integration path. Keep headless and remote-control as supplemental official protocol lanes.

### Gemini

Preserve tools, skills, dynamic instructions, and session context.

### OpenCode

Preserve client/server split and first-class runtime artifacts such as diff, todo, pty, and question.

## Fallback policy

Only use source-derived adapters when no official SDK and no reusable official protocol exist. Source-derived integrations must be explicitly marked and may not be presented as stable official SDK integrations.

## Documentation landing

This design is written back to:

- `docs/架构/04-技术选型与可插拔策略.md`
- `docs/架构/05-统一Kernel与Code Engine标准.md`
- `docs/架构/11-行业对标与能力矩阵.md`
- `docs/架构/21-多Code-Engine协议-SDK-适配标准.md`
- `docs/reference/engine-sdk-integration.md`

## Verification plan

- update docs navigation
- run docs governance and architecture contract checks
- keep provider baseline synchronized between docs, registry, and implementation
