import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';
import { createBirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import {
  type BirdCoderChatMessage,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

const workspaceId = 'workspace-app-runtime-selected-transcript';
const projectId = 'project-app-runtime-selected-transcript';
const codingSessionId = 'session-app-runtime-selected-transcript';
const runtimeLocationId = 'runtime-location-app-runtime-selected-transcript';
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
  buildMessage('app-runtime-selected-message-1', 'first local transcript message', '2026-04-29T09:00:01.000Z'),
  buildMessage('app-runtime-selected-message-2', 'latest local transcript message', '2026-04-29T09:00:02.000Z'),
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
  runtimeLocationId,
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

const appClient = createBirdCoderAppSdkApiClient({
  transport: createBirdCoderInProcessAppRuntimeTransport({
    projectService,
  }),
});

const events = await appClient.listCodingSessionEvents(codingSessionId);
assert.deepEqual(
  events
    .filter((event) => event.kind === 'message.completed')
    .map((event) => event.payload.content),
  transcriptMessages.map((message) => message.content),
  'app.listCodingSessionEvents must build projection events from the hydrated selected-session transcript, not from the empty inventory shell.',
);
assert.equal(
  transcriptReads,
  1,
  'coding-session event projection should perform one precise project transcript read.',
);

const appRuntimeTransportSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts', import.meta.url),
  'utf8',
);

function readSwitchCaseBody(operationId: string): string {
  const caseStart = appRuntimeTransportSource.indexOf(`case '${operationId}':`);
  assert.notEqual(caseStart, -1, `${operationId} case must exist.`);

  const nextCaseStart = appRuntimeTransportSource.indexOf('\n        case ', caseStart + 1);
  assert.notEqual(nextCaseStart, -1, `${operationId} case boundary must be readable.`);

  return appRuntimeTransportSource.slice(caseStart, nextCaseStart);
}

assert.match(
  appRuntimeTransportSource,
  /getCodingSessionTranscriptById/,
  'appRuntimeTransport must keep selected-session transcript hydration isolated from list endpoints.',
);
assert.doesNotMatch(
  appRuntimeTransportSource,
  /case 'nativeSessions\.(?:list|retrieve)'/,
  'appRuntimeTransport must not expose a second public native-session authority.',
);
assert.doesNotMatch(
  readSwitchCaseBody('codingSessions.list'),
  /getCodingSessionTranscriptById/,
  'codingSessions.list must not hydrate message bodies while listing sessions.',
);
assert.match(
  readSwitchCaseBody('codingSessions.events.list'),
  /getCodingSessionTranscriptById/,
  'codingSessions.events.list must hydrate the selected session transcript through the precise reader.',
);

console.log('app runtime selected-session transcript performance contract passed.');
