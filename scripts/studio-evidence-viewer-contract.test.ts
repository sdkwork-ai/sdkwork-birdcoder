import assert from 'node:assert/strict';

import {
  buildUnifiedStudioEvidenceComparisonDiagnosticBundle,
  buildUnifiedStudioEvidenceComparisonSummaryTemplate,
  buildUnifiedStudioEvidenceComparisonTemplate,
  buildUnifiedStudioEvidenceComparisonIssueTemplate,
  buildUnifiedStudioEvidenceComparisonReleaseNoteTemplate,
  buildUnifiedStudioEvidenceDiagnosticBundle,
  buildUnifiedStudioEvidenceExportBundle,
  buildUnifiedStudioEvidenceEntries,
  buildUnifiedStudioEvidenceIssueTemplate,
  buildUnifiedStudioEvidenceReleaseNoteTemplate,
  buildUnifiedStudioEvidenceSummaryTemplate,
  buildUnifiedStudioEvidenceReplayRequest,
  filterUnifiedStudioEvidenceEntries,
  summarizeUnifiedStudioEvidenceEntries,
} from '../packages/sdkwork-birdcoder-studio/src/evidence/viewer.ts';

const entries = buildUnifiedStudioEvidenceEntries({
  previewEvidence: [
    {
      adapterId: 'studio.preview.execution',
      evidenceKey: 'preview.web.launch',
      sessionEvidenceKey: 'preview.web',
      host: { runtimeId: 'desktop' },
      channel: 'web',
      orientation: 'portrait',
      previewUrl: 'https://preview.local',
      command: 'pnpm dev',
      cwd: '/workspace/demo',
      profileId: 'powershell',
      projectId: 'project-demo',
      runConfigurationId: 'run-preview',
      launchedAt: 100,
    } as any,
  ],
  buildEvidence: [
    {
      adapterId: 'studio.build.execution',
      evidenceKey: 'build.web.launch',
      buildProfileId: 'studio-build-web',
      targetId: 'web',
      outputKind: 'web',
      command: 'pnpm build',
      cwd: '/workspace/demo',
      profileId: 'powershell',
      projectId: 'project-demo',
      runConfigurationId: 'run-build',
      launchedAt: 200,
    } as any,
  ],
  simulatorEvidence: [
    {
      adapterId: 'studio.simulator.execution',
      evidenceKey: 'simulator.app.launch',
      sessionEvidenceKey: 'simulator.app',
      host: { runtimeId: 'desktop' },
      channel: 'app',
      runtime: 'ios',
      orientation: 'landscape',
      command: 'pnpm simulator',
      cwd: '/workspace/demo',
      profileId: 'powershell',
      projectId: 'project-demo',
      runConfigurationId: 'run-simulator',
      launchedAt: 300,
    } as any,
  ],
  testEvidence: [
    {
      adapterId: 'studio.test.execution',
      evidenceKey: 'test.test.launch',
      command: 'npm test',
      cwd: '/workspace/demo',
      profileId: 'powershell',
      projectId: 'project-demo',
      runConfigurationId: 'test',
      launchedAt: 400,
    } as any,
  ],
});

assert.deepEqual(
  entries.map((entry) => entry.lane),
  ['test', 'simulator', 'build', 'preview'],
  'unified Studio evidence viewer should sort all lanes by launchedAt descending',
);

assert.deepEqual(
  entries.map((entry) => entry.title),
  ['Test lane test', 'Simulator lane app', 'Build lane web', 'Preview lane web'],
  'unified Studio evidence viewer should label each lane with a stable title',
);

assert.deepEqual(
  entries.map((entry) => entry.summary),
  ['npm test', 'ios', 'web', 'https://preview.local'],
  'unified Studio evidence viewer should surface lane-specific summary text',
);

assert.equal(entries[0].command, 'npm test');
assert.equal(entries[0].cwd, '/workspace/demo');
assert.equal(entries[0].projectId, 'project-demo');

assert.deepEqual(
  summarizeUnifiedStudioEvidenceEntries(filterUnifiedStudioEvidenceEntries(entries, 'build')),
  {
    entryCount: 1,
    lanes: ['build'],
    projectIds: ['project-demo'],
    profileIds: ['powershell'],
    latestLaunchedAt: 200,
  },
  'unified Studio evidence viewer should summarize a filtered evidence slice for diagnostics and export',
);

