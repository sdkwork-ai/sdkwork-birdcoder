> Migrated from `docs/step/17L-App-Runtime-Read-SDK-Lane.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 17L - App Runtime SDK Read Facade Lane

## Goal

Close the first app runtime read SDK facade in `@sdkwork/birdcoder-types` for representative app runtime routes that already have real server behavior.

## Closed Scope

- `scripts/app-runtime-read-sdk-client-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `package.json`

## Checkpoints

- `CP17L-1` `@sdkwork/birdcoder-infrastructure` must own `createBirdCoderAppSdkApiClient({ transport })`.
- `CP17L-2` the facade must build requests only through `createBirdCoderFinalizedCodingServerClient()`.
- `CP17L-3` the initial facade scope is limited to:
  - `/app/v3/api/system/descriptor`
  - `/app/v3/api/system/runtime`
  - `/app/v3/api/system/health`
  - `/app/v3/api/engines`
  - `/app/v3/api/operations/:operationId`
- `CP17L-4` the facade must not publish placeholder routes that still return `not_implemented`.
- `CP17L-5` executable governance must prove method/path wiring for the app runtime SDK facade.
- `CP17L-6` `check:release-flow` must execute that contract.

## Verification

- `node --experimental-strip-types scripts/app-runtime-read-sdk-client-contract.test.ts`
- `pnpm.cmd run test:app-runtime-read-sdk-client-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Extend the same direct app/backend client pattern to implemented app runtime projection reads such as session detail, events, artifacts, and checkpoints.
3. Continue refusing placeholder app runtime routes until the underlying server behavior is real.

