import type { TerminalCommandRequest } from '../../../sdkwork-birdcoder-commons/src/terminal/runtime.ts';
import {
  getTerminalProfile,
  type TerminalProfileId,
} from '../../../sdkwork-birdcoder-commons/src/terminal/profiles.ts';
import type { StudioBuildExecutionEvidence } from '../build/runtime.ts';
import { listStoredStudioBuildExecutionEvidence } from '../build/evidenceStore.ts';
import type { StudioPreviewExecutionEvidence } from '../preview/runtime.ts';
import { listStoredStudioPreviewExecutionEvidence } from '../preview/evidenceStore.ts';
import type { StudioSimulatorExecutionEvidence } from '../simulator/runtime.ts';
import { listStoredStudioSimulatorExecutionEvidence } from '../simulator/evidenceStore.ts';
import type { StudioTestExecutionEvidence } from '../test/runtime.ts';
import { listStoredStudioTestExecutionEvidence } from '../test/evidenceStore.ts';

export type UnifiedStudioEvidenceLane = 'preview' | 'build' | 'simulator' | 'test';
export type UnifiedStudioEvidenceFilter = 'all' | UnifiedStudioEvidenceLane;

export interface UnifiedStudioEvidenceEntry {
  lane: UnifiedStudioEvidenceLane;
  evidenceKey: string;
  title: string;
  summary: string;
  command: string;
  cwd: string;
  profileId: TerminalProfileId;
  projectId: string;
  runConfigurationId: string;
  launchedAt: number;
}

export interface UnifiedStudioEvidenceExportBundle {
  fileName: string;
  content: string;
}

export interface UnifiedStudioEvidenceDiagnosticBundle {
  content: string;
}

export interface UnifiedStudioEvidenceIssueTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceReleaseNoteTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceSummaryTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceComparisonTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceComparisonSummaryTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceComparisonIssueTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceComparisonReleaseNoteTemplate {
  content: string;
}

export interface UnifiedStudioEvidenceComparisonDiagnosticBundle {
  content: string;
}

export interface UnifiedStudioEvidenceExportSummary {
  entryCount: number;
  lanes: UnifiedStudioEvidenceLane[];
  projectIds: string[];
  profileIds: string[];
  latestLaunchedAt: number | null;
}

export interface BuildUnifiedStudioEvidenceComparisonTemplateOptions {
  laneFilter?: UnifiedStudioEvidenceFilter;
  timestamp?: number;
}

export interface BuildUnifiedStudioEvidenceIssueTemplateOptions {
  laneFilter?: UnifiedStudioEvidenceFilter;
  timestamp?: number;
}

export interface BuildUnifiedStudioEvidenceDiagnosticBundleOptions {
  timestamp?: number;
}

export interface BuildUnifiedStudioEvidenceExportBundleOptions {
  laneFilter?: UnifiedStudioEvidenceFilter;
  timestamp?: number;
}

interface BuildUnifiedStudioEvidenceEntriesOptions {
  previewEvidence?: StudioPreviewExecutionEvidence[];
  buildEvidence?: StudioBuildExecutionEvidence[];
  simulatorEvidence?: StudioSimulatorExecutionEvidence[];
  testEvidence?: StudioTestExecutionEvidence[];
}

function normalizeEntries<T>(entries: T[] | undefined): T[] {
  return Array.isArray(entries) ? entries : [];
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!Number.isFinite(timestamp) || (timestamp ?? 0) <= 0) {
    return 'Unknown time';
  }

  return new Date(timestamp as number).toISOString();
}

function buildEvidenceTemplateLines(
  entry: UnifiedStudioEvidenceEntry,
  heading: string,
): string[] {
  return [
    heading,
    `- Title: ${entry.title}`,
    `- Lane: ${entry.lane}`,
    `- Evidence Key: ${entry.evidenceKey}`,
    `- Summary: ${entry.summary}`,
    `- Project: ${normalizeEvidenceProjectId(entry.projectId)}`,
    `- Run Config: ${normalizeEvidenceRunConfigurationId(entry.runConfigurationId)}`,
    `- Profile: ${normalizeEvidenceProfileId(entry.profileId)}`,
    `- Command: ${entry.command}`,
    `- Working Directory: ${entry.cwd}`,
    `- Launched At: ${formatTimestamp(entry.launchedAt)}`,
    '',
  ];
}