assert.deepEqual(
  filterUnifiedStudioEvidenceEntries(entries, 'test').map((entry) => entry.lane),
  ['test'],
  'unified Studio evidence viewer should support test lane filtering',
);

assert.deepEqual(
  filterUnifiedStudioEvidenceEntries(entries, 'build').map((entry) => entry.lane),
  ['build'],
  'unified Studio evidence viewer should support lane-specific filtering',
);

assert.equal(
  filterUnifiedStudioEvidenceEntries(entries, 'all').length,
  entries.length,
  'unified Studio evidence viewer should preserve all entries when the all lane filter is selected',
);

assert.deepEqual(
  buildUnifiedStudioEvidenceReplayRequest(entries[0], 400),
  {
    surface: 'embedded',
    path: '/workspace/demo',
    command: 'npm test',
    profileId: 'powershell',
    timestamp: 400,
  },
  'unified Studio evidence viewer should build a replay terminal request from an evidence entry',
);

const diagnosticBundle = buildUnifiedStudioEvidenceDiagnosticBundle(entries[0], {
  timestamp: 500,
});

assert.equal(
  diagnosticBundle.content.includes('"generatedAt": "1970-01-01T00:00:00.500Z"'),
  true,
  'unified Studio evidence viewer should stamp copied diagnostics with a stable generation timestamp',
);

assert.equal(
  diagnosticBundle.content.includes('"lane": "test"'),
  true,
  'unified Studio evidence viewer should preserve the lane inside a copied diagnostics bundle',
);

assert.equal(
  diagnosticBundle.content.includes('"evidenceKey": "test.test.launch"'),
  true,
  'unified Studio evidence viewer should preserve the evidence key inside a copied diagnostics bundle',
);

assert.equal(
  diagnosticBundle.content.includes('"projectId": "project-demo"'),
  true,
  'unified Studio evidence viewer should preserve the project scope inside a copied diagnostics bundle',
);

const profileFallbackEntry = {
  ...entries[0],
  evidenceKey: 'test.test.fallback-profile',
  title: 'Test lane fallback profile',
  profileId: undefined,
} as any;

const normalizedProfileEntries = buildUnifiedStudioEvidenceEntries({
  testEvidence: [profileFallbackEntry],
});

assert.equal(
  normalizedProfileEntries[0]?.profileId,
  'powershell',
  'buildUnifiedStudioEvidenceEntries should normalize a missing profile onto the default terminal profile before exposing unified entries',
);

assert.deepEqual(
  buildUnifiedStudioEvidenceReplayRequest(profileFallbackEntry, 450),
  {
    surface: 'embedded',
    path: '/workspace/demo',
    command: 'npm test',
    profileId: 'powershell',
    timestamp: 450,
  },
  'unified Studio evidence viewer should normalize a missing profile onto the default terminal profile when building replay requests',
);

const fallbackDiagnosticBundle = buildUnifiedStudioEvidenceDiagnosticBundle(profileFallbackEntry, {
  timestamp: 460,
});

assert.equal(
  fallbackDiagnosticBundle.content.includes('"profileId": "powershell"'),
  true,
  'unified Studio evidence viewer diagnostics should normalize a missing profile onto the default terminal profile',
);

const fallbackIssueTemplate = buildUnifiedStudioEvidenceIssueTemplate([profileFallbackEntry], {
  laneFilter: 'test',
  timestamp: 470,
});

assert.equal(
  fallbackIssueTemplate.content.includes('- Profiles: powershell'),
  true,
  'unified Studio evidence viewer issue templates should normalize missing profile scope onto the default terminal profile',
);

assert.equal(
  fallbackIssueTemplate.content.includes('- Profile: powershell'),
  true,
  'unified Studio evidence viewer entry templates should normalize a missing profile onto the default terminal profile',
);

const fallbackComparisonSummaryTemplate = buildUnifiedStudioEvidenceComparisonSummaryTemplate(
  [profileFallbackEntry, entries[1]],
  {
    laneFilter: 'all',
    timestamp: 1180,
  },
);

