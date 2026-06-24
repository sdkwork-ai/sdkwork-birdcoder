# Step 17R - App Runtime SDK Facade Exclusion Governance Lane

## Goal

Turn the "not-yet-promoted app runtime writes and still-unimplemented app runtime reads must stay outside the shared high-level facade" rule into explicit types-layer metadata plus an executable release-flow contract.

## Closed Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17R-1` `@sdkwork/birdcoder-types` must expose an explicit promoted-operation catalog for the app runtime SDK facade.
- `CP17R-2` `@sdkwork/birdcoder-types` must expose an explicit excluded-operation catalog for not-yet-promoted app runtime writes and still-unimplemented app runtime reads.
- `CP17R-3` helper predicates must let downstream governance distinguish promoted and excluded app runtime operations without scanning implementation text.
- `CP17R-4` executable governance must prove excluded operations remain available in the low-level generated client while staying absent from the app runtime SDK facade.
- `CP17R-5` `check:release-flow` must execute the app runtime SDK facade governance contract.

## Verification

- `node --experimental-strip-types scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `pnpm.cmd run test:app-runtime-sdk-facade-governance-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep excluded app runtime writes out of the shared high-level facade until the corresponding typed write/response facade is closed.
3. Once a server-backed app runtime write route becomes real, move the next serial closure to typed write/response facade promotion for that route.
