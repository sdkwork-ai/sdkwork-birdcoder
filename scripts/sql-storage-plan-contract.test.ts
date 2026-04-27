import assert from 'node:assert/strict';

const typesModulePath = new URL('../packages/sdkwork-birdcoder-types/src/index.ts', import.meta.url);
const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);
const sqlPlansModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts',
  import.meta.url,
);
const sqlRowCodecModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlRowCodec.ts',
  import.meta.url,
);

const typesModule = await import(`${typesModulePath.href}?t=${Date.now()}`);
const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);
const sqlPlansModule = await import(`${sqlPlansModulePath.href}?t=${Date.now()}`);
const sqlRowCodecModule = await import(`${sqlRowCodecModulePath.href}?t=${Date.now()}`);

assert.equal(typeof sqlPlansModule.buildBirdCoderSchemaMigrationPlan, 'function');
assert.equal(typeof sqlPlansModule.buildBirdCoderSchemaMigrationHistoryUpsertPlan, 'function');
assert.equal(typeof sqlPlansModule.combineBirdCoderSqlPlans, 'function');
assert.equal(typeof sqlPlansModule.createBirdCoderTableSqlPlanner, 'function');
assert.equal(typeof sqlRowCodecModule.coerceBirdCoderSqlEntityRow, 'function');

const runtimeDefinition = typesModule.getBirdCoderEntityDefinition('coding_session_runtime');
const runtimeBinding = typesModule.BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING;
const projectDefinition = typesModule.getBirdCoderEntityDefinition('project');
const projectBinding = typesModule.BIRDCODER_PROJECT_STORAGE_BINDING;
const projectContentDefinition = typesModule.getBirdCoderEntityDefinition('project_content');
const projectContentBinding = typesModule.BIRDCODER_PROJECT_CONTENT_STORAGE_BINDING;
const workspaceDefinition = typesModule.getBirdCoderEntityDefinition('workspace');
const workspaceBinding = typesModule.BIRDCODER_WORKSPACE_STORAGE_BINDING;

const sqlitePlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: runtimeBinding,
  definition: runtimeDefinition,
  providerId: 'sqlite',
});

const sqliteListPlan = sqlitePlanner.buildListPlan();
assert.equal(sqliteListPlan.providerId, 'sqlite');
assert.equal(sqliteListPlan.intent, 'read');
assert.equal(sqliteListPlan.statements.length, 1);
assert.equal(
  sqliteListPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE is_deleted = ?1 ORDER BY updated_at DESC, id ASC;',
);
assert.deepEqual(sqliteListPlan.statements[0].params, [0]);

const sqliteCountPlan = sqlitePlanner.buildCountPlan();
assert.equal(
  sqliteCountPlan.statements[0].sql,
  'SELECT COUNT(*) AS total FROM coding_session_runtimes WHERE is_deleted = ?1;',
);
assert.deepEqual(sqliteCountPlan.statements[0].params, [0]);

const sqliteFindByIdPlan = sqlitePlanner.buildFindByIdPlan('runtime-sqlite-1');
assert.equal(
  sqliteFindByIdPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE id = ?1 AND is_deleted = ?2 LIMIT 1;',
);
assert.deepEqual(sqliteFindByIdPlan.statements[0].params, ['runtime-sqlite-1', 0]);

const sqliteUpsertPlan = sqlitePlanner.buildUpsertPlan([
  {
    id: 'runtime-sqlite-1',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    version: 0,
    is_deleted: 0,
    coding_session_id: 'coding-session-1',
    engine_id: 'codex',
    model_id: 'codex',
    host_mode: 'server',
    status: 'ready',
    transport_kind: 'cli',
    native_session_id: 'native-session-1',
    native_turn_container_id: 'turn-1',
    capability_snapshot_json: '{"toolCalls":true}',
    metadata_json: '{}',
  },
]);
assert.equal(sqliteUpsertPlan.intent, 'write');
assert.equal(sqliteUpsertPlan.transactional, true);
assert.equal(sqliteUpsertPlan.statements.length, 1);
assert.match(
  sqliteUpsertPlan.statements[0].sql,
  /^INSERT INTO coding_session_runtimes \(.+\) VALUES \(.+\) ON CONFLICT\(id\) DO UPDATE SET .+;$/,
);
assert.match(sqliteUpsertPlan.statements[0].sql, /\?16\)/);
assert.match(sqliteUpsertPlan.statements[0].sql, /coding_session_id = excluded\.coding_session_id/);
assert.equal(sqliteUpsertPlan.statements[0].params.length, 16);

const projectSqlitePlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: projectBinding,
  definition: projectDefinition,
  providerId: 'sqlite',
});
const projectScopedDefaultPlan = projectSqlitePlanner.buildUpsertPlan([
  {
    id: '100000000000000201',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    workspace_id: '100000000000000101',
    name: 'Starter Project',
    description: 'Project with Java-compatible scoped defaults.',
    status: 'active',
  },
]);
const projectColumnNames = projectDefinition.columns.map((column) => column.name);
const projectScopedParams = projectScopedDefaultPlan.statements[0].params;
assert.equal(projectScopedParams[projectColumnNames.indexOf('tenant_id')], '0');
assert.equal(projectScopedParams[projectColumnNames.indexOf('organization_id')], '0');
assert.equal(projectScopedParams[projectColumnNames.indexOf('data_scope')], 1);

const projectLongWritePlan = projectSqlitePlanner.buildUpsertPlan([
  {
    id: 100000000000000201n,
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    v: 101777208078558071n,
    is_deleted: false,
    workspace_id: 100000000000000101n,
    budget_amount: 101777208078558073n,
    name: 'Starter Project',
    description: 'Project written to Java-compatible physical storage.',
    status: 'active',
  },
]);
const projectLongWriteParams = projectLongWritePlan.statements[0].params;
assert.equal(projectLongWriteParams[projectColumnNames.indexOf('id')], '100000000000000201');
assert.equal(
  projectLongWriteParams[projectColumnNames.indexOf('workspace_id')],
  '100000000000000101',
);
assert.equal(
  projectLongWriteParams[projectColumnNames.indexOf('v')],
  '101777208078558071',
);
assert.equal(
  projectLongWriteParams[projectColumnNames.indexOf('budget_amount')],
  '101777208078558073',
  'SQL write params for id/bigint columns must be exact decimal strings before reaching the database driver.',
);
assert.throws(
  () =>
    projectSqlitePlanner.buildUpsertPlan([
      {
        id: Number('100000000000000201'),
        created_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-04-10T12:00:00.000Z',
        workspace_id: '100000000000000101',
        name: 'Unsafe Project',
        status: 'active',
      },
    ]),
  /unsafe JavaScript number/u,
  'SQL write planning must reject unsafe JavaScript numbers for id/bigint columns instead of persisting rounded values.',
);
assert.throws(
  () =>
    projectSqlitePlanner.buildUpsertPlan([
      {
        id: { value: '100000000000000201' } as unknown as string,
        created_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-04-10T12:00:00.000Z',
        workspace_id: '100000000000000101',
        name: 'Invalid Project',
        status: 'active',
      },
    ]),
  /SQL id field id/u,
  'SQL write planning must reject non-scalar id values instead of stringifying objects into invalid ids.',
);
assert.throws(
  () =>
    projectSqlitePlanner.buildUpsertPlan([
      {
        id: '100000000000000201',
        created_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-04-10T12:00:00.000Z',
        workspace_id: '100000000000000101',
        data_scope: '101777208078558073',
        name: 'Invalid Scope Project',
        status: 'active',
      },
    ]),
  /data_scope/u,
  'SQL write planning must reject out-of-range data_scope values instead of rounding arbitrary numeric strings.',
);

const workspaceSqlitePlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: workspaceBinding,
  definition: workspaceDefinition,
  providerId: 'sqlite',
});
assert.throws(
  () =>
    workspaceSqlitePlanner.buildUpsertPlan([
      {
        id: '100000000000000101',
        created_at: '2026-04-10T12:00:00.000Z',
        updated_at: '2026-04-10T12:00:00.000Z',
        name: 'Unsafe Counter Workspace',
        owner_id: '100000000000000001',
        status: 'active',
        max_members: Number('101777208078558073'),
      },
    ]),
  /unsafe JavaScript number/u,
  'SQL write planning must reject unsafe JavaScript numbers for int columns instead of persisting rounded counters.',
);

const projectContentSqlitePlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: projectContentBinding,
  definition: projectContentDefinition,
  providerId: 'sqlite',
});
assert.equal(
  projectContentSqlitePlanner.buildListPlan().statements[0].sql,
  'SELECT * FROM plus_project_content ORDER BY updated_at DESC, id ASC;',
);
assert.deepEqual(projectContentSqlitePlanner.buildListPlan().statements[0].params, []);
assert.equal(
  projectContentSqlitePlanner.buildCountPlan().statements[0].sql,
  'SELECT COUNT(*) AS total FROM plus_project_content;',
);
assert.deepEqual(projectContentSqlitePlanner.buildCountPlan().statements[0].params, []);
assert.equal(
  projectContentSqlitePlanner.buildFindByIdPlan('100000000000000202').statements[0].sql,
  'SELECT * FROM plus_project_content WHERE id = ?1 LIMIT 1;',
);
assert.deepEqual(
  projectContentSqlitePlanner.buildFindByIdPlan('100000000000000202').statements[0].params,
  ['100000000000000202'],
);