assert.equal(
  fallbackComparisonSummaryTemplate.content.includes('- Entry A Profile: powershell'),
  true,
  'unified Studio evidence viewer comparison summary templates should normalize a missing first profile onto the default terminal profile',
);

const fallbackExportBundle = buildUnifiedStudioEvidenceExportBundle([profileFallbackEntry], {
  laneFilter: 'test',
  timestamp: 480,
});

assert.equal(
  fallbackExportBundle.content.includes('"profileId": "powershell"'),
  true,
  'unified Studio evidence viewer export bundles should normalize a missing profile onto the default terminal profile inside exported entries',
);

const exportFallbackScopeEntry = {
  ...profileFallbackEntry,
  evidenceKey: 'test.test.fallback-scope',
  title: 'Test lane fallback scope',
  projectId: undefined,
  runConfigurationId: undefined,
} as any;

const normalizedScopeEntries = buildUnifiedStudioEvidenceEntries({
  testEvidence: [exportFallbackScopeEntry],
});

assert.deepEqual(
  {
    projectId: normalizedScopeEntries[0]?.projectId,
    runConfigurationId: normalizedScopeEntries[0]?.runConfigurationId,
  },
  {
    projectId: 'global',
    runConfigurationId: 'default',
  },
  'buildUnifiedStudioEvidenceEntries should normalize missing project and run configuration scope before exposing unified entries',
);

const exportFallbackScopeBundle = buildUnifiedStudioEvidenceExportBundle([exportFallbackScopeEntry], {
  laneFilter: 'test',
  timestamp: 490,
});

assert.equal(
  exportFallbackScopeBundle.content.includes('"projectIds": [\n      "global"\n    ]'),
  true,
  'unified Studio evidence viewer export bundle summary should normalize a missing project onto the global scope',
);

assert.equal(
  exportFallbackScopeBundle.content.includes('"projectId": "global"'),
  true,
  'unified Studio evidence viewer export bundles should normalize a missing project onto the global scope inside exported entries',
);

assert.equal(
  exportFallbackScopeBundle.content.includes('"runConfigurationId": "default"'),
  true,
  'unified Studio evidence viewer export bundles should normalize a missing run configuration onto the default scope inside exported entries',
);

assert.equal(
  diagnosticBundle.content.includes('"runConfigurationId": "test"'),
  true,
  'unified Studio evidence viewer should preserve the run configuration identity inside a copied diagnostics bundle',
);

assert.equal(
  diagnosticBundle.content.includes('"command": "npm test"'),
  true,
  'unified Studio evidence viewer should preserve the replay command inside a copied diagnostics bundle',
);

assert.equal(
  diagnosticBundle.content.includes('"cwd": "/workspace/demo"'),
  true,
  'unified Studio evidence viewer should preserve the working directory inside a copied diagnostics bundle',
);

const issueTemplate = buildUnifiedStudioEvidenceIssueTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'build'),
  {
    laneFilter: 'build',
    timestamp: 600,
  },
);

assert.equal(
  issueTemplate.content.includes('# Studio Evidence Triage'),
  true,
  'unified Studio evidence viewer should build a stable issue template heading for triage reuse',
);

assert.equal(
  issueTemplate.content.includes('- Generated At: 1970-01-01T00:00:00.600Z'),
  true,
  'unified Studio evidence viewer should stamp issue templates with a stable generation timestamp',
);

assert.equal(
  issueTemplate.content.includes('- Lane Filter: build'),
  true,
  'unified Studio evidence viewer should preserve the active lane filter in the issue template',
);

assert.equal(
  issueTemplate.content.includes('- Entry Count: 1'),
  true,
  'unified Studio evidence viewer should preserve the visible entry count in the issue template',
);

assert.equal(
  issueTemplate.content.includes('- Evidence Keys: build.web.launch'),
  true,
  'unified Studio evidence viewer issue templates should expose visible evidence identities in the summary block',
);

assert.equal(
  issueTemplate.content.includes('- Titles: Build lane web'),
  true,
  'unified Studio evidence viewer issue templates should expose visible evidence titles in the summary block',
);

