import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const sharedInterfaceSource = read(
  'packages/sdkwork-birdcoder-commons/src/services/interfaces/IFileSystemService.ts',
);
const sharedHookSource = read('packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts');
const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const studioPageSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.match(
  sharedInterfaceSource,
  /LocalFolderMountSource/,
  'IFileSystemService must type folder mounts with LocalFolderMountSource.',
);

assert.doesNotMatch(
  sharedInterfaceSource,
  /mountFolder\(projectId: string, folderInfo: any\)/,
  'IFileSystemService must not keep mountFolder on any-typed folder payloads.',
);

assert.match(
  sharedHookSource,
  /mountFolder = useCallback\(async \(targetProjectId: string, folderInfo: LocalFolderMountSource\)/,
  'useFileSystem must own the typed folder-mount boundary for arbitrary project targets.',
);

for (const [label, source] of [
  ['CodePage', codePageSource],
  ['StudioPage', studioPageSource],
]) {
  assert.doesNotMatch(
    source,
    /fileSystemService/,
    `${label} must not access fileSystemService directly after the file-system boundary is unified.`,
  );

  assert.doesNotMatch(
    source,
    /as any/,
    `${label} must not bypass the file-system boundary with any casts.`,
  );

  assert.match(
    source,
    /mountFolder\(newProject\.id, folderInfo\)/,
    `${label} must mount opened folders through useFileSystem().mountFolder(...).`,
  );
}

console.log('page file system boundary contract passed.');
