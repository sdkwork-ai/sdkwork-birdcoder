# Engine SDK Integration

This document is the technical implementation reference for BirdCoder's multi-engine middle layer.

## Scope

It defines how BirdCoder should integrate Codex, Claude, Gemini, and OpenCode through official SDKs, normalize their runtime semantics, and expose one canonical runtime surface to product packages.

## Official package baseline

| Engine | Official package | Integration class | Stable primary lane | Supplemental lane |
| --- | --- | --- | --- | --- |
| Codex | `@openai/codex-sdk` | `official-sdk` | SDK thread API | CLI JSONL, app-server JSON-RPC |
| Claude | `@anthropic-ai/claude-agent-sdk` | `official-sdk` | Agent SDK `query()` | Headless CLI, remote-control, preview sessions |
| Gemini | `@google/gemini-cli-sdk` | `official-sdk` | SDK agent/session API | CLI/core runtime |
| OpenCode | `@opencode-ai/sdk` | `official-sdk` | SDK client/server API | OpenAPI, SSE |

## Local mirror truth

- `Codex` uses `external/codex/sdk/typescript` as the local official SDK mirror root.
- `Claude` keeps `external/claude-code` only as a local protocol/source mirror. It is not the official Agent SDK package root.
- `Gemini` uses `external/gemini/packages/sdk` as the local official SDK mirror root.
- `OpenCode` uses `external/opencode/packages/sdk/js` as the local JavaScript SDK package root.

## Health semantics

- `describeIntegration()` declares the canonical BirdCoder integration strategy and keeps the provider classified as `official-sdk`.
- `getHealth()` reports the actual runtime lane selected in the current environment.
- If the official SDK package is not installed locally, health must expose the fallback lane instead of pretending the runtime is still on `sdk`.
- Fallback activation, missing auth, local mirror version, and executable visibility must remain visible in diagnostics.

## Runtime execution selection

- Provider adapters must not stop at metadata-only official SDK declarations.
- `sendMessage()` and `sendMessageStream()` must prefer a provider-specific official SDK bridge when one can be loaded.
- If the provider bridge cannot be loaded, BirdCoder must fall back to the deterministic local transport-compatible implementation for that engine.
- Runtime bridge loading failure is a transport/bootstrap concern. It may trigger fallback.
- Once a provider bridge is loaded successfully, request execution errors should surface to the caller instead of being silently rewritten as fallback success.

## Shared bridge contract

The current middle layer standardizes the provider runtime bridge through a small shared contract:

- `ChatEngineOfficialSdkBridge`
- `ChatEngineOfficialSdkBridgeLoader`
- `invokeWithOptionalOfficialSdk()`
- `streamWithOptionalOfficialSdk()`
- `createModuleBackedOfficialSdkBridgeLoader()`

This keeps runtime selection logic centralized in `sdkwork-birdcoder-chat`, while each provider package remains responsible for mapping its official SDK API into BirdCoder's canonical `ChatResponse` and `ChatStreamChunk`.

`packages/sdkwork-birdcoder-chat/src/providerAdapter.ts` must also remain browser-safe:

- no static `node:*` imports
- Node builtin access only through lazy `process.getBuiltinModule(...)`
- provider candidate imports must keep `/* @vite-ignore */` so Vite does not prebundle environment-specific SDK roots

Provider packages should also expose their official bridge factory as a stable adapter-internal entrypoint so bridge-level contract tests can verify one-shot and streaming normalization without going through the full engine wrapper.

Provider package manifest rules:

- Each provider package must declare its own official SDK as an optional `peerDependencies` entry.
- Official SDK peer versions must be governed from the root `pnpm-workspace.yaml` `catalog`.
- Official SDK peer dependencies must not move into `dependencies` or `devDependencies`, because runtime selection still permits mirror-backed and deterministic fallback lanes.

## Module candidate policy

- Every provider should try the installed official package first.
- Local mirror entry paths may be attempted only as development-time supplemental candidates.
- `Claude` must not treat `external/claude-code` as the official SDK root candidate.
- `OpenCode` must use the JavaScript SDK root under `external/opencode/packages/sdk/js`.

## Provider runtime mapping

- `Codex` maps `Codex().startThread().run()` and `runStreamed()` into BirdCoder one-shot and streaming completions.
- `Claude` maps the Agent SDK `unstable_v2_prompt()` and `query()` surfaces into BirdCoder one-shot and streaming completions.
- When a Claude `query()` stream emits partial assistant deltas and later reports the full final assistant text in its `result` event, the bridge must emit only the non-overlapping suffix so canonical streams do not duplicate already-streamed text.
- `Gemini` maps `GeminiCliAgent().session().sendStream()` into BirdCoder one-shot and streaming completions.
- `OpenCode` maps the official SDK session client into BirdCoder one-shot completions through `session.prompt()`, and maps `session.promptAsync()` plus `event.subscribe()` SSE into native canonical streaming.

