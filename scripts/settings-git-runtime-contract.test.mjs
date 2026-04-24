import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const appSettingsSource = readSource(
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'components',
  'appSettings.ts',
);
const settingsPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'pages',
  'SettingsPage.tsx',
);
const gitSettingsSource = readSource(
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'components',
  'GitSettings.tsx',
);
const worktreeSettingsSource = readSource(
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'components',
  'WorktreeSettings.tsx',
);
const projectGitSettingsPanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'components',
  'ProjectGitSettingsPanel.tsx',
);
const worktreeManagementPanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'ProjectGitWorktreeManagementPanel.tsx',
);
const legacySettingsWorktreeManagementPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-settings',
  'src',
  'components',
  'ProjectGitWorktreeManagementPanel.tsx',
);
const shellAppSource = readSource(
  'packages',
  'sdkwork-birdcoder-shell',
  'src',
  'application',
  'app',
  'BirdcoderApp.tsx',
);

assert.doesNotMatch(
  appSettingsSource,
  /gitAutoFetch|gitCommitMessageGeneration|gitDefaultBranch|worktreeLocation|worktreeAutoCleanup/,
  'App settings should not persist legacy fake Git/worktree knobs once those pages become authoritative runtime status views.',
);

assert.match(
  projectGitSettingsPanelSource,
  /import \{[\s\S]*ProjectGitOverviewPanel,[\s\S]*\} from '@sdkwork\/birdcoder-ui';/s,
  'Settings Git runtime panel must reuse the shared ProjectGitOverviewPanel instead of manually wiring another Git overview state container.',
);

assert.match(
  projectGitSettingsPanelSource,
  /<ProjectGitOverviewPanel[\s\S]*projectId=\{currentProjectId\}[\s\S]*visibleSections=\{visibleSections\}/s,
  'Settings Git runtime panel must bind the shared ProjectGitOverviewPanel to the current project and requested visible sections.',
);

assert.match(
  gitSettingsSource,
  /visibleSections=\{\['summary', 'status', 'branches'\]\}/,
  'Git settings page should focus on authoritative repository summary, status, and branches.',
);

assert.doesNotMatch(
  gitSettingsSource,
  /autoFetch|commitMessageGeneration|defaultBranchName/,
  'Git settings page must not render legacy fake Git configuration fields.',
);

assert.match(
  worktreeSettingsSource,
  /visibleSections=\{\['summary', 'worktrees'\]\}/,
  'Worktree settings page should focus on authoritative worktree inventory for the current project.',
);

assert.match(
  worktreeSettingsSource,
  /import \{ ProjectGitWorktreeManagementPanel \} from '@sdkwork\/birdcoder-ui';/,
  'Worktree settings page must import the authoritative worktree management surface from the shared UI package.',
);

assert.match(
  worktreeSettingsSource,
  /<ProjectGitWorktreeManagementPanel currentProjectId=\{currentProjectId\} \/>/,
  'Worktree settings page must mount the authoritative shared worktree management surface instead of remaining read-only.',
);

assert.match(
  worktreeManagementPanelSource,
  /import \{[\s\S]*useProjectGitMutationActions,[\s\S]*useProjectGitOverview,[\s\S]*\} from '@sdkwork\/birdcoder-commons';/s,
  'Worktree management panel must consume shared Git overview and mutation hooks from the commons package root.',
);

assert.match(
  worktreeManagementPanelSource,
  /import \{[\s\S]*useToast[\s\S]*\} from '@sdkwork\/birdcoder-commons';/s,
  'Worktree management panel must source toast behavior from the commons package root instead of a child entry.',
);

assert.equal(
  fs.existsSync(legacySettingsWorktreeManagementPath),
  false,
  'Settings package must not keep a private ProjectGitWorktreeManagementPanel once the shared UI surface becomes authoritative.',
);

assert.match(
  worktreeManagementPanelSource,
  /const \{\s*createWorktree,[\s\S]*pruneWorktrees,[\s\S]*removeWorktree,\s*\} = useProjectGitMutationActions\(\{/s,
  'Worktree management panel must derive create, remove, and prune actions from the shared Git mutation hook.',
);

assert.doesNotMatch(
  worktreeManagementPanelSource,
  /gitService\.(createProjectGitWorktree|removeProjectGitWorktree|pruneProjectGitWorktrees)/,
  'Worktree management panel must not call Git service worktree mutation APIs directly after standardization into commons.',
);

assert.doesNotMatch(
  worktreeSettingsSource,
  /defaultLocation|autoCleanup/,
  'Worktree settings page must not render legacy fake worktree configuration fields.',
);

assert.match(
  settingsPageSource,
  /interface SettingsPageProps \{\s*currentProjectId\?: string;\s*currentProjectName\?: string;\s*onBack\?: \(\) => void;\s*\}/s,
  'SettingsPage should accept current project context so Git/worktree pages can render authoritative project state.',
);

assert.match(
  settingsPageSource,
  /const props = \{\s*currentProjectId,\s*currentProjectName,/s,
  'SettingsPage should pass current project context into settings sections.',
);

assert.match(
  shellAppSource,
  /<SettingsPage[\s\S]*currentProjectId=\{projectId \|\| undefined\}[\s\S]*currentProjectName=\{projectName\}/s,
  'Shell app must pass the active project identity into SettingsPage so Git/worktree settings stay aligned with the current workbench selection.',
);

console.log('settings git runtime contract passed.');
