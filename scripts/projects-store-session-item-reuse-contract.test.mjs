import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { upsertAgentSessionIntoCollection } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts';

const rootDir = process.cwd();
const projectsStoreSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    
    
    'sdkwork-birdcoder-pc-workbench',
    'src',
    'stores',
    'projectsStore.ts',
  ),
  'utf8',
);

assert.doesNotMatch(
  projectsStoreSource,
  /function cloneProjectItems\(/,
  'projectsStore should not deep-clone full Session Item arrays while reconciling project inventory snapshots.',
);

assert.match(
  projectsStoreSource,
  /function normalizeAgentSessionItemsForStore\(/,
  'projectsStore should normalize Agent Session Items through one store boundary before adopting item arrays.',
);

assert.match(
  projectsStoreSource,
  /deduplicateAgentSessionItemViews/,
  'projectsStore Session Item normalization should use the shared Agents item deduplication helper.',
);

assert.doesNotMatch(
  projectsStoreSource,
  /existingMessages|incomingMessages|scopedMessages|preserveEmptyMessages/,
  'The Agent Session store must not model canonical Session Items as IM messages.',
);

function buildItem(overrides = {}) {
  return {
    id: 'item-1',
    sessionId: 'session-1',
    role: 'assistant',
    content: 'Ready.',
    createdAt: '2026-04-27T01:00:00.000Z',
    ...overrides,
  };
}

function buildAgentSession(overrides = {}) {
  return {
    id: 'session-1',
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
    items: [],
    ...overrides,
  };
}

function buildProject(overrides = {}) {
  return {
    projectId: 'project-1',
    name: 'Reuse Project',
    createdAt: '2026-04-27T01:00:00.000Z',
    updatedAt: '2026-04-27T01:00:00.000Z',
    archived: false,
    agentSessions: [],
    ...overrides,
  };
}

const incomingItems = [buildItem()];
const insertedProjects = upsertAgentSessionIntoCollection(
  [buildProject()],
  'project-1',
  buildAgentSession({ items: incomingItems }),
);
const insertedSession = insertedProjects[0]?.agentSessions.find(
  (agentSession) => agentSession.id === 'session-1',
);

assert.equal(
  insertedSession?.items,
  incomingItems,
  'projectsStore should adopt clean incoming Session Item arrays after normalization instead of rebuilding them.',
);

const existingItems = [buildItem()];
const refreshedItems = [buildItem()];
const refreshedProjects = upsertAgentSessionIntoCollection(
  [
    buildProject({
      agentSessions: [buildAgentSession({ items: existingItems })],
    }),
  ],
  'project-1',
  buildAgentSession({ items: refreshedItems }),
);
const refreshedSession = refreshedProjects[0]?.agentSessions.find(
  (agentSession) => agentSession.id === 'session-1',
);

assert.equal(
  refreshedSession?.items,
  existingItems,
  'projectsStore should reuse an existing Session Item array when an authority refresh contains equivalent items.',
);

const refreshedNativeSessionProjects = upsertAgentSessionIntoCollection(
  [
    buildProject({
      agentSessions: [buildAgentSession({ items: existingItems })],
    }),
  ],
  'project-1',
  buildAgentSession({
    items: refreshedItems,
    nativeSessionId: 'store-native-session',
  }),
);
const refreshedNativeSession = refreshedNativeSessionProjects[0]?.agentSessions.find(
  (agentSession) => agentSession.id === 'session-1',
);

assert.notEqual(
  refreshedNativeSession?.nativeSessionId,
  undefined,
  'projectsStore should adopt nativeSessionId-only authority updates instead of reusing a stale coding session object.',
);
assert.equal(
  refreshedNativeSession?.items,
  existingItems,
  'projectsStore should still reuse equivalent Session Item arrays when adopting a nativeSessionId-only update.',
);

console.log('projects store Agent Session Item reuse contract passed.');
