# Step 17Y - Real Admin Audit Lane

## Status

- Closed on `2026-04-11`.

## Goal

Turn `GET /api/admin/v1/audit` from a `not_implemented` placeholder into a real representative admin-surface authority read, then wire the first shared facade and first consumer path without reopening already-closed document or core lanes.

## Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- representative audit authority slice on shared provider/UoW truth
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- shared app/admin facade governance for `admin.listAuditEvents`
- first audit-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17Y-1` Rust host must stop returning `not_implemented` for `GET /api/admin/v1/audit`.
- `CP17Y-2` audit catalog truth must come from one replayable authority path, not a page-local mock list.
- `CP17Y-3` the shared typed app/admin facade must promote `admin.listAuditEvents` only after server behavior is real.
- `CP17Y-4` one real consumer path must read audit events through the shared service/facade instead of rebuilding the route locally.
- `CP17Y-5` docs/release must state which representative app/admin routes remain blocked after the audit lane closes.

## Verification

- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
- `pnpm.cmd run test:generated-app-admin-client-facade-contract`
- `pnpm.cmd run test:default-ide-services-audit-service-contract`
- `pnpm.cmd run test:audit-admin-consumer-contract`
- `pnpm.cmd run test:sqlite-app-admin-repository-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:default-ide-services-document-service-contract`
- `pnpm.cmd run test:default-ide-services-release-service-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Result

- Rust host now serves a real `GET /api/admin/v1/audit` authority read route instead of `not_implemented`.
- Audit catalog truth now converges on one replayable authority path in all current execution modes:
  - demo host: in-process audit state
  - legacy sqlite `kv_store`: materialized into provider-side `audit_events`
  - direct sqlite provider: loaded from `audit_events`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now promotes `admin.listAuditEvents` into the shared generated app/admin facade through `listAuditEvents()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now close the representative audit repository/query/transport slice on top of shared provider truth.
- `IAuditService`, `ApiBackedAuditService`, `createDefaultBirdCoderIdeServices()`, shared contexts, `loadAuditEvents()`, and `useAuditEvents()` now close the first audit-facing consumer path on the shared facade boundary.
- `check:release-flow` now executes audit service and audit consumer governance alongside the existing app/admin facade, document, and release contracts.

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Next non-environmental lane: `docs/step/17Z-Real-App-Deployment-Catalog-Lane.md`.
3. Do not reopen audit governance unless one of the recorded verification commands fails.

## Serial Notes

1. This lane is serial because it changes representative admin route truth, shared app/admin facade governance, and consumer adoption together.
2. Keep `app.listDeployments`, `admin.listPolicies`, and `admin.listDeployments` blocked until their own authority lanes close.
3. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.
