> Migrated from `docs/release/release-2026-04-10-36.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Closes the first representative admin-team client boundary by moving shared typed team reads onto `/backend/v3/api/teams`.
- Adds a minimal `BirdCoderTeam` plus `ITeamService` standard and exposes `teamService` from default IDE services and shared contexts.
- Repairs the corrupted prompt, step, architecture, and prior release append blocks so the next autonomous loop consumes canonical instructions instead of control-character-damaged text.

## Scope

- [index.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-types/src/index.ts)
- [ITeamService.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ITeamService.ts)
- [ApiBackedTeamService.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedTeamService.ts)
- [sdkClients.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts)
- [defaultIdeServices.ts](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts)
- [IDEContext.tsx](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx)
- [ServiceContext.tsx](/<workspace-root>/sdkwork-birdcoder/packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx)
- [split-sdk-consumer-contract.test.ts](/<workspace-root>/sdkwork-birdcoder/scripts/split-sdk-consumer-contract.test.ts)
- [17B-Admin-Team-Client-Boundary.md](/<workspace-root>/sdkwork-birdcoder/docs/step/17B-Admin-Team-Client-Boundary.md)
- [20-统一Rust-Coding-Server-API-协议标准.md](/<workspace-root>/sdkwork-birdcoder/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md)
- [反复执行Step指令.md](/<workspace-root>/sdkwork-birdcoder/docs/prompts/反复执行Step指令.md)

## Verification

- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `node scripts/host-runtime-contract.test.ts`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Notes

- This loop intentionally stops before server bootstrap transport binding because the repository does not yet expose a real TypeScript server runtime entrypoint that can legitimately call `bootstrapShellRuntime({ host })`.
- The next serial closure is defining that server-mode binding on the same runtime contract, then running PostgreSQL live smoke only when a real DSN-backed environment exists.

