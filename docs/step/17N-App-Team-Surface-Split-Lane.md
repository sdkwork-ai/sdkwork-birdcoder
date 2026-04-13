# Step 17N - App Team Surface Split Lane

## Goal

Split runtime team reads from admin team reads on the shared app/admin facade so default IDE services stop routing workspace team catalogs through the admin surface.

## Closed Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- `scripts/generated-app-admin-client-facade-contract.test.ts`
- `scripts/app-admin-sdk-consumer-contract.test.ts`
- `scripts/server-runtime-transport-contract.test.ts`

## Checkpoints

- `CP17N-1` `BirdCoderAppAdminApiClient.listTeams()` must resolve against `/api/app/v1/teams`.
- `CP17N-2` `BirdCoderAppAdminApiClient.listAdminTeams()` must resolve against `/api/admin/v1/teams`.
- `CP17N-3` `ApiBackedTeamService` and default IDE services must consume `listTeams()` for runtime workspace team catalogs.
- `CP17N-4` in-process transport must serve both team surfaces from one shared query layer.
- `CP17N-5` executable governance must prove the shared-facade split plus the default runtime transport adoption.

## Verification

- `pnpm.cmd run test:generated-app-admin-client-facade-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:server-runtime-transport-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Continue shared-facade adoption across remaining real `core / app / admin` transport consumers.
3. Add typed write/response facades only after the read-surface split remains stable under release-flow governance.