assert.equal(
  issueTemplate.content.includes('## Entries'),
  true,
  'unified Studio evidence viewer should include an entries section in the issue template',
);

assert.equal(
  issueTemplate.content.includes('### 1. Build lane web'),
  true,
  'unified Studio evidence viewer should list each visible evidence entry inside the issue template',
);

assert.equal(
  issueTemplate.content.includes('- Evidence Key: build.web.launch'),
  true,
  'unified Studio evidence viewer should include the evidence key in the issue template',
);

assert.equal(
  issueTemplate.content.includes('- Command: pnpm build'),
  true,
  'unified Studio evidence viewer should include the replay command in the issue template',
);

assert.equal(
  issueTemplate.content.includes('- Working Directory: /workspace/demo'),
  true,
  'unified Studio evidence viewer should include the working directory in the issue template',
);

const comparisonTemplate = buildUnifiedStudioEvidenceComparisonTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'all').slice(0, 2),
  {
    laneFilter: 'all',
    timestamp: 700,
  },
);

assert.equal(
  comparisonTemplate.content.includes('# Studio Evidence Comparison'),
  true,
  'unified Studio evidence viewer should build a stable comparison template heading for pairwise triage',
);

assert.equal(
  comparisonTemplate.content.includes('- Generated At: 1970-01-01T00:00:00.700Z'),
  true,
  'unified Studio evidence viewer should stamp comparison templates with a stable generation timestamp',
);

assert.equal(
  comparisonTemplate.content.includes('- Lane Filter: all'),
  true,
  'unified Studio evidence viewer should preserve the active lane filter in the comparison template',
);

assert.equal(
  comparisonTemplate.content.includes('- Compared Entries: 2'),
  true,
  'unified Studio evidence viewer should preserve the compared entry count in the comparison template',
);

assert.equal(
  comparisonTemplate.content.includes('- Evidence A: test.test.launch'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first evidence identity in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Evidence B: simulator.app.launch'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second evidence identity in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry A Title: Test lane test'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first evidence title in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry B Title: Simulator lane app'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second evidence title in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry A Project: project-demo'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first evidence project in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry B Project: project-demo'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second evidence project in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry A Run Config: test'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first run configuration in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry B Run Config: run-simulator'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second run configuration in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry A Profile: powershell'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first profile in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry B Profile: powershell'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second profile in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry A Lane: test'),
  true,
  'unified Studio evidence viewer comparison templates should expose the first lane in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Entry B Lane: simulator'),
  true,
  'unified Studio evidence viewer comparison templates should expose the second lane in the summary block',
);

assert.equal(
  comparisonTemplate.content.includes('## Comparison'),
  true,
  'unified Studio evidence viewer should include a comparison summary block',
);

assert.equal(
  comparisonTemplate.content.includes('- Same Lane: no'),
  true,
  'unified Studio evidence viewer should compute a lane-level comparison summary',
);

assert.equal(
  comparisonTemplate.content.includes('- Same Project: yes'),
  true,
  'unified Studio evidence viewer should compute a project-level comparison summary',
);

assert.equal(
  comparisonTemplate.content.includes('## Entry A'),
  true,
  'unified Studio evidence viewer should render the first evidence entry inside the comparison template',
);

assert.equal(
  comparisonTemplate.content.includes('## Entry B'),
  true,
  'unified Studio evidence viewer should render the second evidence entry inside the comparison template',
);

assert.equal(
  comparisonTemplate.content.includes('- Evidence Key: test.test.launch'),
  true,
  'unified Studio evidence viewer comparison templates should include the first evidence key',
);

assert.equal(
  comparisonTemplate.content.includes('- Evidence Key: simulator.app.launch'),
  true,
  'unified Studio evidence viewer comparison templates should include the second evidence key',
);

const comparisonIssueTemplate = buildUnifiedStudioEvidenceComparisonIssueTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'all').slice(0, 2),
  {
    laneFilter: 'all',
    timestamp: 800,
  },
);

