> Migrated from `docs/release/release-2026-04-11-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Turns Rust host `POST /app/v3/api/coding_sessions` into a real `201 Created` authority write route.
- Closes same-process create -> read consistency on the shared projection authority state.
- Persists provider-backed creates into `coding_sessions` and `coding_session_runtimes`, then reloads projection reads from sqlite provider tables.
- Updates app-runtime governance wording so `codingSessions.create` is treated as server-real but still excluded until the typed write facade closes.

## Scope

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`
- `docs/step/17Q-App-Level-Coding-Session-Projection-Consumer-Adoption-Lane.md`
- `docs/step/17R-App-Runtime-SDK-Governance-Lane.md`
- `docs/step/17S-App-Runtime-Create-Coding-Session-Route-Lane.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/releases.json`

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml create_coding_session_route_returns_created_session_and_makes_projection_readable`
- `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml create_coding_session_route_persists_into_sqlite_provider_authority`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Post-release operations

- Observation window: `0` minutes on `pending`.
- Stop-ship signals: `codingSessions.create` returning `not_implemented`; create/read requests in one host process diverging; sqlite provider-backed creates failing to materialize `coding_sessions` or `coding_session_runtimes`; or release-flow governance still describing the route as unimplemented.
- Rollback entry: `pnpm release:rollback:plan -- --release-tag release-2026-04-11-08 --release-assets-dir artifacts/release`.
- Re-issue path: `pnpm release:plan` -> real app-runtime create-session route fix -> docs/release backwrite -> `pnpm release:finalize`.
- Writeback targets: `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`, `docs/架构/09-安装-部署-发布标准.md`, `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`, `docs/step/17Q-App-Level-Coding-Session-Projection-Consumer-Adoption-Lane.md`, `docs/step/17R-App-Runtime-SDK-Governance-Lane.md`, `docs/step/17S-App-Runtime-Create-Coding-Session-Route-Lane.md`, `docs/prompts/反复执行Step指令.md`, `docs/release/releases.json`, and `docs/release/release-2026-04-11-08.md`.

## Notes

- This loop does not yet promote `codingSessions.create` into the shared high-level facade.
- The next serial closure is the typed app-runtime write/response facade for `codingSessions.create`, followed by exclusion-catalog reclassification and consumer adoption.

