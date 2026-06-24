# Step 17V - Real App Runtime Engine Capability And Model Catalog Lane

## Status

- Closed on `2026-04-11`.

## Goal

Close real server behavior for `engines.capabilities.retrieve` and `models.list`, promote both into the app runtime read SDK facade, and wire the first workbench-facing consumer path without reopening already-closed app runtime write work.

## Scope

- `crates/sdkwork-birdcoder-api-server/src/lib.rs`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IAppRuntimeReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingServerOverview.ts`
- `scripts/app-runtime-read-sdk-client-contract.test.ts`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `scripts/default-ide-services-app-runtime-read-service-contract.test.ts`
- `scripts/coding-server-overview-engine-model-consumer-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17V-1` Rust host must stop returning `not_implemented` for `engines.capabilities.retrieve` and `models.list`.
- `CP17V-2` `GET /app/v3/api/engines` must return the same canonical engine catalog truth used by the capability/model slice.
- `CP17V-3` `@sdkwork/birdcoder-types` must expose both routes through the shared app runtime SDK read facade only after server behavior is real.
- `CP17V-4` app runtime SDK governance must move both operations from excluded to promoted while keeping `approvals.decisions.create` blocked.
- `CP17V-5` one real overview consumer path must read engine capabilities and model catalog through `appRuntimeReadService`, not by reconstructing request paths locally.

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml core_engine_`
- `pnpm.cmd run test:app-runtime-read-sdk-client-contract`
- `pnpm.cmd run test:app-runtime-sdk-facade-governance-contract`
- `pnpm.cmd run test:default-ide-services-app-runtime-read-service-contract`
- `pnpm.cmd run test:coding-server-overview-engine-model-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves real canonical engine catalog, per-engine capability reads, and model catalog reads on:
  - `GET /app/v3/api/engines`
  - `GET /app/v3/api/engines/:engineKey/capabilities`
  - `GET /app/v3/api/models`
- app runtime read SDK facade now promotes:
  - `engines.capabilities.retrieve`
  - `models.list`
- app runtime SDK exclusion governance now keeps only:
  - `approvals.decisions.create`
- `IAppRuntimeReadService`, `ApiBackedAppRuntimeReadService`, and default IDE services now expose the promoted engine/model reads end-to-end.
- `loadCodingServerOverview()` plus `useCodingServerOverview()` now close the first app-level overview consumer path for descriptor/runtime/health/engines/engineCapabilities/models.
- `scripts/coding-server-overview-engine-model-consumer-contract.test.ts` is now part of `check:release-flow`.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep `approvals.decisions.create` blocked until approval authority truth, typed facade promotion, and first consumer adoption can close together.
3. Follow-up lane: `docs/step/17W-App-Runtime-Approval-Decision-Lane.md`.
