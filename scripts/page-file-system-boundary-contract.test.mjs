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
const infrastructureInterfaceSource = read(
  'packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IFileSystemService.ts',
);
const sharedHookSource = read('packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts');
const appSource = read('src/App.tsx');
const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const studioPageSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.match(
  sharedInterfaceSource,
  /LocalFolderMountSource/,
  'IFileSystemService must type folder mounts with LocalFolderMountSource.',
);

assert.match(
  infrastructureInterfaceSource,
  /LocalFolderMountSource/,
  'Infrastructure IFileSystemService must type folder mounts with LocalFolderMountSource.',
);

assert.match(
  sharedInterfaceSource,
  /searchFiles\(\s*projectId: string,\s*options: WorkspaceFileSearchOptions,\s*\)/,
  'IFileSystemService must expose project-aware file search through a typed service boundary.',
);

assert.match(
  infrastructureInterfaceSource,
  /searchFiles\(\s*projectId: string,\s*options: WorkspaceFileSearchOptions,\s*\)/,
  'Infrastructure IFileSystemService must expose project-aware file search through a typed service boundary.',
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

assert.doesNotMatch(
  sharedHookSource,
  /\bcurrentProjectId\b/,
  'useFileSystem must not track project changes through render-phase mirror state.',
);

assert.doesNotMatch(
  sharedHookSource,
  /if \(projectId !== currentProjectId\)/,
  'useFileSystem must not reset selection by calling setState during render.',
);

assert.match(
  sharedHookSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*setIsLoading\(false\);[\s\S]*setIsLoadingContent\(false\);[\s\S]*\}, \[projectId\]\);/,
  'useFileSystem must clear stale loading indicators when switching projects.',
);

assert.match(
  sharedHookSource,
  /export function useFileSystem\(projectId: string, projectPath\?: string\)/,
  'useFileSystem must accept persisted project-path metadata so local mounts can recover after restart.',
);

assert.match(
  sharedHookSource,
  /from '\.\.\/workbench\/fileSystemRequestGuard';/,
  'useFileSystem must consume the shared file-system request guard module.',
);

assert.match(
  sharedHookSource,
  /from '\.\.\/workbench\/fileSelectionMutation';/,
  'useFileSystem must consume the shared file-selection mutation module.',
);

assert.match(
  sharedHookSource,
  /from '\.\.\/workbench\/fileSearch';/,
  'useFileSystem must consume the shared file-search module.',
);

assert.match(
  sharedHookSource,
  /from '\.\.\/workbench\/projectMountRecovery';/,
  'useFileSystem must consume the shared project-mount recovery helper when restoring local project roots.',
);

assert.match(
  sharedHookSource,
  /selectedFileRef = useRef<string \| null>\(null\)/,
  'useFileSystem must track the latest selected file in a ref for async race protection.',
);

assert.match(
  sharedHookSource,
  /requestGuardRef = useRef\(createFileSystemRequestGuardState\(projectId\)\)/,
  'useFileSystem must keep request-guard state inside a single ref.',
);

assert.match(
  sharedHookSource,
  /resetFileSystemRequestGuardState/,
  'useFileSystem must reset the shared request guard when switching projects.',
);

assert.match(
  sharedHookSource,
  /isProjectActiveForRequestGuard\(requestGuardRef\.current, candidateProjectId\)/,
  'useFileSystem must route project activity checks through the shared request guard.',
);

assert.ok(
  [...sharedHookSource.matchAll(/selectedFileRef\.current/g)].length >= 4,
  'useFileSystem async callbacks must use the latest selected file instead of stale closures.',
);

assert.match(
  sharedHookSource,
  /beginFileTreeRequest\(requestGuardRef\.current\)/,
  'useFileSystem must delegate file-tree request ordering to the shared guard module.',
);

assert.match(
  sharedHookSource,
  /resolveProjectMountRecoverySource\(projectPath\)/,
  'useFileSystem must derive recovery mount sources from persisted project metadata before loading files.',
);

assert.match(
  sharedHookSource,
  /await fileSystemService\.mountFolder\(requestProjectId, recoveryMountSource\)/,
  'useFileSystem must re-mount recoverable local project roots before reading the file tree.',
);

assert.match(
  sharedHookSource,
  /const \[mountRecoveryState, setMountRecoveryState\] = useState</,
  'useFileSystem must track structured project mount recovery state for user-facing recovery feedback.',
);

