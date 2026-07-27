import assert from 'node:assert/strict';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/projectMountRecovery.ts',
  import.meta.url,
);

const {
  createIdleProjectMountRecoveryState,
  createFailedProjectMountRecoveryState,
  createProjectMountRecoveryStateFromDeviceMount,
  createRecoveredProjectMountRecoveryState,
  createRecoveringProjectMountRecoveryState,
  isProjectMountReadyForSessionSynchronization,
  resolveProjectMountRecoveryActions,
} = await import(`${modulePath.href}?t=${Date.now()}`);

assert.deepEqual(createIdleProjectMountRecoveryState(), {
  displayName: null,
  status: 'idle',
  message: null,
});

assert.deepEqual(createRecoveringProjectMountRecoveryState('sample-app'), {
  displayName: 'sample-app',
  status: 'recovering',
  message: null,
});

assert.deepEqual(createRecoveredProjectMountRecoveryState('sample-app'), {
  displayName: 'sample-app',
  status: 'recovered',
  message: null,
});

assert.deepEqual(createFailedProjectMountRecoveryState('sample-app'), {
  displayName: 'sample-app',
  status: 'failed',
  message: 'Unable to remount the local project folder. Re-import the folder to restore file access.',
});

for (const [mount, expected] of [
  [
    { displayName: 'sample-app', host: 'tauri', status: 'mounted' },
    { displayName: 'sample-app', status: 'recovered', message: null },
  ],
  [
    { displayName: 'sample-app', host: 'browser', status: 'recoverable' },
    { displayName: 'sample-app', status: 'recovered', message: null },
  ],
  [
    { displayName: 'sample-app', host: 'browser', status: 'permission_required' },
    {
      displayName: 'sample-app',
      status: 'permission_required',
      message: 'Select the folder again to restore files and local coding sessions.',
    },
  ],
  [
    { displayName: null, host: null, status: 'session_required' },
    {
      displayName: null,
      status: 'session_required',
      message: 'Sign in again before accessing the local project folder.',
    },
  ],
  [
    { displayName: null, host: null, status: 'mount_required' },
    {
      displayName: null,
      status: 'mount_required',
      message: 'Select this project\'s local folder to load files and local coding sessions.',
    },
  ],
] as const) {
  const state = createProjectMountRecoveryStateFromDeviceMount(mount);
  assert.deepEqual(state, expected);
  assert.equal(Object.hasOwn(state, 'path'), false);
}

assert.deepEqual(resolveProjectMountRecoveryActions('mount_required'), {
  chooseFolder: true,
  requiresAttention: true,
  retry: false,
});
assert.deepEqual(resolveProjectMountRecoveryActions('permission_required'), {
  chooseFolder: true,
  requiresAttention: true,
  retry: false,
});
assert.deepEqual(resolveProjectMountRecoveryActions('session_required'), {
  chooseFolder: false,
  requiresAttention: true,
  retry: false,
});
assert.deepEqual(resolveProjectMountRecoveryActions('failed'), {
  chooseFolder: true,
  requiresAttention: true,
  retry: true,
});

assert.equal(isProjectMountReadyForSessionSynchronization({
  displayName: 'empty-project',
  host: 'tauri',
  status: 'mounted',
}), true);
assert.equal(isProjectMountReadyForSessionSynchronization({
  displayName: 'empty-project',
  host: 'tauri',
  status: 'permission_required',
}), false);

console.log('project mount recovery contract passed.');