function normalizeEvidenceProjectId(projectId: string | null | undefined): string {
  return projectId ?? 'global';
}

function normalizeEvidenceRunConfigurationId(runConfigurationId: string | null | undefined): string {
  return runConfigurationId ?? 'default';
}

function normalizeEvidenceProfileId(profileId: string | null | undefined): TerminalProfileId {
  return getTerminalProfile(profileId ?? 'powershell').id;
}

function normalizeEvidenceExportEntry(entry: UnifiedStudioEvidenceEntry): UnifiedStudioEvidenceEntry {
  return {
    ...entry,
    projectId: normalizeEvidenceProjectId(entry.projectId),
    runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
    profileId: normalizeEvidenceProfileId(entry.profileId),
  };
}

function buildEvidenceComparisonLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    '- Same Lane: ' + (leftEntry.lane === rightEntry.lane ? 'yes' : 'no'),
    '- Same Project: ' + (normalizeEvidenceProjectId(leftEntry.projectId) === normalizeEvidenceProjectId(rightEntry.projectId) ? 'yes' : 'no'),
    '- Same Run Config: ' + (normalizeEvidenceRunConfigurationId(leftEntry.runConfigurationId) === normalizeEvidenceRunConfigurationId(rightEntry.runConfigurationId) ? 'yes' : 'no'),
    '- Same Profile: ' + (normalizeEvidenceProfileId(leftEntry.profileId) === normalizeEvidenceProfileId(rightEntry.profileId) ? 'yes' : 'no'),
    '- Same Command: ' + (leftEntry.command === rightEntry.command ? 'yes' : 'no'),
    '- Same Working Directory: ' + (leftEntry.cwd === rightEntry.cwd ? 'yes' : 'no'),
  ];
}

function buildEvidenceComparisonIdentityLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    `- Evidence A: ${leftEntry.evidenceKey}`,
    `- Evidence B: ${rightEntry.evidenceKey}`,
    `- Entry A Title: ${leftEntry.title}`,
    `- Entry B Title: ${rightEntry.title}`,
  ];
}

function buildEvidenceComparisonProjectLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    `- Entry A Project: ${normalizeEvidenceProjectId(leftEntry.projectId)}`,
    `- Entry B Project: ${normalizeEvidenceProjectId(rightEntry.projectId)}`,
  ];
}

function buildEvidenceComparisonRunConfigurationLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    `- Entry A Run Config: ${normalizeEvidenceRunConfigurationId(leftEntry.runConfigurationId)}`,
    `- Entry B Run Config: ${normalizeEvidenceRunConfigurationId(rightEntry.runConfigurationId)}`,
  ];
}

function buildEvidenceComparisonProfileLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    `- Entry A Profile: ${normalizeEvidenceProfileId(leftEntry.profileId)}`,
    `- Entry B Profile: ${normalizeEvidenceProfileId(rightEntry.profileId)}`,
  ];
}

function buildEvidenceComparisonLaneLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    `- Entry A Lane: ${leftEntry.lane}`,
    `- Entry B Lane: ${rightEntry.lane}`,
  ];
}

function buildEvidenceComparisonScopeLines(
  leftEntry: UnifiedStudioEvidenceEntry,
  rightEntry: UnifiedStudioEvidenceEntry,
): string[] {
  return [
    ...buildEvidenceComparisonIdentityLines(leftEntry, rightEntry),
    ...buildEvidenceComparisonProjectLines(leftEntry, rightEntry),
    ...buildEvidenceComparisonRunConfigurationLines(leftEntry, rightEntry),
    ...buildEvidenceComparisonProfileLines(leftEntry, rightEntry),
    ...buildEvidenceComparisonLaneLines(leftEntry, rightEntry),
  ];
}

