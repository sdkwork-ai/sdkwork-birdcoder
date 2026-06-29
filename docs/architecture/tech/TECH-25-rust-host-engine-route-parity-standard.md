> Migrated from `docs/架构/25-Rust-Host-Engine-Route-Parity-Standard.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Rust Host Engine Route Parity Standard

## Objective

Rust host must prove that the live HTTP engine/model routes emit the same JSON truth already frozen in the generated shared engine-catalog artifact.

## Standard

- Canonical artifact:
  - `crates/sdkwork-birdcoder-standalone-gateway/generated/engine-catalog.json`
- Artifact generator:
  - `scripts/generate-rust-host-engine-catalog.ts`
- Route parity rules:
  - `GET /app/v3/api/engines` -> `items === generated.engines`
  - `GET /app/v3/api/models` -> `items === generated.models`
  - `GET /app/v3/api/engines/:engineKey/capabilities` -> `data.item === generated.engines[*].capabilityMatrix`
  - list responses use SdkWork list envelopes (`code === 0`, `data.items`, `data.pageInfo`, `traceId`)
- Serialization rule:
  - absent optionals must be omitted, not serialized as `null`
- Governance carrier:
  - `core_engine_catalog_routes_match_generated_shared_engine_catalog`
  - `pnpm.cmd run test:rust-host-engine-route-parity-contract`

## Prohibited

- Treating shared-artifact adoption alone as sufficient proof of route parity.
- Rebuilding engine/model payloads differently on live Rust routes.
- Serializing empty optional fields as `null` when the shared artifact omits them.
- Keeping route parity outside `check:release-flow`.

## Why

- Eliminates the last silent drift window between shared engine truth and actual Rust HTTP responses.
- Makes live route behavior auditable without trusting spot assertions or manual inspection.
- Gives web, desktop, and server consumers one executable engine/model response contract.

## Governance

- Required verification:
  - `pnpm.cmd run test:rust-host-engine-route-parity-contract`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`

## Evaluation Criteria

- `route_payload_alignment`
  - pass: live route `items/data` exactly equal the generated artifact payloads
  - fail: any field drift appears between route JSON and generated artifact JSON
- `serialization_shape_alignment`
  - pass: optional fields are omitted consistently across artifact and route output
  - fail: Rust route output reintroduces `null` placeholders or shape drift
- `governance_strength`
  - pass: route parity is release-blocking
  - fail: parity can regress without failing `check:release-flow`
- `consumer_safety`
  - pass: representative engine/model consumers can trust one stable envelope shape
  - fail: consumers need route-specific fallbacks or shape repair

## Next Standard Target

This standard is now fully closed; future loops should select the next lowest-score non-environmental slice instead of reopening Step 18 route parity governance promotion.

