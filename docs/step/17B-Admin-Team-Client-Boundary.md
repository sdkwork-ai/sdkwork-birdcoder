# Step 17B - Team Client Boundary

## Goal

Close the first representative team service boundary so default IDE services consume workspace team reads through the shared typed app/admin client instead of local repository bypasses or UI-local DTO forks, while explicit admin team reads stay separately named.

## Closed Scope

- packages/sdkwork-birdcoder-types/src/index.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ITeamService.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedTeamService.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts
- packages/sdkwork-birdcoder-infrastructure/src/index.ts
- packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx
- packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx
- scripts/app-admin-sdk-consumer-contract.test.ts

## Checkpoints

- CP17B-1 `BirdCoderAppAdminApiClient.listTeams()` resolves against `/api/app/v1/teams` for workspace-scoped runtime reads.
- CP17B-2 `BirdCoderAppAdminApiClient.listAdminTeams()` remains the explicit admin-surface team reader on `/api/admin/v1/teams`.
- CP17B-3 `createDefaultBirdCoderIdeServices()` exposes `teamService` on the same shared client boundary already used by workspace/project reads.
- CP17B-4 `BirdCoderTeam` and `ITeamService` provide one minimal domain/service standard for later console and UI adoption.
- CP17B-5 `IDEContext` and `ServiceContext` forward `teamService` without reintroducing eager default-service allocation.

## Verification

- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `node scripts/host-runtime-contract.test.ts`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Next Serial Path

1. Define server bootstrap transport binding on the same runtime contract without inventing a fake TS entrypoint.
2. Add PostgreSQL live smoke only with a real DSN-backed environment.
