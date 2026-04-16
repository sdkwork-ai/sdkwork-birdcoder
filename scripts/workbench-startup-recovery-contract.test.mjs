import assert from 'node:assert/strict';
import fs from 'node:fs';

const recoveryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/recovery.ts',
  import.meta.url,
);
const legacyAppPath = new URL('../src/App.tsx', import.meta.url);
const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);

const recoveryModule = await import(`${recoveryModulePath.href}?t=${Date.now()}`);

const {
  buildWorkbenchRecoveryAnnouncement,
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  normalizeWorkbenchRecoverySnapshot,
  resolveStartupCodingSessionId,
  resolveStartupProjectId,
  resolveStartupWorkspaceId,
} = recoveryModule;

const sharedInventoryRecord = {
  createdAt: '2026-04-15T18:30:00.000Z',
  engineId: 'codex',
  hostMode: 'desktop',
  id: 'coding-session-1',
  kind: 'coding',
  lastTurnAt: '2026-04-15T18:35:00.000Z',
  modelId: 'codex',
  sortTimestamp: Date.parse('2026-04-15T18:35:00.000Z'),
  status: 'active',
  title: 'Recovered Session',
  updatedAt: '2026-04-15T18:35:00.000Z',
};

assert.equal(DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT.activeTab, 'code');
assert.equal(DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT.cleanExit, true);
assert.equal(DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT.activeCodingSessionId, '');

const workspaces = [{ id: 'workspace-alpha' }, { id: 'workspace-bravo' }];
const alphaProjects = [
  {
    id: 'project-alpha-1',
    workspaceId: 'workspace-alpha',
    codingSessions: [{ id: 'coding-session-alpha-1' }, { id: 'coding-session-alpha-2' }],
  },
];
const bravoProjects = [
  {
    id: 'project-bravo-1',
    workspaceId: 'workspace-bravo',
    codingSessions: [{ id: 'coding-session-bravo-1' }],
  },
];
const nativeMirrorProjects = [
  {
    id: 'project-native-codex',
    workspaceId: 'workspace-alpha',
    codingSessions: [{ id: 'codex-native:native-session-1' }],
  },
];

const validRecoverySnapshot = normalizeWorkbenchRecoverySnapshot({
  activeCodingSessionId: 'coding-session-alpha-2',
  activeProjectId: 'project-alpha-1',
  activeTab: 'studio',
  activeWorkspaceId: 'workspace-alpha',
  cleanExit: false,
});

