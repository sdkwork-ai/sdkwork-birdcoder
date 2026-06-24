# 07 Contract Addendum - Compare Issue Template

## 1. Goal

- Extend the Step 07 unified Studio evidence viewer from pure comparison output to issue-ready triage output.
- Keep the change inside the existing viewer contract, clipboard flow, and toast flow.
- Reuse the same evidence pair and difference dimensions already used by compare-template copy.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceComparisonIssueTemplate(entries, { laneFilter, timestamp })`
- Input guard: exactly 2 selected evidence entries from the current visible slice
- Output type: `{ content: string }`
- Stable summary fields: `generatedAt`, `laneFilter`, `comparedEntries`, `evidenceA`, `evidenceB`, `entryATitle`, `entryBTitle`, `entryAProject`, `entryBProject`, `entryARunConfig`, `entryBRunConfig`, `entryAProfile`, `entryBProfile`, `entryALane`, `entryBLane`
- Stable difference fields: `sameLane`, `sameProject`, `sameRunConfig`, `sameProfile`, `sameCommand`, `sameWorkingDirectory`

## 3. Output Shape

- Heading: `# Studio Evidence Comparison Issue`
- Sections: `Summary`, `Difference Summary`, `Problem Statement`, `Triage Checklist`, `Entry A`, `Entry B`
- Entry details reuse the shared evidence template fields: title, lane, evidence key, summary, project, run config, profile, command, working directory, launched time

## 4. UI Wiring

- `StudioEvidencePanel` exposes `onCopyCompareIssueTemplate(entries, laneFilter)`
- The action label is `Copy Compare Issue Template`
- The action is disabled unless `selectedEntries.length === 2`
- `StudioPage` copies `comparisonIssueTemplate.content` through `navigator.clipboard.writeText(...)`

## 5. Evaluation

- Pass if a selected evidence pair can be copied directly into issue triage without manual reformatting.
- Fail if the output drops compare summary fields, omits entry identity/title context, or bypasses the shared clipboard flow.
