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
      message: 'Folder permission is required. Select the folder again to continue.',
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
      message: 'Select a local folder to access project files on this device.',
    },
  ],
] as const) {
  const state = createProjectMountRecoveryStateFromDeviceMount(mount);
  assert.deepEqual(state, expected);
  assert.equal(Object.hasOwn(state, 'path'), false);
}

console.log('project mount recovery contract passed.');
