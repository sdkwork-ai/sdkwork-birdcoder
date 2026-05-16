# Step 17K - App/Admin Wrapper Removal Lane

## Goal

Delete the redundant infrastructure-side app/backend high-level wrapper so transport creation remains in infrastructure while representative request assembly stays only in `@sdkwork/birdcoder-types`.

## Closed Scope

- `scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs`
- `scripts/split-sdk-consumer-contract.test.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
- `package.json`

## Checkpoints

- `CP17K-1` `sdkClients.ts` must not export `CreateBirdCoderSplitSdkApiClientsOptions`.
- `CP17K-2` `sdkClients.ts` must not export `createBirdCoderSplitSdkApiClients()`.
- `CP17K-3` the infrastructure module must keep only transport factories for app/backend representative reads.
- `CP17K-4` the representative SDK consumer contract must consume `createBirdCoderSplitSdkApiClients({ appTransport, backendTransport })` directly.
- `CP17K-5` executable governance must prevent wrapper reintroduction.
- `CP17K-6` `check:release-flow` must execute the no-wrapper contract.

## Verification

- `node --experimental-strip-types scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `node --experimental-strip-types scripts/default-ide-services-split-sdk-client-contract.test.ts`
- `node --experimental-strip-types scripts/split-sdk-client-facade-contract.test.ts`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Repeat the same transport-only hard cutover on the next shared `app / backend` transport consumer slice.
3. Add typed write/response facades only on top of the generated client plus shared-facade stack.
