import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const rootDir = process.cwd();
const selectedMessagesHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useSelectedCodingSessionMessages.ts',
  ),
  'utf8',
);

const workspaceId = 'workspace-api-backed-local-transcript';
const projectId = 'project-api-backed-local-transcript';
const codingSessionId = 'session-api-backed-local-transcript';
const timestamp = '2026-04-29T00:00:00.000Z';

const transcriptMessage: BirdCoderChatMessage = {
  codingSessionId,
  content: 'persisted local transcript message',
  createdAt: timestamp,
  id: 'message-api-backed-local-transcript',
  role: 'assistant',
  timestamp: Date.parse(timestamp),
};

const transcriptSession: BirdCoderCodingSession = {
  archived: false,
  createdAt: timestamp,
  displayTime: 'just now',
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: timestamp,
  messages: [transcriptMessage],
  modelId: 'gpt-5.4',
  pinned: false,
  projectId,
  sortTimestamp: String(Date.parse(timestamp)),
  status: 'active',
  title: 'API-backed local transcript',
  transcriptUpdatedAt: timestamp,
  unread: false,
  updatedAt: timestamp,
  workspaceId,
};

const transcriptProject: BirdCoderProject = {
  archived: false,
  codingSessions: [{ ...transcriptSession, messages: [] }],
  createdAt: timestamp,
  id: projectId,
  name: 'API-backed local transcript project',
  path: 'D:/workspace/api-backed-local-transcript',
  updatedAt: timestamp,
  workspaceId,
};

let delegatedTranscriptReads = 0;
const writeService = {
  async getProjects() {
    return [transcriptProject];
  },
  async getProjectById(candidateProjectId: string) {
    return candidateProjectId === projectId ? transcriptProject : null;
  },
  async getProjectByPath() {
    return null;
  },
  async getCodingSessionTranscript(candidateProjectId: string, candidateCodingSessionId: string) {
    delegatedTranscriptReads += 1;
    assert.equal(candidateProjectId, projectId);
    assert.equal(candidateCodingSessionId, codingSessionId);
    return transcriptSession;
  },
  async createProject() {
    throw new Error('createProject should not be called');
  },
  async renameProject() {
    throw new Error('renameProject should not be called');
  },
  async updateProject() {
    throw new Error('updateProject should not be called');
  },
  async deleteProject() {
    throw new Error('deleteProject should not be called');
  },
  async createCodingSession() {
    throw new Error('createCodingSession should not be called');
  },
  async renameCodingSession() {
    throw new Error('renameCodingSession should not be called');
  },
  async updateCodingSession() {
    throw new Error('updateCodingSession should not be called');
  },
  async forkCodingSession() {
    throw new Error('forkCodingSession should not be called');
  },
  async deleteCodingSession() {
    throw new Error('deleteCodingSession should not be called');
  },
  async addCodingSessionMessage() {
    throw new Error('addCodingSessionMessage should not be called');
  },
  async editCodingSessionMessage() {
    throw new Error('editCodingSessionMessage should not be called');
  },
  async deleteCodingSessionMessage() {
    throw new Error('deleteCodingSessionMessage should not be called');
  },
} satisfies IProjectService;

const service = new ApiBackedProjectService({
  client: {
    async listProjects() {
      throw new Error('remote project list should not be called for local transcript hydration');
    },
  } as unknown as BirdCoderAppAdminApiClient,
  writeService,
});

assert.equal(
  typeof service.getCodingSessionTranscript,
  'function',
  'ApiBackedProjectService must expose the selected-session local transcript reader.',
);

const hydratedSession = await service.getCodingSessionTranscript(
  projectId,
  codingSessionId,
);

assert.equal(delegatedTranscriptReads, 1);
assert.deepEqual(
  hydratedSession?.messages.map((message) => message.id),
  [transcriptMessage.id],
  'API-backed selected-session hydration must delegate to the local write service so session clicks render persisted local messages immediately.',
);

assert.doesNotMatch(
  selectedMessagesHookSource,
  /if \(\s*!isActive \|\|\s*!normalizedCodingSessionId \|\|\s*!coreReadService\s*\)/,
  'Selected-session hydration must not require coreReadService before local transcript hydration can run.',
);

assert.match(
  selectedMessagesHookSource,
  /const localTranscriptReader =\s*projectService\.getCodingSessionTranscript\?\.bind\(projectService\);[\s\S]*if \(\s*!isActive \|\|\s*!normalizedCodingSessionId \|\|\s*\(!coreReadService && !localTranscriptReader\)\s*\)/,
  'Selected-session hydration should run when either authority refresh or local transcript hydration is available.',
);

console.log('selected session API-backed local transcript contract passed.');
