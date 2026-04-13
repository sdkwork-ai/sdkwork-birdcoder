# Step 17A - Host Runtime Transport Adoption

## Goal

Close the host bootstrap loop so default workspace/project reads on web / desktop follow one shared runtime-aware app/admin client path.

## Closed Scope

- packages/sdkwork-birdcoder-shell/src/application/bootstrap/bootstrapShellRuntime.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts
- packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts
- packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx
- packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx
- packages/sdkwork-birdcoder-web/src/web/resolveWebRuntime.ts
- packages/sdkwork-birdcoder-web/src/main.tsx
- packages/sdkwork-birdcoder-desktop/src/main.tsx

## Checkpoints

- CP17A-1 `bootstrapShellRuntime({ host })` injects runtime transport into default IDE reads.
- CP17A-2 HTTP transport preserves `apiBaseUrl` path prefixes.
- CP17A-3 `IDEContext` and `ServiceContext` create defaults lazily.
- CP17A-4 web runtime identity follows the same distribution-derived standard as desktop and server.

## Verification

- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `node scripts/host-runtime-contract.test.ts`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run typecheck`

## Next Serial Path

1. Define server bootstrap transport binding on the same runtime contract.
2. Keep representative runtime team reads on the shared app-surface client boundary and keep admin team reads explicit.
3. Add PostgreSQL live smoke only with a real DSN-backed environment.