## Canonical fallback rule

- Fallback behavior remains provider-shaped rather than collapsing all engines into one generic mock.
- Canonical runtime wrappers must preserve provider `describeIntegration()`, `getHealth()`, `getCapabilities()`, and `describeRawExtensions()` even when execution falls back.
- The explicit `extensions/raw` lane remains the only place where provider-native semantics are exposed directly.

## Package layout

BirdCoder should converge on the following package family:

- `@sdkwork/birdcoder-engine`
- `@sdkwork/birdcoder-engine-types`
- `@sdkwork/birdcoder-engine-runtime`
- `@sdkwork/birdcoder-engine-transport`
- `@sdkwork/birdcoder-engine-registry`
- `@sdkwork/birdcoder-engine-codex`
- `@sdkwork/birdcoder-engine-claude`
- `@sdkwork/birdcoder-engine-gemini`
- `@sdkwork/birdcoder-engine-opencode`

The existing `@sdkwork/birdcoder-chat*` packages are compatibility wrappers and must not remain the long-term production integration center.

## Canonical runtime objects

The middle layer must standardize these runtime objects:

- `EngineDescriptor`
- `EngineSession`
- `EngineTurn`
- `EngineMessage`
- `EngineEvent`
- `EngineArtifact`
- `ApprovalCheckpoint`
- `CapabilitySnapshot`

## Canonical event kinds

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

## Canonical artifact kinds

- `diff`
- `patch`
- `file`
- `command-log`
- `todo-list`
- `pty-transcript`
- `structured-output`
- `build-evidence`
- `preview-evidence`
- `simulator-evidence`
- `test-evidence`
- `release-evidence`
- `diagnostic-bundle`

## Required adapter contracts

Every provider package must implement:

- `EngineAdapter`
- `SessionAdapter`
- `EventNormalizer`
- `ArtifactProjector`
- `ApprovalAdapter`
- `ExtensionAdapter`
- `HealthAdapter`

## Recommended TypeScript shape

```ts
export interface EngineAdapter {
  readonly descriptor: EngineDescriptor;
  listModels(): Promise<readonly EngineModelEntry[]>;
  getHealth(): Promise<EngineHealthReport>;
  getCapabilities(input?: CapabilityProbeInput): Promise<CapabilitySnapshot>;
  startSession(input: StartSessionInput): Promise<EngineSessionHandle>;
  resumeSession(input: ResumeSessionInput): Promise<EngineSessionHandle>;
}

export interface EngineSessionHandle {
  readonly session: EngineSession;
  sendTurn(input: SendTurnInput): Promise<EngineTurnHandle>;
  close(): Promise<void>;
}

export interface EngineTurnHandle {
  readonly turn: EngineTurn;
  readonly events: AsyncIterable<EngineEvent>;
}
```

## Transport rules

- `transport` is responsible for connectivity and framing only
- `adapter` is responsible for semantic normalization
- product packages must never parse provider-native events directly
- provider-native DTOs must not escape adapter boundaries

## Provider implementation notes

### Codex

- Preserve thread continuity and turn boundaries
- Normalize `item.*` into message, tool, and artifact updates
- Support structured output and resume semantics

### Claude

- Prefer Agent SDK over protocol-only integration
- Keep headless and remote-control as supplemental lanes
- Treat preview session APIs as experimental capability, not stable baseline

### Gemini

- Preserve tool registry, skill loading, and dynamic instruction assembly
- Keep file-system and shell context under session context, not page-layer glue

### OpenCode

- Preserve server/client duality
- Keep `diff`, `todo`, and `pty` as first-class artifacts or operations

## Source-derived fallback policy

Use `source-derived` only when:

- there is no official SDK
- there is no reusable official protocol
- the capability is still required
- the adapter is explicitly marked as source-derived in docs, registry, and health output

## Governance requirements

- no product package may import provider SDKs directly
- every provider must ship contract tests for descriptor, capability, event normalization, and artifact projection
- preview APIs must be feature-gated
- `getCapabilities().experimentalCapabilities` may expose provider experimental features only while the resolved runtime remains `sdk`; fallback snapshots must suppress them
- fallback modes must be visible in health diagnostics
- canonical event kinds and artifact kinds must remain registry-controlled

## Minimum verification checklist

- descriptor contract test
- capability snapshot test
- session lifecycle test
- streamed event normalization test
- artifact projection test
- approval mapping test
- health/fallback test
- official SDK runtime-selection contract test
- official SDK error-propagation contract test
- experimental capability gating contract test
- product-package provider-SDK import governance contract test
- provider SDK package-manifest contract test
- provider-adapter browser-safety contract test
- canonical event/artifact registry governance contract test
