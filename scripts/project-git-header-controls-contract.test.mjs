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
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitHeaderControls.tsx',
);
const topBarSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'components',
  'TopBar.tsx',
);
const studioStageHeaderSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'preview',
  'StudioStageHeader.tsx',
);
const gitDiffDialogSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitDiffDialog.tsx',
);
const codeWorkbenchCommandsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'useCodeWorkbenchCommands.ts',
);
const studioWorkbenchEventBindingsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'useStudioWorkbenchEventBindings.ts',
);

assert.equal(
  fs.existsSync(sharedControlsPath),
  true,
  'Shared ProjectGitHeaderControls component must exist in the shared UI package.',
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
const createBranchDialogSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitCreateBranchDialog.tsx',
);
const gitMutationActionsSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-commons',
  'src',
  'hooks',
  'useProjectGitMutationActions.ts',
);
const worktreeManagementPanelSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitWorktreeManagementPanel.tsx',
);
const worktreeMenuSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitWorktreeMenu.tsx',
);
const overviewSurfaceSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitOverviewSurface.tsx',
);
const branchMenuSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'ProjectGitBranchMenu.tsx',
);
const englishGitLocaleSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-i18n',
  'src',
  'locales',
  'en',
  'code',
  'sidebar.ts',
);
const chineseGitLocaleSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-i18n',
  'src',
  'locales',
  'zh',
  'code',
  'sidebar.ts',
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
  /import[\s\S]*ProjectGitHeaderControls[\s\S]*from '@sdkwork\/birdcoder-pc-ui';/s,
  'Code top bar must import the shared ProjectGitHeaderControls component.',
);

assert.match(
  topBarSource,
  /<ProjectGitHeaderControls[\s\S]*variant="topbar"/s,
  'Code top bar must mount the shared topbar Git header controls instead of duplicating branch/worktree UI state locally.',
);

assert.match(
  studioStageHeaderSource,
  /import[\s\S]*ProjectGitHeaderControls[\s\S]*from '@sdkwork\/birdcoder-pc-ui';/s,
  'Studio stage header must import the shared ProjectGitHeaderControls component.',
);

assert.match(
  gitDiffDialogSource,
  /gitService\.getProjectGitDiff\(normalizedProjectId\)/,
  'Git diff dialog must load the actual project Git diff through the injected Git service.',
);

assert.match(
  gitDiffDialogSource,
  /className="fixed inset-0 z-\[120\]/,
  'Git diff dialog must render above header menus and overview drawers.',
);

assert.match(
  topBarSource,
  /onRequestViewDiff=\{\(\) => setShowGitDiffDialog\(true\)\}/,
  'Code top bar View Diff action must open the real Git diff dialog.',
);

assert.match(
  studioStageHeaderSource,
  /onRequestViewDiff=\{\(\) => setShowGitDiffDialog\(true\)\}/,
  'Studio code header View Diff action must open the real Git diff dialog.',
);

for (const [sourceName, source] of [
  ['Code workbench commands', codeWorkbenchCommandsSource],
  ['Studio workbench event bindings', studioWorkbenchEventBindingsSource],
]) {
  assert.doesNotMatch(
    source,
    /toggleDiffPanel|noActiveDiff/,
    `${sourceName} must not retain the former no-op Git diff event handler.`,
  );
}

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

assert.match(
  gitMutationActionsSource,
  /await gitService\.createProjectGitWorktree\(nextProjectId, \{\s*branchName: normalizedBranchName,\s*\}\s*,?\s*\)/s,
  'Git worktree creation must send only the generated SDK branchName request field.',
);

assert.match(
  gitMutationActionsSource,
  /await gitService\.removeProjectGitWorktree\(nextProjectId, \{[\s\S]*worktreeKey,[\s\S]*\}\s*,?\s*\)/s,
  'Git worktree removal must address the generated SDK worktreeKey identity.',
);

for (const [sourceName, source] of [
  ['Git mutation hook', gitMutationActionsSource],
  ['Git worktree management panel', worktreeManagementPanelSource],
  ['Git worktree menu', worktreeMenuSource],
  ['Git overview surface', overviewSurfaceSource],
  ['Git branch menu', branchMenuSource],
]) {
  assert.doesNotMatch(
    source,
    /repositoryRootPath|currentWorktreePath|worktree\.path|worktree\.label|worktree\.id|worktree\.isLocked|worktree\.isPrunable|upstreamName|\.ahead\b|\.behind\b/,
    `${sourceName} must not consume retired local-path or pre-migration Git DTO fields.`,
  );
}

assert.match(
  worktreeManagementPanelSource,
  /await createWorktree\(branchName\)/,
  'Git worktree management must create worktrees from a branch name without collecting a local path.',
);

assert.match(
  worktreeManagementPanelSource,
  /worktreeKey,/,
  'Git worktree management must use worktreeKey for removal requests.',
);

for (const [localeName, source] of [
  ['English Git locale', englishGitLocaleSource],
  ['Chinese Git locale', chineseGitLocaleSource],
]) {
  assert.match(source, /worktreeKey:/, `${localeName} must name the remote worktree identity.`);
  assert.match(source, /unstaged:/, `${localeName} must expose the generated unstaged status count.`);
  assert.match(source, /remoteBranch:/, `${localeName} must expose the generated remote-branch state.`);
  assert.doesNotMatch(
    source,
    /worktreePath|worktreePathPlaceholder|worktreePathHint|modified:|deleted:|conflicted:|ahead:|behind:|locked:/,
    `${localeName} must not retain retired path or pre-migration Git DTO copy.`,
  );
}

console.log('project git header controls contract passed.');
