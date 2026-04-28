import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCodingSession,
  BirdCoderCoreWriteApiClient,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

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
  path: 'D:/workspace/native-delete',
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

const writeService = {
  async getProjectById(projectId: string) {
    return projectId === project.id ? structuredClone(project) : null;
  },
  async getProjects() {
    return [structuredClone(project)];
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

const coreWriteClient = {
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
} as unknown as BirdCoderCoreWriteApiClient;

const appAdminClient = {
  async getProject() {
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      rootPath: project.path,
      status: 'active',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  },
} as unknown as BirdCoderAppAdminApiClient;

const service = new ApiBackedProjectService({
  client: appAdminClient,
  coreWriteClient,
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
  'native code-engine transcript deletion must use the server core write API because Rust owns authoritative projection events.',
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
  'native code-engine transcript editing must use the server core write API because Rust owns authoritative projection events.',
);
assert.deepEqual(
  observedLocalDeletes,
  [
    {
      projectId: project.id,
      codingSessionId: codingSession.id,
      messageId: 'codex-native:session-1:authoritative:turn-1:user',
    },
  ],
  'without a core read client, native deletion should still update the local transcript mirror after the authority accepts the delete event.',
);
assert.deepEqual(
  observedLocalEdits,
  [
    {
      projectId: project.id,
      codingSessionId: codingSession.id,
      messageId: 'codex-native:session-1:authoritative:turn-1:user',
      content: 'Edited native authoritative message',
    },
  ],
  'without a core read client, native editing should still update the local transcript mirror after the authority accepts the edit event.',
);

console.log('api backed project service native message mutation contract passed.');
