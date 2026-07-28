import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const runtimeFileSystemServicePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeFileSystemService.ts',
);

const source = fs.readFileSync(runtimeFileSystemServicePath, 'utf8');
const driveFileSystemServicePath = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'impl',
  'DriveSandboxProjectFileSystemService.ts',
);
const driveSource = fs.readFileSync(driveFileSystemServicePath, 'utf8');

function readMethodBody(methodName) {
  const methodStart = source.indexOf(`private async ${methodName}(`);
  assert.notEqual(methodStart, -1, `${methodName} must exist on RuntimeFileSystemService.`);
  const nextMethodStart = source.indexOf('\n  private ', methodStart + 1);
  assert.notEqual(nextMethodStart, -1, `${methodName} body must be followed by another private method.`);
  return source.slice(methodStart, nextMethodStart);
}

assert.match(
  source,
  /interface BrowserMountState \{[\s\S]*loadedDirectoryPaths: Set<string>;[\s\S]*\}/u,
  'Browser-mounted file trees must keep an incremental loaded-directory index.',
);
assert.match(
  source,
  /interface TauriMountState \{[\s\S]*loadedDirectoryPaths: Set<string>;[\s\S]*\}/u,
  'Desktop-mounted file trees must keep an incremental loaded-directory index.',
);
assert.match(
  source,
  /function markLoadedDirectoryPath\(\s*mountState: LoadedDirectoryMountState,\s*directoryPath: string,\s*\): void/u,
  'Directory loads must update the loaded-directory index through a single helper.',
);
assert.match(
  source,
  /function removeLoadedDirectoryPath\(\s*mountState: LoadedDirectoryMountState,\s*path: string,\s*recursive: boolean,\s*\): void/u,
  'Directory removals must prune the loaded-directory index through a single helper.',
);

for (const methodName of ['pollBrowserMountedDirectories', 'pollTauriMountedDirectories']) {
  const body = readMethodBody(methodName);
  assert.doesNotMatch(
    body,
    /collectLoadedDirectoryPaths\(mountState\.tree\)/u,
    `${methodName} must not recursively scan the loaded tree on every poll cycle.`,
  );
  assert.match(
    body,
    /const loadedDirectoryPaths = \[\.\.\.mountState\.loadedDirectoryPaths\];/u,
    `${methodName} must poll from the maintained loaded-directory index.`,
  );
}

assert.match(
  readMethodBody('loadBrowserMountedDirectory'),
  /markLoadedDirectoryPath\(mountState,\s*directoryPath\);/u,
  'Browser directory loads must mark the refreshed directory as loaded.',
);
assert.match(
  readMethodBody('loadTauriMountedDirectory'),
  /markLoadedDirectoryPath\(mountState,\s*listing\.directory\.path\);/u,
  'Desktop directory loads must mark the refreshed directory as loaded.',
);
assert.match(
  source,
  /removeLoadedDirectoryPath\(\s*mountState,\s*currentChild\.path,\s*currentChild\.type === 'directory',\s*\);/u,
  'Removed browser-mounted directories must be pruned from the loaded-directory index.',
);
assert.match(
  readMethodBody('loadTauriMountedDirectory'),
  /pruneRemovedLoadedDirectoryPaths\(\s*mountState,\s*listing\.directory\.path,\s*listing\.directory\.children \?\? \[\],\s*\);/u,
  'Desktop directory refreshes must prune removed loaded descendants before replacing children.',
);

assert.match(
  driveSource,
  /directChildPathsByDirectoryPath: Map<string, Set<string>>;/u,
  'Drive-backed file trees must index direct children by directory path.',
);
const driveLoadStart = driveSource.indexOf('  private async loadRemoteDirectory(');
const driveLoadEnd = driveSource.indexOf('\n  private async refreshRemoteDirectoryState(', driveLoadStart);
assert.notEqual(driveLoadStart, -1, 'DriveSandboxProjectFileSystemService must load remote directories.');
assert.notEqual(driveLoadEnd, -1, 'The remote directory loader must have a bounded method body.');
const driveLoadBody = driveSource.slice(driveLoadStart, driveLoadEnd);
assert.match(
  driveLoadBody,
  /directChildPathsByDirectoryPath\.get\(virtualPath\)/u,
  'Drive directory refreshes must inspect the direct-child index for the current directory.',
);
assert.doesNotMatch(
  driveLoadBody,
  /entriesByVirtualPath\.(?:keys|entries)\(\)/u,
  'Drive directory refreshes must not scan the complete project entry cache.',
);

