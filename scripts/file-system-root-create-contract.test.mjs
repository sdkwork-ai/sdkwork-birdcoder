import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const fileExplorerSource = read('packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx');
const useFileSystemSource = read('packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts');

assert.match(
  fileExplorerSource,
  /function resolveRootCreationParentPath\(files: FileNode\[\]\): string \{/,
  'FileExplorer must resolve the correct root creation parent path from the file tree before creating root files.',
);

assert.match(
  fileExplorerSource,
  /const rootCreationParentPath = useMemo\(\(\) => resolveRootCreationParentPath\(files\), \[files\]\);/,
  'FileExplorer must memoize the resolved root creation parent path from the current file tree.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /setCreatingNode\(\{ parentPath: '', type: 'file' \}\);/,
  'FileExplorer must not create root files against an empty path when a mounted project root exists.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /setCreatingNode\(\{ parentPath: '', type: 'directory' \}\);/,
  'FileExplorer must not create root folders against an empty path when a mounted project root exists.',
);

assert.match(
  fileExplorerSource,
  /const startCreatingRootNode = useCallback\(\(type: 'file' \| 'directory'\) => \{[\s\S]*setCreatingNode\(\{ parentPath: rootCreationParentPath, type \}\);/,
  'FileExplorer root creation helper must target the resolved project root path.',
);

assert.match(
  fileExplorerSource,
  /startCreatingRootNode\('file'\);/,
  'FileExplorer must route root file creation through the resolved root creation helper.',
);

assert.match(
  fileExplorerSource,
  /startCreatingRootNode\('directory'\);/,
  'FileExplorer must route root folder creation through the resolved root creation helper.',
);

assert.match(
  useFileSystemSource,
  /function resolveMountedMutationPath\(path: string, mountedRootPath: string \| null\): string \{/,
  'useFileSystem must normalize mutation paths against the mounted project root before file operations.',
);

assert.match(
  useFileSystemSource,
  /const resolveProjectMountedRootPath = useCallback\(\(\): string \| null => \{/,
  'useFileSystem must resolve a stable mounted root path from either the loaded file tree or persisted project path.',
);

assert.match(
  useFileSystemSource,
  /const ensureMountedProjectRoot = useCallback\(async \(targetProjectId: string\) => \{/,
  'useFileSystem must provide a shared mounted-root recovery helper for file mutations.',
);

assert.match(
  useFileSystemSource,
  /const normalizedPath = resolveMountedMutationPath\(path, resolveProjectMountedRootPath\(\)\);\s*await ensureMountedProjectRoot\(mutationProjectId\);\s*await fileSystemService\.createFile\(mutationProjectId, normalizedPath\);/,
  'useFileSystem must ensure the project root is mounted before creating files.',
);

assert.match(
  useFileSystemSource,
  /const normalizedPath = resolveMountedMutationPath\(path, resolveProjectMountedRootPath\(\)\);\s*await ensureMountedProjectRoot\(mutationProjectId\);\s*await fileSystemService\.createFolder\(mutationProjectId, normalizedPath\);/,
  'useFileSystem must ensure the project root is mounted before creating folders.',
);

console.log('file system root create contract passed.');
