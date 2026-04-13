# Step 18H - Coding-Server Canonical Runtime Projection Lane

## Status

- Closed on `2026-04-13`.

## Goal

Close the remaining Step 18 server-side sink by projecting the shared workbench canonical runtime directly into `coding-server` core-session execution, SSE event envelopes, and provider-backed projection persistence without reassembling engine-specific event semantics inside the server layer.

## Scope

- `packages/sdkwork-birdcoder-server/src/index.ts`
- `packages/sdkwork-birdcoder-server/src/projectionRepository.ts`
- `scripts/coding-server-sse-contract.test.ts`
- `scripts/coding-server-provider-projection-repository-contract.test.ts`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`
- `docs/step/18H-Coding-Server-Canonical-Runtime-Projection-Lane.md`
- `docs/架构/21-多Code-Engine协议-SDK-适配标准.md`
- `docs/release/release-2026-04-13-05.md`

## Checkpoints

- `CP18H-1` `executeBirdCoderCoreSessionRun()` must consume `describeRuntime()` and `sendCanonicalEvents()` from the shared engine runtime instead of rebuilding server-local engine semantics.
- `CP18H-2` the projected runtime record must preserve canonical runtime facts:
  - `nativeRef.transportKind`
  - `nativeRef.nativeSessionId`
  - `capabilitySnapshot`
  - approval-policy metadata
- `CP18H-3` canonical events and projected artifacts must flow through `coding-server` core-session projection and SSE envelopes without dropping `approval.required`, `artifact.upserted`, or terminal turn status events.
- `CP18H-4` provider-backed projection persistence must round-trip the same runtime, event, artifact, and operation truth after reload.
- `CP18H-5` live architecture and Step docs must stop describing this lane as still open.

## Closure Facts

- `packages/sdkwork-birdcoder-server/src/index.ts` now executes core-session runs by:
  - calling `chatEngine.describeRuntime(...)`
  - streaming `chatEngine.sendCanonicalEvents(...)`
  - projecting `nativeRef.transportKind`, `nativeRef.nativeSessionId`, and `capabilitySnapshot` into `BirdCoderCodingSessionRuntime`
- `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` already persists and reloads the same canonical runtime fields through:
  - `transport_kind`
  - `native_session_id`
  - `native_turn_container_id`
  - `capability_snapshot_json`
- `scripts/coding-server-sse-contract.test.ts` proves `coding-server` preserves canonical runtime transport plus representative `approval.required`, `artifact.upserted`, and `turn.completed` event flow.
- `scripts/coding-server-provider-projection-repository-contract.test.ts` now proves the provider-backed snapshot round-trips canonical runtime transport, capability snapshot, event kinds, and artifact kinds after persistence.
- Step 18 no longer treats the server-side canonical-runtime sink as the next open gap; future Step 18 work must be driven by fresh failing evidence or new engine onboarding rather than this already-closed lane.

## Verification

- `node --experimental-strip-types scripts/coding-server-sse-contract.test.ts`
- `node --experimental-strip-types scripts/coding-server-provider-projection-repository-contract.test.ts`
- `node --experimental-strip-types scripts/coding-server-engine-truth-contract.test.ts`
- `node --experimental-strip-types scripts/engine-runtime-adapter-contract.test.ts`
- `node scripts/live-docs-governance-baseline.test.mjs`
- `node scripts/release-flow-contract.test.mjs`

## Notes

- This slice closes the `coding-server` / core-session projection sink only; it does not reopen the already-closed Step 18 governance-promotion or packaged-evidence lanes.
- Representative app/admin route closure remains governed by Step 17 docs; this Step 18 lane is about canonical engine runtime projection into server execution and persistence truth.
