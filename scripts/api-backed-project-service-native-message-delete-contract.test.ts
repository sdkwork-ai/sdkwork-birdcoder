import type {
  BirdCoderAppRuntimeWriteSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';

const codingSession: BirdCoderCodingSession = {
  id: 'codex-native:session-1',
  workspaceId: 'workspace-native-delete',
  projectId: 'project-native-delete',
  title: 'Native Delete Contract',
  status: 'active',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
  nativeSessionId: 'codex-native:session-1',
  createdAt: '2026-04-28T08:00:00.000Z',
  updatedAt: '2026-04-28T08:00:00.000Z',
  lastTurnAt: '2026-04-28T08:00:00.000Z',
  transcriptUpdatedAt: '2026-04-28T08:00:00.000Z',
  displayTime: 'Just now',
  messages: [
    {
      id: 'codex-native:session-1:authoritative:turn-1:user',
      codingSessionId: 'codex-native:session-1',
      turnId: 'turn-1',
      role: 'user',
      content: 'Delete this native authoritative message',
      createdAt: '2026-04-28T08:00:01.000Z',
    },
  ],
};

const project: BirdCoderProject = {
  id: 'project-native-delete',
  workspaceId: 'workspace-native-delete',
  name: 'Native Delete Project',
  createdAt: '2026-04-28T08:00:00.000Z',
  updatedAt: '2026-04-28T08:00:00.000Z',
  codingSessions: [codingSession],
};

const observedCoreDeletes: Array<{ codingSessionId: string; messageId: string }> = [];
const observedCoreEdits: Array<{ codingSessionId: string; content: string; messageId: string }> = [];
const observedLocalDeletes: Array<{ codingSessionId: string; messageId: string; projectId: string }> = [];
const observedLocalEdits: Array<{
  codingSessionId: string;
  content: string | undefined;
  messageId: string;
  projectId: string;
}> = [];
const observedLocalSessionUpserts: Array<{
  codingSessionId: string;
  projectId: string;
}> = [];

const writeService = {
  async getProjectById(projectId: string) {
    return projectId === project.id ? structuredClone(project) : null;
  },
  async getProjects() {
    return [structuredClone(project)];
  },
  async upsertCodingSession(projectId: string, nextCodingSession: BirdCoderCodingSession) {
    assert.equal(projectId, project.id);
    assert.equal(nextCodingSession.id, codingSession.id);
    observedLocalSessionUpserts.push({
      projectId,
      codingSessionId: nextCodingSession.id,
    });
  },
  async deleteCodingSessionMessage(projectId: string, codingSessionId: string, messageId: string) {
    observedLocalDeletes.push({ projectId, codingSessionId, messageId });
  },
  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: { content?: string },
  ) {
    observedLocalEdits.push({ projectId, codingSessionId, messageId, content: updates.content });
  },
} as unknown as IProjectService;

const appRuntimeWriteClient = {
  async getCodingSession(codingSessionId: string) {
    assert.equal(codingSessionId, codingSession.id);
    return structuredClone(codingSession);
  },
  async listCodingSessions() {
    return [structuredClone(codingSession)];
  },
  async listCodingSessionEvents() {
    return [];
  },
  async editCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
    request: { content: string },
  ) {
    observedCoreEdits.push({ codingSessionId, messageId, content: request.content });
    return {
      id: messageId,
      codingSessionId,
      content: request.content,
    };
  },
  async deleteCodingSessionMessage(codingSessionId: string, messageId: string) {
    observedCoreDeletes.push({ codingSessionId, messageId });
    return {
      id: messageId,
      codingSessionId,
    };
  },
} as unknown as BirdCoderAppRuntimeWriteSdkApiClient;

const appClient = {
  async getProject() {
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      status: 'active',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  },
} as unknown as BirdCoderAppSdkApiClient;

const service = new ApiBackedProjectService({
  appClient: appClient,
  codingRuntimeClient: appRuntimeWriteClient,
  writeService,
});

await service.editCodingSessionMessage(
  project.id,
  codingSession.id,
  'codex-native:session-1:authoritative:turn-1:user',
  {
    content: 'Edited native authoritative message',
  },
);

await service.deleteCodingSessionMessage(
  project.id,
  codingSession.id,
  'codex-native:session-1:authoritative:turn-1:user',
);

assert.deepEqual(
  observedCoreDeletes,
  [
    {
      codingSessionId: codingSession.id,
      messageId: 'codex-native:session-1:authoritative:turn-1:user',
    },
  ],
  'native code-engine transcript deletion must use the server app runtime write API because Rust owns authoritative projection events.',
);
assert.deepEqual(
  observedCoreEdits,
  [
    {
      codingSessionId: codingSession.id,
      messageId: 'codex-native:session-1:authoritative:turn-1:user',
      content: 'Edited native authoritative message',
    },
  ],
  'native code-engine transcript editing must use the server app runtime write API because Rust owns authoritative projection events.',
);
assert.deepEqual(
  observedLocalDeletes,
  [],
  'with an injected app runtime, native deletion must converge through the authoritative session projection instead of a direct local message mutation.',
);
assert.deepEqual(
  observedLocalEdits,
  [],
  'with an injected app runtime, native editing must converge through the authoritative session projection instead of a direct local message mutation.',
);
assert.deepEqual(
  observedLocalSessionUpserts,
  [
    {
      projectId: project.id,
      codingSessionId: codingSession.id,
    },
    {
      projectId: project.id,
      codingSessionId: codingSession.id,
    },
  ],
  'each native message mutation must refresh the local session mirror from the authoritative runtime projection.',
);

console.log('api backed project service native message mutation contract passed.');