function resolveEvidenceSliceIdentity(
  entries: UnifiedStudioEvidenceEntry[],
): { evidenceKeys: string; titles: string } {
  return {
    evidenceKeys: entries.map((entry) => entry.evidenceKey).join(', ') || 'none',
    titles: entries.map((entry) => entry.title).join(', ') || 'none',
  };
}

function buildEvidenceSliceIdentityLines(
  entries: UnifiedStudioEvidenceEntry[],
): string[] {
  const identity = resolveEvidenceSliceIdentity(entries);

  return [
    `- Evidence Keys: ${identity.evidenceKeys}`,
    `- Titles: ${identity.titles}`,
  ];
}

export function buildUnifiedStudioEvidenceEntries({
  previewEvidence = [],
  buildEvidence = [],
  simulatorEvidence = [],
  testEvidence = [],
}: BuildUnifiedStudioEvidenceEntriesOptions): UnifiedStudioEvidenceEntry[] {
  const normalizedPreviewEntries = normalizeEntries(previewEvidence).map((entry) => ({
    lane: 'preview' as const,
    evidenceKey: entry.evidenceKey,
    title: `Preview lane ${entry.channel}`,
    summary: entry.previewUrl,
    command: entry.command,
    cwd: entry.cwd,
    profileId: normalizeEvidenceProfileId(entry.profileId),
    projectId: normalizeEvidenceProjectId(entry.projectId),
    runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
    launchedAt: entry.launchedAt,
  }));

  const normalizedBuildEntries = normalizeEntries(buildEvidence).map((entry) => ({
    lane: 'build' as const,
    evidenceKey: entry.evidenceKey,
    title: `Build lane ${entry.targetId}`,
    summary: entry.outputKind,
    command: entry.command,
    cwd: entry.cwd,
    profileId: normalizeEvidenceProfileId(entry.profileId),
    projectId: normalizeEvidenceProjectId(entry.projectId),
    runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
    launchedAt: entry.launchedAt,
  }));

  const normalizedSimulatorEntries = normalizeEntries(simulatorEvidence).map((entry) => ({
    lane: 'simulator' as const,
    evidenceKey: entry.evidenceKey,
    title: `Simulator lane ${entry.channel}`,
    summary: entry.runtime,
    command: entry.command,
    cwd: entry.cwd,
    profileId: normalizeEvidenceProfileId(entry.profileId),
    projectId: normalizeEvidenceProjectId(entry.projectId),
    runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
    launchedAt: entry.launchedAt,
  }));

  const normalizedTestEntries = normalizeEntries(testEvidence).map((entry) => ({
    lane: 'test' as const,
    evidenceKey: entry.evidenceKey,
    title: `Test lane ${normalizeEvidenceRunConfigurationId(entry.runConfigurationId)}`,
    summary: entry.command,
    command: entry.command,
    cwd: entry.cwd,
    profileId: normalizeEvidenceProfileId(entry.profileId),
    projectId: normalizeEvidenceProjectId(entry.projectId),
    runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
    launchedAt: entry.launchedAt,
  }));

  return [
    ...normalizedPreviewEntries,
    ...normalizedBuildEntries,
    ...normalizedSimulatorEntries,
    ...normalizedTestEntries,
  ].sort((left, right) => right.launchedAt - left.launchedAt);
}

export async function listUnifiedStudioExecutionEvidence(
  projectId: string | null | undefined,
): Promise<UnifiedStudioEvidenceEntry[]> {
  const [previewEvidence, buildEvidence, simulatorEvidence, testEvidence] = await Promise.all([
    listStoredStudioPreviewExecutionEvidence(projectId),
    listStoredStudioBuildExecutionEvidence(projectId),
    listStoredStudioSimulatorExecutionEvidence(projectId),
    listStoredStudioTestExecutionEvidence(projectId),
  ]);

  return buildUnifiedStudioEvidenceEntries({
    previewEvidence,
    buildEvidence,
    simulatorEvidence,
    testEvidence,
  });
}

