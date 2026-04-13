# Step 17K - App/Admin Wrapper Removal Lane

## Goal

Delete the redundant infrastructure-side app/admin high-level wrapper so transport creation remains in infrastructure while representative request assembly stays only in `@sdkwork/birdcoder-types`.

## Closed Scope

- `scripts/no-app-admin-client-wrapper-contract.test.ts`
- `scripts/app-admin-sdk-consumer-contract.test.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- `package.json`

## Checkpoints

- `CP17K-1` `appAdminApiClient.ts` must not export `CreateBirdCoderAppAdminApiClientOptions`.
- `CP17K-2` `appAdminApiClient.ts` must not export `createBirdCoderAppAdminApiClient()`.
- `CP17K-3` the infrastructure module must keep only transport factories for app/admin representative reads.
- `CP17K-4` the representative SDK consumer contract must consume `createBirdCoderGeneratedAppAdminApiClient({ transport })` directly.
- `CP17K-5` executable governance must prevent wrapper reintroduction.
- `CP17K-6` `check:release-flow` must execute the no-wrapper contract.

## Verification

- `node --experimental-strip-types scripts/no-app-admin-client-wrapper-contract.test.ts`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `node --experimental-strip-types scripts/default-ide-services-generated-app-admin-facade-contract.test.ts`
- `node --experimental-strip-types scripts/generated-app-admin-client-facade-contract.test.ts`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Repeat the same transport-only hard cutover on the next shared `core / app / admin` transport consumer slice.
3. Add typed write/response facades only on top of the generated client plus shared-facade stack.
