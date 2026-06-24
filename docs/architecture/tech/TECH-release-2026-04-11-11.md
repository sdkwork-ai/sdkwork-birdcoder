> Migrated from `docs/release/release-2026-04-11-11.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Promotes `codingSessions.turns.create` into the typed app-runtime write facade and app-runtime SDK governance.
- Wires the first real turn-write consumer path through `ApiBackedProjectService.addCodingSessionMessage()`.
- Backwrites architecture, step, prompt, and next-lane truth for the post-`17U` engine capability/model slice.

## Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts`
- `scripts/app-runtime-write-sdk-client-contract.test.ts`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `scripts/api-backed-project-service-app-runtime-create-coding-session-contract.test.ts`
- `scripts/api-backed-project-service-app-runtime-create-coding-session-turn-contract.test.ts`
- `package.json`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`
- `docs/step/17U-App-Runtime-Create-Coding-Session-Turn-SDK-And-Consumer-Adoption-Lane.md`
- `docs/step/17V-App-Runtime-Engine-Capability-And-Model-Catalog-Lane.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/releases.json`

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml create_coding_session_turn_route_returns_created_turn_and_makes_projection_readable`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml create_coding_session_turn_route_returns_not_found_for_missing_session`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml create_coding_session_turn_route_persists_into_sqlite_provider_authority`
- `pnpm.cmd run test:app-runtime-write-sdk-client-contract`
- `pnpm.cmd run test:default-ide-services-app-runtime-write-sdk-contract`
- `pnpm.cmd run test:app-runtime-sdk-facade-governance-contract`
- `pnpm.cmd run test:api-backed-project-service-app-runtime-create-coding-session-turn-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run release:smoke:postgresql-live` -> `blocked (reasonCode=missing_postgresql_dsn)`

## Post-release operations

- Observation window: `0` minutes on `pending`.
- Stop-ship signals: `codingSessions.turns.create` missing from the app-runtime write facade; project-service message writes dropping the server-authoritative `turnId`; or release-flow no longer executing the new turn consumer contract.
- Rollback entry: `pnpm release:rollback:plan -- --release-tag release-2026-04-11-11 --release-assets-dir artifacts/release`.
- Re-issue path: `pnpm release:plan` -> turn-write facade / consumer repair -> docs/release backwrite -> `pnpm release:finalize`.
- Writeback targets: `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`, `docs/架构/09-安装-部署-发布标准.md`, `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`, `docs/step/17U-App-Runtime-Create-Coding-Session-Turn-SDK-And-Consumer-Adoption-Lane.md`, `docs/step/17V-App-Runtime-Engine-Capability-And-Model-Catalog-Lane.md`, `docs/prompts/反复执行Step指令.md`, `docs/release/releases.json`, and `docs/release/release-2026-04-11-11.md`.

## Notes

- PostgreSQL live smoke remains environment-blocked and was not claimed as passed.
- The next serial non-environmental lane is `17V`, which targets real `engines.capabilities.retrieve` plus `models.list` behavior and shared-facade adoption.

