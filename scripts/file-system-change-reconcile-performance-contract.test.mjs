import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);
const reconcileFileChangeEventMatch = fileSystemSource.match(
  /const reconcileFileChangeEvent = useCallback\(async \([\s\S]*?\n  \}, \[/s,
);

assert.ok(
  reconcileFileChangeEventMatch,
  'useFileSystem should keep realtime file-change reconciliation isolated in a dedicated callback.',
);

const reconcileFileChangeEventSource = reconcileFileChangeEventMatch[0];

assert.match(
  fileSystemSource,
  /const fileChangeReconciliationInFlightRef = useRef\(false\);/,
  'useFileSystem must guard file-change reconciliation so high-frequency directory change notifications do not trigger overlapping getFiles and content refresh work.',
);

assert.match(
  fileSystemSource,
  /const pendingFileChangeRef = useRef<ProjectFileSystemChangeEvent \| null>\(null\);/,
  'useFileSystem must queue pending file-change events so bursts can be merged into a single follow-up reconciliation pass.',
);

assert.match(
  fileSystemSource,
  /queueFileChangeReconciliation\(requestProjectId, event\);/,
  'useFileSystem must route file-system change notifications through a queued reconciliation path instead of reconciling each event inline.',
);

assert.match(
  fileSystemSource,
  /function resolveFileChangeRefreshDirectoryPaths\(/,
  'useFileSystem should centralize realtime change-to-directory refresh resolution so file and directory events can be reconciled incrementally instead of falling back to full tree reloads.',
);

assert.match(
  fileSystemSource,
  /const refreshDirectoryPaths = resolveFileChangeRefreshDirectoryPaths\(\s*filesIndexRef\.current,\s*event,\s*\);[\s\S]*await fileSystemService\.refreshDirectories\(\s*requestProjectId,\s*refreshDirectoryPaths,\s*\)/s,
  'useFileSystem should refresh only the impacted mounted directories from the precomputed file-tree index instead of reloading or rescanning the entire file tree on every file-system event.',
);

assert.doesNotMatch(
  reconcileFileChangeEventSource,
  /await fileSystemService\.getFiles\(requestProjectId\);/s,
  'useFileSystem must not call getFiles inside realtime file-change reconciliation because path-targeted notifications should not force a full tree reload.',
);

assert.doesNotMatch(
  fileSystemSource,
  /subscribeToFileChanges\(requestProjectId, \(event\) => \{[\s\S]*void \(async \(\) =>/s,
  'useFileSystem must not launch a fresh inline async reconciliation body for every file-system event because bursts of notifications will stack redundant getFiles and selected-file content fetches.',
);

console.log('file system change reconcile performance contract passed.');
