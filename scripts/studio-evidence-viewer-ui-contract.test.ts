import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);

assert.equal(
  studioPageSource.includes('listUnifiedStudioExecutionEvidence('),
  false,
  'StudioPage should not load unified Studio evidence once the right-side evidence panel is removed.',
);

assert.equal(
  studioPageSource.includes('<StudioEvidencePanel'),
  false,
  'StudioPage should not mount the Studio Evidence panel in the main Studio layout.',
);

assert.equal(
  studioPageSource.includes('refreshStudioEvidenceViewer('),
  false,
  'StudioPage should not keep a page-level Studio evidence refresh callback after the panel is removed.',
);

assert.equal(
  studioPageSource.includes('studioEvidenceEntries'),
  false,
  'StudioPage should not keep page-level Studio evidence entry state after the panel is removed.',
);

assert.equal(
  studioPageSource.includes('isStudioEvidenceLoading'),
  false,
  'StudioPage should not keep page-level Studio evidence loading state after the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceReplayRequest('),
  false,
  'StudioPage should not translate evidence entries into replay requests once the evidence panel is removed from the page.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceExportBundle('),
  false,
  'StudioPage should not build evidence export bundles once the evidence panel is removed from the page.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceSummaryTemplate('),
  false,
  'StudioPage should not build evidence summary templates once the evidence panel is removed from the page.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceDiagnosticBundle('),
  false,
  'StudioPage should not keep page-level evidence diagnostics copy flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceIssueTemplate('),
  false,
  'StudioPage should not keep page-level evidence issue-template flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceReleaseNoteTemplate('),
  false,
  'StudioPage should not keep page-level evidence release-note flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceComparisonTemplate('),
  false,
  'StudioPage should not keep page-level evidence comparison template flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceComparisonIssueTemplate('),
  false,
  'StudioPage should not keep page-level evidence comparison issue-template flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceComparisonReleaseNoteTemplate('),
  false,
  'StudioPage should not keep page-level evidence comparison release-note flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceComparisonDiagnosticBundle('),
  false,
  'StudioPage should not keep page-level evidence comparison diagnostics flows once the panel is removed.',
);

assert.equal(
  studioPageSource.includes('buildUnifiedStudioEvidenceComparisonSummaryTemplate('),
  false,
  'StudioPage should not keep page-level evidence comparison summary flows once the panel is removed.',
);

const evidencePanelPath = new URL('../packages/sdkwork-birdcoder-studio/src/evidence/StudioEvidencePanel.tsx', import.meta.url);
const evidenceViewerPath = new URL('../packages/sdkwork-birdcoder-studio/src/evidence/viewer.ts', import.meta.url);

if (!existsSync(evidencePanelPath)) {
  console.log('StudioEvidencePanel module removed; StudioPage integration removal contract passed.');
  process.exit(0);
}

const evidencePanelSource = readFileSync(evidencePanelPath, 'utf8');
const evidenceViewerSource = readFileSync(evidenceViewerPath, 'utf8');

assert.equal(
  evidencePanelSource.includes("useState<'all' | 'preview' | 'build' | 'simulator' | 'test'>('all')"),
  true,
  'StudioEvidencePanel should track the active lane filter locally.',
);

assert.equal(
  evidencePanelSource.includes("['all', 'preview', 'build', 'simulator', 'test']"),
  true,
  'StudioEvidencePanel should expose lane filter chips for all supported evidence lanes.',
);

assert.equal(
  evidencePanelSource.includes('summarizeUnifiedStudioEvidenceEntries('),
  true,
  'StudioEvidencePanel should derive a visible-slice summary from the shared evidence viewer contract.',
);

assert.equal(
  evidencePanelSource.includes('Visible Slice'),
  true,
  'StudioEvidencePanel should render a visible-slice diagnostics summary heading.',
);

assert.equal(
  evidencePanelSource.includes('Latest launch'),
  true,
  'StudioEvidencePanel should render the latest launch timestamp from the visible evidence summary.',
);

assert.equal(
  evidencePanelSource.includes('Evidence Key'),
  true,
  'StudioEvidencePanel should render the evidence key for fine-grained diagnostics.',
);