assert.equal(
  resolveStartupWorkspaceId({
    inventory: [
      {
        ...sharedInventoryRecord,
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
    ],
    recoverySnapshot: validRecoverySnapshot,
    workspaces,
  }),
  'workspace-alpha',
);
assert.equal(
  resolveStartupProjectId({
    inventory: [
      {
        ...sharedInventoryRecord,
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
    ],
    projects: alphaProjects,
    recoverySnapshot: validRecoverySnapshot,
    workspaceId: 'workspace-alpha',
  }),
  'project-alpha-1',
);
assert.equal(
  resolveStartupCodingSessionId({
    inventory: [
      {
        ...sharedInventoryRecord,
        id: 'coding-session-bravo-1',
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
    ],
    projects: alphaProjects,
    recoverySnapshot: validRecoverySnapshot,
    projectId: 'project-alpha-1',
  }),
  'coding-session-alpha-2',
);
assert.equal(
  buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: validRecoverySnapshot,
    activeWorkspaceId: 'workspace-alpha',
    activeProjectId: 'project-alpha-1',
    activeCodingSessionId: 'coding-session-alpha-2',
  }),
  'Recovered previous coding session after the last unexpected shutdown.',
);

const invalidRecoverySnapshot = normalizeWorkbenchRecoverySnapshot({
  activeCodingSessionId: 'missing-coding-session',
  activeProjectId: 'missing-project',
  activeTab: 'vip',
  activeWorkspaceId: 'missing-workspace',
  cleanExit: false,
});

assert.equal(
  resolveStartupWorkspaceId({
    inventory: [
      {
        ...sharedInventoryRecord,
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
    ],
    recoverySnapshot: invalidRecoverySnapshot,
    workspaces,
  }),
  'workspace-bravo',
);
assert.equal(
  resolveStartupProjectId({
    inventory: [
      {
        ...sharedInventoryRecord,
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
    ],
    projects: bravoProjects,
    recoverySnapshot: invalidRecoverySnapshot,
    workspaceId: 'workspace-bravo',
  }),
  'project-bravo-1',
);
assert.equal(
  resolveStartupCodingSessionId({
    inventory: [
      {
        ...sharedInventoryRecord,
        id: 'coding-session-bravo-1',
        projectId: 'project-bravo-1',
        workspaceId: 'workspace-bravo',
      },
      {
        id: 'terminal-session-1',
        kind: 'terminal',
        profileId: 'powershell',
        cwd: 'D:/workspace',
        commandHistory: [],
        recentOutput: [],
        updatedAt: Date.parse('2026-04-15T18:35:00.000Z'),
        sortTimestamp: Date.parse('2026-04-15T18:35:00.000Z'),
        title: 'Terminal',
        workspaceId: 'workspace-bravo',
        projectId: 'project-bravo-1',
        status: 'idle',
        lastExitCode: null,
      },
    ],
    projects: bravoProjects,
    recoverySnapshot: invalidRecoverySnapshot,
    projectId: 'project-bravo-1',
  }),
  'coding-session-bravo-1',
);
assert.equal(
  buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: invalidRecoverySnapshot,
    activeWorkspaceId: 'workspace-bravo',
    activeProjectId: 'project-bravo-1',
    activeCodingSessionId: '',
  }),
  'Recovered previous project after the last unexpected shutdown.',
);

assert.equal(
  resolveStartupWorkspaceId({
    inventory: [],
    recoverySnapshot: DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    workspaces,
  }),
  'workspace-alpha',
);
assert.equal(
  resolveStartupProjectId({
    inventory: [],
    projects: alphaProjects,
    recoverySnapshot: DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    workspaceId: 'workspace-alpha',
  }),
  'project-alpha-1',
);
assert.equal(
  resolveStartupProjectId({
    inventory: [],
    projects: nativeMirrorProjects,
    recoverySnapshot: normalizeWorkbenchRecoverySnapshot({
      activeCodingSessionId: 'codex-native:native-session-1',
      activeProjectId: '',
      activeWorkspaceId: 'workspace-alpha',
      activeTab: 'code',
      cleanExit: false,
    }),
    workspaceId: 'workspace-alpha',
  }),
  'project-native-codex',
);
assert.equal(
  resolveStartupCodingSessionId({
    inventory: [],
    projects: alphaProjects,
    recoverySnapshot: DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    projectId: 'project-alpha-1',
  }),
  'coding-session-alpha-1',
);
assert.equal(
  buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    activeWorkspaceId: 'workspace-alpha',
    activeProjectId: 'project-alpha-1',
    activeCodingSessionId: 'coding-session-alpha-1',
  }),
  null,
);

const legacyAppSource = fs.readFileSync(legacyAppPath, 'utf8');
const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');
assert.equal(
  legacyAppSource.includes("useState<string>('ws-1')"),
  false,
  'legacy app should no longer hardcode ws-1 as the startup workspace',
);
assert.equal(
  legacyAppSource.includes("useState<string>('')"),
  true,
  'legacy app should start from empty workspace/project state and let recovery resolve selection',
);
assert.equal(
  legacyAppSource.includes('usePersistedState'),
  true,
  'legacy app should persist workbench recovery context',
);
assert.equal(
  legacyAppSource.includes('resolveStartupWorkspaceId'),
  true,
  'legacy app should resolve startup workspace through the shared recovery module',
);
assert.equal(
  legacyAppSource.includes('resolveStartupProjectId'),
  true,
  'legacy app should resolve startup project through the shared recovery module',
);
assert.equal(
  legacyAppSource.includes('resolveStartupCodingSessionId'),
  true,
  'legacy app should resolve startup coding session through the shared recovery module',
);
assert.equal(
  legacyAppSource.includes('activeCodingSessionId'),
  true,
  'legacy app should persist active coding session recovery state',
);
assert.equal(
  legacyAppSource.includes('buildWorkbenchRecoveryAnnouncement'),
  true,
  'legacy app should derive a recovery announcement from the shared recovery module',
);
assert.equal(
  legacyAppSource.includes('ensureNativeCodexSessionMirror'),
  true,
  'legacy app should mirror discovered native Codex sessions into a real project surface before recovery resolution completes',
);
assert.equal(
  codePageSource.includes('initialCodingSessionId'),
  true,
  'CodePage should accept a recovered coding session id',
);
assert.equal(
  codePageSource.includes('onCodingSessionChange'),
  true,
  'CodePage should report coding session selection back to the app recovery owner',
);
assert.equal(
  studioPageSource.includes('initialCodingSessionId'),
  true,
  'StudioPage should accept a recovered coding session id',
);
assert.equal(
  studioPageSource.includes('onCodingSessionChange'),
  true,
  'StudioPage should report coding session selection back to the app recovery owner',
);

console.log('workbench startup recovery contract passed.');
