# Step 17I - Coding-Server Shared Generated App/Admin Facade Lane

## Goal

Close the first shared high-level representative app/admin facade on top of the release-backed generated client so infrastructure packages stop hand-assembling representative request paths.

## Closed Scope

- `scripts/generated-app-admin-client-facade-contract.test.ts`
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- `package.json`

## Checkpoints

- `CP17I-1` `@sdkwork/birdcoder-types` must own `createBirdCoderGeneratedAppAdminApiClient({ transport })`.
- `CP17I-2` the shared facade must build representative catalog reads only through `createBirdCoderFinalizedCodingServerClient()`.
- `CP17I-3` the representative shared-facade surface is fixed to:
  - `/api/app/v1/workspaces`
  - `/api/app/v1/projects`
  - `/api/app/v1/teams`
  - `/api/admin/v1/teams`
  - `/api/admin/v1/releases`
- `CP17I-4` infrastructure wrappers may contribute transport implementations only; they must not hand-assemble representative app/admin request paths.
- `CP17I-5` executable governance must prove representative method/path/query wiring and unified list-envelope consumption.
- `CP17I-6` `check:release-flow` must execute the shared-facade contract.

## Verification

- `node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
- `pnpm.cmd run test:generated-app-admin-client-facade-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep moving transport-based consumers onto the shared facade until wrapper-owned representative request assembly disappears from default paths.
3. Remove redundant wrapper layers once no real in-repo consumer remains.
4. Expand the same shared-facade pattern to remaining shared `core / app / admin` consumers so host-local request assembly keeps shrinking.
5. Add typed write/response facades only on top of the generated client plus shared-facade layer.
