# Step 18B - Coding-Server Engine Truth Promotion

## Status

- Closed on `2026-04-11`.

## Goal

Promote shared engine descriptor, capability, and model-catalog truth from `workbench/kernel.ts` into explicit `coding-server` exports so server-side engine catalog behavior cannot drift behind locally reassembled data.

## Scope

- `packages/sdkwork-birdcoder-server/src/index.ts`
- `scripts/coding-server-engine-truth-contract.test.ts`
- `package.json`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18B-Coding-Server-Engine-Truth-Promotion.md`
- `docs/架构/23-Coding-Server-Engine-Truth-Promotion-Standard.md`
- `docs/release/release-2026-04-11-20.md`

## Checkpoints

- `CP18B-1` `coding-server` must export engine descriptors from shared kernel truth instead of reassembling a local copy.
- `CP18B-2` `coding-server` must export model catalog truth from shared kernel truth instead of maintaining a server-only list.
- `CP18B-3` engine capability lookup must resolve from the shared descriptor truth.
- `CP18B-4` unknown engine lookups must stay explicit and must not silently fall back to the default engine.
- `CP18B-5` the new contract must become release-blocking through `check:release-flow`.

## Closure Facts

- `packages/sdkwork-birdcoder-server/src/index.ts` now exports:
  - `listBirdCoderCodingServerEngines()`
  - `listBirdCoderCodingServerModels()`
  - `getBirdCoderCodingServerEngineDescriptor(engineKey)`
  - `getBirdCoderCodingServerEngineCapabilities(engineKey)`
- All four exports derive from `listWorkbenchCodeEngineDescriptors()` and `listWorkbenchModelCatalogEntries()`.
- Unknown server-side engine lookups now return `null` instead of reopening fallback drift through `codex`.
- `scripts/coding-server-engine-truth-contract.test.ts` makes the following executable:
  - server engine descriptors equal shared kernel descriptors
  - server model catalog equals shared kernel catalog
  - per-engine descriptor and capability round-trips stay lossless
  - unknown engines remain explicit `null`
- `check:release-flow` now executes the new contract.

## Verification

- `node --experimental-strip-types scripts/coding-server-engine-truth-contract.test.ts`
- `pnpm.cmd run test:coding-server-engine-truth-contract`
- `pnpm.cmd run test:coding-server-route-contract`
- `pnpm.cmd run test:coding-server-openapi-contract`
- `pnpm.cmd run test:engine-kernel-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Notes

- This slice closes only the TypeScript `coding-server` engine-truth promotion lane.
- Rust host engine/model fixtures still remain a separate duplication risk and become the next non-environmental Step 18 target.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
