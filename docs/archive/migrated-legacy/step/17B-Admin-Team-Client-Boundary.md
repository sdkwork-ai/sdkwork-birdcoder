# Step 17B - Team Client Boundary

## Goal

Close the first representative team service boundary so default IDE services consume workspace team reads through the shared typed app/backend client instead of local repository bypasses or UI-local DTO forks, while explicit backend governance team reads stay separately named.

## Closed Scope

- packages/sdkwork-birdcoder-types/src/index.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ITeamService.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedTeamService.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts
- packages/sdkwork-birdcoder-infrastructure/src/index.ts
- packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx
- packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx
- scripts/split-sdk-consumer-contract.test.ts

## Checkpoints

- CP17B-1 `BirdCoderAppSdkApiClient.listTeams()` resolves against `/app/v3/api/teams` for workspace-scoped runtime reads.
- CP17B-2 `BirdCoderBackendSdkApiClient.listGovernanceTeams()` remains the explicit backend-surface team reader on `/backend/v3/api/iam/teams`.
- CP17B-3 `createDefaultBirdCoderIdeServices()` exposes `teamService` on the same shared client boundary already used by workspace/project reads.
- CP17B-4 `BirdCoderTeam` and `ITeamService` provide one minimal domain/service standard for later console and UI adoption.
- CP17B-5 `IDEContext` and `ServiceContext` forward `teamService` without reintroducing eager default-service allocation.

## Verification

- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `node scripts/host-runtime-contract.test.ts`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Next Serial Path

1. Define server bootstrap transport binding on the same runtime contract without inventing a fake TS entrypoint.
2. Add PostgreSQL live smoke only with a real DSN-backed environment.
