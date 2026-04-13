# 07 Contract Addendum - Compare Diagnostics Bundle

## 1. Goal

- Extend the Step 07 pairwise evidence flow with a machine-readable diagnostics contract.
- Keep the change inside the shared viewer contract plus the existing clipboard/toast flow.
- Reuse the same pairwise difference dimensions already standardized by the compare markdown family.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceComparisonDiagnosticBundle(entries, { laneFilter, timestamp })`
- Input guard: exactly 2 selected evidence entries from the current visible slice
- Output type: `{ content: string }`
- Stable top-level fields: `generatedAt`, `laneFilter`, `comparedEntries`, `comparison`, `entries`
- Stable comparison fields: `sameLane`, `sameProject`, `sameRunConfig`, `sameProfile`, `sameCommand`, `sameWorkingDirectory`

## 3. UI Wiring

- `StudioEvidencePanel` exposes `onCopyCompareDiagnostics(entries, laneFilter)`
- The action label is `Copy Compare Diagnostics`
- The action is disabled unless `selectedEntries.length === 2`
- `StudioPage` copies `comparisonDiagnosticBundle.content` through `navigator.clipboard.writeText(...)`

## 4. Evaluation

- Pass if a selected evidence pair can be copied directly into automation or triage tooling as JSON without manual reshaping.
- Fail if the output drops either evidence entry, loses pairwise comparison fields, or bypasses the shared clipboard flow.
