import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const runtimeFileSystemServicePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeFileSystemService.ts',
);

const source = fs.readFileSync(runtimeFileSystemServicePath, 'utf8');

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

console.log('file-system loaded directory index performance contract passed.');
