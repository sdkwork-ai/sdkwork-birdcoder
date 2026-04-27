import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { upsertCodingSessionIntoCollection } from '../packages/sdkwork-birdcoder-commons/src/stores/projectsStore.ts';

const rootDir = process.cwd();
const projectsStoreSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'stores',
    'projectsStore.ts',
  ),
  'utf8',
);

assert.doesNotMatch(
  projectsStoreSource,
  /function cloneProjectMessages\(/,
  'projectsStore should not deep-clone full transcript arrays while reconciling project inventory snapshots.',
);

assert.match(
  projectsStoreSource,
  /function normalizeCodingSessionMessagesForStore\(/,
  'projectsStore should normalize transcripts through one store boundary before adopting message arrays.',
);

assert.match(
  projectsStoreSource,
  /deduplicateBirdCoderComparableChatMessages/,
  'projectsStore transcript normalization should use the shared chat-message deduplication helper.',
);

function buildMessage(overrides = {}) {
  return {
    id: 'message-1',
    codingSessionId: 'session-1',
    role: 'assistant',
    content: 'Ready.',
    createdAt: '2026-04-27T01:00:00.000Z',
    ...overrides,
  };
}

function buildCodingSession(overrides = {}) {
  return {
    id: 'session-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    title: 'Reuse Session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5-codex',
    createdAt: '2026-04-27T01:00:00.000Z',
    updatedAt: '2026-04-27T01:00:00.000Z',
    lastTurnAt: '2026-04-27T01:00:00.000Z',
    transcriptUpdatedAt: '2026-04-27T01:00:00.000Z',
    displayTime: 'Just now',
    messages: [],
    ...overrides,
  };
}

function buildProject(overrides = {}) {
  return {
    id: 'project-1',
    workspaceId: 'workspace-1',
    name: 'Reuse Project',
    createdAt: '2026-04-27T01:00:00.000Z',
    updatedAt: '2026-04-27T01:00:00.000Z',
    archived: false,
    codingSessions: [],
    ...overrides,
  };
}

const incomingMessages = [buildMessage()];
const insertedProjects = upsertCodingSessionIntoCollection(
  [buildProject()],
  'project-1',
  buildCodingSession({ messages: incomingMessages }),
);
const insertedSession = insertedProjects[0]?.codingSessions.find(
  (codingSession) => codingSession.id === 'session-1',
);

assert.equal(
  insertedSession?.messages,
  incomingMessages,
  'projectsStore should adopt clean incoming transcript arrays after normalization instead of rebuilding them.',
);

const existingMessages = [buildMessage()];
const refreshedMessages = [buildMessage()];
const refreshedProjects = upsertCodingSessionIntoCollection(
  [
    buildProject({
      codingSessions: [buildCodingSession({ messages: existingMessages })],
    }),
  ],
  'project-1',
  buildCodingSession({ messages: refreshedMessages }),
);
const refreshedSession = refreshedProjects[0]?.codingSessions.find(
  (codingSession) => codingSession.id === 'session-1',
);

assert.equal(
  refreshedSession?.messages,
  existingMessages,
  'projectsStore should reuse an existing transcript array when an authority refresh contains equivalent messages.',
);

const refreshedNativeSessionProjects = upsertCodingSessionIntoCollection(
  [
    buildProject({
      codingSessions: [buildCodingSession({ messages: existingMessages })],
    }),
  ],
  'project-1',
  buildCodingSession({
    messages: refreshedMessages,
    nativeSessionId: 'store-native-session',
  }),
);
const refreshedNativeSession = refreshedNativeSessionProjects[0]?.codingSessions.find(
  (codingSession) => codingSession.id === 'session-1',
);

assert.notEqual(
  refreshedNativeSession?.nativeSessionId,
  undefined,
  'projectsStore should adopt nativeSessionId-only authority updates instead of reusing a stale coding session object.',
);
assert.equal(
  refreshedNativeSession?.messages,
  existingMessages,
  'projectsStore should still reuse equivalent transcript arrays when adopting a nativeSessionId-only update.',
);

console.log('projects store message reuse contract passed.');
