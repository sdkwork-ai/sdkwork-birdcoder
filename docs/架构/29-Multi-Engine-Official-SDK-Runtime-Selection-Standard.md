# Multi-Engine Official SDK Runtime Selection Standard

## Purpose

This addendum turns the existing multi-engine SDK architecture from a metadata-only standard into an execution-time standard.

BirdCoder must not only declare `official-sdk` in descriptors. It must also route real engine execution through the official SDK path when that path is available.

## Scope

This standard applies to:

- `packages/sdkwork-birdcoder-chat/src/providerAdapter.ts`
- `packages/sdkwork-birdcoder-chat-codex`
- `packages/sdkwork-birdcoder-chat-claude`
- `packages/sdkwork-birdcoder-chat-gemini`
- `packages/sdkwork-birdcoder-chat-opencode`
- `packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts`

## Core rules

- Provider adapters must expose one canonical BirdCoder interface and one provider-specific official SDK bridge.
- The canonical adapter surface must remain stable even if the provider SDK runtime is absent.
- Runtime selection must happen inside the adapter layer, not in product packages and not in the workbench shell.
- Product packages must never import provider SDKs directly.
- Provider adapter packages must declare their own official SDK as an optional peer dependency governed from the root catalog.

## Shared abstraction

The middle layer standard is a small shared bridge contract:

- `ChatEngineOfficialSdkBridge`
- `ChatEngineOfficialSdkBridgeLoader`
- `createModuleBackedOfficialSdkBridgeLoader()`
- `invokeWithOptionalOfficialSdk()`
- `streamWithOptionalOfficialSdk()`
- Provider packages should expose their official bridge factory for direct bridge-level contract testing and adapter reuse.

This is the required abstraction boundary between BirdCoder's canonical engine contract and provider-specific SDK execution details.

Additional shared-layer safety rules:

- `providerAdapter.ts` must stay browser-safe and must not reintroduce static `node:*` imports
- Node builtin access must stay lazy through `process.getBuiltinModule(...)`
- provider candidate dynamic imports must preserve `/* @vite-ignore */`

## Runtime selection order

Provider adapters must resolve runtime execution in this order:

1. Try the installed official SDK package.
2. Try approved local mirror entry candidates when they represent a real SDK package root.
3. If no bridge can be loaded, use the deterministic provider-shaped fallback path.

Additional rules:

- `Claude` must not promote `external/claude-code` to an official SDK package root.
- `OpenCode` local mirror candidates must point to `external/opencode/packages/sdk/js`.
- Bridge load failure is allowed to trigger fallback.
- Bridge execution failure after successful load should surface as an error unless the provider explicitly documents a narrower retry rule.

## Provider-specific execution standard

### Codex

- Primary lane: `@openai/codex-sdk`
- Runtime mapping: `Codex().startThread().run()` and `runStreamed()`
- Native semantics preserved through raw lane: thread, turn, item

### Claude

- Primary lane: `@anthropic-ai/claude-agent-sdk`
- Runtime mapping: Agent SDK prompt/query surfaces
- Query-stream `result` events must emit only the non-overlapping suffix when earlier partials already carried the same text
- Native semantics preserved through raw lane: agent progress, tool progress, approval

### Gemini

- Primary lane: `@google/gemini-cli-sdk`
- Runtime mapping: `GeminiCliAgent().session().sendStream()`
- Native semantics preserved through raw lane: session, tool, skill, context

### OpenCode

- Primary lane: `@opencode-ai/sdk`
- Runtime mapping: `session.prompt()` for one-shot, `session.promptAsync()` plus `event.subscribe()` SSE for streaming
- If a runtime only exposes one-shot prompt execution, the adapter may synthesize a canonical stream from the one-shot SDK response
- Native semantics preserved through raw lane: session, part, artifact, event

## Canonical compatibility requirements

- `describeIntegration()` remains the source of architectural truth.
- `getHealth()` remains the source of environment/runtime-lane truth.
- `getCapabilities()` must remain aligned with the resolved health runtime.
- `getCapabilities().experimentalCapabilities` must be runtime-gated: preserve provider experimental features only on the resolved `sdk` lane, and suppress them when execution falls back.
- `describeRawExtensions()` remains the only supported provider-native escape hatch.
- `createWorkbenchCanonicalChatEngine()` must preserve integration, health, capability, and raw-extension methods.
- Canonical event kinds and artifact kinds are registry-controlled by `packages/sdkwork-birdcoder-types/src/coding-session.ts`, and reference docs must not drift from that shared registry.

## Verification standard

The minimum verification set for this runtime-selection architecture is:

- `scripts/engine-official-sdk-contract.test.ts`
- `scripts/engine-official-sdk-runtime-selection-contract.test.ts`
- `scripts/engine-official-sdk-error-propagation-contract.test.ts`
- `scripts/provider-sdk-import-governance-contract.test.mjs`
- `scripts/provider-sdk-package-manifest-contract.test.mjs`
- `scripts/provider-adapter-browser-safety-contract.test.mjs`
- `scripts/engine-experimental-capability-gating-contract.test.ts`
- `scripts/engine-canonical-registry-governance-contract.test.ts`
- `scripts/engine-runtime-adapter-contract.test.ts`
- `scripts/engine-kernel-contract.test.ts`
- `scripts/engine-environment-health-contract.test.ts`
- `scripts/engine-capability-extension-contract.test.ts`

## Non-goals

- Do not move provider SDK imports into product-layer packages.
- Do not expose provider-native DTOs through the canonical runtime surface.
- Do not collapse all providers into a fake generic mock when SDK runtime is absent.
