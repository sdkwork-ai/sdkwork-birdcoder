> Migrated from `docs/step/17ZA-Real-Admin-Deployment-Governance-Lane.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 17ZA - Real Admin Deployment Governance Lane

## Status

- Closed on `2026-04-11`.

## Goal

Turn `GET /backend/v3/api/deployments` from a `not_implemented` placeholder into a real representative backend-surface governance read, then wire the backend deployment governance facade and first consumer path on top of the already-closed deployment authority model without mixing in policy governance.

## Scope

- `crates/sdkwork-birdcoder-api-server/src/lib.rs`
- representative deployment governance authority slice on shared provider/UoW truth
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- shared app/backend facade governance for `admin.listDeployments`
- first backend deployment-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17ZA-1` Rust host must stop returning `not_implemented` for `GET /backend/v3/api/deployments`.
- `CP17ZA-2` backend deployment catalog truth must come from one replayable authority path, not a page-local mock list.
- `CP17ZA-3` the shared typed app/backend facade must promote `admin.listDeployments` only after server behavior is real.
- `CP17ZA-4` one real consumer path must read backend deployments through the shared service/facade instead of rebuilding the route locally.
- `CP17ZA-5` docs/release must keep `admin.listPolicies` blocked until a dedicated policy-governance lane closes.

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
- `pnpm.cmd run test:split-sdk-client-facade-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:default-ide-services-admin-deployment-service-contract`
- `pnpm.cmd run test:admin-deployment-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves a real `GET /backend/v3/api/deployments` authority read route instead of `not_implemented`.
- Representative backend deployment truth now converges on one replayable authority path in all current execution modes:
  - demo host: in-process deployment state
  - legacy sqlite `kv_store`: materialized into provider-side `deployment_records`
  - direct sqlite provider: loaded from `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now promotes `admin.listDeployments` into the shared generated app/backend facade through `listAdminDeployments()`.
- In-process app/backend transport now serves both app and backend deployment reads from the same repository-backed query layer without DTO drift.
- `IAdminDeploymentService`, `ApiBackedAdminDeploymentService`, `createDefaultBirdCoderIdeServices()`, shared contexts, `loadAdminDeployments()`, and `useAdminDeployments()` now close the first backend deployment-facing consumer path on the explicit app/backend SDK client pair boundary.
- `check:release-flow` now executes backend deployment service and backend deployment consumer governance alongside the existing app deployment, audit, document, and release contracts.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Next non-environmental lane: `docs/step/17ZB-Real-Admin-Policy-Governance-Lane.md`.
3. Do not reopen backend deployment governance unless one of the recorded verification commands fails.

## Serial Notes

1. This lane is serial because it changes representative backend route truth, shared app/backend facade governance, and backend deployment consumer adoption together.
2. Reuse the existing `deployment_record` / `deployment_records` truth first; do not couple this lane to `policy` entity design.
3. Keep `admin.listPolicies` blocked until a dedicated modeled authority path exists.
4. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.