assert.match(
  sharedHookSource,
  /createRecoveringProjectMountRecoveryState\(/,
  'useFileSystem must expose a recovering mount state while reopening persisted desktop roots.',
);

assert.match(
  sharedHookSource,
  /createRecoveredProjectMountRecoveryState\(/,
  'useFileSystem must expose a recovered mount state after reopening a persisted desktop root.',
);

assert.match(
  sharedHookSource,
  /createFailedProjectMountRecoveryState\(/,
  'useFileSystem must expose a failed mount state instead of only logging recovery errors.',
);

assert.match(
  sharedHookSource,
  /return \{[\s\S]*mountRecoveryState,/,
  'useFileSystem must return mount recovery state so pages can surface restart recovery failures.',
);

assert.match(
  sharedHookSource,
  /beginFileContentRequest\(requestGuardRef\.current\)/,
  'useFileSystem must delegate file-content request ordering to the shared guard module.',
);

assert.match(
  sharedHookSource,
  /beginSearchRequest\(requestGuardRef\.current\)/,
  'useFileSystem must delegate search request ordering to the shared guard module.',
);

assert.match(
  sharedHookSource,
  /isLatestFileTreeRequestForGuard\(/,
  'useFileSystem must ignore stale same-project file-tree responses through the shared guard.',
);

assert.match(
  sharedHookSource,
  /isLatestFileContentRequestForGuard\(/,
  'useFileSystem must ignore stale same-project file-content responses through the shared guard.',
);

assert.match(
  sharedHookSource,
  /isLatestSearchRequestForGuard\(/,
  'useFileSystem must ignore stale same-project search responses through the shared guard.',
);

assert.match(
  sharedHookSource,
  /hasPendingSearchRequests/,
  'useFileSystem must derive dedicated search loading state from the shared request guard.',
);

assert.match(
  sharedHookSource,
  /fileSystemService\.searchFiles\(searchProjectId, \{/,
  'useFileSystem must delegate project search execution to the file-system service boundary.',
);

assert.match(
  sharedHookSource,
  /maxResults:/,
  'useFileSystem must cap file-search results before rendering them into the workspace UI.',
);

assert.match(
  sharedHookSource,
  /maxSnippetLength:/,
  'useFileSystem must cap file-search snippet length before rendering them into the workspace UI.',
);

assert.doesNotMatch(
  sharedHookSource,
  /readFileContent:\s*async/,
  'useFileSystem must not wire per-file content readers directly into search execution once the service boundary exists.',
);

assert.doesNotMatch(
  sharedHookSource,
  /const traverseAndSearch = async/,
  'useFileSystem must not keep inline recursive file-search execution once the shared search module exists.',
);

assert.match(
  sharedHookSource,
  /resolveSelectedFileAfterMutation\(\{/,
  'useFileSystem must resolve post-mutation file selection through the shared mutation helper.',
);

assert.doesNotMatch(
  sharedHookSource,
  /selectedFileRef\.current === oldPath/,
  'useFileSystem must not keep inline rename-selection logic after the shared mutation helper is introduced.',
);

assert.doesNotMatch(
  sharedHookSource,
  /selectedFileRef\.current\?\.startsWith\(`\$\{oldPath\}\/`\)/,
  'useFileSystem must not keep inline descendant rename logic after the shared mutation helper is introduced.',
);

assert.doesNotMatch(
  sharedHookSource,
  /selectedFileRef\.current\?\.startsWith\(`\$\{path\}\/`\)/,
  'useFileSystem must not keep inline delete-folder selection logic after the shared mutation helper is introduced.',
);

const searchFilesMatch = sharedHookSource.match(
  /const searchFiles = useCallback\(async \(query: string\): Promise<[^>]+> => \{[\s\S]*?\n  \}, \[/,
);
assert.ok(searchFilesMatch, 'useFileSystem must keep searchFiles as an isolated useCallback.');
const searchFilesSource = searchFilesMatch[0];

const mountFolderMatch = sharedHookSource.match(
  /const mountFolder = useCallback\(async \(targetProjectId: string, folderInfo: LocalFolderMountSource\) => \{[\s\S]*?\n  \}, \[/,
);
assert.ok(mountFolderMatch, 'useFileSystem must keep mountFolder as an isolated useCallback.');
const mountFolderSource = mountFolderMatch[0];

assert.doesNotMatch(
  searchFilesSource,
  /getFileContent\(/,
  'useFileSystem searchFiles must not read file contents directly once search is owned by the file-system service.',
);

assert.doesNotMatch(
  searchFilesSource,
  /readFileContent:/,
  'useFileSystem searchFiles must not build ad-hoc search readers once search is owned by the file-system service.',
);

assert.doesNotMatch(
  searchFilesSource,
  /beginFileTreeRequestVersion/,
  'useFileSystem searchFiles must not invalidate file-tree requests by reusing tree request ordering.',
);

assert.doesNotMatch(
  searchFilesSource,
  /setIsLoading\(/,
  'useFileSystem searchFiles must not mutate the shared tree loading flag.',
);

assert.doesNotMatch(
  searchFilesSource,
  /setIsLoadingContent\(/,
  'useFileSystem searchFiles must not mutate the file-content loading flag.',
);

assert.match(
  mountFolderSource,
  /createRecoveringProjectMountRecoveryState\(/,
  'useFileSystem mountFolder must expose a recovering state while retrying local folder access.',
);

assert.match(
  mountFolderSource,
  /createRecoveredProjectMountRecoveryState\(/,
  'useFileSystem mountFolder must expose a recovered state after reconnecting local folder access.',
);

assert.match(
  mountFolderSource,
  /createFailedProjectMountRecoveryState\(/,
  'useFileSystem mountFolder must restore failed mount state when a reconnect attempt fails.',
);

assert.match(
  mountFolderSource,
  /throw error;/,
  'useFileSystem mountFolder must rethrow mount failures so import and recovery actions can stop on real errors.',
);

for (const [label, source] of [
  ['App', appSource],
  ['CodePage', codePageSource],
  ['StudioPage', studioPageSource],
]) {
  assert.match(
    source,
    /importLocalFolderProject/,
    `${label} must use the shared local-folder project import helper instead of keeping duplicate import flow logic.`,
  );

  assert.doesNotMatch(
    source,
    /folderInfo\.path\.split/,
    `${label} must not keep inline folder-name parsing once the shared local-folder import helper exists.`,
  );
}

for (const [label, source] of [
  ['CodePage', codePageSource],
  ['StudioPage', studioPageSource],
]) {
  assert.match(
    source,
    /useFileSystem\(currentProjectId,\s*currentProject\?\.path\)/,
    `${label} must pass the persisted project path into useFileSystem so desktop project mounts can recover after restart.`,
  );

  assert.match(
    source,
    /mountRecoveryState,/,
    `${label} must read mount recovery state from useFileSystem so restart recovery failures can surface in the UI.`,
  );

  assert.match(
    source,
    /isMountRecoveryActionPending/,
    `${label} must track recovery action progress so repeated retry clicks cannot race.`,
  );

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
    /isSearchingFiles/,
    `${label} must propagate dedicated file-search loading state from useFileSystem.`,
  );
}

assert.doesNotMatch(
  appSource,
  /fileSystemService as any/,
  'App must not bypass the typed file-system boundary with any casts when importing local folders.',
);

for (const [label, source] of [
  ['CodeWorkspaceOverlays', read('packages/sdkwork-birdcoder-code/src/pages/CodeWorkspaceOverlays.tsx')],
  ['StudioWorkspaceOverlays', read('packages/sdkwork-birdcoder-studio/src/pages/StudioWorkspaceOverlays.tsx')],
]) {
  assert.match(
    source,
    /mountRecoveryState:/,
    `${label} must accept mount recovery state so restart recovery failures are visible in the workspace.`,
  );

  assert.match(
    source,
    /mountRecoveryState\.status === 'failed'/,
    `${label} must render a failure surface when persisted local project remounting fails.`,
  );

  assert.match(
    source,
    /mountRecoveryState\.status === 'recovering'/,
    `${label} must render an active recovery surface so startup remount progress is visible to the user.`,
  );

  assert.match(
    source,
    /onRetryMountRecovery:/,
    `${label} must accept a retry handler so users can retry reconnecting local project access.`,
  );

  assert.match(
    source,
    /onReimportProjectFolder:/,
    `${label} must accept a reimport handler so users can pick a replacement folder after recovery failure.`,
  );

  assert.match(
    source,
    /isMountRecoveryActionPending:/,
    `${label} must accept recovery action loading state so retry controls can be disabled during recovery.`,
  );

  assert.match(
    source,
    /isSearchingFiles: boolean;/,
    `${label} must receive file-search loading state from the hook instead of inventing its own async state.`,
  );

  assert.match(
    source,
    /if \(response\.status !== 'completed'\)/,
    `${label} must ignore stale file-search responses instead of treating them as real empty results.`,
  );

  assert.match(
    source,
    /response\.limitReached/,
    `${label} must surface truncated-search state instead of silently dropping excess results.`,
  );

  assert.doesNotMatch(
    source,
    /const \[isSearching, setIsSearching\]/,
    `${label} must not keep local ad-hoc search loading state after the hook exposes dedicated search loading.`,
  );
}

console.log('page file system boundary contract passed.');
