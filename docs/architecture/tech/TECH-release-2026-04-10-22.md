> Migrated from `docs/release/release-2026-04-10-22.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Extends Rust `coding-server` projection-backed reads from operation, events, and artifacts to full coding-session detail and checkpoint resources.
- Makes the shared desktop `kv_store` SQLite authority path hydrate session summaries and checkpoint records in addition to operation, event, and artifact projections.
- Closes the missing `coding_session_checkpoint` storage binding gap in `packages/sdkwork-birdcoder-types`, keeping checkpoint authority keying on the shared standard instead of undocumented conventions.

## Scope

- [data.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-types/src/data.ts)
- [lib.rs](/<workspace-root>/sdkwork-birdcoder/crates/sdkwork-birdcoder-api-server/src/lib.rs)
- [17-Coding-Server-App-Backend-SDK与控制台实现.md](/<workspace-root>/sdkwork-birdcoder/docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md)
- [20-统一Rust-Coding-Server-API-协议标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md)
- [反复执行Step指令.md](/<workspace-root>/sdkwork-birdcoder/docs/prompts/反复执行Step指令.md)

## Verification

- `cargo test --offline --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml projection_backed_core_read_routes_return_runtime_data`
- `cargo test --offline --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml missing_projection_read_routes_return_unified_not_found_problem`
- `cargo test --offline --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
- `cargo test --offline --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml`
- `pnpm.cmd run check:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `node -e "JSON.parse(require('node:fs').readFileSync('docs/release/releases.json','utf8'))"`

## Notes

- This loop keeps Step 17 on the projection/read serial path. Real app/backend handlers and direct provider/UoW authority remain the next closures.
- Snapshot input is still fallback-only and no longer represents the preferred host authority path.

