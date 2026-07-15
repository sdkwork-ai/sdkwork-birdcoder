import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createDeploymentWorkspaceHostRuntime,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src-host/deploymentWorkspacePlugin.ts';

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

function createRepository(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  runGit(root, ['init', '--initial-branch=main']);
  runGit(root, ['config', 'user.email', 'birdcoder-test@sdkwork.local']);
  runGit(root, ['config', 'user.name', 'BirdCoder Test']);
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'initial\n', 'utf8');
  runGit(root, ['add', 'tracked.txt']);
  runGit(root, ['commit', '-m', 'initial']);
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-browser-git-'));

try {
  const parentRepository = path.join(fixtureRoot, 'parent');
  createRepository(parentRepository);
  const nestedDirectory = path.join(parentRepository, 'nested-project');
  fs.mkdirSync(nestedDirectory);
  assert.equal(
    createDeploymentWorkspaceHostRuntime(nestedDirectory).readGitOverview().status,
    'not_repository',
    'A deployment directory must not silently adopt a parent Git repository.',
  );

  const repositoryRoot = path.join(fixtureRoot, 'project');
  createRepository(repositoryRoot);
  const runtime = createDeploymentWorkspaceHostRuntime(repositoryRoot);
  const initialOverview = runtime.readGitOverview();
  assert.equal(initialOverview.status, 'ready');
  assert.equal(initialOverview.currentBranch, 'main');
  assert.equal(initialOverview.detachedHead, false);

  fs.writeFileSync(path.join(repositoryRoot, 'tracked.txt'), 'updated\n', 'utf8');
  fs.writeFileSync(path.join(repositoryRoot, 'untracked.txt'), 'new file\n', 'utf8');
  const changedOverview = runtime.readGitOverview();
  assert.equal(changedOverview.statusCounts.unstaged, 1);
  assert.equal(changedOverview.statusCounts.untracked, 1);
  const diff = runtime.readGitDiff();
  assert.equal(diff.truncated, false);
  assert.match(diff.patch, /tracked\.txt/u);
  assert.match(diff.patch, /untracked\.txt/u);
  assert.match(diff.patch, /\+updated/u);
  assert.match(diff.patch, /\+new file/u);

  runtime.mutateGit({ operation: 'commit', message: 'commit browser host changes' });
  assert.deepEqual(runtime.readGitOverview().statusCounts, {
    staged: 0,
    unstaged: 0,
    untracked: 0,
  });
  assert.throws(
    () => runtime.mutateGit({ operation: 'commit', message: 'empty commit' }),
    /no Git changes/u,
  );

  runGit(repositoryRoot, ['branch', 'feature/existing']);
  const existingWorktreeOverview = runtime.mutateGit({
    operation: 'createWorktree',
    branchName: 'feature/existing',
  });
  const existingWorktreeKey = createHash('sha256').update('feature/existing').digest('hex');
  assert.ok(
    existingWorktreeOverview.worktrees.some(
      (worktree) => worktree.branch === 'feature/existing'
        && worktree.worktreeKey === existingWorktreeKey,
    ),
    'Existing local branches must be usable for managed worktrees.',
  );
  runtime.mutateGit({
    operation: 'removeWorktree',
    worktreeKey: existingWorktreeKey,
  });

  const newWorktreeOverview = runtime.mutateGit({
    operation: 'createWorktree',
    branchName: 'feature/new-worktree',
  });
  const newWorktreeKey = createHash('sha256').update('feature/new-worktree').digest('hex');
  assert.ok(
    newWorktreeOverview.worktrees.some(
      (worktree) => worktree.branch === 'feature/new-worktree'
        && worktree.worktreeKey === newWorktreeKey,
    ),
  );
  assert.equal(
    runtime.listDirectory().children?.some((entry) => entry.name === '.sdkwork-worktrees'),
    false,
    'Managed worktrees must not appear inside the editor file tree.',
  );
  assert.throws(
    () => runtime.mutateGit({ operation: 'removeWorktree', worktreeKey: 'feature-new-worktree' }),
    /SHA-256/u,
  );
  runtime.mutateGit({
    operation: 'removeWorktree',
    worktreeKey: newWorktreeKey,
  });

  const remoteRoot = path.join(fixtureRoot, 'remote.git');
  fs.mkdirSync(remoteRoot);
  runGit(remoteRoot, ['init', '--bare']);
  runGit(repositoryRoot, ['remote', 'add', 'upstream', remoteRoot]);
  runGit(repositoryRoot, ['push', '--set-upstream', 'upstream', 'main']);
  runGit(repositoryRoot, ['switch', '-c', 'seed-remote-branch']);
  runGit(repositoryRoot, ['push', 'upstream', 'seed-remote-branch:feature/remote']);
  runGit(repositoryRoot, ['switch', 'main']);
  runGit(repositoryRoot, ['branch', '-D', 'seed-remote-branch']);
  runGit(repositoryRoot, ['fetch', 'upstream']);
  runGit(repositoryRoot, [
    'symbolic-ref',
    'refs/remotes/upstream/HEAD',
    'refs/remotes/upstream/main',
  ]);
  const remoteBranchOverview = runtime.readGitOverview();
  assert.equal(
    remoteBranchOverview.branches.some((branch) => branch.name === 'upstream'),
    false,
    'A remote HEAD symbolic ref must not appear as a switchable remote branch.',
  );
  assert.ok(
    remoteBranchOverview.branches.some((branch) => branch.name === 'upstream/main'),
    'Real remote branches must remain visible when the remote HEAD ref is filtered.',
  );

  const remoteSwitchOverview = runtime.mutateGit({
    operation: 'switchBranch',
    branchName: 'upstream/feature/remote',
  });
  assert.equal(remoteSwitchOverview.currentBranch, 'feature/remote');
  assert.equal(remoteSwitchOverview.detachedHead, false);
  assert.equal(
    runGit(repositoryRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']),
    'upstream/feature/remote',
  );

  runtime.mutateGit({ operation: 'createBranch', branchName: 'publish/browser-host' });
  fs.writeFileSync(path.join(repositoryRoot, 'publish.txt'), 'publish\n', 'utf8');
  runtime.mutateGit({ operation: 'commit', message: 'publish branch' });
  runtime.mutateGit({ operation: 'push' });
  assert.equal(
    runGit(repositoryRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']),
    'upstream/publish/browser-host',
    'The only configured remote must be selected and set as upstream on first push.',
  );

  runGit(repositoryRoot, ['checkout', '--detach']);
  const detachedOverview = runtime.readGitOverview();
  assert.equal(detachedOverview.detachedHead, true);
  assert.equal(detachedOverview.currentBranch, undefined);

  console.log('Browser deployment workspace Git contract passed.');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