export function filterUnifiedStudioEvidenceEntries(
  entries: UnifiedStudioEvidenceEntry[],
  lane: UnifiedStudioEvidenceFilter,
): UnifiedStudioEvidenceEntry[] {
  if (lane === 'all') {
    return entries;
  }

  return entries.filter((entry) => entry.lane === lane);
}

export function buildUnifiedStudioEvidenceReplayRequest(
  entry: UnifiedStudioEvidenceEntry,
  timestamp = Date.now(),
): TerminalCommandRequest {
  return {
    path: entry.cwd,
    command: entry.command,
    profileId: normalizeEvidenceProfileId(entry.profileId),
    timestamp,
  };
}

export function buildUnifiedStudioEvidenceDiagnosticBundle(
  entry: UnifiedStudioEvidenceEntry,
  options: BuildUnifiedStudioEvidenceDiagnosticBundleOptions = {},
): UnifiedStudioEvidenceDiagnosticBundle {
  const timestamp = options.timestamp ?? Date.now();

  return {
    content: JSON.stringify(
      {
        generatedAt: new Date(timestamp).toISOString(),
        lane: entry.lane,
        title: entry.title,
        summary: entry.summary,
        evidenceKey: entry.evidenceKey,
        projectId: normalizeEvidenceProjectId(entry.projectId),
        runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
        profileId: normalizeEvidenceProfileId(entry.profileId),
        command: entry.command,
        cwd: entry.cwd,
        launchedAt: entry.launchedAt,
      },
      null,
      2,
    ),
  };
}

export function buildUnifiedStudioEvidenceIssueTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceIssueTemplateOptions = {},
): UnifiedStudioEvidenceIssueTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const summary = summarizeUnifiedStudioEvidenceEntries(entries);
  const lines = [
    '# Studio Evidence Triage',
    '',
    '## Summary',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Entry Count: ${summary.entryCount}`,
    `- Lanes: ${summary.lanes.join(', ') || 'none'}`,
    `- Projects: ${summary.projectIds.join(', ') || 'none'}`,
    `- Profiles: ${summary.profileIds.join(', ') || 'none'}`,
    `- Latest Launch: ${formatTimestamp(summary.latestLaunchedAt)}`,
    ...buildEvidenceSliceIdentityLines(entries),
    '',
    '## Entries',
  ];

  entries.forEach((entry, index) => {
    lines.push(...buildEvidenceTemplateLines(entry, `### ${index + 1}. ${entry.title}`));
  });

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceSummaryTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceIssueTemplateOptions = {},
): UnifiedStudioEvidenceSummaryTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const summary = summarizeUnifiedStudioEvidenceEntries(entries);
  const lines = [
    '# Studio Evidence Summary',
    '',
    '## Scope',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Entry Count: ${summary.entryCount}`,
    `- Lanes: ${summary.lanes.join(', ') || 'none'}`,
    `- Projects: ${summary.projectIds.join(', ') || 'none'}`,
    `- Profiles: ${summary.profileIds.join(', ') || 'none'}`,
    `- Latest Launch: ${formatTimestamp(summary.latestLaunchedAt)}`,
    '',
    '## Notes',
    ...buildEvidenceSliceIdentityLines(entries),
  ];

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceReleaseNoteTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceIssueTemplateOptions = {},
): UnifiedStudioEvidenceReleaseNoteTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const summary = summarizeUnifiedStudioEvidenceEntries(entries);
  const identity = resolveEvidenceSliceIdentity(entries);
  const lines = [
    '## Highlights',
    '',
    `- Captures the ${laneFilter} Studio evidence slice with ${summary.entryCount} visible entries for release triage.`,
    `- Preserves lane, project, profile, and latest-launch context from the unified Step 07 evidence contract.`,
    '',
    '## Scope',
    '',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Entry Count: ${summary.entryCount}`,
    `- Lanes: ${summary.lanes.join(', ') || 'none'}`,
    `- Projects: ${summary.projectIds.join(', ') || 'none'}`,
    `- Profiles: ${summary.profileIds.join(', ') || 'none'}`,
    `- Evidence Keys: ${identity.evidenceKeys}`,
    '',
    '## Verification',
    '',
    '- [ ] Replay the visible evidence commands before finalizing the release note.',
    '- [ ] Attach diagnostics or issue-template output if the slice represents a regression.',
    '',
    '## Notes',
    '',
    `- Source: Studio Evidence Viewer`,
    `- Latest Launch: ${formatTimestamp(summary.latestLaunchedAt)}`,
    `- Titles: ${identity.titles}`,
  ];

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceComparisonTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceComparisonTemplateOptions = {},
): UnifiedStudioEvidenceComparisonTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const [leftEntry, rightEntry] = entries;
  const comparedEntries = entries.slice(0, 2);

  const lines = [
    '# Studio Evidence Comparison',
    '',
    '## Summary',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Compared Entries: ${comparedEntries.length}`,
  ];

  if (leftEntry && rightEntry) {
    lines.push(...buildEvidenceComparisonScopeLines(leftEntry, rightEntry));
    lines.push('');
    lines.push('## Comparison');
    lines.push(...buildEvidenceComparisonLines(leftEntry, rightEntry));
    lines.push('');
    lines.push(...buildEvidenceTemplateLines(leftEntry, '## Entry A'));
    lines.push(...buildEvidenceTemplateLines(rightEntry, '## Entry B'));
  }

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceComparisonSummaryTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceComparisonTemplateOptions = {},
): UnifiedStudioEvidenceComparisonSummaryTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const [leftEntry, rightEntry] = entries;
  const comparedEntries = entries.slice(0, 2);
  const lines = [
    '# Studio Evidence Comparison Summary',
    '',
    '## Scope',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Compared Entries: ${comparedEntries.length}`,
  ];

  if (leftEntry && rightEntry) {
    lines.push(...buildEvidenceComparisonScopeLines(leftEntry, rightEntry));
    lines.push('');
    lines.push('## Notes');
    lines.push(...buildEvidenceComparisonLines(leftEntry, rightEntry));
  }

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceComparisonIssueTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceComparisonTemplateOptions = {},
): UnifiedStudioEvidenceComparisonIssueTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const [leftEntry, rightEntry] = entries;
  const comparedEntries = entries.slice(0, 2);
  const lines = [
    '# Studio Evidence Comparison Issue',
    '',
    '## Summary',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Compared Entries: ${comparedEntries.length}`,
  ];

  if (leftEntry && rightEntry) {
    lines.push(...buildEvidenceComparisonScopeLines(leftEntry, rightEntry));
    lines.push('');
    lines.push('## Difference Summary');
    lines.push(...buildEvidenceComparisonLines(leftEntry, rightEntry));
    lines.push('');
    lines.push('## Problem Statement');
    lines.push('- Expected:');
    lines.push('- Actual:');
    lines.push('- Impact:');
    lines.push('');
    lines.push('## Triage Checklist');
    lines.push('- [ ] Confirm which entry reflects the expected behavior.');
    lines.push('- [ ] Replay both commands and capture the terminal output delta.');
    lines.push('- [ ] Link the related issue, release note, or regression window.');
    lines.push('');
    lines.push(...buildEvidenceTemplateLines(leftEntry, '## Entry A'));
    lines.push(...buildEvidenceTemplateLines(rightEntry, '## Entry B'));
  }

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceComparisonReleaseNoteTemplate(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceComparisonTemplateOptions = {},
): UnifiedStudioEvidenceComparisonReleaseNoteTemplate {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const [leftEntry, rightEntry] = entries;
  const comparedEntries = entries.slice(0, 2);
  const lines = [
    '## Highlights',
    '',
    `- Captures a ${laneFilter} comparison slice with ${comparedEntries.length} selected evidence records for release-note triage.`,
    '- Reuses the standardized Step 07 compare dimensions so pairwise release notes stay aligned with diagnostics and issue templates.',
    '',
    '## Scope',
    '',
    `- Generated At: ${new Date(timestamp).toISOString()}`,
    `- Lane Filter: ${laneFilter}`,
    `- Compared Entries: ${comparedEntries.length}`,
  ];

  if (leftEntry && rightEntry) {
    lines.push(...buildEvidenceComparisonScopeLines(leftEntry, rightEntry));
    lines.push(...buildEvidenceComparisonLines(leftEntry, rightEntry));
    lines.push('');
    lines.push('## Verification');
    lines.push('');
    lines.push('- [ ] Replay Entry A and Entry B before finalizing the release note.');
    lines.push('- [ ] Confirm the reported delta matches the regression or fix narrative.');
    lines.push('');
    lines.push('## Notes');
    lines.push('- Source: Studio Evidence Viewer');
  }

  return {
    content: lines.join('\n').trim(),
  };
}

export function buildUnifiedStudioEvidenceComparisonDiagnosticBundle(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceComparisonTemplateOptions = {},
): UnifiedStudioEvidenceComparisonDiagnosticBundle {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const [leftEntry, rightEntry] = entries;
  const comparedEntries = entries.slice(0, 2);

  return {
    content: JSON.stringify(
      {
        generatedAt: new Date(timestamp).toISOString(),
        laneFilter,
        comparedEntries: comparedEntries.length,
        comparison: leftEntry && rightEntry
          ? {
            sameLane: leftEntry.lane === rightEntry.lane,
            sameProject: normalizeEvidenceProjectId(leftEntry.projectId) === normalizeEvidenceProjectId(rightEntry.projectId),
            sameRunConfig: normalizeEvidenceRunConfigurationId(leftEntry.runConfigurationId) === normalizeEvidenceRunConfigurationId(rightEntry.runConfigurationId),
            sameProfile: normalizeEvidenceProfileId(leftEntry.profileId) === normalizeEvidenceProfileId(rightEntry.profileId),
            sameCommand: leftEntry.command === rightEntry.command,
            sameWorkingDirectory: leftEntry.cwd === rightEntry.cwd,
          }
          : null,
        entries: comparedEntries.map((entry) => ({
          lane: entry.lane,
          title: entry.title,
          summary: entry.summary,
          evidenceKey: entry.evidenceKey,
          projectId: normalizeEvidenceProjectId(entry.projectId),
          runConfigurationId: normalizeEvidenceRunConfigurationId(entry.runConfigurationId),
          profileId: normalizeEvidenceProfileId(entry.profileId),
          command: entry.command,
          cwd: entry.cwd,
          launchedAt: entry.launchedAt,
        })),
      },
      null,
      2,
    ),
  };
}

export function summarizeUnifiedStudioEvidenceEntries(
  entries: UnifiedStudioEvidenceEntry[],
): UnifiedStudioEvidenceExportSummary {
  return {
    entryCount: entries.length,
    lanes: normalizeStringArray(entries.map((entry) => entry.lane)) as UnifiedStudioEvidenceLane[],
    projectIds: normalizeStringArray(entries.map((entry) => normalizeEvidenceProjectId(entry.projectId))),
    profileIds: normalizeStringArray(entries.map((entry) => normalizeEvidenceProfileId(entry.profileId))),
    latestLaunchedAt: entries.reduce((latest, entry) => {
      if (!Number.isFinite(entry.launchedAt) || entry.launchedAt <= 0) {
        return latest;
      }

      return latest === null || entry.launchedAt > latest ? entry.launchedAt : latest;
    }, null as number | null),
  };
}

export function buildUnifiedStudioEvidenceExportBundle(
  entries: UnifiedStudioEvidenceEntry[],
  options: BuildUnifiedStudioEvidenceExportBundleOptions = {},
): UnifiedStudioEvidenceExportBundle {
  const laneFilter = options.laneFilter ?? 'all';
  const timestamp = options.timestamp ?? Date.now();
  const summary = summarizeUnifiedStudioEvidenceEntries(entries);
  const normalizedEntries = entries.map(normalizeEvidenceExportEntry);

  return {
    fileName: `studio-evidence-${laneFilter}-${timestamp}.json`,
    content: JSON.stringify(
      {
        exportedAt: new Date(timestamp).toISOString(),
        laneFilter,
        entryCount: entries.length,
        summary,
        entries: normalizedEntries,
      },
      null,
      2,
    ),
  };
}
