import assert from 'node:assert/strict';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import { ApiBackedProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type { IProjectService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';
import type {
  BirdCoderAppRuntimeSdkApiClient,
  BirdCoderAppSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const project: BirdCoderProject = {
  id: 'project-send-preflight-performance',
  workspaceId: 'workspace-send-preflight-performance',
  name: 'Send Preflight Performance Project',
  createdAt: '2026-05-27T10:00:00.000Z',
  updatedAt: '2026-05-27T10:00:00.000Z',
  codingSessions: [],
};

const codingSession: BirdCoderCodingSession = {
  id: 'coding-session-send-preflight-performance',
  workspaceId: project.workspaceId,
  projectId: project.id,
  title: 'Send Preflight Performance Session',
  status: 'active',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
  createdAt: '2026-05-27T10:01:00.000Z',
  updatedAt: '2026-05-27T10:01:00.000Z',
  lastTurnAt: '2026-05-27T10:01:00.000Z',
  transcriptUpdatedAt: null,
  displayTime: 'Just now',
  messages: [],
};

let releaseSlowProjectDetail: () => void = () => undefined;
let slowProjectDetailStarted = false;
const slowProjectDetail = new Promise<void>((resolve) => {
  releaseSlowProjectDetail = resolve;
});
let createTurnStarted = false;
let mirrorMessageCount = 0;

const appClient = {
  async getProject(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['getProject']>>> {
    slowProjectDetailStarted = true;
    await slowProjectDetail;
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      status: 'active',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  },
  async listProjects(): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['listProjects']>>> {
    return [];
  },
  async deleteProject(): Promise<void> {
    throw new Error('not needed');
  },
} as unknown as BirdCoderAppSdkApiClient;

const codingRuntimeClient = {
  async createCodingSessionTurn(codingSessionId, request) {
    createTurnStarted = true;
    assert.equal(codingSessionId, codingSession.id);
    return {
      id: 'turn-send-preflight-performance',
      codingSessionId,
      runtimeId: request.runtimeId ?? 'runtime-send-preflight-performance',
      requestKind: request.requestKind,
      status: 'running',
      inputSummary: request.inputSummary,
      startedAt: '2026-05-27T10:02:00.000Z',
      completedAt: undefined,
    };
  },
  async getCodingSession(codingSessionId): Promise<BirdCoderCodingSessionSummary> {
    assert.equal(codingSessionId, codingSession.id);
    return {
      id: codingSession.id,
      workspaceId: codingSession.workspaceId,
      projectId: codingSession.projectId,
      title: codingSession.title,
      status: codingSession.status,
      hostMode: codingSession.hostMode,
      engineId: codingSession.engineId,
      modelId: codingSession.modelId,
      createdAt: codingSession.createdAt,
      updatedAt: codingSession.updatedAt,
      lastTurnAt: codingSession.lastTurnAt,
      transcriptUpdatedAt: codingSession.transcriptUpdatedAt,
      runtimeStatus: codingSession.runtimeStatus,
    };
  },
  async listCodingSessions(): Promise<BirdCoderCodingSessionSummary[]> {
    return [
      {
        id: codingSession.id,
        workspaceId: codingSession.workspaceId,
        projectId: codingSession.projectId,
        title: codingSession.title,
        status: codingSession.status,
        hostMode: codingSession.hostMode,
        engineId: codingSession.engineId,
        modelId: codingSession.modelId,
        createdAt: codingSession.createdAt,
        updatedAt: codingSession.updatedAt,
        lastTurnAt: codingSession.lastTurnAt,
        transcriptUpdatedAt: codingSession.transcriptUpdatedAt,
        runtimeStatus: codingSession.runtimeStatus,
      },
    ];
  },
  async listCodingSessionEvents() {
    return [];
  },
} satisfies Partial<BirdCoderAppRuntimeSdkApiClient> as unknown as BirdCoderAppRuntimeSdkApiClient;

const writeService = {
  async getProjects(): Promise<BirdCoderProject[]> {
    return [
      {
        ...project,
        codingSessions: [structuredClone(codingSession)],
      },
    ];
  },
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    if (projectId !== project.id) {
      return null;
    }
    return {
      ...project,
      codingSessions: [structuredClone(codingSession)],
    };
  },
  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'> &
      Partial<Pick<BirdCoderChatMessage, 'createdAt' | 'id'>>,
  ): Promise<BirdCoderChatMessage> {
    assert.equal(projectId, project.id);
    assert.equal(codingSessionId, codingSession.id);
    mirrorMessageCount += 1;
    return {
      id: message.id ?? `${codingSessionId}:turn-send-preflight-performance:user`,
      codingSessionId,
      role: message.role,
      content: message.content,
      turnId: message.turnId,
      createdAt: message.createdAt ?? '2026-05-27T10:02:00.000Z',
      metadata: message.metadata,
    };
  },
  async upsertCodingSession(): Promise<void> {
    return undefined;
  },
} as unknown as IProjectService;

const service = new ApiBackedProjectService({
  appClient,
  codingRuntimeClient,
  writeService,
});

const sendPromise = service.addCodingSessionMessage(project.id, codingSession.id, {
  role: 'user',
  content: 'Start quickly even if project detail hydration is slow.',
});
const sendRace = await Promise.race([
  sendPromise.then((message) => ({ kind: 'sent' as const, message })),
  new Promise<{ kind: 'blocked' }>((resolve) =>
    setTimeout(() => resolve({ kind: 'blocked' }), 25),
  ),
]);

assert.equal(
  sendRace.kind,
  'sent',
  'sending a message to an already mirrored coding session must create the remote engine turn before slow project detail hydration can block the response echo.',
);
assert.equal(
  slowProjectDetailStarted,
  false,
  'send preflight must use the local mirrored coding-session metadata instead of hydrating the whole project detail before createCodingSessionTurn.',
);
assert.equal(createTurnStarted, true);
assert.equal(mirrorMessageCount, 1);

releaseSlowProjectDetail();
const sentMessage = await sendPromise;
assert.equal(sentMessage.turnId, 'turn-send-preflight-performance');

console.log('api-backed project service send preflight performance contract passed.');