assert.equal(
  evidencePanelSource.includes('Run Config'),
  true,
  'StudioEvidencePanel should render the run configuration identity for fine-grained diagnostics.',
);

assert.equal(
  evidencePanelSource.includes('Project'),
  true,
  'StudioEvidencePanel should render the project scope for fine-grained diagnostics.',
);

assert.equal(
  evidenceViewerSource.includes('projectId: string;'),
  true,
  'UnifiedStudioEvidenceEntry should treat normalized project scope as a required string contract.',
);

assert.equal(
  evidenceViewerSource.includes('runConfigurationId: string;'),
  true,
  'UnifiedStudioEvidenceEntry should treat normalized run configuration scope as a required string contract.',
);

assert.equal(
  evidenceViewerSource.includes('profileId: TerminalProfileId;'),
  true,
  'UnifiedStudioEvidenceEntry should treat normalized profile scope as a TerminalProfileId contract.',
);

assert.equal(
  evidencePanelSource.includes('{entry.projectId}'),
  true,
  'StudioEvidencePanel should consume the normalized project scope directly from unified evidence entries.',
);

assert.equal(
  evidencePanelSource.includes('{entry.runConfigurationId}'),
  true,
  'StudioEvidencePanel should consume the normalized run configuration scope directly from unified evidence entries.',
);

assert.equal(
  evidencePanelSource.includes('{entry.profileId}'),
  true,
  'StudioEvidencePanel should consume the normalized profile directly from unified evidence entries.',
);

assert.equal(
  evidenceViewerSource.includes('profileId: normalizeEvidenceProfileId(entry.profileId),'),
  true,
  'viewer helpers should defensively normalize profileId when building downstream payloads from potentially malformed entries.',
);

assert.equal(
  evidenceViewerSource.includes('function normalizeEvidenceProfileId('),
  true,
  'viewer helpers should retain a dedicated profile normalization helper for defensive fallback behavior.',
);

assert.equal(
  evidenceViewerSource.includes('function normalizeEvidenceProjectId('),
  true,
  'viewer helpers should retain a dedicated project scope normalization helper for defensive fallback behavior.',
);

assert.equal(
  evidenceViewerSource.includes('function normalizeEvidenceRunConfigurationId('),
  true,
  'viewer helpers should retain a dedicated run-configuration normalization helper for defensive fallback behavior.',
);

assert.equal(
  evidenceViewerSource.includes('projectId: normalizeEvidenceProjectId(entry.projectId),'),
  true,
  'viewer helpers should defensively normalize project scope when building downstream payloads from potentially malformed entries.',
);

assert.equal(
  evidenceViewerSource.includes('runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),'),
  true,
  'viewer helpers should defensively normalize run-configuration scope when building downstream payloads from potentially malformed entries.',
);

assert.equal(
  evidenceViewerSource.includes('projectIds: normalizeStringArray(entries.map((entry) => normalizeEvidenceProjectId(entry.projectId)))'),
  true,
  'viewer summary helpers should normalize project scope through the shared helper rather than inline fallback expressions.',
);

assert.equal(
  evidencePanelSource.includes('onCopyDiagnostics'),
  true,
  'StudioEvidencePanel should expose a copy-diagnostics callback for each evidence entry.',
);

assert.equal(
  evidencePanelSource.includes('onCopyVisibleDiagnostics'),
  true,
  'StudioEvidencePanel should expose a copy-visible-diagnostics callback for the active evidence slice.',
);

assert.equal(
  evidencePanelSource.includes('onCopySummary'),
  true,
  'StudioEvidencePanel should expose a copy-summary callback for the active evidence slice.',
);

assert.equal(
  evidencePanelSource.includes('onCopyIssueTemplate'),
  true,
  'StudioEvidencePanel should expose a copy-issue-template callback for the active evidence slice.',
);

assert.equal(
  evidencePanelSource.includes('onCopyReleaseNote'),
  true,
  'StudioEvidencePanel should expose a copy-release-note callback for the active evidence slice.',
);

assert.equal(
  evidencePanelSource.includes('onCopyCompareTemplate'),
  true,
  'StudioEvidencePanel should expose a copy-compare-template callback for the selected evidence pair.',
);

assert.equal(
  evidencePanelSource.includes('onCopyCompareIssueTemplate'),
  true,
  'StudioEvidencePanel should expose a copy-compare-issue-template callback for the selected evidence pair.',
);

