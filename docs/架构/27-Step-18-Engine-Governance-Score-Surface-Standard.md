# Step 18 Engine Governance Score-Surface Standard

## Objective

Step 18 engine-adapter correctness must be visible in governance regression and release-tier quality scoring, not only in raw release-flow command membership.

## Standard

- `scripts/governance-regression-report.mjs` must include:
  - `engine-runtime-adapter`
  - `engine-conformance`
  - `tool-protocol`
  - `engine-resume-recovery`
- `scripts/quality-gate-matrix-report.mjs` release tier must expose the same quartet through `governanceCheckIds`.
- Packaged `release-manifest.json.qualityEvidence` must preserve the same quartet through `releaseGovernanceCheckIds`.
- Finalized smoke and rendered release notes must consume the packaged quartet from finalized `qualityEvidence`, not reconstruct it from side knowledge.
- Release-tier quality focus and evidence text must explicitly mention Step 18 engine-governance closure.
- Live docs must track the active governance-regression count and the quality-matrix score surface semantics.

## Prohibited

- Leaving the Step 18 engine-governance quartet visible only inside `check:release-flow`.
- Treating engine-governance regressions as operator knowledge instead of score-bearing report data.
- Letting docs continue to claim the older governance baseline count after the report grows.

## Why

- Loop execution chooses the next slice from reportable risk, not from hidden local knowledge.
- Commercial delivery needs release-tier score artifacts to show engine-governance closure explicitly.
- Governance regression and quality matrix are the two smallest shared score surfaces consumed by docs, release evidence, and operator review.

## Governance

- Required verification:
  - `node scripts/governance-regression-report.test.mjs`
  - `node scripts/quality-gate-matrix-contract.test.mjs`
  - `pnpm.cmd run check:governance-regression`
  - `pnpm.cmd run check:quality-matrix`
  - `pnpm.cmd run check:live-docs-governance-baseline`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
  - `pnpm.cmd run typecheck`

## Evaluation Criteria

- `governance_visibility`
  - pass: governance regression includes the Step 18 quartet as first-class checks
  - fail: any engine-governance check remains outside the aggregated report
- `score_surface_integrity`
  - pass: release-tier quality output exposes the quartet through `governanceCheckIds`, focus, and evidence
  - fail: quality reporting cannot identify Step 18 engine-governance risk directly
- `packaged_evidence_integrity`
  - pass: finalized `qualityEvidence`, finalized smoke, and release notes preserve the quartet through `releaseGovernanceCheckIds`
  - fail: packaged delivery evidence loses the Step 18 quartet after finalization
- `docs_truth_alignment`
  - pass: docs match the live governance count and score-surface semantics
  - fail: docs drift behind executable governance

## Next Standard Target

This standard is now fully closed; PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host, so future loops must select the next lowest-score non-environmental slice instead of reopening Step 18 score-surface or packaged-evidence promotion.
