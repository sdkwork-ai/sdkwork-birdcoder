import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const runtimeFileSystemServiceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);

assert.match(
  runtimeFileSystemServiceSource,
  /interface BrowserMountState \{[\s\S]*cachedSearchTree\?: IFileNode\[\];/s,
  'Browser-mounted search must keep a cached recursive search tree so repeated searches do not rescan the full folder.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /interface TauriMountState \{[\s\S]*cachedSearchTree\?: IFileNode\[\];/s,
  'Desktop-mounted search must keep a cached recursive search tree so repeated searches do not re-request a full Tauri snapshot.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /await this\.getSearchFileTree\(projectId, options\.signal\);/s,
  'RuntimeFileSystemService.searchFiles must pass AbortSignal into cached search tree creation so stale searches can be cancelled before full snapshots finish.',
);

const searchFilesBlock = runtimeFileSystemServiceSource.match(
  /async searchFiles\([\s\S]*?\n  async mountFolder\(/s,
);
assert.ok(searchFilesBlock, 'RuntimeFileSystemService.searchFiles block must be present.');
assert.doesNotMatch(
  searchFilesBlock[0],
  /snapshotBrowserDirectoryRecursively|snapshotFolder\(/,
  'RuntimeFileSystemService.searchFiles must not recursively snapshot mounted projects inline on every search.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /private async getSearchFileTree\(\s*projectId: string,\s*signal\?: AbortSignal,\s*\): Promise<IFileNode\[\]> \{[\s\S]*browserMount\.cachedSearchTree[\s\S]*tauriMount\.cachedSearchTree/s,
  'RuntimeFileSystemService must centralize cached browser and desktop search tree creation while accepting AbortSignal for first-snapshot cancellation.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /const SEARCH_TREE_SNAPSHOT_YIELD_INTERVAL = \d+;/,
  'RuntimeFileSystemService must define a bounded search tree snapshot yield interval so first search snapshots cannot monopolize the UI thread.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /async function yieldSearchTreeSnapshot\(\): Promise<void> \{[\s\S]*setTimeout\(resolve, 0\)[\s\S]*\}/,
  'RuntimeFileSystemService must provide a macrotask yield helper for long-running search tree snapshot traversal.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /interface SearchTreeSnapshotContext \{[\s\S]*signal\?: AbortSignal;[\s\S]*visitedNodeCount: number;[\s\S]*\}/s,
  'Browser search tree snapshot traversal must share cancellation and yield accounting across recursive calls.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /private async snapshotBrowserDirectoryRecursively\([\s\S]*context: SearchTreeSnapshotContext,[\s\S]*\): Promise<IFileNode>/s,
  'Browser recursive search snapshots must accept shared traversal context instead of resetting yield counters in every directory.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /await yieldSearchTreeSnapshot\(\);[\s\S]*throwIfSearchTreeSnapshotAborted\(context\.signal\);/s,
  'Browser recursive search snapshots must yield during traversal and re-check cancellation before continuing.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /if \(signal\?\.aborted\) \{[\s\S]*return createEmptyRuntimeFileSearchResult\(\);[\s\S]*\}/s,
  'RuntimeFileSystemService.searchFiles must short-circuit already-cancelled searches before scheduling search work.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /catch \(error\) \{[\s\S]*if \(isSearchTreeSnapshotAbortError\(error\)\) \{[\s\S]*return createEmptyRuntimeFileSearchResult\(\);[\s\S]*\}/s,
  'RuntimeFileSystemService.searchFiles must treat cancelled first-snapshot work as an empty stale result instead of surfacing errors or caching partial state.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /const tauriSearchTreeSnapshot = await this\.tauriRuntime\.snapshotFolder\(\s*tauriMount\.rootSystemPath,\s*\);[\s\S]*throwIfSearchTreeSnapshotAborted\(signal\);[\s\S]*tauriMount\.cachedSearchTree = createReadonlyMountedTree\(\s*tauriSearchTreeSnapshot\.tree,\s*\);/s,
  'Desktop search snapshots must check cancellation before caching a completed full snapshot.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /private invalidateProjectSearchTree\(projectId: string\): void \{[\s\S]*browserMount\.cachedSearchTree = undefined;[\s\S]*tauriMount\.cachedSearchTree = undefined;/s,
  'RuntimeFileSystemService must invalidate cached search trees when mounted file trees change.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /snapshotBrowserDirectoryRecursively\([\s\S]*directoryHandles: Map<string, BrowserDirectoryHandleLike>,[\s\S]*fileHandles: Map<string, BrowserFileHandleLike>,[\s\S]*directoryHandles\.set\(childPath, entry\);[\s\S]*fileHandles\.set\(childPath, entry\);/s,
  'Browser recursive search snapshots must populate handle maps so cached deep search results can read file contents without rescanning.',
);

for (const mutationMethod of [
  'loadBrowserMountedDirectory',
  'loadTauriMountedDirectory',
  'maybeRefreshBrowserMountedDirectory',
  'maybeRefreshTauriMountedDirectory',
]) {
  const methodIndex = runtimeFileSystemServiceSource.indexOf(`private async ${mutationMethod}(`);
  assert.notEqual(
    methodIndex,
    -1,
    `RuntimeFileSystemService.${mutationMethod} must be present.`,
  );
  const nextMethodIndex = runtimeFileSystemServiceSource.indexOf('\n  private ', methodIndex + 1);
  const methodSource = runtimeFileSystemServiceSource.slice(
    methodIndex,
    nextMethodIndex === -1 ? runtimeFileSystemServiceSource.length : nextMethodIndex,
  );
  assert.match(
    methodSource,
    /this\.invalidateProjectSearchTree\(projectId\);/,
    `RuntimeFileSystemService.${mutationMethod} must invalidate cached search trees after tree mutations.`,
  );
}

console.log('runtime file search snapshot cache performance contract passed.');
