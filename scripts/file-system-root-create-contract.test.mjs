import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const fileExplorerSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx');
const fileExplorerNameValidationSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorerNameValidation.ts',
);
const useFileSystemSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useFileSystem.ts');
const runtimeFileSystemSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
);
const tauriFileSystemSource = read(
  'crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs',
);

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

assert.match(
  fileExplorerNameValidationSource,
  /WINDOWS_RESERVED_DEVICE_NAME_PATTERN[\s\S]*con\|prn\|aux\|nul\|com[\s\S]*lpt/i,
  'FileExplorer names must reject Windows reserved device names consistently in browser and desktop modes.',
);

for (const requiredValidation of [
  "reason: 'empty'",
  "reason: 'dot-entry'",
  "reason: 'path-separator'",
  "reason: 'invalid-character'",
  "reason: 'trailing-dot-or-space'",
  "reason: 'windows-reserved-name'",
]) {
  assert.equal(
    fileExplorerNameValidationSource.includes(requiredValidation),
    true,
    `FileExplorer name validation must cover ${requiredValidation}.`,
  );
}

assert.match(
  fileExplorerSource,
  /const validation = validateFileExplorerNodeName\(inputValue\);[\s\S]*hasFileExplorerNameConflict\([\s\S]*await createNode\(newPath\);[\s\S]*await onRenameNode\(renamingNode\.path, newPath\);/,
  'FileExplorer must validate names, reject known sibling conflicts, and await create/rename callbacks before closing the draft.',
);

assert.match(
  fileExplorerSource,
  /isFileExplorerNameConflictError\(error\)[\s\S]*t\('code\.fileNameConflict'\)/,
  'FileExplorer must present backend name conflicts to the user instead of logging them only.',
);

assert.match(
  useFileSystemSource,
  /console\.error\("Failed to create file", error\);\s*throw error;/,
  'useFileSystem create-file failures must propagate to the FileExplorer feedback boundary.',
);

assert.match(
  useFileSystemSource,
  /console\.error\("Failed to create folder", error\);\s*throw error;/,
  'useFileSystem create-folder failures must propagate to the FileExplorer feedback boundary.',
);

assert.match(
  useFileSystemSource,
  /console\.error\("Failed to rename node", error\);\s*throw error;/,
  'useFileSystem rename failures must propagate to the FileExplorer feedback boundary.',
);

assert.match(
  runtimeFileSystemSource,
  /if \(await browserDirectoryEntryExists\(parentHandle, fileName\)\) \{\s*throw new Error\(`A browser-mounted entry already exists/,
  'Browser-mounted file creation must reject an existing target instead of reopening it with create=true.',
);

assert.match(
  runtimeFileSystemSource,
  /if \(await browserDirectoryEntryExists\(newParent, newName\)\) \{\s*throw new Error\(`A browser-mounted entry already exists/,
  'Browser-mounted rename must reject an existing destination instead of overwriting or merging it.',
);

assert.match(
  tauriFileSystemSource,
  /if new_path\.exists\(\) \{\s*return Err\(format!\(\s*"cannot rename mounted entry because the destination already exists:/,
  'Tauri rename must reject an existing destination on every desktop platform.',
);

console.log('file system root create contract passed.');
