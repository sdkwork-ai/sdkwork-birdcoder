import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const topBarSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'TopBar.tsx',
);
const panelSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);
const sharedControlsSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const submitDialogSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitSubmitDialog.tsx',
);
const hookSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'hooks',
  'useProjectGitOverview.ts',
);
const eventSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'events',
  'projectGitOverview.ts',
);
const workbenchEventSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const legacyHookPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'useProjectGitOverview.ts',
);
const legacyEventPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'projectGitOverviewEvents.ts',
);
const legacyCommonsEventPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const legacyGitRuntimePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'gitRuntime.ts',
);
const legacyPanelPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);

assert.match(
  hookSource,
  /const projectGitOverviewCache = new Map<string, ProjectGitOverviewCacheEntry>\(\);/,
  'Project Git overview state must be cached in the shared commons module so multiple consumers stay consistent.',
);

assert.match(
  eventSource,
  /const PROJECT_GIT_OVERVIEW_REFRESH_EVENT = 'projectGitOverviewRefresh';/,
  'Project Git overview refresh events must live in commons shared infrastructure instead of a code-only component module.',
);

assert.equal(
  fs.existsSync(legacyHookPath),
  false,
  'Legacy code-local project Git overview hook must be removed after standardization into commons.',
);

assert.equal(
  fs.existsSync(legacyEventPath),
  false,
  'Legacy code-local project Git overview event module must be removed after standardization into commons.',
);

assert.equal(
  fs.existsSync(legacyCommonsEventPath),
  true,
  'Commons workbench must expose a project Git overview bridge for workbench consumers.',
);

assert.match(
  workbenchEventSource,
  /from '\.\.\/events\/projectGitOverview\.ts';/,
  'Commons workbench project Git overview bridge must forward to the shared events implementation.',
);

assert.equal(
  fs.existsSync(legacyGitRuntimePath),
  false,
  'Legacy code-local Git branch helper module must be removed after standardization into commons.',
);

assert.equal(
  fs.existsSync(legacyPanelPath),
  false,
  'Legacy code-local Project Git overview panel must be removed after standardization into the shared UI package.',
);

assert.match(
  topBarSource,
  /import[\s\S]*useProjectGitOverview[\s\S]*from '@sdkwork\/birdcoder-pc-workbench\/hooks\/useProjectGitOverview';/,
  'Code TopBar must import the shared project Git overview hook through the governed commons hook subpath.',
);

assert.doesNotMatch(
  topBarSource,
  /from '@sdkwork\/birdcoder-pc-ui';/,
  'Code TopBar must not load the broad UI package root because it defeats Git and chat chunk boundaries.',
);

assert.match(
  topBarSource,
  /from '@sdkwork\/birdcoder-pc-ui\/components\/ProjectGitHeaderControls';/,
  'Code TopBar must import the shared Git header controls through the precise UI component subpath.',
);

assert.match(
  topBarSource,
  /from '@sdkwork\/birdcoder-pc-ui\/components\/ProjectGitSubmitDialog';/,
  'Code TopBar must import the shared Git submit dialog through the precise UI component subpath.',
);

assert.match(
  submitDialogSource,
  /import[\s\S]*useProjectGitOverview[\s\S]*from '@sdkwork\/birdcoder-pc-workbench\/hooks\/useProjectGitOverview';/,
  'The shared Git submit dialog must read Git state through the governed commons hook subpath.',
);

assert.match(
  submitDialogSource,
  /import[\s\S]*useProjectGitMutationActions[\s\S]*from '@sdkwork\/birdcoder-pc-workbench\/hooks\/useProjectGitMutationActions';/,
  'The shared Git submit dialog must own commit and push mutations through the governed commons hook subpath.',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitBranchMenu[\s\S]*from '\.\/ProjectGitBranchMenu';/s,
  'Shared ProjectGitHeaderControls must reuse the shared ProjectGitBranchMenu.',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitWorktreeMenu[\s\S]*from '\.\/ProjectGitWorktreeMenu';/s,
  'Shared ProjectGitHeaderControls must reuse the shared ProjectGitWorktreeMenu.',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitCreateBranchDialog[\s\S]*from '\.\/ProjectGitCreateBranchDialog';/s,
  'Shared ProjectGitHeaderControls must reuse the shared ProjectGitCreateBranchDialog.',
);

assert.match(
  panelSource,
  /import[\s\S]*useProjectGitOverview[\s\S]*from '@sdkwork\/birdcoder-pc-workbench\/hooks\/useProjectGitOverview';/,
  'Shared Project Git overview panel must import the shared project Git overview hook through its governed commons subpath.',
);

assert.match(
  panelSource,
  /import[\s\S]*ProjectGitOverviewSurface[\s\S]*from '\.\/ProjectGitOverviewSurface';/,
  'Shared Project Git overview panel must reuse the shared ProjectGitOverviewSurface.',
);

assert.doesNotMatch(
  topBarSource,
  /useState<string\[\]>\(\['main', 'dev', 'feature\/auth'\]\)/,
  'Code TopBar must not seed fake branch data once the Git overview becomes authoritative.',
);

assert.doesNotMatch(
  topBarSource,
  /await gitService\.getProjectGitOverview\(normalizedProjectId\)/,
  'Code TopBar must not duplicate direct Git overview fetching after the shared hook becomes authoritative.',
);

assert.doesNotMatch(
  topBarSource,
  /ProjectGitBranchMenu|ProjectGitWorktreeMenu|ProjectGitCreateBranchDialog/,
  'Code TopBar must not embed branch or worktree Git UI primitives directly after shared header controls extraction.',
);

assert.doesNotMatch(
  panelSource,
  /requestVersionRef|subscribeProjectGitOverviewRefresh/,
  'Shared Project Git overview panel must not keep its own stale-response or refresh-bus implementation after shared hook extraction.',
);

assert.match(
  topBarSource,
  /<ProjectGitHeaderControls[\s\S]*onRequestViewDiff=\{\(\) => setShowGitDiffDialog\(true\)\}[\s\S]*projectId=\{projectId\}[\s\S]*variant="topbar"/s,
  'Code TopBar must delegate Git controls to the shared header component and open the real diff dialog.',
);

assert.match(
  topBarSource,
  /onRequestCommit=\{\(\) => setGitSubmitMode\('commit'\)\}/,
  'Code TopBar must open the shared submit dialog in commit mode.',
);

assert.match(
  topBarSource,
  /onRequestPush=\{\(\) => setGitSubmitMode\('commitAndPush'\)\}/,
  'Code TopBar Push must open the message-required commit-and-push workflow.',
);

assert.match(
  topBarSource,
  /<ProjectGitSubmitDialog[\s\S]*initialMode=\{gitSubmitMode \?\? 'commit'\}[\s\S]*isOpen=\{gitSubmitMode !== null\}/s,
  'Code TopBar must render the shared Git submit dialog for both commit workflows.',
);

assert.doesNotMatch(
  topBarSource,
  /showCommitModal|showPushModal|setCommitMessage|useProjectGitMutationActions/,
  'Code TopBar must not retain legacy local commit/push modal or mutation state after shared submit dialog extraction.',
);

assert.doesNotMatch(
  topBarSource,
  /gitService\.(commitProjectGitChanges|createProjectGitBranch|switchProjectGitBranch|pushProjectGitBranch|pruneProjectGitWorktrees)/,
  'Code TopBar must not call Git mutation service methods directly after the shared Git mutation hook becomes authoritative.',
);

console.log('code topbar git overview contract passed.');
