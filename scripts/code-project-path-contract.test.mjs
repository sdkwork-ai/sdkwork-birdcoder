import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const codePageSharedPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageShared.tsx',
  import.meta.url,
);
const appContentPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx',
  import.meta.url,
);
const appMainBodyPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppMainBody.tsx',
  import.meta.url,
);
const sidebarPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
  import.meta.url,
);
const workspacePanelPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
  import.meta.url,
);
const workspacePanelTypesPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/codeEditorWorkspacePanel.types.ts',
  import.meta.url,
);
const codeServerDirectoryImportHookPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeServerDirectoryProjectImport.ts',
  import.meta.url,
);
const fileExplorerPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx',
  import.meta.url,
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const codePageSharedSource = fs.readFileSync(codePageSharedPath, 'utf8');
const appContentSource = fs.readFileSync(appContentPath, 'utf8');
const appMainBodySource = fs.readFileSync(appMainBodyPath, 'utf8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');
const workspacePanelSource = fs.readFileSync(workspacePanelPath, 'utf8');
const workspacePanelTypesSource = fs.readFileSync(workspacePanelTypesPath, 'utf8');
const codeServerDirectoryImportHookSource = fs.readFileSync(codeServerDirectoryImportHookPath, 'utf8');
const fileExplorerSource = fs.readFileSync(fileExplorerPath, 'utf8');
const serverDirectoryImportStart = codeServerDirectoryImportHookSource.indexOf(
  'return importSelectedProjectDirectory({',
);
const serverDirectoryImportEnd =
  serverDirectoryImportStart >= 0
    ? codeServerDirectoryImportHookSource.indexOf('    });', serverDirectoryImportStart)
    : -1;
const serverDirectoryImportBlock =
  serverDirectoryImportStart >= 0 && serverDirectoryImportEnd >= 0
    ? codeServerDirectoryImportHookSource.slice(
        serverDirectoryImportStart,
        serverDirectoryImportEnd,
      )
    : '';

assert.equal(
  /const handleNewProject = useCallback\(\s*\(\) => onRequestProjectCreation\(\),\s*\[onRequestProjectCreation\],\s*\);/s.test(codePageSource),
  true,
  'CodePage must delegate every new-project entry to the shell-owned project creation request.',
);

assert.equal(
  codePageSource.includes("selectFolderAndImportProject('New Project')"),
  false,
  'CodePage must not bypass the shared Create Project dialog with a direct directory import.',
);

assert.equal(
  codePageSource.includes("selectFolderAndImportProject(t('app.serverDirectory'))"),
  true,
  'The distinct Open Folder command must continue to use server-directory import.',
);

assert.equal(
  codePageSharedSource.includes(
    'onRequestProjectCreation: () => Promise<string | undefined>;',
  ),
  true,
  'CodePage must depend on a narrow asynchronous project creation command.',
);

assert.equal(
  (appMainBodySource.match(/onRequestProjectCreation=\{onRequestProjectCreation\}/g) ?? []).length,
  2,
  'AppMainBody must inject the same project creation command into Code and Studio.',
);

assert.equal(
  (appContentSource.match(/onRequestProjectCreation=\{handleOpenCreateProjectDialog\}/g) ?? []).length,
  2,
  'The Header popover and feature surfaces must share one shell-owned creation request.',
);

assert.equal(
  appContentSource.includes('<CreateProjectDialog'),
  true,
  'The application shell must remain the sole Create Project dialog owner.',
);

assert.equal(
  /CreateProjectDialog|birdcoder-pc-shell/u.test(codePageSource),
  false,
  'CodePage must not import the shell or its dialog implementation.',
);

assert.equal(
  sidebarSource.includes('await handleCreateProjectFromHeader();'),
  true,
  'Code Project Explorer header and root context menu must share one new-project handler.',
);

assert.equal(
  codeServerDirectoryImportHookSource.includes('importSelectedProjectDirectory({'),
  true,
  'Open Folder must import the selected Drive sandbox directory into the project record.',
);

assert.equal(
  codePageSource.includes('useCodeServerDirectoryProjectImport({')
    && codePageSource.includes('workspaceId,'),
  true,
  'CodePage must pass the shell-selected Workspace into the server-directory import boundary.',
);

assert.equal(
  codeServerDirectoryImportHookSource.includes(
    'workspaceId,',
  ),
  true,
  'CodePage server-directory imports must bind the selected Workspace id to the imported project.',
);

assert.equal(
  /^\s*createProject,\s*$/m.test(serverDirectoryImportBlock),
  false,
  'CodePage must not pass a workspace-unbound createProject function into server-directory import.',
);

assert.equal(
  /absolutePath|localWorkingDirectory|folderInfo\.path/u.test(serverDirectoryImportBlock),
  false,
  'Server-directory import must bind sandbox identifiers and must not project an OS path into the remote project contract.',
);

assert.equal(
  codePageSource.includes("const newProject = await createProject('New Project');"),
  false,
  'CodePage must not create fake "New Project" entries without first selecting a real directory.',
);

assert.equal(
  codePageSource.includes('/workspace/${project.name}'),
  false,
  'CodePage project actions must not fabricate a project path from remote project metadata.',
);

assert.equal(
  sidebarSource.includes('/workspace/${project.name}'),
  false,
  'Sidebar project actions must not fabricate /workspace/<name> paths for copy or explorer operations.',
);

assert.equal(
  workspacePanelTypesSource.includes('currentProjectPath?: string;'),
  false,
  'Code editor workspace panel must not accept an OS project path from the page layer.',
);

assert.equal(
  workspacePanelSource.includes('basePath={currentProjectPath}'),
  false,
  'File explorer must not receive a project OS path from the active remote project.',
);

assert.equal(
  workspacePanelSource.includes("/workspace/${currentProjectName || 'project'}"),
  false,
  'Code editor workspace panel must not pass a synthetic /workspace/<name> base path.',
);

assert.equal(
  fileExplorerSource.includes("t('code.openInFileExplorer')"),
  true,
  'File explorer context menus must expose the localized Open in File Explorer action.',
);

assert.equal(
  fileExplorerSource.includes("basePath = '/workspace/project'"),
  false,
  'File explorer must not default to a synthetic workspace root path.',
);

assert.equal(
  fileExplorerSource.includes('emitRevealProjectInFileManager'),
  true,
  'File explorer must request project reveal through the shell-owned device-mount event boundary.',
);

assert.equal(
  /\b(basePath|currentProjectPath)\b/.test(fileExplorerSource),
  false,
  'File explorer must not retain a project-root path prop after device-mount separation.',
);

console.log('code project path contract passed.');
