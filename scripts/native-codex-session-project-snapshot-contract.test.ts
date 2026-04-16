import assert from 'node:assert/strict';
import type { IProjectService } from '../packages/sdkwork-birdcoder-commons/src/services/interfaces/IProjectService.ts';

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
const mirrorProject = await projectService.createProject('ws-1', 'Codex Sessions');
await projectService.updateProject(mirrorProject.id, {
  description: 'Managed BirdCoder mirror for imported local Codex sessions.',
});

await projectService.upsertCodingSession?.(mirrorProject.id, {
  id: 'codex-native:native-session-snapshot',
  workspaceId: 'ws-1',
  projectId: mirrorProject.id,
  title: 'Snapshot-backed native session',
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
      id: 'codex-native:native-session-snapshot:native-message:1',
      codingSessionId: 'codex-native:native-session-snapshot',
      role: 'assistant',
      content: 'Keep the lightweight project snapshot path.',
      createdAt: '2026-04-16T10:05:00.000Z',
      timestamp: Date.parse('2026-04-16T10:05:00.000Z'),
    },
  ],
});

let getProjectsCalls = 0;
let getProjectMirrorSnapshotsCalls = 0;
const originalGetProjects = projectService.getProjects.bind(projectService);

projectService.getProjects = async (...args) => {
  getProjectsCalls += 1;
  return await originalGetProjects(...args);
};

(projectService as typeof projectService & {
  getProjectMirrorSnapshots?: (workspaceId?: string) => Promise<unknown>;
}).getProjectMirrorSnapshots = async (workspaceId?: string) => {
  getProjectMirrorSnapshotsCalls += 1;
  const projects = await originalGetProjects(workspaceId);
  return projects.map((project) => ({
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    path: project.path,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archived: project.archived,
    codingSessions: project.codingSessions.map((session) => ({
      id: session.id,
      workspaceId: session.workspaceId,
      projectId: session.projectId,
      title: session.title,
      status: session.status,
      hostMode: session.hostMode,
      engineId: session.engineId,
      modelId: session.modelId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastTurnAt: session.lastTurnAt,
      displayTime: session.displayTime,
      pinned: session.pinned,
      archived: session.archived,
      unread: session.unread,
      messageCount: session.messages.length,
      nativeTranscriptUpdatedAt: session.messages[session.messages.length - 1]?.createdAt ?? null,
    })),
  }));
};

await ensureNativeCodexSessionMirror({
  inventory: [
    {
      id: 'codex-native:native-session-snapshot',
      workspaceId: '',
      projectId: '',
      title: 'Snapshot-backed native session',
      status: 'completed',
      hostMode: 'desktop',
      engineId: 'codex',
      modelId: 'codex',
      createdAt: '2026-04-16T10:00:00.000Z',
      updatedAt: '2026-04-16T10:30:00.000Z',
      lastTurnAt: '2026-04-16T10:05:00.000Z',
      transcriptUpdatedAt: '2026-04-16T10:05:00.000Z',
      kind: 'coding',
      sortTimestamp: Date.parse('2026-04-16T10:30:00.000Z'),
    },
  ],
  projectService: projectService as IProjectService,
  workspaceId: 'ws-1',
});

assert.equal(
  getProjectMirrorSnapshotsCalls,
  1,
  'Native Codex mirror should use the lightweight project snapshot interface when available.',
);
assert.equal(
  getProjectsCalls,
  0,
  'Native Codex mirror should not fall back to the heavy getProjects path when a project snapshot interface is available.',
);

console.log('native codex session project snapshot contract passed.');
