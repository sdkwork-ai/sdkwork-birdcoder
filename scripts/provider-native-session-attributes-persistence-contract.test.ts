import assert from 'node:assert/strict';
import {
  createBirdCoderCodingSessionRepositories,
  type BirdCoderPersistedCodingSessionRecord,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts';
import { createBirdCoderStorageProvider } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlExecutor.ts';

const timestamp = '2026-07-15T00:00:00.000Z';
const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
const storage = createBirdCoderStorageProvider('sqlite', { sqlExecutor });
const repositories = createBirdCoderCodingSessionRepositories({
  providerId: storage.providerId,
  storage,
});

function session(
  id: string,
  engineId: BirdCoderPersistedCodingSessionRecord['engineId'],
  nativeAttributes: NonNullable<BirdCoderPersistedCodingSessionRecord['nativeAttributes']>,
): BirdCoderPersistedCodingSessionRecord {
  return {
    archived: false,
    createdAt: timestamp,
    engineId,
    hostMode: engineId === 'opencode' ? 'server' : 'desktop',
    id,
    modelId: `${engineId}-model`,
    nativeSessionId: 'same-native-id-across-providers',
    nativeAttributes,
    pinned: false,
    projectId: 'birdcoder-project',
    status: 'active',
    title: `${engineId} native session`,
    unread: false,
    updatedAt: timestamp,
    workspaceId: 'birdcoder-workspace',
  };
}

const records = [
  session('codex-session', 'codex', {
    schemaVersion: 1,
    sessionTreeId: 'codex-tree',
    parentSessionId: 'codex-parent',
    forkedFromSessionId: 'codex-fork',
    title: 'Codex native title',
    preview: 'Codex first prompt',
    source: 'vscode',
    providerVersion: '0.144.3',
    modelProvider: 'openai',
    projectId: 'codex-provider-project',
    gitBranch: 'main',
    gitCommit: 'abc123',
    gitRepositoryUrl: 'https://example.invalid/codex.git',
    agentName: 'worker-1',
    agentRole: 'reviewer',
    isEphemeral: true,
    isSidechain: false,
    metadata: { futureCodexField: { nested: true } },
  }),
  session('claude-session', 'claude-code', {
    schemaVersion: 1,
    title: 'Claude custom title',
    preview: 'Claude last prompt',
    source: 'cli',
    providerVersion: '2.1.172',
    gitBranch: 'feature/claude',
    isEphemeral: false,
    isSidechain: false,
    metadata: { customTitle: 'Claude custom title', slug: 'calm-session' },
  }),
  session('gemini-session', 'gemini', {
    schemaVersion: 1,
    title: 'Gemini summary',
    modelProvider: 'google',
    projectId: 'gemini-project-hash',
    agentRole: 'main',
    isEphemeral: false,
    isSidechain: false,
    metadata: { futureGeminiField: 42 },
  }),
  session('opencode-session', 'opencode', {
    schemaVersion: 1,
    parentSessionId: 'opencode-parent',
    title: 'OpenCode title',
    providerVersion: '1.17.4',
    modelProvider: 'anthropic',
    projectId: 'opencode-project-id',
    isEphemeral: false,
    isSidechain: false,
    metadata: { futureOpenCodeField: ['preserved'] },
  }),
];

await repositories.sessions.saveMany(records);

for (const expected of records) {
  const loaded = await repositories.sessions.findById(expected.id);
  assert.deepEqual(
    JSON.parse(JSON.stringify(loaded?.nativeAttributes)),
    JSON.parse(JSON.stringify(expected.nativeAttributes)),
    `${expected.engineId} native attributes must survive the provider-mirror round trip`,
  );
  assert.equal(loaded?.projectId, 'birdcoder-project');
  assert.equal(loaded?.nativeAttributes?.projectId, expected.nativeAttributes?.projectId);
  assert.equal(loaded?.modelId, `${expected.engineId}-model`);
  assert.equal(loaded?.nativeAttributes?.modelProvider, expected.nativeAttributes?.modelProvider);
  assert.equal(
    'cwd' in ((loaded?.nativeAttributes ?? {}) as Record<string, unknown>),
    false,
    'public native session attributes must not persist or expose a local working directory.',
  );
}

const unsafeMetadataRecord = session('unsafe-native-metadata', 'codex', {
  schemaVersion: 1,
  gitRepositoryUrl: 'https://token:secret@example.invalid/private.git',
  isEphemeral: false,
  isSidechain: false,
  metadata: {
    cwd: 'C:/private/project',
    nested: {
      browserHandle: { opaque: true },
      safe: 'preserved',
      workingDirectory: 'C:/private/project/packages',
    },
    values: [{ nativeCwd: 'C:/private/project/src' }, { safe: true }],
  },
});

await repositories.sessions.saveMany([unsafeMetadataRecord]);
const sanitizedUnsafeMetadataRecord = await repositories.sessions.findById(
  unsafeMetadataRecord.id,
);
const sanitizedMetadata = sanitizedUnsafeMetadataRecord?.nativeAttributes?.metadata ?? {};
assert.equal(sanitizedMetadata.cwd, undefined);
assert.equal((sanitizedMetadata.nested as Record<string, unknown>).browserHandle, undefined);
assert.equal((sanitizedMetadata.nested as Record<string, unknown>).workingDirectory, undefined);
assert.equal((sanitizedMetadata.nested as Record<string, unknown>).safe, 'preserved');
assert.equal(
  ((sanitizedMetadata.values as Array<Record<string, unknown>>)[0] ?? {}).nativeCwd,
  undefined,
);
assert.equal(
  ((sanitizedMetadata.values as Array<Record<string, unknown>>)[1] ?? {}).safe,
  true,
);
assert.equal(
  sanitizedUnsafeMetadataRecord?.nativeAttributes?.gitRepositoryUrl,
  undefined,
  'credential-bearing native Git URLs must not persist in local projections.',
);

const upsertPlan = sqlExecutor.history.find(
  (plan) => plan.meta?.kind === 'table-upsert' && plan.meta.tableName === 'ai_coding_session',
);
const persistedRows = upsertPlan?.meta?.rows ?? [];
assert.ok(
  persistedRows.every(
    (row) => row.project_id === 'birdcoder-project' && row.native_project_id !== row.project_id,
  ),
  'provider project ids must remain isolated from BirdCoder project_id',
);
assert.ok(
  persistedRows.every((row) => 'native_metadata_json' in row && 'native_schema_version' in row),
  'every provider mirror row must carry versioned native metadata',
);

console.log('provider native session attributes persistence contract passed.');
