import assert from 'node:assert/strict';
import fs from 'node:fs';

const recoveryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/recovery.ts',
  import.meta.url,
);
const birdcoderAppModulePath = new URL(
  '../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx',
  import.meta.url,
);

const recoveryModule = await import(`${recoveryModulePath.href}?t=${Date.now()}`);

assert.equal(
  recoveryModule.normalizeWorkbenchRecoveryUserScope(' user-a '),
  'user-a',
  'workbench recovery user scope must trim authenticated user identifiers.',
);
assert.equal(
  recoveryModule.normalizeWorkbenchRecoveryUserScope(''),
  'anonymous',
  'workbench recovery user scope must use an explicit anonymous scope when there is no authenticated user.',
);

const userARecoverySnapshot = recoveryModule.buildWorkbenchRecoverySnapshot({
  userScope: 'user-a',
  sessionId: 'recovery-user-a-session',
  activeTab: 'code',
  activeWorkspaceId: 'workspace-user-a',
  activeProjectId: 'project-user-a',
  activeCodingSessionId: 'coding-session-user-a',
  cleanExit: false,
});

assert.deepEqual(
  recoveryModule.resolveWorkbenchRecoverySnapshotForUser(
    userARecoverySnapshot,
    'user-a',
  ),
  userARecoverySnapshot,
  'workbench recovery must preserve workspace/project/session selection for the same authenticated user.',
);

assert.deepEqual(
  recoveryModule.resolveWorkbenchRecoverySnapshotForUser(
    userARecoverySnapshot,
    'user-b',
  ),
  {
    ...recoveryModule.DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    userScope: 'user-b',
  },
  'workbench recovery must discard another user scope before it can drive workspace/project/session queries.',
);

const normalizedLegacySnapshot = recoveryModule.normalizeWorkbenchRecoverySnapshot({
  version: 1,
  sessionId: 'legacy-session',
  activeTab: 'terminal',
  activeWorkspaceId: 'legacy-workspace',
  activeProjectId: 'legacy-project',
  activeCodingSessionId: 'legacy-coding-session',
  cleanExit: false,
});

assert.equal(
  normalizedLegacySnapshot.userScope,
  'anonymous',
  'legacy recovery snapshots without an explicit user scope must normalize into the anonymous scope instead of being reused for authenticated users.',
);
assert.deepEqual(
  recoveryModule.resolveWorkbenchRecoverySnapshotForUser(
    normalizedLegacySnapshot,
    'user-authenticated',
  ),
  {
    ...recoveryModule.DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    userScope: 'user-authenticated',
  },
  'authenticated startup must not restore unscoped legacy workspace/project/session ids.',
);

const birdcoderAppSource = fs.readFileSync(birdcoderAppModulePath, 'utf8');
assert.match(
  birdcoderAppSource,
  /resolveWorkbenchRecoverySnapshotForUser\(/,
  'BirdcoderApp must resolve persisted workbench recovery through the current authenticated user scope before deriving workspace/project/session selections.',
);
assert.match(
  birdcoderAppSource,
  /previousWorkbenchUserScopeRef/,
  'BirdcoderApp must track authenticated user scope transitions and reset in-memory workbench selections before loading the next user project inventory.',
);
assert.match(
  birdcoderAppSource,
  /userScope:\s*currentWorkbenchUserScope/,
  'BirdcoderApp must persist recovery snapshots with the current authenticated user scope.',
);

console.log('workbench recovery user scope contract passed.');
