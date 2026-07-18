import assert from 'node:assert/strict';
import { listAuthorityBackedCodingSessionInventoryPage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionInventory.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';
import { createBirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const workspaceId = 'workspace-unified-session-contract';
const projectId = 'project-unified-session-contract';
const runtimeLocationId = 'runtime-location-unified-session-contract';
const now = '2026-07-15T08:00:00.000Z';
const projectionSession = {
  id: 'coding-session-1',
  workspaceId,
  projectId,
  runtimeLocationId,
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
  runtimeLocationId,
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
    async listNativeSessionPage(request: { runtimeLocationId: string }) {
      assert.equal(request.runtimeLocationId, runtimeLocationId);
      backendNativeReads += 1;
      return {
        items: [
          {
            ...projectionSession,
            kind: 'coding',
            title: 'Provider title must not replace the logical title',
            modelId: 'gpt-5-provider-reported',
            runtimeStatus: 'streaming',
            updatedAt: '2026-07-15T08:01:00.000Z',
            lastTurnAt: '2026-07-15T08:01:00.000Z',
            sortTimestamp: '1784102460000',
          },
          {
            ...projectionSession,
            // A native summary may reuse a logical id. It must not overwrite
            // the logical session when its provider-native identity differs.
            id: projectionSession.id,
            nativeSessionId: 'native-session-2',
            title: 'Native-only synchronized session',
          },
          {
            // Different providers may reuse an opaque raw native id. Both
            // records need a stable provider-scoped UI id.
            ...projectionSession,
            id: projectionSession.id,
            engineId: 'gemini',
            modelId: 'gemini-2.5-pro',
            nativeSessionId: 'native-session-1',
            title: 'Gemini same raw native id',
          },
          {
            ...projectionSession,
            id: projectionSession.id,
            engineId: 'opencode',
            modelId: 'opencode/big-pickle',
            nativeSessionId: 'native-session-1',
            title: 'OpenCode same raw native id',
          },
        ],
        pageInfo: { totalItems: '4' },
      };
    },
  } as never,
});

const response = await transport.request<{
  data: {
    items: Array<{
      engineId: string;
      id: string;
      modelId: string;
      nativeSessionId?: string;
      projectId: string;
      createdAt: string;
      hostMode: string;
      lastTurnAt?: string;
      runtimeStatus?: string;
      sortTimestamp?: string;
      status: string;
      title: string;
      transcriptUpdatedAt?: string | null;
      updatedAt: string;
      workspaceId: string;
    }>;
  };
}>({
  method: 'GET',
  path: '/app/v3/api/intelligence/coding_sessions',
  query: { page: 1, page_size: 6, projectId, runtimeLocationId, workspaceId },
});

assert.equal(backendNativeReads, 1, 'backend must own native-session synchronization.');
assert.deepEqual(
  response.data.items.map((item) => item.id).sort(),
  [
    'coding-session-1',
    'codex-native:native-session-2',
    'gemini-native:native-session-1',
    'opencode-native:native-session-1',
  ],
  'native-only records must be provider-scoped instead of replacing a logical session with a colliding id.',
);
const logicalItem = response.data.items.find((item) => item.id === projectionSession.id);
assert.deepEqual(logicalItem, {
  id: projectionSession.id,
  workspaceId,
  projectId,
  runtimeLocationId,
  title: projectionSession.title,
  status: projectionSession.status,
  hostMode: projectionSession.hostMode,
  engineId: projectionSession.engineId,
  modelId: projectionSession.modelId,
  nativeSessionId: projectionSession.nativeSessionId,
  runtimeStatus: 'streaming',
  createdAt: now,
  updatedAt: '2026-07-15T08:01:00.000Z',
  lastTurnAt: '2026-07-15T08:01:00.000Z',
  sortTimestamp: '1784102460000',
  transcriptUpdatedAt: now,
});
assert.deepEqual(
  response.data.items
    .filter((item) => item.id !== projectionSession.id)
    .map((item) => `${item.engineId}:${item.nativeSessionId}`)
    .sort(),
  [
    'codex:native-session-2',
    'gemini:native-session-1',
    'opencode:native-session-1',
  ],
  'cross-provider native inventory collisions must stay independent and keep their selected provider.',
);

const sdkClient = createBirdCoderAppSdkApiClient({ transport });
const sdkPage = await sdkClient.listCodingSessionPage({
  projectId,
  runtimeLocationId,
  workspaceId,
  limit: 6,
  offset: 0,
});
assert.deepEqual(
  sdkPage.items.map((item) => `${item.engineId}:${item.nativeSessionId}`).sort(),
  [
    'codex:native-session-1',
    'codex:native-session-2',
    'gemini:native-session-1',
    'opencode:native-session-1',
  ],
  'the composed app SDK must preserve provider-scoped unified summaries instead of collapsing them into Codex.',
);

console.log('unified coding session inventory contract passed.');
