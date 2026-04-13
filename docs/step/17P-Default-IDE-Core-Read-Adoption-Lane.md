# Step 17P - Default IDE Core Read Adoption Lane

## Goal

Adopt the implemented shared core read facade into the default IDE service/context/app-consumer path without reopening placeholder core write routes or inventing a local fake core authority.

## Closed Scope

- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx`
- `packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx`
- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingServerOverview.ts`
- `scripts/default-ide-services-generated-core-read-facade-contract.test.ts`
- `scripts/default-ide-services-core-read-service-contract.test.ts`
- `package.json`

## Checkpoints

- `CP17P-1` runtime-bound default IDE services must compose `createBirdCoderGeneratedCoreReadApiClient({ transport: createBirdCoderHttpApiTransport(...) })` directly.
- `CP17P-2` `ICoreReadService` and `ApiBackedCoreReadService` must expose the implemented shared core read surface without rebuilding request paths locally.
- `CP17P-3` `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useCodingServerOverview()` must expose one default app consumer boundary for descriptor/runtime/health/engine overview reads.
- `CP17P-4` no current closure may claim a local in-process core transport truth; when no bound runtime or injected client exists, core reads must stay explicitly unavailable instead of fabricating authority.
- `CP17P-5` `check:release-flow` must execute both new core-read adoption contracts.

## Verification

- `pnpm.cmd run test:default-ide-services-generated-core-read-facade-contract`
- `pnpm.cmd run test:default-ide-services-core-read-service-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Adopt the implemented core projection read facade into app-level coding-session detail consumers before any typed write surface work.
3. Only after read-surface adoption stays stable under release-flow governance may typed write/response facades advance.
