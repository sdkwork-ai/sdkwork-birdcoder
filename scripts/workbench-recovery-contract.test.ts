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

const {
  isWorkbenchRecoverySelectionResolutionReady,
  resolveWorkbenchRecoveryPersistenceSelection,
} = await import(`${recoveryModulePath.href}?t=${Date.now()}`);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: '',
    currentProjectId: '',
    currentCodingSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeCodingSessionId: 'session-recovered',
    },
    hasProjectsFetched: false,
    hasWorkspacesFetched: false,
  }),
  {
    activeWorkspaceId: 'workspace-recovered',
    activeProjectId: 'project-recovered',
    activeCodingSessionId: 'session-recovered',
  },
  'Recovery persistence must preserve the previously recovered workspace/project/session ids until startup workspace loading finishes.',
);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: 'workspace-current',
    currentProjectId: '',
    currentCodingSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeCodingSessionId: 'session-recovered',
    },
    hasProjectsFetched: false,
    hasWorkspacesFetched: true,
  }),
  {
    activeWorkspaceId: 'workspace-current',
    activeProjectId: 'project-recovered',
    activeCodingSessionId: 'session-recovered',
  },
  'Recovery persistence must keep the recovered project/session ids intact while the selected workspace project list is still loading.',
);

assert.deepEqual(
  resolveWorkbenchRecoveryPersistenceSelection({
    currentWorkspaceId: 'workspace-current',
    currentProjectId: '',
    currentCodingSessionId: '',
    fallbackSnapshot: {
      activeWorkspaceId: 'workspace-recovered',
      activeProjectId: 'project-recovered',
      activeCodingSessionId: 'session-recovered',
    },
    hasProjectsFetched: true,
    hasWorkspacesFetched: true,
  }),
  {
    activeWorkspaceId: 'workspace-current',
    activeProjectId: '',
    activeCodingSessionId: '',
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

const birdcoderAppSource = fs.readFileSync(birdcoderAppModulePath, 'utf8');
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

console.log('workbench recovery contract passed.');