const driveSearchStart = driveSource.indexOf('  private async buildRemoteSearchTree(');
const driveSearchEnd = driveSource.indexOf('\n  async searchFiles(', driveSearchStart);
assert.notEqual(driveSearchStart, -1, 'DriveSandboxProjectFileSystemService must build search snapshots.');
assert.notEqual(driveSearchEnd, -1, 'The Drive search snapshot builder must have a bounded method body.');
const driveSearchBody = driveSource.slice(driveSearchStart, driveSearchEnd);
assert.match(
  driveSearchBody,
  /const entriesByVirtualPath = new Map<string, SandboxEntry>\(\);/u,
  'Drive search must use a request-local entry identity map.',
);
assert.doesNotMatch(
  driveSearchBody,
  /(?:entryToFileNode|cacheRemoteEntry)\(/u,
  'Drive search snapshots must not permanently populate the interactive directory cache.',
);
assert.doesNotMatch(
  driveSearchBody,
  /queue\.shift\(\)/u,
  'Drive search breadth-first traversal must use an O(1) cursor instead of Array.shift().',
);
assert.match(
  driveSource,
  /mutationGeneration[\s\S]*?MAX_SEARCH_SNAPSHOT_ATTEMPTS/u,
  'Drive search must reject or retry a snapshot invalidated by an in-process mutation.',
);
assert.match(
  driveSource,
  /private async probeRemoteDirectory\([\s\S]*?pageSize: DIRECTORY_PAGE_SIZE,[\s\S]*?validateDirectoryEntry\(state, logicalPath, entry\);/u,
  'Drive mount-state checks must use one bounded and validated directory page.',
);
const driveMountStateStart = driveSource.indexOf('  async getProjectMountState(');
const driveMountStateEnd = driveSource.indexOf('\n  async restoreProjectMount(', driveMountStateStart);
const driveMountStateBody = driveSource.slice(driveMountStateStart, driveMountStateEnd);
assert.match(
  driveMountStateBody,
  /await this\.probeRemoteDirectory\(state, state\.binding\.logicalPath\);/u,
  'Drive mount-state checks must not traverse every root directory page.',
);
assert.doesNotMatch(
  driveMountStateBody,
  /collectDirectoryChildrenBounded/u,
  'Drive mount-state checks must remain independent of full directory collection.',
);
const driveRestoreMountStart = driveSource.indexOf('  async restoreProjectMount(');
const driveRestoreMountEnd = driveSource.indexOf('\n  resolveLocalWorkingDirectory(', driveRestoreMountStart);
const driveRestoreMountBody = driveSource.slice(driveRestoreMountStart, driveRestoreMountEnd);
assert.match(
  driveRestoreMountBody,
  /await this\.probeRemoteDirectory\(state, state\.binding\.logicalPath\);/u,
  'Mount restoration must verify current Drive access even when the file tree is cached.',
);
assert.match(
  driveSource,
  /function selectRemoteTrackedFilePollPaths\([\s\S]*?const primaryPath = trackedFilePaths\[0\]![\s\S]*?nextCursor:/u,
  'Drive file polling must keep the primary file hot while rotating through additional tracked files.',
);
const driveSubscriptionStart = driveSource.indexOf('  subscribeToFileChanges(');
const driveSubscriptionEnd = driveSource.indexOf('\n  async getProjectMountState(', driveSubscriptionStart);
const driveSubscriptionBody = driveSource.slice(driveSubscriptionStart, driveSubscriptionEnd);
assert.match(
  driveSubscriptionBody,
  /let trackedFilePollCursor = 0;/u,
  'Drive file polling must retain a round-robin cursor across cycles.',
);
assert.doesNotMatch(
  driveSubscriptionBody,
  /\.slice\(0, MAX_REMOTE_POLLED_FILES\)/u,
  'Drive file polling must not permanently starve tracked files beyond the first batch.',
);

console.log('file-system loaded directory index performance contract passed.');
