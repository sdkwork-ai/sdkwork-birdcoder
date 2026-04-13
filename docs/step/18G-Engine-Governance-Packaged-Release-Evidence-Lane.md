# Step 18G - Engine Governance Packaged Release Evidence Lane

## Status

- Closed on `2026-04-11`.

## Goal

Promote the Step 18 engine runtime adapter, conformance, tool protocol, and resume or recovery quartet from score surfaces into packaged release evidence, so finalized assets and rendered release notes preserve the same engine-governance context end to end.

## Scope

- `scripts/release/quality-gate-release-evidence.mjs`
- `scripts/release/finalize-release-assets.test.mjs`
- `scripts/release/smoke-finalized-release-assets.test.mjs`
- `scripts/release/render-release-notes.mjs`
- `scripts/release/render-release-notes.test.mjs`
- `docs/core/architecture.md`
- `docs/core/release-and-deployment.md`
- `docs/reference/commands.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18G-Engine-Governance-Packaged-Release-Evidence-Lane.md`
- `docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md`
- `docs/step/19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md`
- `docs/架构/27-Step-18-Engine-Governance-Score-Surface-Standard.md`
- `docs/架构/28-Governance-Regression-Deterministic-Baseline-Standard.md`
- `docs/架构/29-Web-Bundle-Segmentation-And-Production-Build-Standard.md`
- `docs/release/release-2026-04-11-29.md`

## Checkpoints

- `CP18G-1` finalized `release-manifest.json.qualityEvidence` must preserve the Step 18 quartet through `releaseGovernanceCheckIds`.
- `CP18G-2` finalized smoke must reject any drift between packaged `quality-gate-matrix-report.json` and the manifest summary, including `releaseGovernanceCheckIds`.
- `CP18G-3` rendered release notes must surface the same packaged Step 18 quartet from finalized `qualityEvidence`.
- `CP18G-4` PostgreSQL live smoke future reruns may still return `blocked`, `failed`, or `passed`, and packaged release evidence must preserve that executable status instead of misreporting it.

## Closure Facts

- `scripts/release/quality-gate-release-evidence.mjs` now promotes the release-tier Step 18 quartet into packaged `qualityEvidence.releaseGovernanceCheckIds`.
- `scripts/release/smoke-finalized-release-assets.mjs` now re-verifies that packaged `qualityEvidence` summary with the same quartet preserved.
- `scripts/release/render-release-notes.mjs` now renders the packaged Step 18 quartet directly from finalized `qualityEvidence`.
- At this checkpoint, PostgreSQL live smoke was still blocked with `reasonCode=missing_postgresql_dsn`; the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.

## Verification

- `node scripts/release/finalize-release-assets.test.mjs`
- `node scripts/release/smoke-finalized-release-assets.test.mjs`
- `node scripts/release/render-release-notes.test.mjs`
- `pnpm.cmd run release:smoke:postgresql-live` -> `blocked (reasonCode=missing_postgresql_dsn)`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run check:governance-regression`
- `pnpm.cmd run docs:build`

## Notes

- This lane closes packaged release-evidence promotion only; it does not fabricate PostgreSQL live-smoke passage in DSN-less environments.
- With this closure, the Step 18 quartet now survives all four layers:
  - `check:release-flow`
  - `check:governance-regression`
  - release-tier quality report
  - packaged `qualityEvidence` / finalized smoke / rendered release notes
- Future reruns must preserve explicit PostgreSQL smoke status inside packaged evidence instead of fabricating or hiding the runtime result.
