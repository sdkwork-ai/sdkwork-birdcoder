# Step 17O - Default IDE Release Service Adoption Lane

## Goal

Close the first governed admin release consumer slice in the default IDE/app layer so release catalog reads stop ending at the shared app/admin client only.

## Closed Scope

- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IReleaseService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedReleaseService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx`
- `packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx`
- `packages/sdkwork-birdcoder-commons/src/hooks/useReleases.ts`
- `scripts/default-ide-services-release-service-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17O-1` `BirdCoderAppAdminApiClient.listReleases()` must remain the explicit admin-surface release reader on `/api/admin/v1/releases`.
- `CP17O-2` `IReleaseService` and `ApiBackedReleaseService` must expose governed release catalog reads without rebuilding admin HTTP or DTOs locally.
- `CP17O-3` `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useReleases()` must expose one shared default IDE/app consumer boundary for release catalogs.
- `CP17O-4` `check:release-flow` must execute `scripts/default-ide-services-release-service-contract.test.ts`.

## Verification

- `pnpm.cmd run test:default-ide-services-release-service-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Move the implemented shared core read facade into default service/context/app consumers before adding typed write surfaces.
3. Add higher-level typed write/response facades only after shared read adoption remains stable under release-flow governance.
