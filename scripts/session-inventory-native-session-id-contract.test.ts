import type {
  BirdCoderAppRuntimeReadSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionSummary,
  BirdCoderNativeSessionSummary,
} from '@sdkwork/birdcoder-pc-types';
import {
  listStoredSessionInventory,
  type StoredCodingSessionInventoryRecord,
  type WorkbenchSessionInventoryRecord,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench/sessionInventory.ts';

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
  const appRuntimeReadService = {
    async listCodingSessions() {
      return [...projectionSummaries];
    },
    async listNativeSessions() {
      return [...nativeSummaries];
    },
  } as Pick<BirdCoderAppRuntimeReadSdkApiClient, 'listCodingSessions' | 'listNativeSessions'>;

  return listStoredSessionInventory({
    appRuntimeReadService: appRuntimeReadService as BirdCoderAppRuntimeReadSdkApiClient,
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
      updatedAt: '2026-04-27T00:02:00.000Z',
      lastTurnAt: '2026-04-27T00:02:00.000Z',
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
assert.equal(
  mergedNativeSession?.sortTimestamp,
  String(Date.parse('2026-04-27T00:02:00.000Z')),
  'a newer native activity timestamp must advance the merged session order.',
);
assert.equal(
  mergedNativeSession?.updatedAt,
  '2026-04-27T00:02:00.000Z',
  'a newer native update time must advance the merged session activity.',
);

const projectionNewerRecords = await listInventoryFor(
  [
    buildCodingSummary({
      nativeSessionId: 'projection-newer-session',
      updatedAt: '2026-04-27T00:04:00.000Z',
      lastTurnAt: '2026-04-27T00:04:00.000Z',
      sortTimestamp: String(Date.parse('2026-04-27T00:04:00.000Z')),
      transcriptUpdatedAt: '2026-04-27T00:04:00.000Z',
    }),
  ],
  [
    buildNativeSummary({
      id: 'codex-native:projection-newer-session',
      nativeSessionId: 'codex-native:projection-newer-session',
      updatedAt: '2026-04-27T00:03:00.000Z',
      lastTurnAt: '2026-04-27T00:03:00.000Z',
      sortTimestamp: String(Date.parse('2026-04-27T00:03:00.000Z')),
      transcriptUpdatedAt: '2026-04-27T00:03:00.000Z',
    }),
  ],
);
const projectionNewerSession = projectionNewerRecords.find(
  (record): record is StoredCodingSessionInventoryRecord =>
    isCodingInventoryRecord(record) && record.id === 'birdcoder-session-1',
);

assert.equal(
  projectionNewerSession?.sortTimestamp,
  String(Date.parse('2026-04-27T00:04:00.000Z')),
  'a newer projection message activity timestamp must not be replaced by an older native snapshot.',
);
assert.equal(
  projectionNewerSession?.transcriptUpdatedAt,
  '2026-04-27T00:04:00.000Z',
  'a newer projection transcript timestamp must survive native session merging.',
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
