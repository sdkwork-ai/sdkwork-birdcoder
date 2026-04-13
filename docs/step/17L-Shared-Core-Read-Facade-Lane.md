# Step 17L - Shared Core Read Facade Lane

## Goal

Close the first shared core read facade in `@sdkwork/birdcoder-types` for representative core routes that already have real server behavior.

## Closed Scope

- `scripts/generated-core-read-client-facade-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `package.json`

## Checkpoints

- `CP17L-1` `@sdkwork/birdcoder-types` must own `createBirdCoderGeneratedCoreReadApiClient({ transport })`.
- `CP17L-2` the facade must build requests only through `createBirdCoderFinalizedCodingServerClient()`.
- `CP17L-3` the initial facade scope is limited to:
  - `/api/core/v1/descriptor`
  - `/api/core/v1/runtime`
  - `/api/core/v1/health`
  - `/api/core/v1/engines`
  - `/api/core/v1/operations/:operationId`
- `CP17L-4` the facade must not publish placeholder routes that still return `not_implemented`.
- `CP17L-5` executable governance must prove method/path wiring for the shared core facade.
- `CP17L-6` `check:release-flow` must execute that contract.

## Verification

- `node --experimental-strip-types scripts/generated-core-read-client-facade-contract.test.ts`
- `pnpm.cmd run test:generated-core-read-client-facade-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Extend the same shared-facade pattern to implemented core projection reads such as session detail, events, artifacts, and checkpoints.
3. Continue refusing placeholder core routes until the underlying server behavior is real.