assert.equal(
  comparisonIssueTemplate.content.includes('# Studio Evidence Comparison Issue'),
  true,
  'unified Studio evidence viewer should build a stable comparison-issue heading for pairwise triage reuse',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Generated At: 1970-01-01T00:00:00.800Z'),
  true,
  'unified Studio evidence viewer should stamp comparison-issue templates with a stable generation timestamp',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Lane Filter: all'),
  true,
  'unified Studio evidence viewer should preserve the active lane filter in the comparison-issue template',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Compared Entries: 2'),
  true,
  'unified Studio evidence viewer should preserve the compared entry count in the comparison-issue template',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Evidence A: test.test.launch'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first evidence identity in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Evidence B: simulator.app.launch'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second evidence identity in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry A Title: Test lane test'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first evidence title in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry B Title: Simulator lane app'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second evidence title in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry A Project: project-demo'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first evidence project in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry B Project: project-demo'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second evidence project in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry A Run Config: test'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first run configuration in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry B Run Config: run-simulator'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second run configuration in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry A Profile: powershell'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first profile in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry B Profile: powershell'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second profile in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry A Lane: test'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the first lane in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('- Entry B Lane: simulator'),
  true,
  'unified Studio evidence viewer comparison-issue templates should expose the second lane in the summary block',
);

assert.equal(
  comparisonIssueTemplate.content.includes('## Difference Summary'),
  true,
  'unified Studio evidence viewer comparison-issue templates should include a difference summary section',
);

assert.equal(
  comparisonIssueTemplate.content.includes('## Triage Checklist'),
  true,
  'unified Studio evidence viewer comparison-issue templates should include a triage checklist section',
);

assert.equal(
  comparisonIssueTemplate.content.includes('## Entry A'),
  true,
  'unified Studio evidence viewer comparison-issue templates should include the first evidence entry details',
);

assert.equal(
  comparisonIssueTemplate.content.includes('## Entry B'),
  true,
  'unified Studio evidence viewer comparison-issue templates should include the second evidence entry details',
);

const releaseNoteTemplate = buildUnifiedStudioEvidenceReleaseNoteTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'build'),
  {
    laneFilter: 'build',
    timestamp: 900,
  },
);

assert.equal(
  releaseNoteTemplate.content.includes('## Highlights'),
  true,
  'unified Studio evidence viewer should build a release-note template with a highlights section',
);

assert.equal(
  releaseNoteTemplate.content.includes('## Scope'),
  true,
  'unified Studio evidence viewer should build a release-note template with a scope section',
);

assert.equal(
  releaseNoteTemplate.content.includes('## Verification'),
  true,
  'unified Studio evidence viewer should build a release-note template with a verification section',
);

assert.equal(
  releaseNoteTemplate.content.includes('## Notes'),
  true,
  'unified Studio evidence viewer should build a release-note template with a notes section',
);

assert.equal(
  releaseNoteTemplate.content.includes('- Generated At: 1970-01-01T00:00:00.900Z'),
  true,
  'unified Studio evidence viewer release-note templates should stamp a stable generation timestamp',
);

assert.equal(
  releaseNoteTemplate.content.includes('- Lane Filter: build'),
  true,
  'unified Studio evidence viewer release-note templates should preserve the active lane filter',
);

assert.equal(
  releaseNoteTemplate.content.includes('- Entry Count: 1'),
  true,
  'unified Studio evidence viewer release-note templates should preserve the visible entry count',
);

assert.equal(
  releaseNoteTemplate.content.includes('build.web.launch'),
  true,
  'unified Studio evidence viewer release-note templates should include the visible evidence keys',
);

