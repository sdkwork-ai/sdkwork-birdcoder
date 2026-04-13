# Step 17H - Coding-Server Finalized Typed Client Codegen Lane

## Goal

Close the second release-backed SDK/codegen lane by consuming the generated `coding-server` operation catalog and materializing one reusable typed request-builder/client surface under `@sdkwork/birdcoder-types`.

## Closed Scope

- `scripts/generate-coding-server-client-types.ts`
- `scripts/generate-coding-server-client-types.test.ts`
- `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`
- `packages/sdkwork-birdcoder-types/src/index.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- `package.json`

## Checkpoints

- `CP17H-1` codegen input must come only from `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`, not from raw finalized OpenAPI files.
- `CP17H-2` generated output path is fixed to `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`.
- `CP17H-3` generated output must freeze:
  - deterministic operation descriptor map
  - typed path-parameter map
  - `buildBirdCoderFinalizedCodingServerClientRequest()`
  - `createBirdCoderFinalizedCodingServerClient()`
- `CP17H-4` route-less operations must not require `pathParams`; route-param operations must still require `pathParams`.
- `CP17H-5` at least one real shared consumer must adopt the generated request builder. The representative closure is `appAdminApiClient.ts`.
- `CP17H-6` release-flow governance must execute the typed-client codegen contract.

## Verification

- `node --experimental-strip-types scripts/generate-coding-server-client-types.ts`
- `node --experimental-strip-types scripts/generate-coding-server-client-types.test.ts`
- `pnpm.cmd run test:coding-server-client-types-codegen`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Expand generated-client adoption through shared high-level facades so handwritten request assembly keeps shrinking across remaining shared `core / app / admin` consumers.
3. Build higher-level typed response/write facades only on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`.
