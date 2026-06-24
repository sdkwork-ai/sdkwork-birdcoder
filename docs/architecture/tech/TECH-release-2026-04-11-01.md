> Migrated from `docs/release/release-2026-04-11-01.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Adds the first app-runtime read facade in `@sdkwork/birdcoder-types` on top of the generated coding-server client.
- Closes representative app-runtime read request assembly for `descriptor / runtime / health / engines / operation` without exposing placeholder app-runtime routes.
- Makes the new app-runtime read facade executable under `check:release-flow`.

## Scope

- `scripts/app-runtime-read-sdk-client-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `package.json`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`
- `docs/step/17L-App-Runtime-Read-SDK-Lane.md`
- `docs/prompts/反复执行Step指令.md`

## Verification

- `node --experimental-strip-types scripts/app-runtime-read-sdk-client-contract.test.ts`
- `pnpm.cmd run test:app-runtime-read-sdk-client-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Post-release operations

- Observation window: `0` minutes on `pending`.
- Stop-ship signals: app-runtime facade routing drift on `/app/v3/api/system/descriptor`, `/app/v3/api/system/runtime`, `/app/v3/api/system/health`, `/app/v3/api/engines`, or `/app/v3/api/operations/:operationId`; exposing routes that still return `not_implemented`; or any `check:release-flow` regression that drops the app-runtime facade contract.
- Rollback entry: `pnpm release:rollback:plan -- --release-tag release-2026-04-11-01 --release-assets-dir artifacts/release`.
- Re-issue path: `pnpm release:plan` -> app-runtime read facade fix -> docs/release backwrite -> `pnpm release:finalize`.
- Writeback targets: `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`, `docs/架构/09-安装-部署-发布标准.md`, `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`, `docs/step/17L-App-Runtime-Read-SDK-Lane.md`, `docs/prompts/反复执行Step指令.md`, `docs/release/releases.json`, and `docs/release/release-2026-04-11-01.md`.

## Notes

- This loop closes the representative app-runtime read facade only; it does not yet claim coverage for session projection reads or placeholder app-runtime routes.
- PostgreSQL live smoke remains environment-blocked until a DSN-backed run produces a real `passed` report.

