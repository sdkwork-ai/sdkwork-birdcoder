import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
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
const codeEffectiveWorkspaceHookPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEffectiveWorkspaceId.ts',
  import.meta.url,
);
const fileExplorerPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx',
  import.meta.url,
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');
const workspacePanelSource = fs.readFileSync(workspacePanelPath, 'utf8');
const workspacePanelTypesSource = fs.readFileSync(workspacePanelTypesPath, 'utf8');
const codeServerDirectoryImportHookSource = fs.readFileSync(codeServerDirectoryImportHookPath, 'utf8');
const codeEffectiveWorkspaceHookSource = fs.readFileSync(codeEffectiveWorkspaceHookPath, 'utf8');
const fileExplorerSource = fs.readFileSync(fileExplorerPath, 'utf8');
const serverDirectoryImportStart = codeServerDirectoryImportHookSource.indexOf(
  'const importedProject = await importSandboxDirectoryProject({',
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
  /const handleNewProject = (?:useCallback\()?async \(\) => \{/.test(codePageSource),
  true,
  'CodePage must keep a dedicated new-project handler.',
);

assert.equal(
  codePageSource.includes("selectFolderAndImportProject('New Project')"),
  true,
  'New project creation must delegate server-directory selection and workspace binding to the dedicated import hook.',
);

assert.equal(
  codeServerDirectoryImportHookSource.includes('importSandboxDirectoryProject({'),
  true,
  'New project creation must import the selected Drive sandbox directory into the project record.',
);

assert.equal(
  codeEffectiveWorkspaceHookSource.includes('useWorkspaces({ isActive: isVisible })'),
  true,
  'CodePage must gate workspace resolution by visibility before a server-directory import resolves its target workspace.',
);

assert.equal(
  codeServerDirectoryImportHookSource.includes(
    'const targetWorkspaceId = await resolveTargetWorkspaceId();',
  ),
  true,
  'CodePage server-directory imports must resolve a concrete workspace id before creating a project.',
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
  fileExplorerSource.includes('Open in File Explorer'),
  true,
  'File explorer context menus must expose an explicit "Open in File Explorer" action.',
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
