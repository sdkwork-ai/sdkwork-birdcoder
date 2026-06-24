> Migrated from `docs/release/release-2026-04-08-24.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Bridges Studio Build and Simulator evidence archives into finalized release metadata, so `release-manifest.json` can now expose normalized `buildEvidence` and `simulatorEvidence` summaries beside `previewEvidence`.
- Extends finalized release smoke to verify the new Build and Simulator summaries against their raw archives instead of trusting manifest generation alone.
- Aligns Step 07, architecture, release docs, and closure gates with the new release-summary bridge so repository governance matches the shipped behavior.

## Scope

- `scripts/release/finalize-release-assets.mjs`
- `scripts/release/smoke-finalized-release-assets.mjs`
- `scripts/release/studio-build-evidence-archive.mjs`
- `scripts/release/studio-simulator-evidence-archive.mjs`
- `scripts/release/finalize-release-assets.test.mjs`
- `scripts/release/smoke-finalized-release-assets.test.mjs`
- `scripts/check-release-closure.mjs`
- `scripts/check-sdkwork-birdcoder-structure.mjs`
- `scripts/sdkwork-birdcoder-architecture-contract.test.mjs`
- `docs/core/release-and-deployment.md`
- `docs/step/07-studio视图-预览-模拟器-编译环境体系.md`
- `docs/架构/06-编译环境-预览-模拟器-测试体系.md`
- `docs/架构/07-数据模型-状态模型-接口契约.md`
- `docs/架构/14-现状基线-差距-演进路线.md`
- `docs/release/releases.json`

## Verification

- `node scripts/release/finalize-release-assets.test.mjs`
- `node scripts/release/smoke-finalized-release-assets.test.mjs`
- `node scripts/check-release-closure.mjs`
- `node scripts/release-flow-contract.test.mjs`
- `node scripts/sdkwork-birdcoder-architecture-contract.test.mjs`
- `node scripts/check-sdkwork-birdcoder-structure.mjs`
- `pnpm.cmd -s exec tsc --noEmit`
- `pnpm.cmd run lint`
- `pnpm.cmd docs:build`

## Notes

- `buildEvidence` is optional and only appears when `studio/build/studio-build-evidence.json` exists in release assets.
- `simulatorEvidence` is optional and only appears when `studio/simulator/studio-simulator-evidence.json` exists in release assets.
- The next Step 07 focus is a unified evidence viewer plus Test lane standardization on the same execution/audit envelope.

