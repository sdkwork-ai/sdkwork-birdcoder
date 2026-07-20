import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const recoveryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/recovery.ts',
  import.meta.url,
);
const authSessionScopeModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/authSessionScope.ts',
  import.meta.url,
);
const birdcoderAppSource = readBirdcoderAppShellSource();
const useProjectsSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
    import.meta.url,
  ),
  'utf8',
);
const useSelectedCodingSessionMessagesSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useSelectedCodingSessionMessages.ts',
    import.meta.url,
  ),
  'utf8',
);
const useWorkspacesSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkspaces.ts',
    import.meta.url,
  ),
  'utf8',
);

const recoveryModule = await import(`${recoveryModulePath.href}?t=${Date.now()}`);
const authSessionScopeModule = await import(
  `${authSessionScopeModulePath.href}?t=${Date.now()}`
);

assert.notEqual(
  authSessionScopeModule.buildBirdCoderAuthSessionInventoryScope('user-a', 1),
  authSessionScopeModule.buildBirdCoderAuthSessionInventoryScope('user-a', 2),
  'same-user authenticated session changes must receive distinct tenant-bound inventory scopes.',
);

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

assert.match(
  birdcoderAppSource,
  /resolveWorkbenchRecoverySnapshotForUser\(/,
  'BirdcoderApp must resolve persisted workbench recovery through the current authenticated user scope before deriving workspace/project/session selections.',
);
assert.match(
  birdcoderAppSource,
  /previousWorkbenchSessionScopeRef/,
  'BirdcoderApp must track authenticated session scope transitions and reset in-memory workbench selections before loading the next tenant-bound project inventory.',
);
assert.match(
  useWorkspacesSource,
  /buildBirdCoderAuthSessionInventoryScope\(user\?\.id, sessionRevision\)/,
  'workspace inventory must be scoped by authenticated session revision, not only user id.',
);
assert.match(
  useProjectsSource,
  /buildBirdCoderAuthSessionInventoryScope\(user\?\.id, sessionRevision\)/,
  'project inventory must be scoped by authenticated session revision, not only user id.',
);
assert.match(
  useSelectedCodingSessionMessagesSource,
  /buildBirdCoderAuthSessionInventoryScope\(\s*user\?\.id,\s*sessionRevision,?\s*\)/,
  'selected-session transcript hydration must write into the same authenticated-session project inventory scope.',
);
assert.match(
  birdcoderAppSource,
  /userScope:\s*currentWorkbenchUserScope/,
  'BirdcoderApp must persist recovery snapshots with the current authenticated user scope.',
);

console.log('workbench recovery user scope contract passed.');
