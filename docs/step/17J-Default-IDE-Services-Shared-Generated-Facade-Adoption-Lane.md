# Step 17J - Default IDE Services Shared Generated Facade Adoption Lane

## Goal

Move the default IDE service-composition path onto the shared generated app/admin facade so runtime HTTP and in-process fallback consumers stop routing representative request assembly through the infrastructure wrapper.

## Closed Scope

- `scripts/default-ide-services-generated-app-admin-facade-contract.test.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts`
- `package.json`

## Checkpoints

- `CP17J-1` `defaultIdeServices.ts` must import `createBirdCoderGeneratedAppAdminApiClient` from `@sdkwork/birdcoder-types`.
- `CP17J-2` runtime HTTP composition must build the shared facade directly from `createBirdCoderHttpApiTransport(...)`.
- `CP17J-3` in-process fallback composition must build the shared facade directly from `createBirdCoderInProcessAppAdminApiTransport(...)`.
- `CP17J-4` `defaultIdeServices.ts` must not call `createBirdCoderAppAdminApiClient()` for transport-based representative app/admin reads.
- `CP17J-5` executable governance must lock this rule with a dedicated contract.
- `CP17J-6` `check:release-flow` must execute that contract.

## Verification

- `node --experimental-strip-types scripts/default-ide-services-generated-app-admin-facade-contract.test.ts`
- `node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
- `pnpm.cmd run test:shell-runtime-app-client-contract`
- `pnpm.cmd run test:server-runtime-transport-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Remove redundant app/admin wrapper layers once the default path and consumer contracts no longer need them.
3. Extend the same direct shared-facade composition rule to remaining shared `core / app / admin` transport consumers.
4. Add typed write/response facades only on top of the generated client plus shared-facade stack.
