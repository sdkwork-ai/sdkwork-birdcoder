# Step 17G - Coding-Server Finalized OpenAPI Types Codegen Lane

## Goal

Close the first real release-backed SDK/codegen lane by consuming finalized `codingServerOpenApiEvidence` and materializing one generated TypeScript artifact under `@sdkwork/birdcoder-types`.

## Closed Scope

- `scripts/generate-coding-server-openapi-types.mjs`
- `scripts/generate-coding-server-openapi-types.test.mjs`
- `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`
- `packages/sdkwork-birdcoder-types/src/index.ts`
- `package.json`

## Checkpoints

- `CP17G-1` codegen input must come from finalized `release-manifest.json` through `scripts/coding-server-openapi-codegen-input.mjs`.
- `CP17G-2` generated output must freeze canonical OpenAPI evidence fields:
  - `canonicalRelativePath`
  - `targets`
  - `sha256`
  - `openapi`
  - `version`
  - `title`
- `CP17G-3` generated output must include a deterministic operation catalog derived from the finalized canonical snapshot, not from ad hoc route discovery.
- `CP17G-4` generated output path is fixed to `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.
- `CP17G-5` `@sdkwork/birdcoder-types` must export the generated module so downstream SDK/client work can consume one release-backed contract surface.
- `CP17G-6` release-flow governance must execute the new codegen contract test.

## Verification

- `node scripts/generate-coding-server-openapi-types.test.mjs`
- `node scripts/coding-server-openapi-codegen-input.test.mjs`
- `node scripts/generate-coding-server-openapi-types.mjs --release-assets-dir artifacts/release-openapi-canonical`
- `pnpm.cmd run test:coding-server-openapi-types-codegen`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`

## Next Serial Path

1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
2. Build the next non-environmental slice on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`:
   - typed route helpers, or
   - a generated app/admin/core client surface
3. Do not bypass the generated module and rediscover OpenAPI paths directly from release assets.
