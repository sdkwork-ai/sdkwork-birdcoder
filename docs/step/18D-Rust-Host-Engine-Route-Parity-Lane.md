# Step 18D - Rust Host Engine Route Parity Lane

## Status

- Closed on `2026-04-11`.

## Goal

Make actual Rust host `/api/core/v1/engines`, `/api/core/v1/engines/:engineKey/capabilities`, and `/api/core/v1/models` responses auditable against the generated shared engine-catalog artifact end-to-end, not only by shared-source adoption.

## Scope

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18D-Rust-Host-Engine-Route-Parity-Lane.md`
- `docs/架构/25-Rust-Host-Engine-Route-Parity-Standard.md`
- `docs/release/release-2026-04-11-22.md`

## Checkpoints

- `CP18D-1` `/api/core/v1/engines` must return `items` exactly equal to generated `engines`.
- `CP18D-2` `/api/core/v1/models` must return `items` exactly equal to generated `models`.
- `CP18D-3` `/api/core/v1/engines/:engineKey/capabilities` must return `data` exactly equal to the matching generated `capabilityMatrix`.
- `CP18D-4` optional engine/model fields must preserve artifact JSON shape; `null` placeholders must not reappear on the Rust route surface.
- `CP18D-5` route-parity verification must be part of release-blocking governance.

## Closure Facts

- Rust host now exposes an executable route-parity test:
  - `core_engine_catalog_routes_match_generated_shared_engine_catalog`
- That test proves:
  - `/api/core/v1/engines` equals generated `engines`
  - `/api/core/v1/models` equals generated `models`
  - each `/api/core/v1/engines/:engineKey/capabilities` response equals the corresponding generated `capabilityMatrix`
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
- `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This slice closes HTTP-level parity for the current representative engine/model route set; it does not claim broader multi-engine runtime adapter closure.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- The later Step 18 governance-promotion slice is already closed; future loops must not reopen Step 18 route parity without fresh failing evidence.
