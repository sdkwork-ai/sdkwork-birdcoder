import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  requestProjectFileSystemFlush,
  requestProjectFileSystemRefresh,
  subscribeProjectFileSystemFlushRequest,
  subscribeProjectFileSystemRefreshRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/events/projectFileSystemSynchronization.ts';

const projectId = 'project-git-filesystem-contract';
const sequence: string[] = [];

const unsubscribeFlush = subscribeProjectFileSystemFlushRequest((request) => {
  if (request.projectId !== projectId) {
    return;
  }
  request.waitUntil(Promise.resolve().then(() => {
    sequence.push('flush');
  }));
});
const unsubscribeRefresh = subscribeProjectFileSystemRefreshRequest((request) => {
  if (request.projectId !== projectId) {
    return;
  }
  request.waitUntil(Promise.resolve().then(() => {
    sequence.push('refresh');
  }));
});

await requestProjectFileSystemFlush(`  ${projectId}  `);
await requestProjectFileSystemRefresh(projectId);
assert.deepEqual(sequence, ['flush', 'refresh']);

unsubscribeFlush();
unsubscribeRefresh();

const rejectedTask = new Error('autosave failed');
const unsubscribeRejectedFlush = subscribeProjectFileSystemFlushRequest((request) => {
  if (request.projectId === projectId) {
    request.waitUntil(Promise.reject(rejectedTask));
  }
});
await assert.rejects(requestProjectFileSystemFlush(projectId), rejectedTask);
unsubscribeRejectedFlush();

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const mutationHookSource = await readFile(
  `${repositoryRoot}/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjectGitMutationActions.ts`,
  'utf8',
);
const switchBranchBody = mutationHookSource.match(
  /const switchBranch = useCallback\([\s\S]*?\n  }, \[applyGitOverview/,
)?.[0] ?? '';
assert.match(switchBranchBody, /await requestProjectFileSystemFlush\(nextProjectId\);/);
assert.match(switchBranchBody, /await gitService\.switchProjectGitBranch/);
assert.match(switchBranchBody, /await requestProjectFileSystemRefresh\(nextProjectId\);/);
assert.ok(
  switchBranchBody.indexOf('requestProjectFileSystemFlush')
    < switchBranchBody.indexOf('gitService.switchProjectGitBranch'),
  'Pending editor writes must flush before Git checkout starts.',
);
assert.ok(
  switchBranchBody.indexOf('gitService.switchProjectGitBranch')
    < switchBranchBody.indexOf('requestProjectFileSystemRefresh'),
  'The editor tree and open files must refresh only after Git checkout succeeds.',
);

const fileSystemHookSource = await readFile(
  `${repositoryRoot}/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useFileSystem.ts`,
  'utf8',
);
assert.match(fileSystemHookSource, /subscribeProjectFileSystemFlushRequest/);
assert.match(fileSystemHookSource, /request\.waitUntil\(flushPendingAutosave\(\)\);/);
assert.match(fileSystemHookSource, /subscribeProjectFileSystemRefreshRequest/);
assert.match(fileSystemHookSource, /await refreshFiles\(\);/);
assert.match(fileSystemHookSource, /await syncSelectedFileFromSource/);
assert.match(fileSystemHookSource, /await syncInactiveOpenFilesFromSource/);

console.log('Project Git/file-system coordination contract passed.');
