import assert from 'node:assert/strict';
import { listAuthorityBackedCodingSessionInventoryPage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionInventory.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';
import { createBirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import type { BirdCoderCodingSession } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

const workspaceId = 'workspace-unified-session-contract';
const projectId = 'project-unified-session-contract';
const runtimeLocationId = 'runtime-location-unified-session-contract';
const now = '2026-07-15T08:00:00.000Z';

function buildSession(
  id: string,
  engineId: BirdCoderCodingSession['engineId'],
  nativeSessionId: string,
  overrides: Partial<BirdCoderCodingSession> = {},
): BirdCoderCodingSession {
  return {
    id,
    workspaceId,
    projectId,
    runtimeLocationId,
    title: `${engineId} unified session`,
    status: 'active',
    hostMode: 'desktop',
    engineId,
    modelId: `${engineId}-model`,
    nativeSessionId,
    runtimeStatus: 'idle',
    createdAt: now,
    updatedAt: now,
    lastTurnAt: now,
    sortTimestamp: String(Date.parse(now)),
    transcriptUpdatedAt: now,
    messages: [],
    ...overrides,
  };
}

const unifiedSessions = [
  buildSession('birdcoder-session-1', 'codex', 'provider-session-1'),
  buildSession('birdcoder-session-2', 'claude-code', 'provider-session-2'),
  buildSession('birdcoder-session-3', 'gemini', 'shared-provider-id'),
  buildSession('birdcoder-session-4', 'opencode', 'shared-provider-id'),
];

let frontendAuthorityReads = 0;
const inventoryPage = await listAuthorityBackedCodingSessionInventoryPage({
  workspaceId,
  projectId,
  runtimeLocationId,
  limit: 6,
  appRuntimeReadService: {
    async listCodingSessions() {
      frontendAuthorityReads += 1;
      return unifiedSessions;
    },
    async listCodingSessionPage(request) {
      frontendAuthorityReads += 1;
      assert.equal(request?.workspaceId, workspaceId);
      assert.equal(request?.projectId, projectId);
      assert.equal(request?.runtimeLocationId, runtimeLocationId);
      return {
        items: unifiedSessions,
        pageInfo: { hasMore: false },
      };
    },
  },
});

assert.equal(frontendAuthorityReads, 1);
assert.deepEqual(
  inventoryPage.items.map((item) => item.id).sort(),
  unifiedSessions.map((item) => item.id).sort(),
  'Frontend inventory must consume the single materialized coding-session authority.',
);

let inProcessAuthorityReads = 0;
const transport = createBirdCoderInProcessAppRuntimeTransport({
  projectService: {
    async listCodingSessions(request: {
      projectId?: string;
      runtimeLocationId?: string;
      workspaceId?: string;
    }) {
      inProcessAuthorityReads += 1;
      assert.equal(request.projectId, projectId);
      assert.equal(request.runtimeLocationId, runtimeLocationId);
      assert.equal(request.workspaceId, workspaceId);
      return { items: unifiedSessions, total: unifiedSessions.length };
    },
  } as never,
});

const sdkClient = createBirdCoderAppSdkApiClient({ transport });
const sdkPage = await sdkClient.listCodingSessionPage({
  projectId,
  runtimeLocationId,
  workspaceId,
  limit: 6,
  offset: 0,
});

assert.equal(inProcessAuthorityReads, 1);
assert.deepEqual(
  sdkPage.items.map((item) => item.id).sort(),
  [
    'birdcoder-session-1',
    'birdcoder-session-2',
    'birdcoder-session-3',
    'birdcoder-session-4',
  ],
  'The app SDK must preserve persistent BirdCoder ids for every provider-backed session.',
);
assert.deepEqual(
  sdkPage.items.map((item) => `${item.engineId}:${item.nativeSessionId}`).sort(),
  [
    'claude-code:provider-session-2',
    'codex:provider-session-1',
    'gemini:shared-provider-id',
    'opencode:shared-provider-id',
  ],
  'The unified summaries must preserve provider bindings for all supported engines.',
);

console.log('unified coding session inventory contract passed.');
