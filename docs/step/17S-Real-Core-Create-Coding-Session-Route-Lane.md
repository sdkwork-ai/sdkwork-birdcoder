# Step 17S - Real Core Create Coding Session Route Lane

## Goal

Turn `POST /api/core/v1/coding-sessions` from a `not_implemented` skeleton into a real Rust-host authority write route without prematurely promoting it into the shared high-level facade.

## Closed Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17R-Shared-Core-Facade-Exclusion-Governance-Lane.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/release-2026-04-11-08.md`
- `docs/release/releases.json`

## Checkpoints

- `CP17S-1` Rust host must return `201 Created` plus a real `CodingSessionPayload` for `POST /api/core/v1/coding-sessions`.
- `CP17S-2` create/read requests in the same host process must share one projection authority state, so the newly created session is immediately readable through `GET /api/core/v1/coding-sessions/:id`.
- `CP17S-3` sqlite provider-backed hosts must persist new rows into `coding_sessions` and `coding_session_runtimes`, then reload projection reads from provider tables.
- `CP17S-4` shared high-level facade governance must stop describing `core.createCodingSession` as `not_implemented`; it remains excluded only because the typed write/response facade lane is not closed yet.
- `CP17S-5` release writeback must move the next serial closure to typed `core.createCodingSession` facade promotion.

## Verification

- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_route_returns_created_session_and_makes_projection_readable`
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_route_persists_into_sqlite_provider_authority`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep `core.createCodingSession` outside the shared high-level facade until the typed write/response facade is introduced on top of the now-real server route.
3. Promote `core.createCodingSession` from the excluded catalog only after the typed facade, service adoption, and release-flow governance all close together.