assert.equal(
  evidencePanelSource.includes('onCopyCompareReleaseNote'),
  true,
  'StudioEvidencePanel should expose a copy-compare-release-note callback for the selected evidence pair.',
);

assert.equal(
  evidencePanelSource.includes('onCopyCompareDiagnostics'),
  true,
  'StudioEvidencePanel should expose a copy-compare-diagnostics callback for the selected evidence pair.',
);

assert.equal(
  evidencePanelSource.includes('onCopyCompareSummary'),
  true,
  'StudioEvidencePanel should expose a copy-compare-summary callback for the selected evidence pair.',
);

assert.equal(
  evidencePanelSource.includes('Copy Diagnostics'),
  true,
  'StudioEvidencePanel should render a Copy Diagnostics action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Visible Diagnostics'),
  true,
  'StudioEvidencePanel should render a Copy Visible Diagnostics action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Summary'),
  true,
  'StudioEvidencePanel should render a Copy Summary action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Issue Template'),
  true,
  'StudioEvidencePanel should render a Copy Issue Template action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Release Note'),
  true,
  'StudioEvidencePanel should render a Copy Release Note action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Compare Template'),
  true,
  'StudioEvidencePanel should render a Copy Compare Template action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Compare Issue Template'),
  true,
  'StudioEvidencePanel should render a Copy Compare Issue Template action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Compare Release Note'),
  true,
  'StudioEvidencePanel should render a Copy Compare Release Note action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Compare Diagnostics'),
  true,
  'StudioEvidencePanel should render a Copy Compare Diagnostics action.',
);

assert.equal(
  evidencePanelSource.includes('Copy Compare Summary'),
  true,
  'StudioEvidencePanel should render a Copy Compare Summary action.',
);

assert.equal(
  evidencePanelSource.includes('selectedEvidenceKeys'),
  true,
  'StudioEvidencePanel should track a local selected evidence pair for comparison.',
);

assert.equal(
  evidencePanelSource.includes('selectedEntries.length !== 2'),
  true,
  'StudioEvidencePanel should require exactly two selected entries before enabling compare copy.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyVisibleDiagnostics?.(visibleEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the visible slice and active lane into the copy-visible callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopySummary?.(visibleEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the visible slice and active lane into the copy-summary callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyIssueTemplate?.(visibleEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the visible slice and active lane into the copy-issue-template callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyReleaseNote?.(visibleEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the visible slice and active lane into the copy-release-note callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyCompareTemplate?.(selectedEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the selected evidence pair and active lane into the compare callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyCompareIssueTemplate?.(selectedEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the selected evidence pair and active lane into the compare-issue callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyCompareReleaseNote?.(selectedEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the selected evidence pair and active lane into the compare-release-note callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyCompareDiagnostics?.(selectedEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the selected evidence pair and active lane into the compare-diagnostics callback.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyCompareSummary?.(selectedEntries, selectedLane)}'),
  true,
  'StudioEvidencePanel should route the selected evidence pair and active lane into the compare-summary callback.',
);

assert.equal(
  evidencePanelSource.includes('toggleSelectedEvidenceEntry(entry)'),
  true,
  'StudioEvidencePanel should expose a per-entry toggle for comparison selection.',
);

assert.equal(
  evidencePanelSource.includes('onClick={() => onCopyDiagnostics?.(entry)}'),
  true,
  'StudioEvidencePanel should route the Copy Diagnostics action through the shared callback.',
);

assert.equal(
  evidencePanelSource.includes('onReplay?.(entry)'),
  true,
  'StudioEvidencePanel should expose a replay action per evidence entry.',
);

assert.equal(
  evidencePanelSource.includes('onExport'),
  true,
  'StudioEvidencePanel should expose an export action callback for the currently visible evidence entries.',
);

assert.equal(
  evidencePanelSource.includes('onExport?.(visibleEntries, selectedLane)'),
  true,
  'StudioEvidencePanel should pass the active lane filter into evidence export callbacks.',
);

assert.equal(
  evidencePanelSource.includes('Export JSON'),
  true,
  'StudioEvidencePanel should render an Export JSON action.',
);

console.log('studio evidence viewer ui contract passed.');
