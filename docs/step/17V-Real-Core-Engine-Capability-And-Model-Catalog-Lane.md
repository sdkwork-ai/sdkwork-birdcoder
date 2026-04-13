# Step 17V - Real Core Engine Capability And Model Catalog Lane

## Status

- Closed on `2026-04-11`.

## Goal

Close real server behavior for `core.getEngineCapabilities` and `core.listModels`, promote both into the shared core read facade, and wire the first workbench-facing consumer path without reopening already-closed core write work.

## Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingServerOverview.ts`
- `scripts/generated-core-read-client-facade-contract.test.ts`
- `scripts/shared-core-facade-governance-contract.test.ts`
- `scripts/default-ide-services-core-read-service-contract.test.ts`
- `scripts/coding-server-overview-engine-model-consumer-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17V-1` Rust host must stop returning `not_implemented` for `core.getEngineCapabilities` and `core.listModels`.
- `CP17V-2` `GET /api/core/v1/engines` must return the same canonical engine catalog truth used by the capability/model slice.
- `CP17V-3` `@sdkwork/birdcoder-types` must expose both routes through the shared generated core read facade only after server behavior is real.
- `CP17V-4` shared core governance must move both operations from excluded to promoted while keeping `core.submitApprovalDecision` blocked.
- `CP17V-5` one real overview consumer path must read engine capabilities and model catalog through `coreReadService`, not by reconstructing request paths locally.

## Verification

- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml core_engine_`
- `pnpm.cmd run test:generated-core-read-client-facade-contract`
- `pnpm.cmd run test:shared-core-facade-governance-contract`
- `pnpm.cmd run test:default-ide-services-core-read-service-contract`
- `pnpm.cmd run test:coding-server-overview-engine-model-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves real canonical engine catalog, per-engine capability reads, and model catalog reads on:
  - `GET /api/core/v1/engines`
  - `GET /api/core/v1/engines/:engineKey/capabilities`
  - `GET /api/core/v1/models`
- Shared core read facade now promotes:
  - `core.getEngineCapabilities`
  - `core.listModels`
- Shared core exclusion governance now keeps only:
  - `core.submitApprovalDecision`
- `ICoreReadService`, `ApiBackedCoreReadService`, and default IDE services now expose the promoted engine/model reads end-to-end.
- `loadCodingServerOverview()` plus `useCodingServerOverview()` now close the first app-level overview consumer path for descriptor/runtime/health/engines/engineCapabilities/models.
- `scripts/coding-server-overview-engine-model-consumer-contract.test.ts` is now part of `check:release-flow`.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep `core.submitApprovalDecision` blocked until approval authority truth, typed facade promotion, and first consumer adoption can close together.
3. Follow-up lane: `docs/step/17W-Real-Core-Approval-Decision-Lane.md`.
