import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/localFolderProjectWorkspace.ts',
  import.meta.url,
);
const codeLocalFolderImportHookPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/useCodeLocalFolderProjectImport.ts',
  import.meta.url,
);
const appShellPath = new URL(
  '../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx',
  import.meta.url,
);

const { resolveLocalFolderImportWorkspaceId } = await import(
  `${modulePath.href}?t=${Date.now()}`,
);

const { readFileSync } = await import('node:fs');

const localFolderWorkspaceSource = readFileSync(modulePath, 'utf8');
const codeLocalFolderImportHookSource = readFileSync(codeLocalFolderImportHookPath, 'utf8');
const appShellSource = readFileSync(appShellPath, 'utf8');

const immediateWorkspaceId = await resolveLocalFolderImportWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace should not run when an effective workspace exists.');
  },
  effectiveWorkspaceId: ' workspace-existing ',
  refreshWorkspaces: async () => {
    throw new Error('refreshWorkspaces should not run when an effective workspace exists.');
  },
});

assert.equal(
  immediateWorkspaceId,
  'workspace-existing',
  'local folder import must use an already effective workspace id.',
);

const refreshedWorkspaceId = await resolveLocalFolderImportWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace should not run when refresh finds a workspace.');
  },
  effectiveWorkspaceId: '',
  refreshWorkspaces: async () => [{ id: ' workspace-refreshed ' }],
});

assert.equal(
  refreshedWorkspaceId,
  'workspace-refreshed',
  'local folder import must use a refreshed workspace before creating a fallback workspace.',
);

const fallbackCalls: string[] = [];
const createdWorkspaceId = await resolveLocalFolderImportWorkspaceId({
  createWorkspace: async (name: string, description?: string) => {
    fallbackCalls.push(`${name}:${description ?? ''}`);
    return { id: ' workspace-created ' };
  },
  effectiveWorkspaceId: '',
  refreshWorkspaces: async () => [],
});

assert.equal(
  createdWorkspaceId,
  'workspace-created',
  'local folder import must create a default workspace when the workspace catalog is empty.',
);
assert.deepEqual(
  fallbackCalls,
  ['Default Workspace:Default workspace for local folder projects.'],
  'local folder import must create the standardized default workspace fallback.',
);

await assert.rejects(
  () =>
    resolveLocalFolderImportWorkspaceId({
      createWorkspace: async () => ({ id: '   ' }),
      effectiveWorkspaceId: '',
      refreshWorkspaces: async () => [],
    }),
  /Default workspace is unavailable/,
  'local folder import must fail explicitly if fallback workspace creation returns no id.',
);

assert.match(
  codeLocalFolderImportHookSource,
  /from '@sdkwork\/birdcoder-commons';[\s\S]*resolveLocalFolderImportWorkspaceId/s,
  'CodePage local folder imports must use the shared workspace resolver from commons.',
);

assert.match(
  codeLocalFolderImportHookSource,
  /return \{[\s\S]*\.\.\.importedProject,[\s\S]*workspaceId: targetWorkspaceId,[\s\S]*\};/s,
  'CodePage local folder imports must return the concrete target workspace id with the imported project.',
);

assert.doesNotMatch(
  localFolderWorkspaceSource,
  /string\s*\|\s*number/,
  'local folder workspace identity must keep workspace ids as canonical strings, never numeric ids that can lose Long precision.',
);

assert.doesNotMatch(
  codeLocalFolderImportHookSource,
  /id:\s*string\s*\|\s*number/,
  'CodePage local folder imports must not reintroduce numeric workspace ids after the shared resolver standardized ids as strings.',
);

assert.doesNotMatch(
  codeLocalFolderImportHookSource,
  /function resolveCodeLocalFolderImportWorkspaceId|DEFAULT_LOCAL_FOLDER_IMPORT_WORKSPACE_NAME/,
  'CodePage must not keep a private local-folder workspace resolver after the shared commons helper exists.',
);

assert.match(
  appShellSource,
  /resolveLocalFolderImportWorkspaceId/,
  'App shell local folder imports must use the same shared workspace resolver as CodePage.',
);

assert.doesNotMatch(
  appShellSource,
  /Default workspace is unavailable\. Please wait for workspace initialization to complete\./,
  'App shell must not keep an inline no-workspace throw that bypasses default workspace creation.',
);

assert.match(
  readFileSync(new URL(
    '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
    import.meta.url,
  ), 'utf8'),
  /syncImportedProjectInBackground\(importedProject\.projectId,\s*importedProject\.workspaceId\)/,
  'CodePage must hydrate imported projects against the workspace that actually received the project.',
);

assert.doesNotMatch(
  readFileSync(new URL(
    '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
    import.meta.url,
  ), 'utf8'),
  /syncImportedProjectInBackground\([^,\n]+\);/,
  'CodePage must never call imported-project hydration without an explicit workspace id.',
);

console.log('code local folder import workspace contract passed.');
