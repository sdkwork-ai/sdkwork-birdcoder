# 07 Contract Addendum - Compare Summary Template

## 1. Goal

- Extend the Step 07 pairwise evidence flow with a lightweight comparison summary contract.
- Keep the change inside the shared viewer contract plus the existing clipboard/toast flow.
- Reuse the standardized pairwise comparison dimensions without serializing full entry payloads.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceComparisonSummaryTemplate(entries, { laneFilter, timestamp })`
- Input guard: exactly 2 selected evidence entries from the current visible slice
- Output type: `{ content: string }`
- Stable scope fields: `Generated At`, `Lane Filter`, `Compared Entries`, `Evidence A`, `Evidence B`, `Entry A Title`, `Entry B Title`, `Entry A Project`, `Entry B Project`, `Entry A Run Config`, `Entry B Run Config`, `Entry A Profile`, `Entry B Profile`, `Entry A Lane`, `Entry B Lane`
- Stable note fields: compare summary lines
- Output format: compact markdown comparison summary

## 3. UI Wiring

- `StudioEvidencePanel` exposes `onCopyCompareSummary(entries, laneFilter)`
- The action label is `Copy Compare Summary`
- The action is disabled unless `selectedEntries.length === 2`
- `StudioPage` copies `comparisonSummaryTemplate.content` through `navigator.clipboard.writeText(...)`

## 4. Evaluation

- Pass if a selected evidence pair can be copied into triage, chat, or release drafting as a concise comparison summary.
- Fail if the output drops pairwise summary fields, omits either evidence key/title, or falls back to heavy compare/export payloads.
