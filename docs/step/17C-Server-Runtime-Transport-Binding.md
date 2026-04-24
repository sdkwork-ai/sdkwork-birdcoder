# Step 17C - Server Runtime Transport Binding

## Goal

Close the server-side runtime transport binding so TypeScript-side default IDE reads can adopt the same host-derived app/admin client contract without pretending the server package has a shell-style UI entrypoint.

## Closed Scope

- packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts
- packages/sdkwork-birdcoder-infrastructure/package.json
- packages/sdkwork-birdcoder-shell/src/application/bootstrap/bootstrapShellRuntime.ts
- packages/sdkwork-birdcoder-server/src/index.ts
- packages/sdkwork-birdcoder-server/package.json
- scripts/server-runtime-transport-contract.test.ts
- package.json

## Checkpoints

- CP17C-1 shared host-to-runtime binding logic is reusable and no longer duplicated between shell bootstrap and server runtime binding.
- CP17C-2 `await bindBirdCoderServerRuntimeTransport()` resolves `resolveServerRuntime()` and configures default IDE reads through the same host-derived HTTP transport contract.
- CP17C-3 server transport binding remains transport-only and does not pretend to be a shell `initCore()` entrypoint.
- CP17C-4 release-flow verification now treats server runtime transport binding as part of the mandatory host runtime baseline.

## Verification

- `pnpm.cmd run test:server-runtime-transport-contract`
- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `node scripts/host-runtime-contract.test.ts`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Next Serial Path

1. Run PostgreSQL live smoke only when a real DSN-backed environment exists.
2. If no real DSN exists, record the block explicitly and do not fabricate a PostgreSQL closure claim.
