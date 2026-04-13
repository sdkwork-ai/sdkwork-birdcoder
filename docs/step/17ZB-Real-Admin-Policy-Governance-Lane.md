# Step 17ZB - Real Admin Policy Governance Lane

## Status

- Closed on `2026-04-11`.

## Goal

Turn `GET /api/admin/v1/policies` from a `not_implemented` placeholder into a real representative admin governance read by first defining a dedicated policy authority model, then wiring the shared facade and first consumer path without overloading deployment or audit truth.

## Scope

- dedicated policy entity, storage binding, and repository truth on shared provider/UoW
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- shared app/admin facade governance for `admin.listPolicies`
- first admin policy-facing consumer in `packages/sdkwork-birdcoder-commons` or `packages/sdkwork-birdcoder-studio`
- governance scripts and release-flow writeback

## Checkpoints

- `CP17ZB-1` policy governance must have its own modeled authority entity before any route promotion.
- `CP17ZB-2` Rust host must stop returning `not_implemented` for `GET /api/admin/v1/policies`.
- `CP17ZB-3` the shared typed app/admin facade must promote `admin.listPolicies` only after server behavior is real.
- `CP17ZB-4` one real consumer path must read policies through the shared service/facade instead of rebuilding the route locally.
- `CP17ZB-5` docs/release must record policy truth separately from deployment and audit truth.

## Verification

- `pnpm.cmd run test:generated-app-admin-client-facade-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:default-ide-services-admin-policy-service-contract`
- `pnpm.cmd run test:admin-policy-consumer-contract`
- `pnpm.cmd run test:sqlite-app-admin-repository-contract`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Closure Facts

- Dedicated policy authority is now modeled as `governance_policy -> governance_policies`, not reused from `deployment_records` or `audit_events`.
- Rust host now serves real `GET /api/admin/v1/policies` authority truth across:
  - demo host state
  - legacy sqlite materialization from `table.sqlite.governance-policies.v1`
  - direct sqlite provider reads from `governance_policies`
- The shared app/admin facade now promotes `listPolicies()` as the only approved high-level policy read entry.
- The first reusable consumer lane is closed through:
  - `IAdminPolicyService`
  - `ApiBackedAdminPolicyService`
  - `adminPolicyService`
  - `loadAdminPolicies()`
  - `useAdminPolicies()`
- This lane closes the last representative Step 17 admin placeholder route, and PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.

## Parallel Windows

- Can parallelize after entity and DTO names are frozen:
  - policy entity plus repository work
  - Rust route plus service/consumer adoption
  - docs/release writeback drafts
- Must stay serial:
  - authority-model freeze
  - shared facade promotion in `server-api.ts`
  - final release numbering and backwrite

## Serial Notes

1. This lane is serial because it introduces a new governance authority model and promotes the last remaining representative admin placeholder route.
2. Do not reuse `deployment_records` or `audit_events` as substitute truth for policy governance.
3. Future reruns must preserve executable PostgreSQL smoke truth as `blocked`, `failed`, or `passed`; do not fabricate closure.
