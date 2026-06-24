# 07 Contract Addendum - Summary Template

## 1. Goal

- Extend the Step 07 visible-slice flow with a lightweight summary contract.
- Keep the change inside the shared viewer contract plus the existing clipboard/toast flow.
- Reuse the same normalized summary fields already shown in the panel and export bundle.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceSummaryTemplate(entries, { laneFilter, timestamp })`
- Input: current visible evidence slice after lane filtering
- Output type: `{ content: string }`
- Stable scope fields: `Generated At`, `Lane Filter`, `Entry Count`, `Lanes`, `Projects`, `Profiles`, `Latest Launch`
- Stable note fields: `Evidence Keys`, `Titles`
- Output format: compact markdown summary without full entry serialization

## 3. UI Wiring

- `StudioEvidencePanel` exposes `onCopySummary(entries, laneFilter)`
- The action label is `Copy Summary`
- The action is disabled when `visibleEntries.length === 0`
- `StudioPage` copies `summaryTemplate.content` through `navigator.clipboard.writeText(...)`

## 4. Evaluation

- Pass if the active evidence slice can be copied into chat, issue triage, or release drafting as a concise markdown summary.
- Fail if the summary drops lane scope, latest launch context, or reintroduces full entry payloads instead of the normalized slice overview.
