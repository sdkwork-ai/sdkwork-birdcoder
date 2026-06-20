# Legacy PC server host archive

The monolithic `lib.rs` host was retired in favor of `crates/sdkwork-birdcoder-api-server`.

- Runtime authority: `crates/sdkwork-birdcoder-api-server`
- OpenAPI and route catalog authority: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts`
- Contract tests must read canonical Rust sources via `scripts/birdcoder-canonical-server-rust-sources.mjs`

Files in this directory are kept for historical reference only and are not compiled.

Retired BirdCoder-local IAM authority sources were removed after the appbase IAM router migration.
