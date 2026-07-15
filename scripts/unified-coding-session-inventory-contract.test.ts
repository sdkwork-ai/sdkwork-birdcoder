import assert from 'node:assert/strict';
import { listAuthorityBackedCodingSessionInventoryPage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench/sessionInventory.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';
import { createBirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const workspaceId = 'workspace-unified-session-contract';
const projectId = 'project-unified-session-contract';
const now = '2026-07-15T08:00:00.000Z';
const projectionSession = {
  id: 'coding-session-1',
  workspaceId,
  projectId,
  title: 'Unified session',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5',
  nativeSessionId: 'native-session-1',
  runtimeStatus: 'idle',
  createdAt: now,
  updatedAt: now,
  lastTurnAt: now,
  sortTimestamp: '1784102400000',
  transcriptUpdatedAt: now,
  messages: [],
};

let nativeInventoryReads = 0;
const inventoryPage = await listAuthorityBackedCodingSessionInventoryPage({
  workspaceId,
  projectId,
  limit: 6,
  appRuntimeReadService: {
    codingSessionListIncludesNativeSessions: true,
    async listCodingSessions() {
      return [projectionSession] as never;
    },
    async listCodingSessionPage() {
      return { items: [projectionSession], pageInfo: { hasMore: false } } as never;
    },
    async listNativeSessions() {
      nativeInventoryReads += 1;
      return [];
    },
    async listNativeSessionPage() {
      nativeInventoryReads += 1;
      return { items: [], pageInfo: { hasMore: false } };
    },
  },
});

assert.equal(inventoryPage.items.length, 1);
assert.equal(
  nativeInventoryReads,
  0,
  'frontend inventory must not issue a native_sessions list request when coding_sessions is unified.',
);

let backendNativeReads = 0;
const transport = createBirdCoderInProcessAppRuntimeTransport({
  projectService: {
    async listCodingSessions() {
      return { items: [projectionSession], total: 1 };
    },
  } as never,
  nativeSessionProvider: {
    async listNativeSessionPage() {
      backendNativeReads += 1;
      return {
        items: [
          { ...projectionSession, kind: 'coding', nativeCwd: 'E:/workspace' },
          {
            ...projectionSession,
            id: 'codex-native:native-session-2',
            nativeSessionId: 'native-session-2',
            title: 'Native-only synchronized session',
          },
        ],
        pageInfo: { totalItems: '2' },
      };
    },
  } as never,
});

const response = await transport.request<{
  data: { items: Array<{ id: string; nativeSessionId?: string }> };
}>({
  method: 'GET',
  path: '/app/v3/api/intelligence/coding_sessions',
  query: { page: 1, page_size: 6, projectId, workspaceId },
});

assert.equal(backendNativeReads, 1, 'backend must own native-session synchronization.');
assert.deepEqual(
  response.data.items.map((item) => item.nativeSessionId).sort(),
  ['native-session-1', 'native-session-2'],
  'coding_sessions must return the complete deduplicated inventory, including native-only sessions.',
);

const sdkClient = createBirdCoderAppSdkApiClient({ transport });
const sdkPage = await sdkClient.listCodingSessionPage({
  projectId,
  workspaceId,
  limit: 6,
  offset: 0,
});
assert.deepEqual(
  sdkPage.items.map((item) => item.nativeSessionId).sort(),
  ['native-session-1', 'native-session-2'],
  'the composed app SDK must preserve the unified native session summaries instead of returning an empty projection.',
);

console.log('unified coding session inventory contract passed.');
