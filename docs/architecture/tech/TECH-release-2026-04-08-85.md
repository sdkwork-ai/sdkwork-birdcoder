> Migrated from `docs/release/release-2026-04-08-85.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Extends the Step 10 governance regression report into shared release flow, CI flow, release parity, and docs information architecture contracts.
- Reuses the existing `release-flow`, `ci-flow`, `release-parity`, and `docs-ia` contracts inside `scripts/governance-regression-report.mjs` instead of introducing a second delivery-governance report.
- Raises the shared JSON governance regression artifact from 27 to 31 checks while keeping the same `artifacts/governance/governance-regression-report.json` output contract.

## Scope

- `scripts/governance-regression-report.mjs`
- `scripts/governance-regression-report.test.mjs`
- `docs/core/release-and-deployment.md`
- `docs/release/releases.json`

## Verification

- `node scripts/governance-regression-report.test.mjs`
- `pnpm check:governance-regression`

## Notes

- This closes the next delivery-governance slice by proving that release workflow shape, CI workflow shape, release parity, and docs information architecture live inside the same repeatable governance aggregation path as runtime and persistence governance.
- The report stays contract-first: it widens by importing existing delivery and parity contracts instead of widening the report schema.
- The next best expansion remains another uncovered engine, browser-runtime, or release-asset contract with direct operational value.
