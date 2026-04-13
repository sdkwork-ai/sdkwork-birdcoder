# Step 17U - Typed Core Create Coding Session Turn Facade And Consumer Adoption Lane

## Status

- Closed on `2026-04-11`.

## Goal

Close the typed shared core write facade for `core.createCodingSessionTurn`, keep shared-core governance truthful, and wire the first real consumer path on top of the now-real Rust route.

## Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts`
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `scripts/generated-core-write-client-facade-contract.test.ts`
- `scripts/default-ide-services-generated-core-write-facade-contract.test.ts`
- `scripts/shared-core-facade-governance-contract.test.ts`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-Core-App-Admin-API与控制台实现.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/releases.json`

## Checkpoints

- `CP17U-1` `core.createCodingSessionTurn` must stay server-real and keep returning `201 Created` through the Rust host.
- `CP17U-2` `@sdkwork/birdcoder-types` must expose typed shared-core write access for `core.createCodingSessionTurn` on top of the generated client.
- `CP17U-3` shared core governance must move `core.createCodingSessionTurn` from excluded to promoted only when the typed facade is executable.
- `CP17U-4` one real consumer path must call the shared turn-write facade instead of rebuilding the route locally.
- `CP17U-5` refreshed session detail/event views must preserve the server-authoritative turn id, operation id, and replay state after consumer adoption.

## Verification

- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_returns_created_turn_and_makes_projection_readable`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_returns_not_found_for_missing_session`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_persists_into_sqlite_provider_authority`
- `pnpm.cmd run test:generated-core-write-client-facade-contract`
- `pnpm.cmd run test:default-ide-services-generated-core-write-facade-contract`
- `pnpm.cmd run test:shared-core-facade-governance-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Promote `core.createCodingSessionTurn` only after the typed write facade, consumer adoption, and release-flow governance all close together.
3. Keep `core.getEngineCapabilities`, `core.listModels`, and `core.submitApprovalDecision` blocked until server behavior is real and executable.

## Result

- `createBirdCoderGeneratedCoreWriteApiClient({ transport })` now exposes `createCodingSessionTurn(...)`.
- `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` now promotes `core.createCodingSessionTurn`.
- `ApiBackedProjectService.addCodingSessionMessage()` is now the first real consumer path and mirrors the server turn id into local message state.
- `scripts/generated-core-write-client-facade-contract.test.ts`, `scripts/shared-core-facade-governance-contract.test.ts`, and `scripts/api-backed-project-service-core-create-coding-session-turn-contract.test.ts` now lock this closure into `check:release-flow`.
- Follow-up lane: `docs/step/17V-Real-Core-Engine-Capability-And-Model-Catalog-Lane.md`.
