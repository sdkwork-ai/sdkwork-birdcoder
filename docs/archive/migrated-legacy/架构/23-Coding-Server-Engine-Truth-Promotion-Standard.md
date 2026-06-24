# Coding-Server Engine Truth Promotion Standard

## Objective

`coding-server` must not own a second engine catalog truth. Engine descriptors, capability matrices, and model catalog entries must be promoted from the shared workbench kernel and exposed through stable server-level exports.

## Standard

- Shared truth source:
  - `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts`
- Required server exports:
  - `listBirdCoderCodingServerEngines()`
  - `listBirdCoderCodingServerModels()`
  - `getBirdCoderCodingServerEngineDescriptor(engineKey)`
  - `getBirdCoderCodingServerEngineCapabilities(engineKey)`
- Resolution rules:
  - descriptors and models must be direct projections of shared kernel truth
  - capabilities must be read from the promoted descriptor truth
  - unknown engine lookups must return `null`
  - no default-engine fallback is allowed in catalog lookup APIs

## Why

- Prevents drift between workbench selection truth and server catalog truth.
- Gives web, desktop, server, OpenAPI, SDK, and future host bindings one reusable TypeScript-side catalog surface.
- Makes later Rust-host parity work auditable against a stable promoted source instead of informal file comparison.

## API Contract

```ts
listBirdCoderCodingServerEngines(): ReadonlyArray<BirdCoderEngineDescriptor>
listBirdCoderCodingServerModels(): ReadonlyArray<BirdCoderModelCatalogEntry>
getBirdCoderCodingServerEngineDescriptor(engineKey: string): BirdCoderEngineDescriptor | null
getBirdCoderCodingServerEngineCapabilities(engineKey: string): BirdCoderEngineCapabilityMatrix | null
```

## Governance

- Release-blocking contract:
  - `scripts/coding-server-engine-truth-contract.test.ts`
- Required checks:
  - `pnpm.cmd run test:coding-server-engine-truth-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`

## Evaluation Criteria

- `truth_uniqueness`
  - pass: no server-local catalog reassembly exists
  - fail: server owns manual descriptor/model fixtures
- `lookup_safety`
  - pass: unknown engine returns explicit `null`
  - fail: lookup silently falls back to a default engine
- `release_governance`
  - pass: contract is wired into `check:release-flow`
  - fail: drift can merge without a failing gate
- `next_stage_readiness`
  - pass: Rust host parity can target promoted server truth
  - fail: cross-language parity still lacks a stable TS-side baseline

## Next Standard Target

The later Rust host artifact-adoption and route-parity lanes are already closed historical follow-ons; future loops must not reopen this standard as an active next target without fresh failing evidence on the promoted engine truth itself.
