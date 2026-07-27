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
const useFileSystemSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useFileSystem.ts');
const projectFileSystemRootContractSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/workbench-view.ts',
);
const fileSystemServiceInterfaceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts',
);
const workbenchFileSystemServiceProxySource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/interfaces/IFileSystemService.ts',
);
const runtimeFileSystemSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
);
const driveFileSystemSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/DriveSandboxProjectFileSystemService.ts',
);
const tauriFileSystemSource = read(
  'crates/sdkwork-birdcoder-tauri-host/src/commands/filesystem_commands.rs',
);

function requireSourceRegion(source, pattern, description) {
  const region = source.match(pattern)?.[0] ?? '';
  assert.notEqual(region, '', description);
  return region;
}

function assertTokensInOrder(source, tokens, description) {
  let searchFrom = 0;
  for (const token of tokens) {
    const tokenIndex = source.indexOf(token, searchFrom);
    assert.notEqual(tokenIndex, -1, `${description} Missing token: ${token}`);
    searchFrom = tokenIndex + token.length;
  }
}

const projectFileSystemRootContract = requireSourceRegion(
  projectFileSystemRootContractSource,
  /export interface ProjectFileSystemRoot \{[^}]+\}/,
  'The shared contracts package must expose a first-class ProjectFileSystemRoot descriptor.',
);

for (const field of [
  'displayName: string',
  "host: LocalFolderMountSource['type'] | 'server'",
  'projectId: string',
  'virtualPath: string',
]) {
  assert.equal(
    projectFileSystemRootContract.includes(field),
    true,
    `ProjectFileSystemRoot must expose ${field}.`,
  );
}

assert.doesNotMatch(
  projectFileSystemRootContract,
  /\b(?:handle|nativePath|path)\??\s*:/,
  'ProjectFileSystemRoot must not expose a browser handle or a host-native path.',
);

assert.match(
  fileSystemServiceInterfaceSource,
  /resolveProjectRoot\(projectId: string\): Promise<ProjectFileSystemRoot \| null>;/,
  'The stable file-system port must resolve the project root through the shared descriptor.',
);

assert.match(
  workbenchFileSystemServiceProxySource,
  /export type \{[\s\S]*IFileSystemService,[\s\S]*\} from '@sdkwork\/birdcoder-pc-infrastructure-runtime';/s,
  'Workbench must re-export the canonical file-system port instead of maintaining a second interface.',
);

const runtimeResolveProjectRoot = requireSourceRegion(
  runtimeFileSystemSource,
  /async resolveProjectRoot\(projectId: string\): Promise<ProjectFileSystemRoot \| null> \{[\s\S]*?(?=\n  private getFilesForSubjectScope\()/,
  'The local runtime provider must implement resolveProjectRoot.',
);
assert.match(
  runtimeResolveProjectRoot,
  /host: 'browser',[\s\S]*projectId: normalizedProjectId,[\s\S]*virtualPath: browserMount\.rootPath/,
  'Browser mounts must resolve to the shared virtual-root descriptor.',
);
assert.match(
  runtimeResolveProjectRoot,
  /host: 'tauri',[\s\S]*projectId: normalizedProjectId,[\s\S]*virtualPath: tauriMount\.rootVirtualPath/,
  'Tauri mounts must resolve to the same shared virtual-root descriptor.',
);

const driveResolveProjectRoot = requireSourceRegion(
  driveFileSystemSource,
  /async resolveProjectRoot\(projectId: string\): Promise<ProjectFileSystemRoot \| null> \{[\s\S]*?(?=\n  async loadDirectory\()/,
  'The Drive provider must implement resolveProjectRoot.',
);
assert.match(
  driveResolveProjectRoot,
  /host: 'server',[\s\S]*projectId: normalizedProjectId,[\s\S]*virtualPath: state\.context\.virtualRootPath/,
  'Cloud workspaces must resolve to the same shared virtual-root descriptor.',
);

assert.match(
  fileExplorerSource,
  /projectRootPath\?: string;/,
  'FileExplorer must receive the project virtual root as a first-class prop.',
);

assert.match(
  fileExplorerSource,
  /const rootCreationParentPath = useMemo\(\(\) => projectRootPath\.trim\(\), \[projectRootPath\]\);/,
  'FileExplorer must derive root creation from the explicit projectRootPath prop.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /resolveRootCreationParentPath|files\s*\[\s*0\s*\]/,
  'FileExplorer must not infer the project root from the first loaded tree node.',
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
  'useFileSystem must normalize mutation paths against the resolved project virtual root.',
);

assert.match(
  useFileSystemSource,
  /const resolveRequiredProjectRoot = useCallback\(async \([\s\S]*fileSystemService\.resolveProjectRoot\(targetProjectId\)/,
  'useFileSystem must resolve the first-class project root through the stable file-system port.',
);

assert.match(
  useFileSystemSource,
  /const ensureMountedProjectRoot = useCallback\(async \(targetProjectId: string\) => \{/,
  'useFileSystem must provide a shared mounted-root recovery helper for file mutations.',
);

assert.match(
  useFileSystemSource,
  /const \[projectRoot, setProjectRoot\] = useState<ProjectFileSystemRoot \| null>\(null\);[\s\S]*return \{\s*files,\s*projectRoot,/,
  'useFileSystem must retain and expose ProjectFileSystemRoot as first-class state.',
);

const createFileHandler = requireSourceRegion(
  useFileSystemSource,
  /const createFile = useCallback\(async \(path: string\) => \{[\s\S]*?(?=\n  const createFolder = useCallback)/,
  'useFileSystem must expose an identifiable create-file mutation boundary.',
);
assertTokensInOrder(
  createFileHandler,
  [
    'await ensureMountedProjectRoot(mutationProjectId);',
    'const resolvedProjectRoot = await resolveRequiredProjectRoot(mutationProjectId);',
    'const normalizedPath = resolveMountedMutationPath(',
    'resolvedProjectRoot.virtualPath,',
    'await fileSystemService.createFile(mutationProjectId, normalizedPath);',
  ],
  'File creation must recover the mount, resolve the root, normalize the mutation path, and then create.',
);

const createFolderHandler = requireSourceRegion(
  useFileSystemSource,
  /const createFolder = useCallback\(async \(path: string\) => \{[\s\S]*?(?=\n  const deleteFile = useCallback)/,
  'useFileSystem must expose an identifiable create-folder mutation boundary.',
);
assertTokensInOrder(
  createFolderHandler,
  [
    'await ensureMountedProjectRoot(mutationProjectId);',
    'const resolvedProjectRoot = await resolveRequiredProjectRoot(mutationProjectId);',
    'const normalizedPath = resolveMountedMutationPath(',
    'resolvedProjectRoot.virtualPath,',
    'await fileSystemService.createFolder(mutationProjectId, normalizedPath);',
  ],
  'Folder creation must recover the mount, resolve the root, normalize the mutation path, and then create.',
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
