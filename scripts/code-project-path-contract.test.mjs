import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const sidebarPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
  import.meta.url,
);
const workspacePanelPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx',
  import.meta.url,
);
const workspacePanelTypesPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanel.types.ts',
  import.meta.url,
);
const codeLocalFolderImportHookPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/useCodeLocalFolderProjectImport.ts',
  import.meta.url,
);
const fileExplorerPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx',
  import.meta.url,
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');
const workspacePanelSource = fs.readFileSync(workspacePanelPath, 'utf8');
const workspacePanelTypesSource = fs.readFileSync(workspacePanelTypesPath, 'utf8');
const codeLocalFolderImportHookSource = fs.readFileSync(codeLocalFolderImportHookPath, 'utf8');
const fileExplorerSource = fs.readFileSync(fileExplorerPath, 'utf8');
const localFolderImportStart = codeLocalFolderImportHookSource.indexOf('return importLocalFolderProject({');
const localFolderImportEnd =
  localFolderImportStart >= 0
    ? codeLocalFolderImportHookSource.indexOf('    });', localFolderImportStart)
    : -1;
const localFolderImportBlock =
  localFolderImportStart >= 0 && localFolderImportEnd >= 0
    ? codeLocalFolderImportHookSource.slice(localFolderImportStart, localFolderImportEnd)
    : '';

assert.equal(
  /const handleNewProject = (?:useCallback\()?async \(\) => \{/.test(codePageSource),
  true,
  'CodePage must keep a dedicated new-project handler.',
);

assert.equal(
  codePageSource.includes('const folderInfo = await openLocalFolder();'),
  true,
  'New project creation must open a folder picker first so the project binds to a real directory.',
);

assert.equal(
  codeLocalFolderImportHookSource.includes('importLocalFolderProject({'),
  true,
  'New project creation must import the selected local folder into the project record.',
);

assert.equal(
  codeLocalFolderImportHookSource.includes('useWorkspaces({ isActive: isVisible })'),
  true,
  'CodePage local folder imports must be able to resolve a default workspace when no workspaceId prop is available.',
);

assert.equal(
  codeLocalFolderImportHookSource.includes('const targetWorkspaceId = await resolveLocalFolderImportWorkspaceId();'),
  true,
  'CodePage local folder imports must resolve a concrete workspace id before creating a project.',
);

assert.equal(
  /^\s*createProject,\s*$/m.test(localFolderImportBlock),
  false,
  'CodePage must not pass a workspace-unbound createProject function into local folder import.',
);

assert.equal(
  codePageSource.includes("const newProject = await createProject('New Project');"),
  false,
  'CodePage must not create fake "New Project" entries without first selecting a real directory.',
);

assert.equal(
  codePageSource.includes('/workspace/${project.name}'),
  false,
  'CodePage project path actions must use the real project.path instead of a synthetic /workspace/<name> path.',
);

assert.equal(
  sidebarSource.includes('/workspace/${project.name}'),
  false,
  'Sidebar project actions must not fabricate /workspace/<name> paths for copy or explorer operations.',
);

assert.equal(
  workspacePanelTypesSource.includes('currentProjectPath?: string;'),
  true,
  'Code editor workspace panel must accept the real current project path.',
);

assert.equal(
  workspacePanelSource.includes('basePath={currentProjectPath}'),
  true,
  'File explorer must receive the real project path from the active project.',
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

console.log('code project path contract passed.');
