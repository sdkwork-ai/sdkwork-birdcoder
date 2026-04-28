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

const createdAfterRefreshFailureWorkspaceId = await resolveLocalFolderImportWorkspaceId({
  createWorkspace: async (name: string, description?: string) => {
    fallbackCalls.push(`refresh-failed:${name}:${description ?? ''}`);
    return { id: ' workspace-created-after-refresh-failure ' };
  },
  effectiveWorkspaceId: '',
  refreshWorkspaces: async () => {
    throw new Error('workspace catalog is temporarily unavailable.');
  },
});

assert.equal(
  createdAfterRefreshFailureWorkspaceId,
  'workspace-created-after-refresh-failure',
  'local folder import must still create a default workspace when workspace refresh fails transiently.',
);

let createFailureRefreshAttempt = 0;
const recoveredAfterCreateFailureWorkspaceId = await resolveLocalFolderImportWorkspaceId({
  createWorkspace: async () => {
    throw new Error('default workspace was created by another window.');
  },
  effectiveWorkspaceId: '',
  refreshWorkspaces: async () => {
    createFailureRefreshAttempt += 1;
    return createFailureRefreshAttempt === 1
      ? []
      : [{ id: ' workspace-recovered-after-create-failure ' }];
  },
});

assert.equal(
  recoveredAfterCreateFailureWorkspaceId,
  'workspace-recovered-after-create-failure',
  'local folder import must refresh once after fallback workspace creation fails so multi-window creation races can converge.',
);

const concurrentFallbackCalls: string[] = [];
const sharedImportCreateWorkspace = async (name: string, description?: string) => {
  concurrentFallbackCalls.push(`${name}:${description ?? ''}`);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { id: ' workspace-concurrent-import-created ' };
};
const concurrentImportWorkspaceIds = await Promise.all([
  resolveLocalFolderImportWorkspaceId({
    createWorkspace: sharedImportCreateWorkspace,
    effectiveWorkspaceId: '',
    refreshWorkspaces: async () => [],
  }),
  resolveLocalFolderImportWorkspaceId({
    createWorkspace: sharedImportCreateWorkspace,
    effectiveWorkspaceId: '',
    refreshWorkspaces: async () => [],
  }),
]);

assert.deepEqual(
  concurrentImportWorkspaceIds,
  ['workspace-concurrent-import-created', 'workspace-concurrent-import-created'],
  'local folder import must share concurrent default workspace creation within one workspace service scope.',
);
assert.deepEqual(
  concurrentFallbackCalls,
  ['Default Workspace:Default workspace for local folder projects.'],
  'local folder import must not create duplicate default workspaces for concurrent imports in the same scope.',
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
