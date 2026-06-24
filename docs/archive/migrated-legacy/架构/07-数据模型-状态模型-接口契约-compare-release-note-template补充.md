# 07 Contract Addendum - Compare Release Note Template

## 1. Goal

- Extend the Step 07 pairwise evidence flow from compare diagnostics and compare issue triage into docs/release-style markdown.
- Keep the change inside the shared viewer contract plus the existing clipboard/toast flow.
- Reuse the same pairwise difference dimensions already standardized by the compare template contract.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceComparisonReleaseNoteTemplate(entries, { laneFilter, timestamp })`
- Input guard: exactly 2 selected evidence entries from the current visible slice
- Output type: `{ content: string }`
- Stable sections: `Highlights`, `Scope`, `Verification`, `Notes`
- Stable fields: `generatedAt`, `laneFilter`, `comparedEntries`, `evidenceA`, `evidenceB`, `entryATitle`, `entryBTitle`, `entryAProject`, `entryBProject`, `entryARunConfig`, `entryBRunConfig`, `entryAProfile`, `entryBProfile`, `entryALane`, `entryBLane`
- Stable difference fields: `sameLane`, `sameProject`, `sameRunConfig`, `sameProfile`, `sameCommand`, `sameWorkingDirectory`
- De-dup rule: fields promoted into the top-level `Scope` block should not be repeated again in `Notes`
- Stable note fields: `Source: Studio Evidence Viewer`

## 3. UI Wiring

- `StudioEvidencePanel` exposes `onCopyCompareReleaseNote(entries, laneFilter)`
- The action label is `Copy Compare Release Note`
- The action is disabled unless `selectedEntries.length === 2`
- `StudioPage` copies `comparisonReleaseNoteTemplate.content` through `navigator.clipboard.writeText(...)`

## 4. Evaluation

- Pass if a selected evidence pair can be copied directly into a `docs/release/release-*.md` draft without manual restructuring.
- Fail if the output drops pairwise difference fields, omits either evidence identity/title, duplicates promoted scope fields in `Notes`, leaves `Notes` empty, or bypasses the shared clipboard flow.
