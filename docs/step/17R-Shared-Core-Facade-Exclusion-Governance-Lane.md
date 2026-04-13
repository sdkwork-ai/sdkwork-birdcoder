# Step 17R - Shared Core Facade Exclusion Governance Lane

## Goal

Turn the "not-yet-promoted core writes and still-unimplemented core reads must stay outside the shared high-level facade" rule into explicit types-layer metadata plus an executable release-flow contract.

## Closed Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `scripts/shared-core-facade-governance-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17R-1` `@sdkwork/birdcoder-types` must expose an explicit promoted-operation catalog for the shared high-level core facade.
- `CP17R-2` `@sdkwork/birdcoder-types` must expose an explicit excluded-operation catalog for not-yet-promoted core writes and still-unimplemented core reads.
- `CP17R-3` helper predicates must let downstream governance distinguish promoted and excluded core operations without scanning implementation text.
- `CP17R-4` executable governance must prove excluded operations remain available in the low-level generated client while staying absent from the shared high-level core facade.
- `CP17R-5` `check:release-flow` must execute the shared core facade governance contract.

## Verification

- `node --experimental-strip-types scripts/shared-core-facade-governance-contract.test.ts`
- `pnpm.cmd run test:shared-core-facade-governance-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep excluded core writes out of the shared high-level facade until the corresponding typed write/response facade is closed.
3. Once a server-backed core write route becomes real, move the next serial closure to typed write/response facade promotion for that route.
