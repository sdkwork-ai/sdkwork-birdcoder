import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const topBarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'TopBar.tsx',
);
const panelSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitOverviewPanel.tsx',
);
const sharedControlsSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const hookSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useProjectGitOverview.ts',
);
const eventSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'events',
  'projectGitOverview.ts',
);
const workbenchEventSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const legacyHookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'useProjectGitOverview.ts',
);
const legacyEventPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'projectGitOverviewEvents.ts',
);
const legacyCommonsEventPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'projectGitOverview.ts',
);
const legacyGitRuntimePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'gitRuntime.ts',
);
const legacyPanelPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
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
  /import[\s\S]*useProjectGitOverview[\s\S]*from '@sdkwork\/birdcoder-commons';/,
  'Code TopBar must import the shared project Git overview hook from commons.',
);

assert.match(
  topBarSource,
  /import[\s\S]*useProjectGitMutationActions[\s\S]*from '@sdkwork\/birdcoder-commons';/,
  'Code TopBar must import shared Git mutation actions from commons instead of duplicating mutation logic locally.',
);

assert.match(
  topBarSource,
  /import[\s\S]*ProjectGitHeaderControls[\s\S]*from '@sdkwork\/birdcoder-ui';/s,
  'Code TopBar must import the shared ProjectGitHeaderControls component from the shared UI package.',
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
  /import[\s\S]*useProjectGitOverview[\s\S]*from '@sdkwork\/birdcoder-commons';/,
  'Shared Project Git overview panel must import the shared project Git overview hook from commons.',
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
  /const \{\s*commitChanges,[\s\S]*isCommitting,[\s\S]*isPushingBranch,[\s\S]*pushBranch,\s*\} = useProjectGitMutationActions\(\{/s,
  'Code TopBar must derive commit and push handlers from the shared Git mutation hook.',
);

assert.match(
  topBarSource,
  /<ProjectGitHeaderControls[\s\S]*projectId=\{projectId\}[\s\S]*variant="topbar"[\s\S]*onAnyMenuOpen=\{\(\) => \{\s*setShowSubmitMenu\(false\);/s,
  'Code TopBar must delegate branch and worktree controls to the shared ProjectGitHeaderControls component.',
);

assert.doesNotMatch(
  topBarSource,
  /gitService\.(commitProjectGitChanges|createProjectGitBranch|switchProjectGitBranch|pushProjectGitBranch|pruneProjectGitWorktrees)/,
  'Code TopBar must not call Git mutation service methods directly after the shared Git mutation hook becomes authoritative.',
);

console.log('code topbar git overview contract passed.');
