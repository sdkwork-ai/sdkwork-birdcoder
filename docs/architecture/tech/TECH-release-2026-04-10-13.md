> Migrated from `docs/release/release-2026-04-10-13.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Adds the first `coding-server` projection store contract so server-side session runs can now be accumulated into one coding-session snapshot containing runtime, events, artifacts, and operations.
- Fixes event identity generation by making projected event ids turn-aware, preventing collisions when multiple turns reuse the same runtime id.
- Extends the executable Step 17 verification baseline with a new projection-store contract test and a root workspace script.

## Scope

- [package.json](/<workspace-root>/sdkwork-birdcoder/package.json)
- [index.ts](/<workspace-root>/sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts)
- [coding-server-projection-store-contract.test.ts](/<workspace-root>/sdkwork-birdcoder/scripts/coding-server-projection-store-contract.test.ts)
- [17-Coding-Server-App-Backend-SDK与控制台实现.md](/<workspace-root>/sdkwork-birdcoder/docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md)
- [20-统一Rust-Coding-Server-API-协议标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md)

## Verification

- `node --experimental-strip-types scripts/coding-server-projection-store-contract.test.ts`
- `pnpm.cmd run test:coding-server-projection-store-contract`
- `pnpm.cmd run test:coding-server-sse-contract`
- `pnpm.cmd run typecheck`

## Notes

- This loop still uses an in-memory aggregation store. The next serial step is replacing it with repository-backed persistence wired to the shared data-kernel and migration standard.

