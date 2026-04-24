import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const sharedControlsPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const topBarSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'components',
  'TopBar.tsx',
);
const studioStageHeaderSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'preview',
  'StudioStageHeader.tsx',
);

assert.equal(
  fs.existsSync(sharedControlsPath),
  true,
  'Shared ProjectGitHeaderControls component must exist in the shared UI package.',
);

const sharedControlsSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const createBranchDialogSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitCreateBranchDialog.tsx',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitBranchMenu[\s\S]*from '\.\/ProjectGitBranchMenu';/s,
  'Shared ProjectGitHeaderControls must render the shared branch menu.',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitWorktreeMenu[\s\S]*from '\.\/ProjectGitWorktreeMenu';/s,
  'Shared ProjectGitHeaderControls must render the shared worktree menu.',
);

assert.match(
  sharedControlsSource,
  /import[\s\S]*ProjectGitCreateBranchDialog[\s\S]*from '\.\/ProjectGitCreateBranchDialog';/s,
  'Shared ProjectGitHeaderControls must render the shared create-branch dialog.',
);

assert.match(
  sharedControlsSource,
  /const \{\s*createBranch,[\s\S]*isCreatingBranch,[\s\S]*isPruningWorktrees,[\s\S]*pruneWorktrees,[\s\S]*switchBranch,\s*\} = useProjectGitMutationActions\(\{/s,
  'Shared ProjectGitHeaderControls must derive branch creation and worktree pruning state from the shared Git mutation hook.',
);

assert.match(
  sharedControlsSource,
  /<ProjectGitCreateBranchDialog[\s\S]*isCreating=\{isCreatingBranch\}/s,
  'Shared ProjectGitHeaderControls must wire branch creation progress into the shared create-branch dialog.',
);

assert.match(
  createBranchDialogSource,
  /interface ProjectGitCreateBranchDialogProps \{[\s\S]*isCreating\?: boolean;/s,
  'Shared create-branch dialog must accept an isCreating state so Git mutations can disable duplicate submissions.',
);

assert.match(
  createBranchDialogSource,
  /disabled=\{!branchName\.trim\(\) \|\| isCreating\}/,
  'Shared create-branch dialog must disable the submit action while branch creation is in progress.',
);

assert.match(
  topBarSource,
  /import[\s\S]*ProjectGitHeaderControls[\s\S]*from '@sdkwork\/birdcoder-ui';/s,
  'Code top bar must import the shared ProjectGitHeaderControls component.',
);

assert.match(
  topBarSource,
  /<ProjectGitHeaderControls[\s\S]*variant="topbar"/s,
  'Code top bar must mount the shared topbar Git header controls instead of duplicating branch/worktree UI state locally.',
);

assert.match(
  studioStageHeaderSource,
  /import[\s\S]*ProjectGitHeaderControls[\s\S]*from '@sdkwork\/birdcoder-ui';/s,
  'Studio stage header must import the shared ProjectGitHeaderControls component.',
);

assert.match(
  studioStageHeaderSource,
  /<ProjectGitHeaderControls[\s\S]*variant="studio"/s,
  'Studio stage header must mount the shared studio Git header controls instead of duplicating branch/worktree UI state locally.',
);

assert.match(
  sharedControlsSource,
  /aria-expanded=\{isOverviewDrawerOpen\}/,
  'Shared ProjectGitHeaderControls must expose drawer expanded state on the Git overview toggle for accessible disclosure semantics.',
);

assert.match(
  sharedControlsSource,
  /aria-haspopup="dialog"/,
  'Shared ProjectGitHeaderControls must identify the Git overview toggle as opening a dialog-style drawer.',
);

assert.match(
  sharedControlsSource,
  /const overviewDrawerLabel = isOverviewDrawerOpen \? t\('code\.closeGitOverview'\) : t\('code\.openGitOverview'\);/,
  'Shared ProjectGitHeaderControls must use explicit open and close Git overview labels instead of a static generic title.',
);

console.log('project git header controls contract passed.');
