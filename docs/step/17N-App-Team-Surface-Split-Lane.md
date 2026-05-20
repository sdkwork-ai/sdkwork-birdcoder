# Step 17N - App Team Surface Split Lane

## Goal

Split runtime team reads from backend governance team reads on the shared app/backend facade so default IDE services stop routing workspace team catalogs through the backend surface.

## Closed Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
- `scripts/split-sdk-client-facade-contract.test.ts`
- `scripts/split-sdk-consumer-contract.test.ts`
- `scripts/server-runtime-transport-contract.test.ts`

## Checkpoints

- `CP17N-1` `BirdCoderAppSdkApiClient.listTeams()` must resolve against `/app/v3/api/teams`.
- `CP17N-2` `BirdCoderBackendSdkApiClient.listGovernanceTeams()` must resolve against `/backend/v3/api/iam/teams`.
- `CP17N-3` `ApiBackedTeamService` and default IDE services must consume `listTeams()` for runtime workspace team catalogs.
- `CP17N-4` in-process transport must serve both team surfaces from one shared query layer.
- `CP17N-5` executable governance must prove the direct app/backend client split plus the default runtime transport adoption.

## Verification

- `pnpm.cmd run test:split-sdk-client-facade-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:server-runtime-transport-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Continue direct app/backend client adoption across remaining real `app / backend` transport consumers.
3. Add typed write/response facades only after the read-surface split remains stable under release-flow governance.
