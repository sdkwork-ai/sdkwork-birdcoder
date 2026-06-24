# Step 17Z - Real App Deployment Catalog Lane

## Status

- Closed on `2026-04-11`.

## Goal

Turn `GET /app/v3/api/deployments` from a `not_implemented` placeholder into a real representative app-surface authority read, then wire the first explicit app/backend SDK client pair and first consumer path on top of the existing deployment data model without prematurely closing backend deployment governance.

## Scope

- `crates/sdkwork-birdcoder-api-server/src/lib.rs`
- representative deployment-record authority slice on shared provider/UoW truth
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- default IDE app/backend service wiring for deployment reads
- first deployment-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17Z-1` Rust host must stop returning `not_implemented` for `GET /app/v3/api/deployments`.
- `CP17Z-2` app deployment catalog truth must come from one replayable authority path, not a page-local mock list.
- `CP17Z-3` the shared typed app/backend facade must promote `app.listDeployments` only after server behavior is real.
- `CP17Z-4` one real consumer path must read deployments through the shared service/facade instead of rebuilding the route locally.
- `CP17Z-5` docs/release must keep `admin.listPolicies` and `admin.listDeployments` blocked until their own governance lanes close.

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
- `pnpm.cmd run test:split-sdk-client-facade-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run test:sqlite-console-repository-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:default-ide-services-deployment-service-contract`
- `pnpm.cmd run test:deployment-app-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves a real `GET /app/v3/api/deployments` authority read route instead of `not_implemented`.
- Representative deployment truth now converges on one replayable authority path in all current execution modes:
  - demo host: in-process deployment state
  - legacy sqlite `kv_store`: materialized into provider-side `deployment_records`
  - direct sqlite provider: loaded from `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now promotes `app.listDeployments` into the shared generated app/backend facade through `listDeployments()`.
- `appConsoleRepository.ts`, `consoleQueries.ts`, and transport-backed app/backend client wiring now close the representative deployment repository/query/transport slice on top of shared provider truth.
- `IDeploymentService`, `ApiBackedDeploymentService`, `createDefaultBirdCoderIdeServices()`, shared contexts, `loadDeployments()`, and `useDeployments()` now close the first deployment-facing consumer path on the explicit app/backend SDK client pair boundary.
- `check:release-flow` now executes deployment service and deployment consumer governance alongside the existing app/backend facade, audit, document, and release contracts.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Next non-environmental lane: `docs/step/17ZA-Real-Admin-Deployment-Governance-Lane.md`.
3. Do not reopen app deployment governance unless one of the recorded verification commands fails.

## Serial Notes

1. This lane is serial because it changes representative app route truth, shared app/backend facade governance, and deployment consumer adoption together.
2. Prefer the existing `deployment_record` authority path first; do not force `deployment_target` or policy-governance aggregation into this app lane.
3. Keep `admin.listPolicies` and `admin.listDeployments` blocked until their own authority lanes close.
4. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.
