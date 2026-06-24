> Migrated from `docs/release/release-2026-04-10-20.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Replaces the Rust host's hard-coded projection read seed with a replaceable snapshot-backed read source while preserving the same unified route and envelope contracts.
- Adds `BIRDCODER_CODING_SERVER_SNAPSHOT_FILE` plus `build_app_from_env()` so the real `coding-server` startup path can boot from external JSON projection snapshots instead of only the built-in demo state.
- Makes configured snapshot load failures fatal at startup to prevent silent fallback from hiding broken host wiring.

## Scope

- [Cargo.toml](/<workspace-root>/sdkwork-birdcoder/crates/sdkwork-birdcoder-api-server/Cargo.toml)
- [lib.rs](/<workspace-root>/sdkwork-birdcoder/crates/sdkwork-birdcoder-api-server/src/lib.rs)
- [17-Coding-Server-App-Backend-SDK与控制台实现.md](/<workspace-root>/sdkwork-birdcoder/docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md)
- [20-统一Rust-Coding-Server-API-协议标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md)
- [反复执行Step指令.md](/<workspace-root>/sdkwork-birdcoder/docs/prompts/反复执行Step指令.md)

## Verification

- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml`
- `pnpm.cmd run check:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `node -e "JSON.parse(require('node:fs').readFileSync('docs/release/releases.json','utf8'))"`

## Notes

- This loop still does not make the Rust host consume the shared TypeScript provider-backed repository directly. The snapshot-file bridge is an explicit transition boundary that externalizes host read state and removes hard-coded demo coupling, but the next serial closure remains the real shared repository read path.

