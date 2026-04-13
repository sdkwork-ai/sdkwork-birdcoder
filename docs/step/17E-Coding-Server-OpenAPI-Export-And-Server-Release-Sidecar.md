# Step 17E - Coding-Server OpenAPI Export And Server Release Sidecar

## Goal

Close the canonical `coding-server` OpenAPI export as a real artifact and force server packaging plus smoke verification to reuse that same snapshot instead of descriptor-only or seed-only evidence.

## Closed Scope

- `packages/sdkwork-birdcoder-server/src/index.ts`
- `scripts/coding-server-openapi-export.ts`
- `scripts/coding-server-openapi-export-contract.test.ts`
- `scripts/release/local-release-command.mjs`
- `scripts/release/local-release-command.test.mjs`
- `scripts/release/package-release-assets.mjs`
- `scripts/release/package-release-assets.test.mjs`
- `scripts/release/smoke-server-release-assets.mjs`
- `scripts/release/smoke-server-release-assets.test.mjs`
- `package.json`

## Checkpoints

- `CP17E-1` `buildBirdCoderCodingServerOpenApiDocument()` is the canonical TS-side document builder and the export script writes `artifacts/openapi/coding-server-v1.json`.
- `CP17E-2` `release:package:server` always runs `generate:openapi:coding-server` before packaging and reuses that same snapshot.
- `CP17E-3` server release assets always stage `openapi/coding-server-v1.json` under `artifacts/release/server/<platform>/<arch>/`.
- `CP17E-4` `release-asset-manifest.json` must reference the OpenAPI sidecar relative path and `release:smoke:server` must fail if either the manifest entry or the sidecar file is missing.
- `CP17E-5` `local-release-command package server` must print auditable package facts:
  - `outputDir`
  - `outputFamilyDir`
  - `manifestPath`
  - `archivePath`
  - `artifacts`
- `CP17E-6` repo-root stray output such as `server/*` is invalid for the default packaging path; the default package target is only `artifacts/release/server/<platform>/<arch>/`.

## Verification

- `node --experimental-strip-types scripts/coding-server-openapi-export-contract.test.ts`
- `node scripts/release/local-release-command.test.mjs`
- `node scripts/release/package-release-assets.test.mjs`
- `node scripts/release/smoke-server-release-assets.test.mjs`
- `pnpm.cmd run generate:openapi:coding-server`
- `pnpm.cmd run release:package:server`
- `pnpm.cmd run release:smoke:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## Next Serial Path

1. Reuse the canonical `coding-server-v1.json` snapshot in downstream SDK/codegen and finalized release governance instead of rebuilding ad hoc OpenAPI variants.
2. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
