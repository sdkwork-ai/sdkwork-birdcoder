import assert from 'node:assert/strict';
import type { BirdCoderCodingSessionSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  listStoredSessionInventory,
  type StoredCodingSessionInventoryRecord,
  type WorkbenchSessionInventoryRecord,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionInventory.ts';

const workspaceId = 'workspace-session-inventory-binding';
const projectId = 'project-session-inventory-binding';
const runtimeLocationId = 'runtime-location-session-inventory-binding';

function buildSummary(
  overrides: Partial<BirdCoderCodingSessionSummary> = {},
): BirdCoderCodingSessionSummary {
  return {
    id: 'birdcoder-session-1',
    workspaceId,
    projectId,
    title: 'Provider-backed session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    nativeSessionId: 'provider-session-1',
    runtimeLocationId,
    runtimeStatus: 'completed',
    createdAt: '2026-04-27T00:00:00.000Z',
    updatedAt: '2026-04-27T00:01:00.000Z',
    lastTurnAt: '2026-04-27T00:01:00.000Z',
    sortTimestamp: String(Date.parse('2026-04-27T00:01:00.000Z')),
    transcriptUpdatedAt: '2026-04-27T00:01:00.000Z',
    ...overrides,
  };
}

async function listInventoryFor(summaries: readonly BirdCoderCodingSessionSummary[]) {
  return listStoredSessionInventory({
    appRuntimeReadService: {
      async listCodingSessions() {
        return [...summaries];
      },
      async listCodingSessionPage(request) {
        assert.equal(request?.runtimeLocationId, runtimeLocationId);
        return {
          items: [...summaries],
          pageInfo: { hasMore: false },
        };
      },
    },
    limit: Math.max(1, summaries.length),
    projectId,
    runtimeLocationId,
    workspaceId,
  });
}

function isCodingRecord(
  record: WorkbenchSessionInventoryRecord,
): record is StoredCodingSessionInventoryRecord {
  return record.kind === 'coding';
}

const normalizedRecords = await listInventoryFor([
  buildSummary({ nativeSessionId: 'codex-native:provider-session-1' }),
]);
const normalizedSession = normalizedRecords.find(isCodingRecord);
assert.equal(normalizedSession?.id, 'birdcoder-session-1');
assert.equal(
  normalizedSession?.nativeSessionId,
  'provider-session-1',
  'The unified authority must preserve the logical id and normalize only the provider binding.',
);

const crossProviderRecords = (await listInventoryFor([
  buildSummary({
    id: 'birdcoder-codex-session',
    engineId: 'codex',
    nativeSessionId: 'shared-provider-id',
  }),
  buildSummary({
    id: 'birdcoder-gemini-session',
    engineId: 'gemini',
    modelId: 'gemini-2.5-pro',
    nativeSessionId: 'shared-provider-id',
  }),
  buildSummary({
    id: 'birdcoder-opencode-session',
    engineId: 'opencode',
    modelId: 'opencode/big-pickle',
    nativeSessionId: 'opencode-provider-id',
  }),
])).filter(isCodingRecord);

assert.deepEqual(
  crossProviderRecords.map((record) => record.id).sort(),
  [
    'birdcoder-codex-session',
    'birdcoder-gemini-session',
    'birdcoder-opencode-session',
  ],
  'Provider-backed inventory rows must retain persistent BirdCoder logical ids.',
);
assert.equal(
  crossProviderRecords.filter((record) => record.nativeSessionId === 'shared-provider-id').length,
  2,
  'Equal provider ids owned by different engines must remain separate bindings.',
);

console.log('session inventory provider binding contract passed.');
