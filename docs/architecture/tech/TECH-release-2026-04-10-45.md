> Migrated from `docs/release/release-2026-04-10-45.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Deletes the redundant infrastructure-side app/backend high-level wrapper and leaves transport factories as the only responsibility of `sdkClients.ts`.
- Moves the representative SDK consumer contract to the shared generated facade directly, completing the hard cut from wrapper-based request assembly.
- Adds a no-wrapper governance contract and promotes it into `check:release-flow`.

## Scope

- `scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs`
- `scripts/split-sdk-consumer-contract.test.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
- `package.json`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`
- `docs/step/17I-Coding-Server-Split-SDK-Client-Lane.md`
- `docs/step/17J-Default-IDE-Services-Split-SDK-Adoption-Lane.md`
- `docs/step/17K-Mixed-App-Transport-Wrapper-Removal-Lane.md`
- `docs/prompts/反复执行Step指令.md`

## Verification

- `node --experimental-strip-types scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `node --experimental-strip-types scripts/default-ide-services-split-sdk-client-contract.test.ts`
- `node scripts/run-local-tsx.mjs scripts/split-sdk-client-facade-contract.test.ts`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Post-release operations

- Observation window: `0` minutes on `pending`.
- Stop-ship signals: `sdkClients.ts` reintroducing a high-level wrapper, representative SDK consumers falling back to infrastructure-side request assembly, or any `check:release-flow` regression that drops the no-wrapper contract.
- Rollback entry: `pnpm release:rollback:plan -- --release-tag release-2026-04-10-45 --release-assets-dir artifacts/release`.
- Re-issue path: `pnpm release:plan` -> wrapper-removal follow-up fix -> docs/release backwrite -> `pnpm release:finalize`.
- Writeback targets: `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`, `docs/架构/09-安装-部署-发布标准.md`, `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`, `docs/step/17I-Coding-Server-Split-SDK-Client-Lane.md`, `docs/step/17J-Default-IDE-Services-Split-SDK-Adoption-Lane.md`, `docs/step/17K-Mixed-App-Transport-Wrapper-Removal-Lane.md`, `docs/prompts/反复执行Step指令.md`, `docs/release/releases.json`, and `docs/release/release-2026-04-10-45.md`.

## Notes

- This loop closes the app/backend wrapper-removal slice only; it does not yet claim that every remaining shared `app / backend` transport consumer has been hard-cut to a types-layer facade.
- PostgreSQL live smoke remains environment-blocked until a DSN-backed run produces a real `passed` report.

