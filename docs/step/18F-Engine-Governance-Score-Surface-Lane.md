# Step 18F - Engine Governance Score-Surface Lane

## Status

- Closed on `2026-04-11`.

## Goal

Promote the existing Step 18 engine runtime adapter, conformance, tool protocol, and resume or recovery checks into score-bearing governance surfaces so loop decisions can read engine-governance risk from governance regression and release-tier quality reports.

## Scope

- `scripts/governance-regression-report.mjs`
- `scripts/governance-regression-report.test.mjs`
- `scripts/quality-gate-matrix-report.mjs`
- `scripts/quality-gate-matrix-contract.test.mjs`
- `docs/core/release-and-deployment.md`
- `docs/reference/commands.md`
- `docs/guide/development.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/18F-Engine-Governance-Score-Surface-Lane.md`
- `docs/架构/27-Step-18-Engine-Governance-Score-Surface-Standard.md`
- `docs/release/release-2026-04-11-24.md`

## Checkpoints

- `CP18F-1` governance regression must include `engine-runtime-adapter`.
- `CP18F-2` governance regression must include `engine-conformance`.
- `CP18F-3` governance regression must include `tool-protocol`.
- `CP18F-4` governance regression must include `engine-resume-recovery`.
- `CP18F-5` release-tier quality reporting must expose the same quartet through `governanceCheckIds`.
- `CP18F-6` release-tier quality focus and evidence text must explicitly surface Step 18 engine-governance risk.

## Closure Facts

- `scripts/governance-regression-report.mjs` now treats the Step 18 engine-governance quartet as first-class regression checks instead of leaving them outside the aggregated governance baseline.
- `scripts/quality-gate-matrix-report.mjs` now exposes the same quartet in the release tier through:
  - release focus text
  - release evidence text
  - `governanceCheckIds`
- Core docs now align with the live machine baseline:
  - governance regression count is `80`
  - release-tier quality reporting explicitly names the Step 18 engine-governance quartet
- At this checkpoint, PostgreSQL live smoke was not reopened because Step 18 score-surface promotion was the active target; the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.

## Verification

- `node scripts/governance-regression-report.test.mjs`
- `node scripts/quality-gate-matrix-contract.test.mjs`
- `pnpm.cmd run check:governance-regression` -> blocked by `node scripts/check-arch-boundaries.mjs`
- `pnpm.cmd run check:quality-matrix`
- `pnpm.cmd run check:live-docs-governance-baseline`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run typecheck`

## Notes

- This lane closed score-surface promotion first.
- The packaged release-evidence follow-on is now closed separately in `18G-Engine-Governance-Packaged-Release-Evidence-Lane.md`.
- Future reruns must preserve explicit PostgreSQL smoke status as `blocked`, `failed`, or `passed`; do not infer this lane from stale DSN-less history.
