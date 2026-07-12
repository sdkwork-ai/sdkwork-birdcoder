import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const runtimeFileSystemServiceSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
  ),
  'utf8',
);
const hostFilesystemSource = fs.readFileSync(
  path.join(
    rootDir,
    'crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs',
  ),
  'utf8',
);
const desktopLibSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs',
  ),
  'utf8',
);
const tauriRuntimeSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  ),
  'utf8',
);

assert.match(
  runtimeFileSystemServiceSource,
  /interface BrowserMountState \{[\s\S]*cachedSearchTree\?: IFileNode\[\];/s,
  'Browser-mounted search must keep a cached recursive search tree so repeated searches do not rescan the full folder.',
);

assert.match(
  hostFilesystemSource,
  /pub struct FileSystemSnapshotResponse \{[\s\S]*pub limit_reached: bool,[\s\S]*\}/s,
  'Rust folder snapshots must report whether depth or node budgets truncated the tree.',
);

assert.match(
  hostFilesystemSource,
  /const DEFAULT_DIRECTORY_SNAPSHOT_MAX_NODES: usize = [\d_]+;[\s\S]*const MAX_DIRECTORY_SNAPSHOT_MAX_NODES: usize = [\d_]+;/s,
  'Rust folder snapshots must define bounded default and absolute node budgets.',
);

assert.match(
  hostFilesystemSource,
  /pub async fn fs_snapshot_folder\(\s*root_path: String,\s*max_nodes: Option<usize>,[\s\S]*DirectorySnapshotBudget/s,
  'Rust fs_snapshot_folder must accept a caller budget and apply it through shared traversal state.',
);

assert.match(
  desktopLibSource,
  /async fn fs_snapshot_folder\(\s*root_path: String,\s*max_nodes: Option<usize>,[\s\S]*host::fs_snapshot_folder\(root_path, max_nodes\)\.await/s,
  'The desktop shell command must forward the search snapshot node budget into the shared Rust host.',
);

assert.match(
  tauriRuntimeSource,
  /snapshotFolder\(\s*rootSystemPath: string,\s*maxNodes\?: number,[\s\S]*Promise<BirdCoderTauriFolderSnapshot>/s,
  'The typed Tauri filesystem adapter must expose an optional snapshot node budget.',
);

assert.match(
  tauriRuntimeSource,
  /maxNodes: normalizedMaxNodes/,
  'The typed Tauri filesystem adapter must forward the normalized snapshot node budget.',
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
  /private async getSearchFileTree\(\s*projectId: string,\s*signal\?: AbortSignal,\s*\): Promise<SearchFileTreeSnapshot> \{[\s\S]*browserMount\.cachedSearchTree[\s\S]*tauriMount\.cachedSearchTree/s,
  'RuntimeFileSystemService must centralize cached browser and desktop search tree creation while accepting AbortSignal for first-snapshot cancellation.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /const MAX_RUNTIME_FILE_SEARCH_TREE_NODES = [\d_]+;/,
  'RuntimeFileSystemService must cap recursive search snapshots before very large dependency trees monopolize memory and I/O.',
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
  /interface SearchTreeSnapshotContext \{[\s\S]*limitReached: boolean;[\s\S]*maxNodeCount: number;[\s\S]*signal\?: AbortSignal;[\s\S]*totalVisitedNodeCount: number;[\s\S]*visitedNodeCount: number;[\s\S]*\}/s,
  'Browser search tree snapshot traversal must share cancellation, node-budget, and yield accounting across recursive calls.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /context\.totalVisitedNodeCount >= context\.maxNodeCount[\s\S]*context\.limitReached = true;[\s\S]*return false;/s,
  'Browser search tree snapshots must stop enumeration and mark the result incomplete when the node budget is reached.',
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
  /const tauriSearchTreeSnapshot = await this\.tauriRuntime\.snapshotFolder\(\s*tauriMount\.rootSystemPath,\s*MAX_RUNTIME_FILE_SEARCH_TREE_NODES,\s*\);[\s\S]*throwIfSearchTreeSnapshotAborted\(signal\);[\s\S]*tauriMount\.cachedSearchTree = createReadonlyMountedTree\(\s*tauriSearchTreeSnapshot\.tree,\s*\);[\s\S]*tauriMount\.cachedSearchTreeLimitReached =\s*tauriSearchTreeSnapshot\.limitReached === true;/s,
  'Desktop search snapshots must forward the node budget and cache whether the Rust snapshot was truncated.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /private invalidateProjectSearchTree\(projectId: string\): void \{[\s\S]*browserMount\.cachedSearchTree = undefined;[\s\S]*browserMount\.cachedSearchTreeLimitReached = undefined;[\s\S]*tauriMount\.cachedSearchTree = undefined;[\s\S]*tauriMount\.cachedSearchTreeLimitReached = undefined;/s,
  'RuntimeFileSystemService must invalidate cached search trees when mounted file trees change.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /limitReached: searchResult\.limitReached \|\| searchTreeSnapshot\.limitReached/,
  'Find-in-files must surface an incomplete tree snapshot through the existing limitReached result.',
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
