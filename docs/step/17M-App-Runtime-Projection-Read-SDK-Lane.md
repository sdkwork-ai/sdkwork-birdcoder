# Step 17M - App Runtime SDK Projection Read Facade Lane

## Goal

Close the next shared core facade slice in `@sdkwork/birdcoder-types` for the implemented coding-session projection-read routes.

## Closed Scope

- `scripts/app-runtime-projection-read-sdk-client-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `package.json`

## Checkpoints

- `CP17M-1` `@sdkwork/birdcoder-types` must extend `createBirdCoderGeneratedCoreReadApiClient({ transport })` instead of creating a second core-read wrapper.
- `CP17M-2` projection-read requests must build only through `createBirdCoderFinalizedCodingServerClient()`.
- `CP17M-3` current shared projection-read scope is limited to:
  - `/app/v3/api/coding_sessions/:id`
  - `/app/v3/api/coding_sessions/:id/events`
  - `/app/v3/api/coding_sessions/:id/artifacts`
  - `/app/v3/api/coding_sessions/:id/checkpoints`
- `CP17M-4` payload mapping must stay on shared types-layer models:
  - `BirdCoderCodingSessionSummary`
  - `BirdCoderCodingSessionEvent[]`
  - `BirdCoderCodingSessionArtifact[]`
  - `BirdCoderCodingSessionCheckpoint[]`
- `CP17M-5` executable governance must prove method/path wiring for all four projection-read routes.
- `CP17M-6` `check:release-flow` must execute that contract.

## Verification

- `node --experimental-strip-types scripts/app-runtime-projection-read-sdk-client-contract.test.ts`
- `pnpm.cmd run test:app-runtime-projection-read-sdk-client-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Broaden shared-facade adoption across the remaining `app / backend` transport consumers.
3. Add higher-level typed write/response facades only after the remaining shared read-consumer adoption is closed.
