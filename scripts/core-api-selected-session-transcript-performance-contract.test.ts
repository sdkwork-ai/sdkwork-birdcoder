import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBirdCoderInProcessCoreApiTransport } from '../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts';
import {
  createBirdCoderGeneratedCoreReadApiClient,
  type BirdCoderChatMessage,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const workspaceId = 'workspace-core-selected-transcript';
const projectId = 'project-core-selected-transcript';
const codingSessionId = 'session-core-selected-transcript';
const timestamp = '2026-04-29T09:00:00.000Z';

function buildMessage(id: string, content: string, createdAt: string): BirdCoderChatMessage {
  return {
    codingSessionId,
    content,
    createdAt,
    id,
    role: 'assistant',
    timestamp: Date.parse(createdAt),
  };
}

const transcriptMessages = [
  buildMessage('core-selected-message-1', 'first local transcript message', '2026-04-29T09:00:01.000Z'),
  buildMessage('core-selected-message-2', 'latest local transcript message', '2026-04-29T09:00:02.000Z'),
];

const inventorySession: BirdCoderCodingSession = {
  archived: false,
  createdAt: timestamp,
  displayTime: 'just now',
  engineId: 'codex',
  hostMode: 'desktop',
  id: codingSessionId,
  lastTurnAt: timestamp,
  messages: [],
  modelId: 'gpt-5.4',
  pinned: false,
  projectId,
  sortTimestamp: String(Date.parse(timestamp)),
  status: 'active',
  title: 'Core selected transcript',
  transcriptUpdatedAt: transcriptMessages.at(-1)?.createdAt ?? timestamp,
  unread: false,
  updatedAt: timestamp,
  workspaceId,
};

const hydratedSession: BirdCoderCodingSession = {
  ...inventorySession,
  messages: transcriptMessages,
};

const inventoryProject: BirdCoderProject = {
  archived: false,
  codingSessions: [inventorySession],
  createdAt: timestamp,
  id: projectId,
  name: 'Core selected transcript project',
  path: 'D:/workspace/core-selected-transcript',
  updatedAt: timestamp,
  workspaceId,
};

let transcriptReads = 0;
const projectService = {
  async getProjects() {
    return [structuredClone(inventoryProject)];
  },
  async getProjectById(candidateProjectId: string) {
    return candidateProjectId === projectId ? structuredClone(inventoryProject) : null;
  },
  async getCodingSessionTranscript(
    candidateProjectId: string,
    candidateCodingSessionId: string,
    options?: { expectedTranscriptUpdatedAt?: string | null },
  ) {
    transcriptReads += 1;
    assert.equal(candidateProjectId, projectId);
    assert.equal(candidateCodingSessionId, codingSessionId);
    assert.equal(options?.expectedTranscriptUpdatedAt, inventorySession.transcriptUpdatedAt);
    return structuredClone(hydratedSession);
  },
} as never;

const readClient = createBirdCoderGeneratedCoreReadApiClient({
  transport: createBirdCoderInProcessCoreApiTransport({
    projectService,
  }),
});

const nativeSession = await readClient.getNativeSession(codingSessionId);
assert.deepEqual(
  nativeSession.messages.map((message) => message.id),
  transcriptMessages.map((message) => message.id),
  'core.getNativeSession must hydrate the selected session transcript through the precise local transcript reader before mapping messages.',
);

const events = await readClient.listCodingSessionEvents(codingSessionId);
assert.deepEqual(
  events
    .filter((event) => event.kind === 'message.completed')
    .map((event) => event.payload.content),
  transcriptMessages.map((message) => message.content),
  'core.listCodingSessionEvents must build projection events from the hydrated selected-session transcript, not from the empty inventory shell.',
);
assert.equal(
  transcriptReads,
  2,
  'selected-session detail/event reads should use one precise transcript read per selected-session endpoint call.',
);

const coreApiClientSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts', import.meta.url),
  'utf8',
);

function readSwitchCaseBody(operationId: string): string {
  const caseStart = coreApiClientSource.indexOf(`case '${operationId}':`);
  assert.notEqual(caseStart, -1, `${operationId} case must exist.`);

  const nextCaseStart = coreApiClientSource.indexOf('\n        case ', caseStart + 1);
  assert.notEqual(nextCaseStart, -1, `${operationId} case boundary must be readable.`);

  return coreApiClientSource.slice(caseStart, nextCaseStart);
}

assert.match(
  coreApiClientSource,
  /getCodingSessionTranscriptById/,
  'coreApiClient must keep selected-session transcript hydration isolated from list endpoints.',
);
assert.doesNotMatch(
  readSwitchCaseBody('core.listNativeSessions'),
  /getCodingSessionTranscriptById/,
  'core.listNativeSessions must not hydrate message bodies while listing sessions.',
);
assert.doesNotMatch(
  readSwitchCaseBody('core.listCodingSessions'),
  /getCodingSessionTranscriptById/,
  'core.listCodingSessions must not hydrate message bodies while listing sessions.',
);

console.log('core API selected-session transcript performance contract passed.');
