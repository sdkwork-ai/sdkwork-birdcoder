import assert from 'node:assert/strict';

const mirrorModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

const moduleVersion = Date.now();
const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

const projectService = new MockProjectService();
const upsertOperations: Array<{
  projectId: string;
  title: string;
}> = [];
let getProjectsCount = 0;
let getProjectMirrorSnapshotsCount = 0;
const originalUpsertCodingSession = projectService.upsertCodingSession?.bind(projectService);
const originalGetProjects = projectService.getProjects.bind(projectService);
const originalGetProjectMirrorSnapshots =
  projectService.getProjectMirrorSnapshots?.bind(projectService);

assert.ok(originalUpsertCodingSession, 'Mock project service should expose upsertCodingSession for mirror tests.');
assert.ok(
  originalGetProjectMirrorSnapshots,
  'Mock project service should expose getProjectMirrorSnapshots for mirror performance tests.',
);

projectService.getProjects = async (...args) => {
  getProjectsCount += 1;
  return await originalGetProjects(...args);
};

projectService.getProjectMirrorSnapshots = async (...args) => {
  getProjectMirrorSnapshotsCount += 1;
  return await originalGetProjectMirrorSnapshots!(...args);
};

projectService.upsertCodingSession = async (projectId, codingSession) => {
  upsertOperations.push({
    projectId,
    title: codingSession.title,
  });
  await originalUpsertCodingSession(projectId, codingSession);
};

const mirrorProject = await projectService.createProject('ws-1', 'Codex Sessions');
await projectService.updateProject(mirrorProject.id, {
  description: 'Managed BirdCoder mirror for imported local Codex sessions.',
});

await projectService.upsertCodingSession(mirrorProject.id, {
  id: 'codex-native:native-session-noop',
  workspaceId: 'ws-1',
  projectId: mirrorProject.id,
  title: 'Keep this mirrored session stable',
  status: 'completed',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'codex',
  createdAt: '2026-04-16T10:00:00.000Z',
  updatedAt: '2026-04-16T10:30:00.000Z',
  lastTurnAt: '2026-04-16T10:05:00.000Z',
  displayTime: 'Just now',
  pinned: false,
  archived: false,
  unread: false,
  messages: [
    {
      id: 'codex-native:native-session-noop:native-message:1',
      codingSessionId: 'codex-native:native-session-noop',
      role: 'user',
      content: 'Hydrate the unchanged mirror session.',
      createdAt: '2026-04-16T10:05:00.000Z',
      timestamp: Date.parse('2026-04-16T10:05:00.000Z'),
    },
  ],
});

upsertOperations.length = 0;
getProjectsCount = 0;
getProjectMirrorSnapshotsCount = 0;

const stableInventoryRecord = {
  id: 'codex-native:native-session-noop',
  workspaceId: '',
  projectId: '',
  title: 'Keep this mirrored session stable',
  status: 'completed' as const,
  hostMode: 'desktop' as const,
  engineId: 'codex' as const,
  modelId: 'codex',
  createdAt: '2026-04-16T10:00:00.000Z',
  updatedAt: '2026-04-16T10:30:00.000Z',
  lastTurnAt: '2026-04-16T10:05:00.000Z',
  transcriptUpdatedAt: '2026-04-16T10:05:00.000Z',
  kind: 'coding' as const,
  sortTimestamp: Date.parse('2026-04-16T10:30:00.000Z'),
};

await ensureNativeCodexSessionMirror({
  inventory: [stableInventoryRecord],
  projectService,
  workspaceId: 'ws-1',
});

assert.deepEqual(
  upsertOperations,
  [],
  'An unchanged native Codex session should not trigger a redundant mirror upsert.',
);
assert.equal(
  getProjectsCount,
  0,
  'An unchanged native Codex session should avoid the heavy getProjects path when the lightweight project snapshot interface is available.',
);
assert.equal(
  getProjectMirrorSnapshotsCount,
  1,
  'An unchanged native Codex session should load project state through a single snapshot read.',
);

await ensureNativeCodexSessionMirror({
  inventory: [
    {
      ...stableInventoryRecord,
      title: 'Renamed native session still requires summary upsert',
      updatedAt: '2026-04-16T11:00:00.000Z',
      sortTimestamp: Date.parse('2026-04-16T11:00:00.000Z'),
    },
  ],
  projectService,
  workspaceId: 'ws-1',
});

assert.deepEqual(
  upsertOperations.map((operation) => operation.title),
  ['Renamed native session still requires summary upsert'],
  'A real summary change must still perform a mirror upsert.',
);

console.log('native codex session noop upsert contract passed.');
