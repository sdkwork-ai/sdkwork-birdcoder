import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useFileSystem.ts',
  ),
  'utf8',
);

const commonsInterfaceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'services',
    'interfaces',
    'IFileSystemService.ts',
  ),
  'utf8',
);

const infrastructureInterfaceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-infrastructure',
    'src',
    'services',
    'interfaces',
    'IFileSystemService.ts',
  ),
  'utf8',
);

const runtimeSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-infrastructure',
    'src',
    'services',
    'impl',
    'RuntimeFileSystemService.ts',
  ),
  'utf8',
);

assert.match(
  commonsInterfaceSource,
  /refreshDirectories\(\s*projectId: string,\s*paths: readonly string\[\]\s*\): Promise<IFileNode\[]>;/s,
  'The shared filesystem service contract must expose refreshDirectories so high-level hooks can refresh all loaded directories in one batch.',
);

assert.match(
  infrastructureInterfaceSource,
  /refreshDirectories\(\s*projectId: string,\s*paths: readonly string\[\]\s*\): Promise<IFileNode\[]>;/s,
  'The infrastructure filesystem service contract must expose refreshDirectories so runtime implementations can batch loaded-directory refreshes.',
);

assert.match(
  hookSource,
  /const data = await fileSystemService\.refreshDirectories\(\s*requestProjectId,\s*loadedDirectoryPaths,\s*\);/s,
  'useFileSystem.refreshFiles must call refreshDirectories once for loaded directories instead of refreshing each directory separately and then fetching the full tree again.',
);

assert.doesNotMatch(
  hookSource,
  /runBatchedTasks\(\s*loadedDirectoryPaths,\s*DIRECTORY_REFRESH_BATCH_SIZE,\s*async \(directoryPath\)\s*=>\s*fileSystemService\.refreshDirectory\(requestProjectId,\s*directoryPath\)\s*,?\s*\)/s,
  'useFileSystem.refreshFiles must not fan out into per-directory refreshDirectory calls because each refresh can rebuild the full tree.',
);

assert.match(
  runtimeSource,
  /async refreshDirectories\(\s*projectId: string,\s*paths: readonly string\[\]\s*\): Promise<IFileNode\[]>/s,
  'RuntimeFileSystemService must implement refreshDirectories so directory refreshes can be coalesced before returning a single updated tree.',
);

console.log('file system directory refresh batch performance contract passed.');
