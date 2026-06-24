# 07 Contract Addendum - Release Note Template

## 1. Goal

- Extend the Step 07 unified Studio evidence viewer from diagnostics and issue triage into docs/release-style markdown autofill.
- Keep the change in the shared viewer contract plus the existing clipboard/toast flow.
- Reuse the visible-slice summary instead of introducing a release-only evidence schema.

## 2. Contract

- Builder: `buildUnifiedStudioEvidenceReleaseNoteTemplate(entries, { laneFilter, timestamp })`
- Input: current visible evidence slice after lane filtering
- Output type: `{ content: string }`
- Stable sections: `Highlights`, `Scope`, `Verification`, `Notes`
- Stable fields: `generatedAt`, `laneFilter`, `entryCount`, `lanes`, `projects`, `profiles`, `evidenceKeys`, `latestLaunch`

## 3. UI Wiring

- `StudioEvidencePanel` exposes `onCopyReleaseNote(entries, laneFilter)`
- The action label is `Copy Release Note`
- The action is disabled when the current visible slice is empty
- `StudioPage` copies `releaseNoteTemplate.content` through `navigator.clipboard.writeText(...)`

## 4. Evaluation

- Pass if the current visible slice can be copied directly into a `docs/release/release-*.md` draft without manual restructuring.
- Fail if the output omits the release note sections, drops lane/project/profile scope, or bypasses the shared clipboard flow.
