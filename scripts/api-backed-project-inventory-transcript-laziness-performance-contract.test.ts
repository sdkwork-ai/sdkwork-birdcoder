import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ApiBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IProjectService.ts';

const workspaceId = 'workspace-api-backed-inventory-laziness';
const projectId = 'project-api-backed-inventory-laziness';
const codingSessionId = 'session-api-backed-inventory-laziness';
const timestamp = '2026-04-29T12:00:00.000Z';
const transcriptTimestamp = '2026-04-29T12:00:02.000Z';

function buildMessage(id: string, createdAt: string): BirdCoderChatMessage {
  return {
    codingSessionId,
    content: id.repeat(128),
    createdAt,
    id,
    metadata: {
      nested: {
        id,
      },
    },
    role: 'assistant',
    timestamp: Date.parse(createdAt),
  };
}

const localMessages = [
  buildMessage('api-backed-inventory-message-1', '2026-04-29T12:00:01.000Z'),
  buildMessage('api-backed-inventory-message-2', transcriptTimestamp),
];

const localCodingSession: BirdCoderCodingSession = {
  archived: false,
  createdAt: timestamp,
  displayTime: 'just now',
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: transcriptTimestamp,
  messages: localMessages,
  modelId: 'gpt-5.4',
  pinned: false,
  projectId,
  runtimeStatus: 'completed',
  sortTimestamp: String(Date.parse(transcriptTimestamp)),
  status: 'active',
  title: 'API-backed inventory laziness',
  transcriptUpdatedAt: transcriptTimestamp,
  unread: false,
  updatedAt: transcriptTimestamp,
  workspaceId,
};

const localProject: BirdCoderProject = {
  archived: false,
  codingSessions: [localCodingSession],
  createdAt: timestamp,
  id: projectId,
  name: 'API-backed inventory laziness',
  path: 'D:/workspace/api-backed-inventory-laziness',
  updatedAt: transcriptTimestamp,
  workspaceId,
};

const projectSummary: BirdCoderProjectSummary = {
  createdAt: timestamp,
  id: projectId,
  name: localProject.name,
  rootPath: localProject.path,
  status: 'active',
  updatedAt: transcriptTimestamp,
  workspaceId,
};

const codingSessionSummary: BirdCoderCodingSessionSummary = {
  createdAt: timestamp,
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: transcriptTimestamp,
  modelId: 'gpt-5.4',
  nativeSessionId: undefined,
  projectId,
  runtimeStatus: 'completed',
  sortTimestamp: String(Date.parse(transcriptTimestamp)),
  status: 'active',
  title: localCodingSession.title,
  transcriptUpdatedAt: transcriptTimestamp,
  updatedAt: transcriptTimestamp,
  workspaceId,
};

let transcriptReads = 0;
const writeService = {
  async getProjects(candidateWorkspaceId?: string) {
    assert.equal(candidateWorkspaceId, workspaceId);
    return [structuredClone(localProject)];
  },
  async getProjectById(candidateProjectId: string) {
    return candidateProjectId === projectId ? structuredClone(localProject) : null;
  },
  async getProjectByPath() {
    return null;
  },
  async getCodingSessionTranscript(candidateProjectId: string, candidateCodingSessionId: string) {
    transcriptReads += 1;
    assert.equal(candidateProjectId, projectId);
    assert.equal(candidateCodingSessionId, codingSessionId);
    return structuredClone(localCodingSession);
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
    async getProject(candidateProjectId: string) {
      assert.equal(candidateProjectId, projectId);
      return projectSummary;
    },
    async listProjects(request?: { workspaceId?: string }) {
      assert.equal(request?.workspaceId, workspaceId);
      return [projectSummary];
    },
  } as unknown as BirdCoderAppAdminApiClient,
  coreReadClient: {
    async listCodingSessions(request?: { projectId?: string; workspaceId?: string }) {
      assert.equal(request?.workspaceId, workspaceId);
      if (request?.projectId && request.projectId !== projectId) {
        return [];
      }
      return [codingSessionSummary];
    },
  } as unknown as BirdCoderCoreReadApiClient,
  writeService,
});

const listedProjects = await service.getProjects(workspaceId);
const listedSession = listedProjects[0]?.codingSessions[0];
assert.ok(listedSession, 'API-backed project inventory must include the local session summary.');
assert.deepEqual(
  listedSession.messages,
  [],
  'API-backed project inventory must not carry local transcript messages even when the local transcript is fresher than authority.',
);

const projectDetail = await service.getProjectById(projectId);
const detailedSession = projectDetail?.codingSessions[0];
assert.ok(detailedSession, 'API-backed project detail must include the local session summary.');
assert.deepEqual(
  detailedSession.messages,
  [],
  'API-backed project detail must also stay metadata-only; selected-session messages load through getCodingSessionTranscript.',
);

const transcript = await service.getCodingSessionTranscript(projectId, codingSessionId);
assert.deepEqual(
  transcript?.messages.map((message) => message.id),
  localMessages.map((message) => message.id),
  'API-backed selected-session transcript reads must still delegate to the local transcript reader.',
);
assert.equal(transcriptReads, 1);

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts', import.meta.url),
  'utf8',
);

const mergeStart = source.indexOf('function mergeAuthoritativeProjectSessions(');
assert.notEqual(mergeStart, -1, 'ApiBackedProjectService must define mergeAuthoritativeProjectSessions.');
const mergeEnd = source.indexOf('\nfunction ', mergeStart + 1);
const mergeSource = source.slice(mergeStart, mergeEnd === -1 ? source.length : mergeEnd);

assert.match(
  mergeSource,
  /preserveLocalMessages:\s*false/,
  'API-backed project inventory merging must never preserve local transcript message bodies.',
);
assert.doesNotMatch(
  mergeSource,
  /shouldPreserveLocalCodingSessionMessages/,
  'API-backed project inventory merging must not branch into transcript preservation based on timestamp freshness.',
);

const indexStart = source.indexOf('function indexLocalCodingSessionsById(');
assert.notEqual(indexStart, -1, 'ApiBackedProjectService must define indexLocalCodingSessionsById.');
const indexEnd = source.indexOf('\nfunction ', indexStart + 1);
const indexSource = source.slice(indexStart, indexEnd === -1 ? source.length : indexEnd);
assert.doesNotMatch(
  indexSource,
  /toProjectCodingSession\(codingSession\)/,
  'API-backed project inventory indexing must not structuredClone local transcript messages before metadata-only merging.',
);

assert.match(
  source,
  /function normalizeProjectForInventory\(project: BirdCoderProject\): BirdCoderProject \{[\s\S]*preserveLocalMessages:\s*false/,
  'API-backed local fallback inventory normalization must strip transcript messages.',
);

console.log('api-backed project inventory transcript laziness performance contract passed.');
