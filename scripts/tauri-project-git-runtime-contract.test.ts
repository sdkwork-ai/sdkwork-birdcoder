import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import type { BirdCoderProjectGitOverview } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  createTauriProjectGitRuntime,
  TauriProjectGitRuntimeUnavailableError,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriProjectGitRuntime.ts';

const rootDir = process.cwd();
const desktopEntrypointSource = fs.readFileSync(path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
), 'utf8');
const tauriGitCommandSource = fs.readFileSync(path.join(
  rootDir,
  'crates/sdkwork-birdcoder-tauri-host/src/commands/git_commands.rs',
), 'utf8');

const commandNames = [
  'git_project_overview',
  'git_project_diff',
  'git_create_branch',
  'git_switch_branch',
  'git_commit_changes',
  'git_push_branch',
  'git_create_worktree',
  'git_remove_worktree',
  'git_prune_worktrees',
];

for (const commandName of commandNames) {
  assert.match(
    desktopEntrypointSource,
    new RegExp(`\\b${commandName},`, 'u'),
    `Desktop invoke handler must register ${commandName}.`,
  );
  assert.match(
    tauriGitCommandSource,
    new RegExp(`pub async fn ${commandName}\\b`, 'u'),
    `Tauri host must implement ${commandName}.`,
  );
}

assert.match(
  tauriGitCommandSource,
  /resolve_root_directory_path\(&root_path\)/,
  'Every Tauri Git operation must resolve the root through the authorized filesystem registry.',
);
assert.doesNotMatch(
  tauriGitCommandSource,
  /repository_root_path:|current_worktree_path:/,
  'Tauri Git DTOs must not expose device-local filesystem paths to the renderer.',
);

const overview: BirdCoderProjectGitOverview = {
  branches: [{ isCurrent: true, isRemote: false, name: 'main' }],
  currentBranch: 'main',
  currentRevision: 'abc123',
  detachedHead: false,
  status: 'ready',
  statusCounts: { staged: 0, unstaged: 1, untracked: 0 },
  worktrees: [],
};

const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
const runtime = createTauriProjectGitRuntime({
  invoke: async <T>(command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    return overview as T;
  },
  isTauriRuntime: async () => true,
  resolveProjectRoot: async (projectId) =>
    projectId === 'mounted-project' ? 'C:\\workspace\\mounted-project' : null,
});

await runtime.getProjectGitOverview('mounted-project');
await runtime.commitProjectGitChanges('mounted-project', {
  message: 'desktop commit',
});
await runtime.pushProjectGitBranch('mounted-project', {
  branchName: 'main',
  remoteName: 'origin',
});
await runtime.removeProjectGitWorktree('mounted-project', {
  force: true,
  worktreeKey: 'a'.repeat(64),
});

assert.deepEqual(calls, [
  {
    command: 'git_project_overview',
    args: { rootPath: 'C:\\workspace\\mounted-project' },
  },
  {
    command: 'git_commit_changes',
    args: {
      rootPath: 'C:\\workspace\\mounted-project',
      includeUnstaged: true,
      message: 'desktop commit',
    },
  },
  {
    command: 'git_push_branch',
    args: {
      rootPath: 'C:\\workspace\\mounted-project',
      branchName: 'main',
      remoteName: 'origin',
    },
  },
  {
    command: 'git_remove_worktree',
    args: {
      rootPath: 'C:\\workspace\\mounted-project',
      force: true,
      worktreeKey: 'a'.repeat(64),
    },
  },
]);

await assert.rejects(
  runtime.getProjectGitOverview('unmounted-project'),
  TauriProjectGitRuntimeUnavailableError,
);

const browserRuntime = createTauriProjectGitRuntime({
  invoke: async <T>() => overview as T,
  isTauriRuntime: async () => false,
  resolveProjectRoot: async () => 'C:\\workspace\\mounted-project',
});
await assert.rejects(
  browserRuntime.getProjectGitOverview('mounted-project'),
  TauriProjectGitRuntimeUnavailableError,
);

console.log('Tauri project Git runtime contract passed.');
