import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/workspaceBootstrap.ts',
  import.meta.url,
);

const { resolveEffectiveWorkspaceId } = await import(`${modulePath.href}?t=${Date.now()}`);

const selectedWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace must not run when the active workspace exists.');
  },
  currentWorkspaceId: ' workspace-active ',
  refreshWorkspaces: async () => {
    throw new Error('refreshWorkspaces must not run when the active workspace exists.');
  },
  workspaces: [
    { id: 'workspace-active' },
    { id: 'workspace-other' },
  ],
});

assert.equal(
  selectedWorkspaceId,
  'workspace-active',
  'startup workspace resolution must keep an already selected workspace when it still exists.',
);

const recoveredWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace must not run when recovery resolves a workspace.');
  },
  currentWorkspaceId: '',
  recoveryWorkspaceId: ' workspace-recovered ',
  refreshWorkspaces: async () => {
    throw new Error('refreshWorkspaces must not run when recovery resolves a workspace.');
  },
  workspaces: [
    { id: 'workspace-first' },
    { id: 'workspace-recovered' },
  ],
});

assert.equal(
  recoveredWorkspaceId,
  'workspace-recovered',
  'startup workspace resolution must prefer a valid recovered workspace before the first workspace.',
);

const firstWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace must not run when a workspace already exists.');
  },
  currentWorkspaceId: 'workspace-stale',
  recoveryWorkspaceId: 'workspace-missing',
  refreshWorkspaces: async () => {
    throw new Error('refreshWorkspaces must not run when local workspace list has a fallback.');
  },
  workspaces: [
    { id: ' workspace-first ' },
    { id: 'workspace-second' },
  ],
});

assert.equal(
  firstWorkspaceId,
  'workspace-first',
  'startup workspace resolution must select the first available workspace when no current or recovered workspace is valid.',
);

const refreshedWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async () => {
    throw new Error('createWorkspace must not run when refresh returns a workspace.');
  },
  currentWorkspaceId: '',
  refreshWorkspaces: async () => [{ id: ' workspace-refreshed ' }],
  workspaces: [],
});

assert.equal(
  refreshedWorkspaceId,
  'workspace-refreshed',
  'startup workspace resolution must refresh before creating a default workspace.',
);

const createCalls: string[] = [];
const createdWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async (name: string, description?: string) => {
    createCalls.push(`${name}:${description ?? ''}`);
    return { id: ' workspace-created ' };
  },
  currentWorkspaceId: '',
  refreshWorkspaces: async () => [],
  workspaces: [],
});

assert.equal(
  createdWorkspaceId,
  'workspace-created',
  'startup workspace resolution must create a default workspace when the workspace catalog is empty.',
);
assert.deepEqual(
  createCalls,
  ['Default Workspace:Default workspace for BirdCoder projects.'],
  'startup workspace resolution must use the standardized default workspace metadata.',
);

const createdAfterRefreshFailureWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async (name: string, description?: string) => {
    createCalls.push(`refresh-failed:${name}:${description ?? ''}`);
    return { id: ' workspace-created-after-refresh-failure ' };
  },
  currentWorkspaceId: '',
  refreshWorkspaces: async () => {
    throw new Error('workspace catalog is temporarily unavailable.');
  },
  workspaces: [],
});

assert.equal(
  createdAfterRefreshFailureWorkspaceId,
  'workspace-created-after-refresh-failure',
  'startup workspace resolution must still create a default workspace when the empty-catalog refresh fails transiently.',
);

let createFailureRefreshAttempt = 0;
const recoveredAfterCreateFailureWorkspaceId = await resolveEffectiveWorkspaceId({
  createWorkspace: async () => {
    throw new Error('default workspace was created by another window.');
  },
  currentWorkspaceId: '',
  refreshWorkspaces: async () => {
    createFailureRefreshAttempt += 1;
    return createFailureRefreshAttempt === 1
      ? []
      : [{ id: ' workspace-recovered-after-create-failure ' }];
  },
  workspaces: [],
});

assert.equal(
  recoveredAfterCreateFailureWorkspaceId,
  'workspace-recovered-after-create-failure',
  'startup workspace resolution must refresh once after default creation fails so multi-window creation races can converge.',
);

const concurrentCreateCalls: string[] = [];
const sharedCreateWorkspace = async (name: string, description?: string) => {
  concurrentCreateCalls.push(`shared:${name}:${description ?? ''}`);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { id: ' workspace-concurrent-created ' };
};
const concurrentWorkspaceIds = await Promise.all([
  resolveEffectiveWorkspaceId({
    createWorkspace: sharedCreateWorkspace,
    currentWorkspaceId: '',
    refreshWorkspaces: async () => [],
    workspaces: [],
  }),
  resolveEffectiveWorkspaceId({
    createWorkspace: sharedCreateWorkspace,
    currentWorkspaceId: '',
    refreshWorkspaces: async () => [],
    workspaces: [],
  }),
]);

assert.deepEqual(
  concurrentWorkspaceIds,
  ['workspace-concurrent-created', 'workspace-concurrent-created'],
  'concurrent startup workspace resolution must share the first default workspace creation instead of returning duplicate workspaces.',
);
assert.deepEqual(
  concurrentCreateCalls,
  ['shared:Default Workspace:Default workspace for BirdCoder projects.'],
  'concurrent startup workspace resolution must create the default workspace only once.',
);

const scopedConcurrentCreateCalls: string[] = [];
const firstScopedCreateWorkspace = async (name: string, description?: string) => {
  scopedConcurrentCreateCalls.push(`scope-a:${name}:${description ?? ''}`);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { id: ' workspace-scope-a-created ' };
};
const secondScopedCreateWorkspace = async (name: string, description?: string) => {
  scopedConcurrentCreateCalls.push(`scope-b:${name}:${description ?? ''}`);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { id: ' workspace-scope-b-created ' };
};
const scopedConcurrentWorkspaceIds = await Promise.all([
  resolveEffectiveWorkspaceId({
    createWorkspace: firstScopedCreateWorkspace,
    currentWorkspaceId: '',
    refreshWorkspaces: async () => [],
    workspaces: [],
  }),
  resolveEffectiveWorkspaceId({
    createWorkspace: secondScopedCreateWorkspace,
    currentWorkspaceId: '',
    refreshWorkspaces: async () => [],
    workspaces: [],
  }),
]);

assert.deepEqual(
  scopedConcurrentWorkspaceIds,
  ['workspace-scope-a-created', 'workspace-scope-b-created'],
  'concurrent startup workspace resolution must not share default creation promises across distinct workspace service scopes.',
);
assert.deepEqual(
  scopedConcurrentCreateCalls,
  [
    'scope-a:Default Workspace:Default workspace for BirdCoder projects.',
    'scope-b:Default Workspace:Default workspace for BirdCoder projects.',
  ],
  'distinct workspace service scopes must each create their own default workspace.',
);

await assert.rejects(
  () =>
    resolveEffectiveWorkspaceId({
      createWorkspace: async () => ({ id: '   ' }),
      currentWorkspaceId: '',
      refreshWorkspaces: async () => [],
      workspaces: [],
    }),
  /Default workspace is unavailable/,
  'startup workspace resolution must fail explicitly if default workspace creation returns no id.',
);

console.log('workspace effective selection contract passed.');