const comparisonReleaseNoteTemplate = buildUnifiedStudioEvidenceComparisonReleaseNoteTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'all').slice(0, 2),
  {
    laneFilter: 'all',
    timestamp: 1000,
  },
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('## Highlights'),
  true,
  'unified Studio evidence viewer should build a comparison release-note template with a highlights section',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('## Scope'),
  true,
  'unified Studio evidence viewer should build a comparison release-note template with a scope section',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('## Verification'),
  true,
  'unified Studio evidence viewer should build a comparison release-note template with a verification section',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('## Notes'),
  true,
  'unified Studio evidence viewer should build a comparison release-note template with a notes section',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('- Generated At: 1970-01-01T00:00:01.000Z'),
  true,
  'unified Studio evidence viewer comparison release-note templates should stamp a stable generation timestamp',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('- Compared Entries: 2'),
  true,
  'unified Studio evidence viewer comparison release-note templates should preserve the compared entry count',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('- Evidence A: test.test.launch'),
  true,
  'unified Studio evidence viewer comparison release-note templates should identify the first evidence entry',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('- Evidence B: simulator.app.launch'),
  true,
  'unified Studio evidence viewer comparison release-note templates should identify the second evidence entry',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry A Title: Test lane test') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the first evidence title in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry B Title: Simulator lane app') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the second evidence title in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry A Project: project-demo') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the first evidence project in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry B Project: project-demo') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the second evidence project in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry A Run Config: test') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the first run configuration in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry B Run Config: run-simulator') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the second run configuration in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry A Profile: powershell') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the first profile in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry B Profile: powershell') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the second profile in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry A Lane: test') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the first lane in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.indexOf('- Entry B Lane: simulator') <
    comparisonReleaseNoteTemplate.content.indexOf('## Verification'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep the second lane in the top-level scope block before verification guidance',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.split('- Entry A Project: project-demo').length - 1,
  1,
  'unified Studio evidence viewer comparison release-note templates should not duplicate the first project line after promoting it into the top-level scope block',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.split('- Entry B Project: project-demo').length - 1,
  1,
  'unified Studio evidence viewer comparison release-note templates should not duplicate the second project line after promoting it into the top-level scope block',
);

assert.equal(
  comparisonReleaseNoteTemplate.content.includes('## Notes\n- Source: Studio Evidence Viewer'),
  true,
  'unified Studio evidence viewer comparison release-note templates should keep a stable non-empty notes block after scope-field deduplication',
);

const comparisonDiagnosticBundle = buildUnifiedStudioEvidenceComparisonDiagnosticBundle(
  filterUnifiedStudioEvidenceEntries(entries, 'all').slice(0, 2),
  {
    laneFilter: 'all',
    timestamp: 1100,
  },
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"generatedAt": "1970-01-01T00:00:01.100Z"'),
  true,
  'unified Studio evidence viewer comparison diagnostics should stamp a stable generation timestamp',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"laneFilter": "all"'),
  true,
  'unified Studio evidence viewer comparison diagnostics should preserve the active lane filter',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"comparedEntries": 2'),
  true,
  'unified Studio evidence viewer comparison diagnostics should preserve the compared entry count',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"sameLane": false'),
  true,
  'unified Studio evidence viewer comparison diagnostics should preserve lane-level pairwise differences',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"sameProject": true'),
  true,
  'unified Studio evidence viewer comparison diagnostics should preserve project-level pairwise differences',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"evidenceKey": "test.test.launch"'),
  true,
  'unified Studio evidence viewer comparison diagnostics should include the first evidence entry',
);

assert.equal(
  comparisonDiagnosticBundle.content.includes('"evidenceKey": "simulator.app.launch"'),
  true,
  'unified Studio evidence viewer comparison diagnostics should include the second evidence entry',
);

const comparisonSummaryTemplate = buildUnifiedStudioEvidenceComparisonSummaryTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'all').slice(0, 2),
  {
    laneFilter: 'all',
    timestamp: 1150,
  },
);

assert.equal(
  comparisonSummaryTemplate.content.includes('# Studio Evidence Comparison Summary'),
  true,
  'unified Studio evidence viewer should build a stable comparison-summary heading for pairwise clipboard reuse',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Generated At: 1970-01-01T00:00:01.150Z'),
  true,
  'unified Studio evidence viewer comparison summary templates should stamp a stable generation timestamp',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Lane Filter: all'),
  true,
  'unified Studio evidence viewer comparison summary templates should preserve the active lane filter',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Compared Entries: 2'),
  true,
  'unified Studio evidence viewer comparison summary templates should preserve the compared entry count',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Evidence A: test.test.launch'),
  true,
  'unified Studio evidence viewer comparison summary templates should identify the first evidence entry',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Evidence B: simulator.app.launch'),
  true,
  'unified Studio evidence viewer comparison summary templates should identify the second evidence entry',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry A Title: Test lane test') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the first evidence title in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry B Title: Simulator lane app') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the second evidence title in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry A Project: project-demo') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the first evidence project in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry B Project: project-demo') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the second evidence project in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry A Run Config: test') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the first run configuration in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry B Run Config: run-simulator') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the second run configuration in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry A Profile: powershell') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the first profile in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry B Profile: powershell') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the second profile in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry A Lane: test') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the first lane in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.indexOf('- Entry B Lane: simulator') <
    comparisonSummaryTemplate.content.indexOf('## Notes'),
  true,
  'unified Studio evidence viewer comparison summary templates should keep the second lane in the top-level scope block before notes',
);

