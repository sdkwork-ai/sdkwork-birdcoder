import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderNativeSessionSummary,
} from '@sdkwork/birdcoder-types';
import {
  listStoredSessionInventory,
  type StoredCodingSessionInventoryRecord,
  type WorkbenchSessionInventoryRecord,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts';

const workspaceId = 'workspace-session-inventory-native-id';
const projectId = 'project-session-inventory-native-id';

function buildCodingSummary(
  overrides: Partial<BirdCoderCodingSessionSummary> = {},
): BirdCoderCodingSessionSummary {
  return {
    id: 'birdcoder-session-1',
    workspaceId,
    projectId,
    title: 'Projection session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    runtimeStatus: 'completed',
    createdAt: '2026-04-27T00:00:00.000Z',
    updatedAt: '2026-04-27T00:01:00.000Z',
    lastTurnAt: '2026-04-27T00:01:00.000Z',
    sortTimestamp: String(Date.parse('2026-04-27T00:01:00.000Z')),
    transcriptUpdatedAt: '2026-04-27T00:01:00.000Z',
    ...overrides,
  };
}

function buildNativeSummary(
  overrides: Partial<BirdCoderNativeSessionSummary> = {},
): BirdCoderNativeSessionSummary {
  return {
    ...buildCodingSummary(),
    kind: 'coding',
    nativeCwd: 'D:/workspace/session-inventory-native-id',
    nativeSessionId: 'native-session-from-engine',
    sortTimestamp: String(Date.parse('2026-04-27T00:02:00.000Z')),
    transcriptUpdatedAt: '2026-04-27T00:02:00.000Z',
    ...overrides,
  };
}

async function listInventoryFor(
  projectionSummaries: readonly BirdCoderCodingSessionSummary[],
  nativeSummaries: readonly BirdCoderNativeSessionSummary[],
) {
  const coreReadService = {
    async listCodingSessions() {
      return [...projectionSummaries];
    },
    async listNativeSessions() {
      return [...nativeSummaries];
    },
  } as Pick<BirdCoderCoreReadApiClient, 'listCodingSessions' | 'listNativeSessions'>;

  return listStoredSessionInventory({
    coreReadService: coreReadService as BirdCoderCoreReadApiClient,
    projectId,
    workspaceId,
  });
}

function isCodingInventoryRecord(
  record: WorkbenchSessionInventoryRecord,
): record is StoredCodingSessionInventoryRecord {
  return record.kind === 'coding';
}

const normalizedProjectionRecords = await listInventoryFor(
  [
    buildCodingSummary({
      nativeSessionId: 'codex-native:projection-native-session',
    }),
  ],
  [],
);
const normalizedProjectionSession = normalizedProjectionRecords.find(
  (record): record is StoredCodingSessionInventoryRecord =>
    isCodingInventoryRecord(record) && record.id === 'birdcoder-session-1',
);

assert.equal(
  normalizedProjectionSession?.nativeSessionId,
  'projection-native-session',
  'authority-backed session inventory must normalize loaded session-list nativeSessionId values to raw provider ids.',
);

const mergedNativeRecords = await listInventoryFor(
  [buildCodingSummary()],
  [
    buildNativeSummary({
      id: 'birdcoder-session-1',
      nativeSessionId: 'codex-native:merged-native-session',
    }),
  ],
);
const mergedNativeSession = mergedNativeRecords.find(
  (record): record is StoredCodingSessionInventoryRecord =>
    isCodingInventoryRecord(record) && record.id === 'birdcoder-session-1',
);

assert.equal(
  mergedNativeSession?.nativeSessionId,
  'merged-native-session',
  'authority-backed session inventory must merge nativeSessionId from the native session list when projection summaries do not carry it.',
);

const nativeOnlyRecords = await listInventoryFor(
  [],
  [
    buildNativeSummary({
      id: 'codex-native:native-only-session',
      nativeSessionId: 'codex-native:native-only-session',
      title: 'Native-only session',
    }),
  ],
);
const nativeOnlySession = nativeOnlyRecords.find(
  (record): record is StoredCodingSessionInventoryRecord =>
    isCodingInventoryRecord(record) && record.nativeSessionId === 'native-only-session',
);

assert.equal(
  nativeOnlySession?.id,
  'native-only-session',
  'authority-backed session inventory must include native-only coding sessions instead of dropping them when projection summaries are empty.',
);
assert.equal(
  nativeOnlySession?.engineId,
  'codex',
  'native-only session inventory items must carry engineId as the engine discriminator.',
);

console.log('session inventory native session id contract passed.');
