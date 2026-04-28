# Governance Regression Deterministic Baseline Standard

## Objective

`check:governance-regression` must fail only on real repository regressions, not on stale dependency policy drift, missing locale keys, missing build artifacts, or host command-runner capability gaps.

## Standard

- Architecture-boundary allowlists must match the active runtime package topology.
- Locale governance must include every key referenced by source code in both `en` and `zh`.
- The web bundle budget slice must execute on a fresh build artifact, not on leftover `dist` state.
- Governance checks that depend on generated artifacts must execute their declared command path when the command itself materializes the prerequisite artifact; relabeling the command without executing it is still stale-state drift.
- If the host blocks the declared command runner itself, governance regression must preserve that condition as a structured `blocked` `toolchain-platform` diagnostic instead of collapsing it into a failed repository regression.
- Once those prerequisites are correct, the remaining governance-regression failures are treated as real release blockers.

## Prohibited

- Keeping outdated package-boundary policy that rejects the runtime topology already used by the product.
- Letting source code reference translation keys that are absent from one locale.
- Running the web budget gate against an undefined or stale build state.
- Masking a real oversized bundle by weakening the budget instead of fixing the bundle.

## Why

- Governance scoring is only useful when false blockers are removed.
- Locale parity and package topology are baseline correctness, not optional cleanup.
- Commercial delivery needs performance blockers to be measurable and reproducible from one deterministic command path.

## Governance

- Required verification:
  - `node scripts/check-arch-boundaries.mjs`
  - `node scripts/i18n-contract.test.mjs`
  - `node scripts/governance-regression-report.test.mjs`
  - `pnpm.cmd run build`
  - `pnpm.cmd run check:governance-regression`

## Evaluation Criteria

- `boundary_truth`
  - pass: package boundary policy matches active runtime composition
  - fail: governance regression blocks on outdated allowlists
- `locale_truth`
  - pass: all used translation keys exist in both locales
  - fail: source keys drift beyond locale resources
- `performance_truth`
  - pass: the web budget gate runs on a fresh build and reports a real size outcome
  - fail: missing build artifacts or stale outputs hide the true bundle state
- `runner_truth`
  - pass: host command-runner denials are recorded as structured blocked diagnostics
  - fail: host `spawn EPERM` conditions are misreported as repository regressions

## Closure Result

- This deterministic baseline is now fully closed.
- The former `web-bundle-budget` blocker is closed by `29-Web-Bundle-Segmentation-And-Production-Build-Standard.md`.
- Latest evidence:
  - entry `index-CKw7UVoM.js`: `68.1 KiB`
  - largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`
  - allowed cap: `700.0 KiB`

## Next Standard Target

The Step 18 packaged release-evidence promotion is now closed; PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host, so future loops must select the next lowest-score non-environmental slice instead of reopening this packaged-evidence work.

## Current Loop Addendum - Command-backed Build Truth

- `scripts/governance-regression-report.mjs` now keeps `web-bundle-budget` on the declared `pnpm run build` command path instead of importing only `scripts/web-bundle-budget.test.mjs`.
- `scripts/governance-regression-report.test.mjs` freezes that command-backed execution mode so future loops cannot silently regress to stale-artifact imports while still claiming fresh-build governance truth.
- Command-backed governance execution now strips parent `pnpm run` lifecycle metadata before spawning nested commands, so `check:quality:release` cannot leak outer script context into the governed build lane.
- The governed root build path now bypasses recursive `pnpm --filter @sdkwork/birdcoder-web build` script execution and instead calls the web host build directly through `pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production`.
- `scripts/ci-flow-contract.test.mjs` and `scripts/quality-gate-matrix-contract.test.mjs` now freeze that same direct web-host `check:quality:standard` chain, so governance regression no longer fails at the tail on stale release-tier contract metadata.
- Fresh evidence on `2026-04-13` reconfirms the same governed outcome:
  - entry `index-DJsuPCYU.js`: `68.1 KiB`
  - largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`
  - allowed cap: `700.0 KiB`
- Historical direct-runner evidence on `2026-04-13` re-verified:
  - `artifacts/governance/governance-regression-report.json`: `101/101` passed with `failedCheckIds: []`
  - `artifacts/quality/quality-gate-execution-report.json`: `status: passed` with `passedCount: 3`
- Current host evidence on `2026-04-15` now preserves the governed Vite-host blocker explicitly instead of fabricating a repository failure:
  - direct `pnpm.cmd run build` still passes with entry `68.1 KiB`, largest JS asset `598.2 KiB`, and cap `700.0 KiB`
  - `artifacts/governance/governance-regression-report.json`: `status: blocked`, `passedCount: 97`, `blockedCount: 1`, `failedCount: 0`, `blockedCheckIds: ["web-bundle-budget"]`, `blockingDiagnosticIds: ["vite-host-build-preflight"]`
  - direct `pnpm.cmd check:quality:release` now exits non-zero earlier because `fast` fails first at `check:web-vite-build` with `[vite:define] spawn EPERM`
