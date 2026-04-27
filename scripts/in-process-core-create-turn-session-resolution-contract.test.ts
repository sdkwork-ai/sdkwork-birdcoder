import assert from 'node:assert/strict';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import type { CreateCodingSessionMessageInput } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const coreApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts',
  import.meta.url,
);
const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
  import.meta.url,
);

const { createBirdCoderInProcessCoreApiTransport } = await import(
  `${coreApiClientModulePath.href}?t=${Date.now()}`
);
const {
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
} = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);

const sessionCreatedAt = '2026-04-26T15:00:00.000Z';
const targetSession: BirdCoderCodingSession = {
  id: '101777127764351000',
  workspaceId: 'workspace-live',
  projectId: 'project-live',
  title: 'Live Session',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  createdAt: sessionCreatedAt,
  updatedAt: sessionCreatedAt,
  lastTurnAt: sessionCreatedAt,
  displayTime: 'Just now',
  messages: [],
};

const cachedWorkspaceProject: BirdCoderProject = {
  id: 'project-cached',
  workspaceId: 'workspace-cached',
  name: 'Cached Project',
  createdAt: '2026-04-26T14:00:00.000Z',
  updatedAt: '2026-04-26T14:00:00.000Z',
  codingSessions: [],
};

const liveProject: BirdCoderProject = {
  id: 'project-live',
  workspaceId: 'workspace-live',
  name: 'Live Project',
  createdAt: '2026-04-26T14:30:00.000Z',
  updatedAt: '2026-04-26T15:00:00.000Z',
  codingSessions: [targetSession],
};

const createdMessages: BirdCoderChatMessage[] = [];
const projectService = {
  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    if (workspaceId === 'workspace-cached') {
      return [structuredClone(cachedWorkspaceProject)];
    }
    if (workspaceId === 'workspace-live') {
      return [structuredClone(liveProject)];
    }
    return [structuredClone(cachedWorkspaceProject), structuredClone(liveProject)];
  },
  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    if (projectId === liveProject.id) {
      return structuredClone(liveProject);
    }
    if (projectId === cachedWorkspaceProject.id) {
      return structuredClone(cachedWorkspaceProject);
    }
    return null;
  },
  async createCodingSession() {
    throw new Error('not needed');
  },
  async updateCodingSession() {
    throw new Error('not needed');
  },
  async forkCodingSession() {
    throw new Error('not needed');
  },
  async deleteCodingSession() {
    throw new Error('not needed');
  },
  async deleteCodingSessionMessage() {
    throw new Error('not needed');
  },
  async renameCodingSession() {
    throw new Error('not needed');
  },
  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: CreateCodingSessionMessageInput,
  ): Promise<BirdCoderChatMessage> {
    assert.equal(projectId, liveProject.id);
    assert.equal(codingSessionId, targetSession.id);
    const createdMessage: BirdCoderChatMessage = {
      id: `message-${createdMessages.length + 1}`,
      codingSessionId,
      ...message,
      createdAt: '2026-04-26T15:01:00.000Z',
      timestamp: Date.parse('2026-04-26T15:01:00.000Z'),
    };
    createdMessages.push(createdMessage);
    return structuredClone(createdMessage);
  },
};

const transport = createBirdCoderInProcessCoreApiTransport({
  projectService,
});
const readClient = createBirdCoderGeneratedCoreReadApiClient({ transport });
const writeClient = createBirdCoderGeneratedCoreWriteApiClient({ transport });

await readClient.listCodingSessions({ workspaceId: 'workspace-cached' });

const turn = await writeClient.createCodingSessionTurn(targetSession.id, {
  requestKind: 'chat',
  inputSummary: 'Continue live session.',
});

assert.equal(turn.codingSessionId, targetSession.id);
assert.equal(createdMessages.length, 1);
assert.equal(createdMessages[0]?.content, 'Continue live session.');

console.log('in-process core create-turn session resolution contract passed.');
