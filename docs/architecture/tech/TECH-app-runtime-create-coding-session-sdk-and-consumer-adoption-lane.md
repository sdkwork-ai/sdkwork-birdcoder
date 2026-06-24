> Migrated from `docs/step/17T-App-Runtime-Create-Coding-Session-SDK-And-Consumer-Adoption-Lane.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 17T - Typed App Runtime Create Coding Session Facade And Consumer Adoption Lane

## Goal

Close the typed app runtime write SDK facade for `codingSessions.create`, promote it into app runtime SDK governance, and wire the first real default-IDE consumer path without losing refreshed UI session visibility.

## Closed Scope

- `packages/sdkwork-birdcoder-types/src/server-api.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectSessionMirror.ts`
- `package.json`
- `scripts/app-runtime-write-sdk-client-contract.test.ts`
- `scripts/default-ide-services-app-runtime-write-sdk-contract.test.ts`
- `scripts/api-backed-project-service-app-runtime-create-coding-session-contract.test.ts`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
- `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `docs/架构/09-安装-部署-发布标准.md`
- `docs/step/17-Coding-Server-App-Backend-SDK与控制台实现.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/release/release-2026-04-11-09.md`
- `docs/release/releases.json`

## Checkpoints

- `CP17T-1` `@sdkwork/birdcoder-infrastructure` must expose `createBirdCoderAppSdkApiClient({ transport })` for `codingSessions.create`.
- `CP17T-2` app runtime SDK governance must move `codingSessions.create` from excluded to promoted while keeping `createCodingSessionTurn` excluded.
- `CP17T-3` runtime-bound default IDE services must compose the app runtime write SDK facade directly from `createBirdCoderHttpApiTransport(...)`.
- `CP17T-4` `ApiBackedProjectService.createCodingSession()` must resolve `workspaceId` from project truth, call the app runtime write SDK facade, and return the server-authoritative session id.
- `CP17T-5` refreshed project catalogs must retain the server-created session through local mirror state instead of dropping it after `fetchProjects()`.

## Verification

- `pnpm.cmd run test:app-runtime-write-sdk-client-contract`
- `pnpm.cmd run test:default-ide-services-app-runtime-write-sdk-contract`
- `pnpm.cmd run test:api-backed-project-service-app-runtime-create-coding-session-contract`
- `pnpm.cmd run test:app-runtime-sdk-facade-governance-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Keep `codingSessions.turns.create` excluded after the now-real Rust host route until the typed write facade and first consumer path close in the same loop.
3. Keep `engines.capabilities.retrieve`, `models.list`, and `approvals.decisions.create` blocked until server behavior is real and release-flow evidence exists.