assert.equal(
  comparisonSummaryTemplate.content.includes('- Same Project: yes'),
  true,
  'unified Studio evidence viewer comparison summary templates should preserve pairwise comparison summary fields',
);

const exportBundle = buildUnifiedStudioEvidenceExportBundle(
  filterUnifiedStudioEvidenceEntries(entries, 'build'),
  {
    laneFilter: 'build',
    timestamp: 400,
  },
);

assert.equal(
  exportBundle.fileName,
  'studio-evidence-build-400.json',
  'unified Studio evidence viewer should build a stable export filename from the export lane and export timestamp',
);

assert.equal(
  exportBundle.content.includes('"entryCount": 1'),
  true,
  'unified Studio evidence viewer export bundle should record the filtered entry count',
);

assert.equal(
  exportBundle.content.includes('"lane": "build"'),
  true,
  'unified Studio evidence viewer export bundle should serialize the filtered evidence entries',
);

assert.equal(
  exportBundle.content.includes('"laneFilter": "build"'),
  true,
  'unified Studio evidence viewer export bundle should record the active lane filter for diagnostics and triage',
);

assert.equal(
  exportBundle.content.includes('"summary"'),
  true,
  'unified Studio evidence viewer export bundle should include a normalized summary block',
);

assert.equal(
  exportBundle.content.includes('"lanes": [\n      "build"\n    ]'),
  true,
  'unified Studio evidence viewer export bundle summary should record the normalized lane set',
);

assert.equal(
  exportBundle.content.includes('"projectIds": [\n      "project-demo"\n    ]'),
  true,
  'unified Studio evidence viewer export bundle summary should record normalized project scope',
);

assert.equal(
  exportBundle.content.includes('"profileIds": [\n      "powershell"\n    ]'),
  true,
  'unified Studio evidence viewer export bundle summary should record normalized profile scope',
);

assert.equal(
  exportBundle.content.includes('"latestLaunchedAt": 200'),
  true,
  'unified Studio evidence viewer export bundle summary should record the latest launch timestamp in the exported slice',
);

const summaryTemplate = buildUnifiedStudioEvidenceSummaryTemplate(
  filterUnifiedStudioEvidenceEntries(entries, 'build'),
  {
    laneFilter: 'build',
    timestamp: 550,
  },
);

assert.equal(
  summaryTemplate.content.includes('# Studio Evidence Summary'),
  true,
  'unified Studio evidence viewer should build a stable visible-slice summary heading for clipboard reuse',
);

assert.equal(
  summaryTemplate.content.includes('- Generated At: 1970-01-01T00:00:00.550Z'),
  true,
  'unified Studio evidence viewer summary templates should stamp a stable generation timestamp',
);

assert.equal(
  summaryTemplate.content.includes('- Lane Filter: build'),
  true,
  'unified Studio evidence viewer summary templates should preserve the active lane filter',
);

assert.equal(
  summaryTemplate.content.includes('- Entry Count: 1'),
  true,
  'unified Studio evidence viewer summary templates should preserve the visible entry count',
);

assert.equal(
  summaryTemplate.content.includes('- Latest Launch: 1970-01-01T00:00:00.200Z'),
  true,
  'unified Studio evidence viewer summary templates should preserve the latest visible launch timestamp',
);

assert.equal(
  summaryTemplate.content.includes('- Evidence Keys: build.web.launch'),
  true,
  'unified Studio evidence viewer summary templates should preserve the visible evidence keys without serializing full entry payloads',
);

console.log('studio evidence viewer contract passed.');
