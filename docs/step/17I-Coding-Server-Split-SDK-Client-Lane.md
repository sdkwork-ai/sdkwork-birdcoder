# Step 17I - Coding-Server Generated App/Backend SDK Client Lane

## Goal

Close the first explicit high-level app/backend SDK client pair on top of the release-backed generated client so infrastructure packages stop hand-assembling representative request paths.

## Closed Scope

- `scripts/split-sdk-client-facade-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
- `package.json`

## Checkpoints

- `CP17I-1` `@sdkwork/birdcoder-infrastructure` must own `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport })`.
- `CP17I-2` the explicit app/backend SDK client pair must build representative catalog reads only through `createBirdCoderFinalizedCodingServerClient()`.
- `CP17I-3` the representative direct app/backend client surface is fixed to:
  - `/app/v3/api/workspaces`
  - `/app/v3/api/projects`
  - `/app/v3/api/teams`
  - `/backend/v3/api/iam/teams`
  - `/backend/v3/api/releases`
- `CP17I-4` infrastructure wrappers may contribute transport implementations only; they must not hand-assemble representative app/backend request paths.
- `CP17I-5` executable governance must prove representative method/path/query wiring and unified list-envelope consumption.
- `CP17I-6` `check:release-flow` must execute the direct app/backend client contract.

## Verification

- `node --experimental-strip-types scripts/split-sdk-client-facade-contract.test.ts`
- `pnpm.cmd run test:split-sdk-client-facade-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep moving transport-based consumers onto the explicit app/backend SDK client pair until wrapper-owned representative request assembly disappears from default paths.
3. Remove redundant wrapper layers once no real in-repo consumer remains.
4. Expand the same direct app/backend client pattern to remaining shared `app / backend` consumers so host-local request assembly keeps shrinking.
5. Add typed write/response facades only on top of the generated client plus direct app/backend client layer.
