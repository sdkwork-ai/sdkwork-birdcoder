# Step 17F - Coding-Server Finalized OpenAPI Governance And Codegen Input

## Goal

Close the finalized-release reuse of the canonical `coding-server` OpenAPI snapshot and expose one downstream codegen input entry that consumes the finalized manifest summary instead of rebuilding another OpenAPI source.

## Closed Scope

- `scripts/release/coding-server-openapi-release-evidence.mjs`
- `scripts/release/finalize-release-assets.mjs`
- `scripts/release/smoke-finalized-release-assets.mjs`
- `scripts/release/render-release-notes.mjs`
- `scripts/coding-server-openapi-codegen-input.mjs`
- `scripts/coding-server-openapi-codegen-input.test.mjs`
- `scripts/release/finalize-release-assets.test.mjs`
- `scripts/release/smoke-finalized-release-assets.test.mjs`
- `scripts/release/render-release-notes.test.mjs`
- `scripts/release/render-release-notes-docs-registry.test.mjs`
- `package.json`

## Checkpoints

- `CP17F-1` finalized `release-manifest.json` must emit `codingServerOpenApiEvidence` whenever server release assets are present.
- `CP17F-2` `codingServerOpenApiEvidence` must be derived from packaged server sidecars only, not from ad hoc regeneration.
- `CP17F-3` multi-target server snapshots must be byte-identical before one canonical summary can be published.
- `CP17F-4` `smoke-finalized-release-assets.mjs` must verify `codingServerOpenApiEvidence` against packaged files and fail if the summary is missing or drifted.
- `CP17F-5` rendered release notes must surface the canonical snapshot path, targets, OpenAPI/API version, and SHA256.
- `CP17F-6` `scripts/coding-server-openapi-codegen-input.mjs` must read the finalized manifest summary and resolve the canonical snapshot path for downstream SDK/codegen consumers.

## Verification

- `node scripts/coding-server-openapi-codegen-input.test.mjs`
- `node scripts/release/finalize-release-assets.test.mjs`
- `node scripts/release/smoke-finalized-release-assets.test.mjs`
- `node scripts/release/render-release-notes.test.mjs`
- `node scripts/release/render-release-notes-docs-registry.test.mjs`
- `pnpm.cmd run generate:openapi:coding-server`
- `node scripts/release/local-release-command.mjs package server --output-dir artifacts/release-openapi-canonical`
- `node scripts/release/local-release-command.mjs smoke server --release-assets-dir artifacts/release-openapi-canonical`
- `node scripts/release/local-release-command.mjs finalize --release-assets-dir artifacts/release-openapi-canonical`
- `node scripts/release/smoke-finalized-release-assets.mjs --release-assets-dir artifacts/release-openapi-canonical`
- `node scripts/release/render-release-notes.mjs --release-tag release-local --release-assets-dir artifacts/release-openapi-canonical --output artifacts/release-openapi-canonical/release-notes.md`
- `node scripts/coding-server-openapi-codegen-input.mjs --release-assets-dir artifacts/release-openapi-canonical`

## Next Serial Path

1. Build the first real SDK/codegen generation lane that consumes `scripts/coding-server-openapi-codegen-input.mjs` instead of hand-resolving OpenAPI paths.
2. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
