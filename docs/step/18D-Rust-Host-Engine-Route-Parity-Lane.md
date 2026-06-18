# Step 18D - Rust Host Engine Route Parity Lane

## Status

- Closed on `2026-04-11`.

## Goal

Make actual Rust host `/app/v3/api/engines`, `/app/v3/api/engines/:engineKey/capabilities`, and `/app/v3/api/models` responses auditable against the generated shared engine-catalog artifact end-to-end, not only by shared-source adoption.

## Scope

- `crates/sdkwork-birdcoder-api-server/src/lib.rs`
- `crates/sdkwork-birdcoder-api-server/generated/engine-catalog.json`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18D-Rust-Host-Engine-Route-Parity-Lane.md`
- `docs/架构/25-Rust-Host-Engine-Route-Parity-Standard.md`
- `docs/release/release-2026-04-11-22.md`

## Checkpoints

- `CP18D-1` `/app/v3/api/engines` must return `items` exactly equal to generated `engines`.
- `CP18D-2` `/app/v3/api/models` must return `items` exactly equal to generated `models`.
- `CP18D-3` `/app/v3/api/engines/:engineKey/capabilities` must return `data` exactly equal to the matching generated `capabilityMatrix`.
- `CP18D-4` optional engine/model fields must preserve artifact JSON shape; `null` placeholders must not reappear on the Rust route surface.
- `CP18D-5` route-parity verification must be part of release-blocking governance.

## Closure Facts

- Rust host now exposes an executable route-parity test:
  - `core_engine_catalog_routes_match_generated_shared_engine_catalog`
- That test proves:
  - `/app/v3/api/engines` equals generated `engines`
  - `/app/v3/api/models` equals generated `models`
  - each `/app/v3/api/engines/:engineKey/capabilities` response equals the corresponding generated `capabilityMatrix`
- Rust route payload structs now omit absent optionals so route JSON stays byte-shape compatible with the generated artifact:
  - `EngineDescriptorPayload.default_model_id`
  - `EngineDescriptorPayload.homepage`
  - `ModelCatalogEntryPayload.provider_id`
- `package.json` now exposes:
  - `test:rust-host-engine-route-parity-contract`
- `check:release-flow` now executes that parity contract.
- Step 18 engine truth is now closed at four levels:
  - source mirror truth
  - TypeScript `coding-server` truth promotion
  - generated Rust shared artifact adoption
  - real Rust HTTP route parity

## Verification

- `pnpm.cmd run test:rust-host-engine-route-parity-contract`
- `cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This slice closes HTTP-level parity for the current representative engine/model route set; it does not claim broader multi-engine runtime adapter closure.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- The later Step 18 governance-promotion slice is already closed; future loops must not reopen Step 18 route parity without fresh failing evidence.
