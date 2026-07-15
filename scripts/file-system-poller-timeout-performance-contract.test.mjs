import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  runtimeSource,
  /timerId: ReturnType<typeof setTimeout> \| null;/,
  'RuntimeFileSystemService file-tree poller must track a cancellable timeout instead of a fixed interval so slow filesystem work cannot stack recurring main-thread wakeups.',
);

assert.match(
  runtimeSource,
  /private scheduleProjectFileTreePoll\(\s*projectId: string,\s*poller: ProjectFileTreePoller,\s*\): void/s,
  'RuntimeFileSystemService must centralize file-tree poll scheduling so the next cycle is scheduled only after ownership is known.',
);

assert.match(
  runtimeSource,
  /poller\.timerId = setTimeout\(\(\) => \{[\s\S]*void this\.pollProjectFileTreeChanges\(projectId, poller\);[\s\S]*\}, FILE_TREE_POLL_INTERVAL_MS\);/s,
  'RuntimeFileSystemService should schedule file-tree polling with setTimeout and its owned poller instance so each cycle can be delayed until the previous poll has completed and cannot cross a subject change.',
);

assert.doesNotMatch(
  runtimeSource,
  /const intervalId = setInterval\(\(\) => \{[\s\S]*pollProjectFileTreeChanges\(projectId\)[\s\S]*\}, FILE_TREE_POLL_INTERVAL_MS\);/s,
  'RuntimeFileSystemService must not use setInterval for file-tree polling because long polls still generate recurring JS wakeups.',
);

assert.match(
  runtimeSource,
  /clearTimeout\(poller\.timerId\);/,
  'RuntimeFileSystemService must cancel the pending poll timeout when a project no longer has active file-change listeners.',
);

assert.match(
  runtimeSource,
  /currentPoller\.isRunning = false;[\s\S]*this\.scheduleProjectFileTreePoll\(projectId, currentPoller\);/s,
  'RuntimeFileSystemService must schedule the next file-tree poll only after the current async poll releases its running guard.',
);

assert.match(
  runtimeSource,
  /this\.projectFileTreePollers\.get\(projectId\) !== poller[\s\S]*!this\.isProjectMountOwnedByScope\(projectId, poller\.scope\)/s,
  'RuntimeFileSystemService must reject stale poller callbacks before they can read, mutate, or notify a replacement subject mount.',
);

console.log('file system poller timeout performance contract passed.');
