import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';
import type { IProjectSessionMirror } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectSessionMirror.ts';

const mirroredSessions: Array<{
  codingSession: BirdCoderCodingSession;
  projectId: string;
}> = [];

const codingSession: BirdCoderCodingSession = {
  id: 'codex-native:native-session-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: 'Resume imported native Codex session',
  status: 'paused',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'codex',
  createdAt: '2026-04-16T10:00:00.000Z',
  updatedAt: '2026-04-16T10:30:00.000Z',
  lastTurnAt: '2026-04-16T10:30:00.000Z',
  displayTime: 'Just now',
  pinned: false,
  archived: false,
  unread: false,
  messages: [],
};

const localProject: BirdCoderProject = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Codex Sessions',
  description: 'Managed BirdCoder mirror for imported local Codex sessions.',
  createdAt: '2026-04-16T10:00:00.000Z',
  updatedAt: '2026-04-16T10:30:00.000Z',
  codingSessions: [structuredClone(codingSession)],
};

const client = {
  async listProjects(): Promise<Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>> {
    return [];
  },
} as BirdCoderAppAdminApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [structuredClone(localProject)];
  },
} as IProjectService;

const codingSessionMirror: IProjectSessionMirror = {
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    mirroredSessions.push({
      codingSession: structuredClone(nextCodingSession),
      projectId,
    });
  },
};

const service = new ApiBackedProjectService({
  client,
  codingSessionMirror,
  writeService,
});

const visibleProjects = await service.getProjects('workspace-1');

assert.equal(
  visibleProjects.some((project) => project.id === 'project-1'),
  true,
  'api-backed project queries must preserve local-only mirror projects instead of dropping them when the server summary has not projected them yet.',
);

await service.upsertCodingSession('project-1', codingSession);

assert.deepEqual(mirroredSessions, [
  {
    codingSession,
    projectId: 'project-1',
  },
]);

console.log('api backed project service upsert contract passed.');
