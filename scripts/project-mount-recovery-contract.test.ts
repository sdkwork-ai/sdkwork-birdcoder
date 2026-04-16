import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/projectMountRecovery.ts',
  import.meta.url,
);

const { resolveProjectMountRecoverySource } = await import(`${modulePath.href}?t=${Date.now()}`);
const {
  createFailedProjectMountRecoveryState,
  createRecoveredProjectMountRecoveryState,
  createRecoveringProjectMountRecoveryState,
} = await import(`${modulePath.href}?t=${Date.now()}`);

assert.equal(
  resolveProjectMountRecoverySource(undefined),
  null,
  'project mount recovery should ignore missing project paths.',
);

assert.equal(
  resolveProjectMountRecoverySource('   '),
  null,
  'project mount recovery should ignore blank project paths.',
);

assert.equal(
  resolveProjectMountRecoverySource('/sample-app'),
  null,
  'project mount recovery must not treat browser virtual root paths as recoverable desktop mounts.',
);

assert.deepEqual(
  resolveProjectMountRecoverySource('D:\\repos\\sample-app'),
  {
    type: 'tauri',
    path: 'D:\\repos\\sample-app',
  },
  'project mount recovery must restore persisted Windows desktop roots through the tauri mount path.',
);

assert.deepEqual(
  resolveProjectMountRecoverySource('D:/repos/sample-app'),
  {
    type: 'tauri',
    path: 'D:/repos/sample-app',
  },
  'project mount recovery must restore normalized Windows desktop roots through the tauri mount path.',
);

assert.deepEqual(
  resolveProjectMountRecoverySource('/Users/admin/sample-app'),
  {
    type: 'tauri',
    path: '/Users/admin/sample-app',
  },
  'project mount recovery must support POSIX desktop roots for future macOS and Linux hosts.',
);

assert.deepEqual(
  createRecoveringProjectMountRecoveryState('D:\\repos\\sample-app'),
  {
    status: 'recovering',
    path: 'D:\\repos\\sample-app',
    message: null,
  },
  'project mount recovery should expose structured recovering state while reopening persisted desktop roots.',
);

assert.deepEqual(
  createRecoveredProjectMountRecoveryState('D:\\repos\\sample-app'),
  {
    status: 'recovered',
    path: 'D:\\repos\\sample-app',
    message: null,
  },
  'project mount recovery should expose structured recovered state after remounting a persisted desktop root.',
);

assert.deepEqual(
  createFailedProjectMountRecoveryState(
    'D:\\repos\\sample-app',
    new Error('Permission denied'),
  ),
  {
    status: 'failed',
    path: 'D:\\repos\\sample-app',
    message: 'Permission denied',
  },
  'project mount recovery should preserve meaningful runtime errors for user-facing diagnostics.',
);

assert.deepEqual(
  createFailedProjectMountRecoveryState('D:\\repos\\sample-app', null),
  {
    status: 'failed',
    path: 'D:\\repos\\sample-app',
    message: 'Unable to remount the local project folder. Re-import the folder to restore file access.',
  },
  'project mount recovery should fall back to a stable remediation message when the runtime error is unknown.',
);

console.log('project mount recovery contract passed.');