const projectRowFromJavaPhysicalStorage = sqlRowCodecModule.coerceBirdCoderSqlEntityRow(
  projectDefinition,
  {
    id: 100000000000000201n,
    uuid: 'project-uuid',
    tenant_id: 0,
    organization_id: 0,
    data_scope: 2,
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    v: 101777208078558071n,
    is_deleted: 0,
    workspace_id: 100000000000000101n,
    budget_amount: 101777208078558073n,
    parent_metadata: '{"ownerId":101777208078558041}',
    name: 'Starter Project',
    description: 'Project read from Java-compatible physical storage.',
    status: 'active',
  },
);
assert.ok(projectRowFromJavaPhysicalStorage);
assert.equal(projectRowFromJavaPhysicalStorage.id, '100000000000000201');
assert.equal(projectRowFromJavaPhysicalStorage.tenant_id, '0');
assert.equal(projectRowFromJavaPhysicalStorage.organization_id, '0');
assert.equal(projectRowFromJavaPhysicalStorage.data_scope, 'SHARED');
assert.equal(projectRowFromJavaPhysicalStorage.workspace_id, '100000000000000101');
assert.equal(
  projectRowFromJavaPhysicalStorage.v,
  '101777208078558071',
  'SQL row Long/BIGINT columns must cross the TypeScript boundary as exact decimal strings.',
);
assert.equal(
  projectRowFromJavaPhysicalStorage.budget_amount,
  '101777208078558073',
  'SQL row monetary Long/BIGINT columns must not be rounded through Number(value).',
);
assert.deepEqual(
  projectRowFromJavaPhysicalStorage.parent_metadata,
  {
    ownerId: '101777208078558041',
  },
  'SQL row JSON columns must preserve unquoted Long identifier fields as strings.',
);
assert.throws(
  () =>
    sqlRowCodecModule.coerceBirdCoderSqlEntityRow(projectDefinition, {
      id: Number('100000000000000201'),
      created_at: '2026-04-10T12:00:00.000Z',
      updated_at: '2026-04-10T12:00:00.000Z',
      workspace_id: '100000000000000101',
      name: 'Unsafe Project',
      status: 'active',
    }),
  /unsafe JavaScript number/u,
  'SQL row decoding must reject unsafe JavaScript numbers for id columns instead of treating the row as missing.',
);
assert.throws(
  () =>
    sqlRowCodecModule.coerceBirdCoderSqlEntityRow(projectDefinition, {
      id: { value: '100000000000000201' },
      created_at: '2026-04-10T12:00:00.000Z',
      updated_at: '2026-04-10T12:00:00.000Z',
      workspace_id: '100000000000000101',
      name: 'Invalid Project',
      status: 'active',
    }),
  /SQL id field/u,
  'SQL row decoding must reject non-scalar id values instead of stringifying objects into invalid ids.',
);
assert.throws(
  () =>
    sqlRowCodecModule.coerceBirdCoderSqlEntityRow(projectDefinition, {
      id: '100000000000000201',
      created_at: '2026-04-10T12:00:00.000Z',
      updated_at: '2026-04-10T12:00:00.000Z',
      workspace_id: '100000000000000101',
      budget_amount: Number('101777208078558073'),
      name: 'Unsafe Project',
      status: 'active',
    }),
  /unsafe JavaScript number/u,
  'SQL row decoding must reject unsafe JavaScript numbers for bigint columns instead of clearing the field.',
);
assert.throws(
  () =>
    sqlRowCodecModule.coerceBirdCoderSqlEntityRow(workspaceDefinition, {
      id: '100000000000000101',
      created_at: '2026-04-10T12:00:00.000Z',
      updated_at: '2026-04-10T12:00:00.000Z',
      name: 'Unsafe Counter Workspace',
      owner_id: '100000000000000001',
      status: 'active',
      max_members: '101777208078558073',
    }),
  /safe integer/u,
  'SQL row decoding must reject unsafe numeric strings for int columns instead of rounding them through Number(value).',
);

const deletedProjectRowFromJavaPhysicalStorage = sqlRowCodecModule.coerceBirdCoderSqlEntityRow(
  projectDefinition,
  {
    id: 100000000000000202n,
    uuid: 'deleted-project-uuid',
    tenant_id: 0n,
    organization_id: 0n,
    data_scope: 1n,
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    version: 1n,
    is_deleted: 1n,
    workspace_id: 100000000000000101n,
    name: 'Deleted Project',
    description: 'Deleted project read from SQLite BigInt INTEGER storage.',
    status: 'inactive',
  },
);
assert.ok(deletedProjectRowFromJavaPhysicalStorage);
assert.equal(deletedProjectRowFromJavaPhysicalStorage.is_deleted, true);

const sqliteDeletePlan = sqlitePlanner.buildDeletePlan('runtime-sqlite-1');
assert.equal(
  sqliteDeletePlan.statements[0].sql,
  'DELETE FROM coding_session_runtimes WHERE id = ?1;',
);
assert.deepEqual(sqliteDeletePlan.statements[0].params, ['runtime-sqlite-1']);

