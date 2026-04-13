# Rust Host Engine Truth Artifact Standard

## Objective

Rust host must not maintain a parallel handwritten engine catalog. Engine descriptors, capability matrices, and model catalog entries must be ingested from a generated artifact derived from promoted `coding-server` truth.

## Standard

- Promoted truth source:
  - `packages/sdkwork-birdcoder-server/src/index.ts`
  - `listBirdCoderCodingServerEngines()`
  - `listBirdCoderCodingServerModels()`
- Generated artifact:
  - `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
- Generator:
  - `scripts/generate-rust-host-engine-catalog.ts`
- Rust host loading rule:
  - load via `include_str!("../generated/engine-catalog.json")`
  - parse once via `OnceLock`
  - route handlers must read cloned data from the parsed artifact

## Prohibited

- Local Rust-only engine descriptor assembly.
- Local Rust-only model catalog assembly.
- Local transport-kind helper fixtures used only for engine/model catalog routes.
- Silent divergence between generated artifact and promoted `coding-server` truth.

## Why

- Removes the main cross-language drift source in the engine/model catalog lane.
- Keeps TypeScript server truth and Rust host route truth on the same auditable artifact.
- Makes future route-level parity and release packaging evidence straightforward.

## Governance

- Release-blocking contract:
  - `scripts/rust-host-engine-truth-contract.test.ts`
- Required verification:
  - `pnpm.cmd run generate:rust-host-engine-catalog`
  - `pnpm.cmd run test:rust-host-engine-truth-contract`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`

## Evaluation Criteria

- `artifact_alignment`
  - pass: generated artifact equals promoted `coding-server` truth
  - fail: artifact drifts from TypeScript server truth
- `host_adoption`
  - pass: Rust host reads the generated artifact directly
  - fail: Rust host keeps local handwritten engine/model fixtures
- `route_safety`
  - pass: Rust host tests stay green after adoption
  - fail: adoption breaks route behavior or cargo tests
- `release_governance`
  - pass: the new contract is part of `check:release-flow`
  - fail: drift can merge without a gate

## Next Standard Target

The later HTTP-level route-parity lane is already a closed historical follow-on; future loops must not reopen this standard as an active next target without fresh failing evidence on the generated Rust engine artifact itself.
