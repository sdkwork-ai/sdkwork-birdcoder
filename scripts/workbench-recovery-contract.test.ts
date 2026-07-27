import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const recoveryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/recovery.ts',
  import.meta.url,
);

const {
  buildWorkbenchRecoverySnapshot,
  isWorkbenchRecoverySelectionResolutionReady,
  resolveStartupAgentSessionId,
  resolveStartupProjectId,
  resolveWorkbenchRecoveryPersistenceSelection,
} = await import(`${recoveryModulePath.href}?t=${Date.now()}`);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: '',
    currentProjectId: '',
    currentAgentSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeAgentSessionId: 'session-recovered',
    },
    hasProjectsFetched: false,
    hasWorkspacesFetched: false,
  }),
  {
    activeWorkspaceId: 'workspace-recovered',
    activeProjectId: 'project-recovered',
    activeAgentSessionId: 'session-recovered',
  },
  'Recovery persistence must preserve the previously recovered workspace/project/session ids until startup workspace loading finishes.',
);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: 'workspace-current',
    currentProjectId: '',
    currentAgentSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeAgentSessionId: 'session-recovered',
    },
    hasProjectsFetched: false,
    hasWorkspacesFetched: true,
  }),
  {
    activeWorkspaceId: 'workspace-current',
    activeProjectId: 'project-recovered',
    activeAgentSessionId: 'session-recovered',
  },
  'Recovery persistence must keep the recovered project/session ids intact while the selected workspace project list is still loading.',
);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: 'workspace-current',
    currentProjectId: '',
    currentAgentSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeAgentSessionId: 'session-recovered',
    },
    hasProjectsFetched: true,
    hasWorkspacesFetched: true,
  }),
  {
    activeWorkspaceId: 'workspace-current',
    activeProjectId: '',
    activeAgentSessionId: '',
  },
  'Recovery persistence must allow authoritative empty project/session selections once startup resolution is complete.',
);

assert.equal(
  isWorkbenchRecoverySelectionResolutionReady({
    currentWorkspaceId: 'workspace-current',
    hasProjectsFetched: false,
    hasWorkspacesFetched: true,
  }),
  false,
  'Recovery resolution cannot be considered ready while a selected workspace is still loading its projects.',
);

assert.equal(
  isWorkbenchRecoverySelectionResolutionReady({
    currentWorkspaceId: 'workspace-current',
    hasProjectsFetched: true,
    hasWorkspacesFetched: true,
  }),
  true,
  'Recovery resolution should be ready once the selected workspace project list has loaded.',
);

const startupRecoverySnapshot = buildWorkbenchRecoverySnapshot({
  activeWorkspaceId: 'workspace-recovered',
  activeProjectId: 'project-recovered',
  activeAgentSessionId: 'session-recovered',
});
assert.equal(
  resolveStartupProjectId({
    hasProjectsFetched: false,
    projects: [{ projectId: 'project-first' }],
    recoverySnapshot: startupRecoverySnapshot,
  }),
  'project-recovered',
  'Startup must retain a recovered Project id while its directed lookup is still pending.',
);
assert.equal(
  resolveStartupProjectId({
    hasProjectsFetched: true,
    projects: [{ projectId: 'project-first' }],
    recoverySnapshot: startupRecoverySnapshot,
  }),
  'project-first',
  'Startup may fall back to the first authoritative Project after the recovered Project lookup finishes missing.',
);
assert.equal(
  resolveStartupAgentSessionId({
    projectId: 'project-recovered',
    projects: [{ projectId: 'project-recovered', agentSessions: [] }],
    recoverySnapshot: startupRecoverySnapshot,
  }),
  'session-recovered',
  'Startup must retain a recovered Session id that still needs a directed SDK lookup.',
);

const birdcoderAppSource = readBirdcoderAppShellSource();
const useWorkspacesSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkspaces.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.equal(
  birdcoderAppSource.includes('resolveWorkbenchRecoveryPersistenceSelection('),
  true,
  'BirdcoderApp must resolve persisted recovery selection through the shared recovery helper so startup races cannot blank the last recovered session.',
);
assert.equal(
  birdcoderAppSource.includes('recoverySelectionResolutionReady'),
  true,
  'BirdcoderApp must gate recovery announcement timing on recovery selection readiness so it does not announce a partial workspace-only restore before projects load.',
);
assert.match(
  birdcoderAppSource,
  /preferredWorkspaceId:\s*normalizedRecoverySnapshot\.activeWorkspaceId/,
  'BirdcoderApp must pass the recovered Workspace id into Workspace startup selection.',
);
assert.match(
  birdcoderAppSource,
  /useProjects\(\{\s*isActive:\s*Boolean\(user\)\s*&&\s*isRecoveryHydrated/,
  'BirdcoderApp must not start its root Project inventory before local recovery hydration finishes.',
);
assert.equal(
  [...birdcoderAppSource.matchAll(/if \(!isRecoveryProjectInventoryReady\)/gu)].length,
  2,
  'BirdcoderApp must gate both Project and Session selection initialization on hydrated Project inventory.',
);
assert.match(
  useWorkspacesSource,
  /workspaceService\.getWorkspaceById\(/,
  'Workspace startup must use a directed SDK lookup when the recovered Workspace is outside the first page.',
);

console.log('workbench recovery contract passed.');