const sqliteClearPlan = sqlitePlanner.buildClearPlan();
assert.equal(sqliteClearPlan.statements[0].sql, 'DELETE FROM coding_session_runtimes;');
assert.deepEqual(sqliteClearPlan.statements[0].params, []);

const postgresPlanner = sqlPlansModule.createBirdCoderTableSqlPlanner({
  binding: runtimeBinding,
  definition: runtimeDefinition,
  providerId: 'postgresql',
});

const postgresListPlan = postgresPlanner.buildListPlan();
assert.equal(
  postgresListPlan.statements[0].sql,
  'SELECT * FROM coding_session_runtimes WHERE is_deleted = $1 ORDER BY updated_at DESC, id ASC;',
);
assert.deepEqual(postgresListPlan.statements[0].params, [false]);

const postgresUpsertPlan = postgresPlanner.buildUpsertPlan([
  {
    id: 'runtime-postgres-1',
    created_at: '2026-04-10T12:00:00.000Z',
    updated_at: '2026-04-10T12:00:00.000Z',
    version: 0,
    is_deleted: false,
    coding_session_id: 'coding-session-1',
    engine_id: 'codex',
    model_id: 'codex',
    host_mode: 'server',
    status: 'ready',
    transport_kind: 'cli',
    native_session_id: 'native-session-1',
    native_turn_container_id: 'turn-1',
    capability_snapshot_json: {
      toolCalls: true,
      toolCallIds: [101777208078558091n],
    },
    metadata_json: {
      requestId: 101777208078558093n,
    },
  },
]);
assert.match(postgresUpsertPlan.statements[0].sql, /\$16\)/);
assert.match(postgresUpsertPlan.statements[0].sql, /ON CONFLICT\(id\) DO UPDATE SET/);
assert.deepEqual(postgresUpsertPlan.statements[0].params.slice(0, 5), [
  'runtime-postgres-1',
  null,
  '2026-04-10T12:00:00.000Z',
  '2026-04-10T12:00:00.000Z',
  '0',
]);
const runtimeColumnNames = runtimeDefinition.columns.map((column) => column.name);
assert.equal(
  postgresUpsertPlan.statements[0].params[
    runtimeColumnNames.indexOf('capability_snapshot_json')
  ],
  '{"toolCalls":true,"toolCallIds":["101777208078558091"]}',
  'SQL JSON column planning must serialize nested Long identifier arrays as exact decimal strings.',
);
assert.equal(
  postgresUpsertPlan.statements[0].params[runtimeColumnNames.indexOf('metadata_json')],
  '{"requestId":"101777208078558093"}',
  'SQL JSON column planning must serialize nested Long identifier fields as exact decimal strings.',
);

const migrationPlan = sqlPlansModule.buildBirdCoderSchemaMigrationPlan('sqlite', [
  providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2'),
]);
assert.equal(migrationPlan.intent, 'write');
assert.equal(migrationPlan.transactional, true);
assert.equal(
  migrationPlan.statements.some((statement) =>
    statement.sql.includes('CREATE TABLE IF NOT EXISTS coding_session_runtimes'),
  ),
  true,
);

const migrationHistoryPlan = sqlPlansModule.buildBirdCoderSchemaMigrationHistoryUpsertPlan(
  'postgresql',
  {
    appliedAt: '2026-04-10T12:00:00.000Z',
    description: 'Bootstrap coding server kernel.',
    entityNames: ['coding_session_runtime', 'coding_session_event'],
    migrationId: 'coding-server-kernel-v2',
    providerId: 'postgresql',
  },
);
assert.equal(migrationHistoryPlan.intent, 'write');
assert.equal(migrationHistoryPlan.statements.length, 1);
assert.match(
  migrationHistoryPlan.statements[0].sql,
  /INSERT INTO schema_migration_history \(.+\) VALUES \(.+\$11\) ON CONFLICT\(provider_id, migration_id\) DO NOTHING;$/,
);
assert.equal(migrationHistoryPlan.statements[0].params.length, 11);
assert.deepEqual(migrationHistoryPlan.statements[0].params.slice(0, 6), [
  'postgresql:coding-server-kernel-v2',
  null,
  '2026-04-10T12:00:00.000Z',
  '2026-04-10T12:00:00.000Z',
  0,
  false,
]);

const bundledPlan = sqlPlansModule.combineBirdCoderSqlPlans(sqliteDeletePlan, sqliteClearPlan);
assert.equal(bundledPlan.providerId, 'sqlite');
assert.equal(bundledPlan.intent, 'write');
assert.equal(bundledPlan.transactional, true);
assert.equal(bundledPlan.statements.length, 2);

console.log('sql storage plan contract passed.');
