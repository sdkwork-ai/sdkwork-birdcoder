# Step 19 - Governance Regression Deterministic Baseline Lane

## Status

- Closed on `2026-04-11`.

## Goal

Remove false governance-regression blockers so the gate fails only on real product regressions, then record the next remaining blocker with exact measurable evidence.

## Scope

- `scripts/check-arch-boundaries.mjs`
- `scripts/governance-regression-report.mjs`
- `scripts/governance-regression-report.test.mjs`
- `packages/sdkwork-birdcoder-i18n/src/locales/en/app/menu.ts`
- `packages/sdkwork-birdcoder-i18n/src/locales/zh/app/menu.ts`
- `docs/reference/commands.md`
- `docs/guide/development.md`
- `docs/prompts/反复执行Step指令.md`
- `docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md`
- `docs/架构/28-Governance-Regression-Deterministic-Baseline-Standard.md`
- `docs/release/release-2026-04-11-25.md`

## Checkpoints

- `CP19-1` `check-arch-boundaries.mjs` must match the active runtime package topology instead of failing on outdated allowlists.
- `CP19-2` `i18n-contract.test.mjs` must cover every used translation key, including `app.menu.previousCodingSession` and `app.menu.nextCodingSession`.
- `CP19-3` governance regression must run the web budget slice on a fresh build, not on leftover `dist` state.
- `CP19-4` after false blockers are removed, the remaining governance-regression failure must be a real measurable regression.

## Closure Facts

- `check-arch-boundaries.mjs` now accepts the active package topology used by the current runtime composition:
  - `chat -> types`
  - `infrastructure -> host-core | types`
  - `server -> chat | commons | host-core | infrastructure | types`
  - `shell -> infrastructure`
  - `web -> distribution | host-core | shell`
- Locale parity is restored for the two active menu shortcuts:
  - `app.menu.previousCodingSession`
  - `app.menu.nextCodingSession`
- Governance regression now executes the web budget slice through `pnpm run build`, so missing build artifacts no longer hide the real performance outcome.
- The executable implementation truth for `CP19-3` is now frozen again:
  - `scripts/governance-regression-report.mjs` must execute the declared `pnpm run build` command for `web-bundle-budget`
  - `scripts/governance-regression-report.test.mjs` must fail if a command-backed check is silently downgraded to import-only execution
- After those repairs, the remaining governance-regression blocker is now explicit and singular:
  - `web-bundle-budget`
  - built largest asset: `index-CyGeJBBo.js`
  - observed size: `1791.9 KiB`
  - allowed cap: `700.0 KiB`

## Verification

- `node scripts/check-arch-boundaries.mjs`
- `node scripts/i18n-contract.test.mjs`
- `node scripts/governance-regression-report.test.mjs`
- `pnpm.cmd run build` -> passes under the governed `web-bundle-budget`
- `node scripts/governance-regression-report.mjs` -> blocked on `vite-host-build-preflight`

## Notes

- This slice closes governance-regression determinism, not web performance optimization itself.
- The concrete web bundle regression is closed by `19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md`; treat that follow-up lane as the live bundle standard.
- The former next target is now closed in `18G-Engine-Governance-Packaged-Release-Evidence-Lane.md`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- Active Architecture 27/28 docs must not regress to `after PostgreSQL live-smoke recheck`; on this host, that rerun already closed as a DSN-backed `passed` report, so future loops must move to the next lowest-score non-environmental slice unless fresh failing evidence appears.

## Current Loop Addendum - 2026-04-13 Command Path Re-closure

- A real drift reappeared when `web-bundle-budget` was labeled as `pnpm run build` in governance regression metadata but still executed via direct module import, which bypassed the build and falsely failed on missing `dist`.
- This loop re-closes `CP19-3` by restoring true command execution for the build-backed bundle-budget lane and freezing that behavior in `scripts/governance-regression-report.test.mjs`.
- `scripts/governance-regression-report.mjs` now also clears parent `pnpm run` lifecycle metadata before executing command-backed checks, so the Step `19` lane stays deterministic even when governance runs as the final tier of `check:quality:release`.
- The governed root `build` path now avoids recursive `pnpm --filter @sdkwork/birdcoder-web build` execution and instead runs the web Vite host directly through `pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production`; `check:quality:standard` now reuses the same direct web-host build chain.
- `scripts/ci-flow-contract.test.mjs` and `scripts/quality-gate-matrix-contract.test.mjs` now freeze that same direct `check:quality:standard` command string, closing the final Step `19` tail drift that was still failing only on stale contract expectations.
- Fresh release-tier evidence on `2026-04-13` now confirms both command surfaces are green with the declared `fast -> standard -> matrix -> release-flow -> ci-flow -> governance` topology unchanged:
  - `cmd /d /s /c "pnpm.cmd check:quality:release"` passes
  - `node scripts/quality-gate-execution-report.mjs` returns `status: passed` with `passedCount: 3`
- Fresh `node scripts/governance-regression-report.mjs` evidence now returns `110/110` passed checks with the governed bundle sizes:
  - entry `index-DJsuPCYU.js`: `68.1 KiB`
  - largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`

## Current Loop Addendum - 2026-04-15 Vite Host Block Preservation

- The Step `19` deterministic baseline now also closes the remaining Vite-host blocker misclassification drift.
- `scripts/governance-regression-report.test.mjs` now freezes that command-backed `[vite:define] spawn EPERM` is reported as `blocked` with `failureClassification: toolchain-platform`, not as an ordinary failed repository regression.
- `scripts/governance-regression-report.mjs` now emits `blockedCheckIds`, `blockingDiagnosticIds`, and `environmentDiagnostics` so a governed Vite-host denial stays machine-readable and auditable inside the governance report.
- Fresh evidence on `2026-04-15` now records the split current truth:
  - direct `pnpm.cmd run build` still passes with entry `68.1 KiB`, largest JS asset `598.2 KiB`, and cap `700.0 KiB`
  - `node scripts/governance-regression-report.mjs` returns `status: blocked`, `passedCount: 97`, `blockedCount: 1`, `failedCount: 0`, `blockedCheckIds: ["web-bundle-budget"]`, and `blockingDiagnosticIds: ["vite-host-build-preflight"]`
  - direct `pnpm.cmd check:quality:release` now exits non-zero earlier because `fast` fails first at `check:web-vite-build` with `[vite:define] spawn EPERM`
- Future loops must not weaken the web budget or rewrite repository truth when the remaining governance issue is this blocked Vite-host execution path on the current host; rerun the declared command path after the host capability gap is cleared.
