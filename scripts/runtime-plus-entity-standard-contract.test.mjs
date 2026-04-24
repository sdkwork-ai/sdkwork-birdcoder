import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataDefinitionsPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/data.ts',
  import.meta.url,
);
const storageBindingsPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/storageBindings.ts',
  import.meta.url,
);
const runConfigStoragePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/terminal/runConfigStorage.ts',
  import.meta.url,
);
const workbenchPreferencesPath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
  import.meta.url,
);
const desktopRustPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs',
  import.meta.url,
);

const dataDefinitionsSource = await readFile(dataDefinitionsPath, 'utf8');
const storageBindingsSource = await readFile(storageBindingsPath, 'utf8');
const runConfigStorageSource = await readFile(runConfigStoragePath, 'utf8');
const workbenchPreferencesSource = await readFile(workbenchPreferencesPath, 'utf8');
const desktopRustSource = await readFile(desktopRustPath, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  return source.slice(startIndex, startIndex + 6000);
}

function captureEntityBlock(source, entityName) {
  const pattern = new RegExp(`defineEntity\\([\\s\\S]*?'${escapeRegExp(entityName)}'[\\s\\S]*?\\),`, 'm');
  const match = source.match(pattern);
  assert.ok(match?.[0], `Missing entity definition for ${entityName}.`);
  return match[0];
}

function assertFields(source, anchor, fieldNames, label) {
  const block = captureBlock(source, anchor);
  for (const fieldName of fieldNames) {
    assert.match(
      block,
      new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
      `${label} must include "${fieldName}".`,
    );
  }
}

function assertContains(source, anchor, snippets, label) {
  const block = captureBlock(source, anchor);
  for (const snippet of snippets) {
    assert.ok(block.includes(snippet), `${label} must include "${snippet}".`);
  }
}

function collectCreateTableBodies(source, tableName) {
  const pattern = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)? ${escapeRegExp(tableName)} \\(([\\s\\S]*?)\\);`,
    'g',
  );
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const runtimeEntityExpectations = [
  {
    entityName: 'workbench_preference',
    label: 'workbench_preference entity definition',
    fields: ['tenant_id', 'organization_id', 'scope_type', 'scope_id'],
  },
  {
    entityName: 'run_configuration',
    label: 'run_configuration entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'workspace_id',
      'project_id',
      'scope_type',
      'scope_id',
      'config_key',
      'name',
      'command',
      'profile_id',
    ],
  },
  {
    entityName: 'terminal_execution',
    label: 'terminal_execution entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'workspace_id',
      'project_id',
      'session_id',
      'command',
      'started_at',
      'ended_at',
    ],
  },
];

for (const expectation of runtimeEntityExpectations) {
  const block = captureEntityBlock(dataDefinitionsSource, expectation.entityName);
  for (const fieldName of expectation.fields) {
    assert.match(
      block,
      new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
      `${expectation.label} must include "${fieldName}".`,
    );
  }
}

assertContains(
  storageBindingsSource,
  'export const BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING',
  ['workbench_preference', "storageMode: 'table'"],
  'workbench preference storage binding',
);
assertContains(
  storageBindingsSource,
  'export const BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING',
  ['run_configuration', "storageMode: 'table'"],
  'run configuration storage binding',
);
assertContains(
  storageBindingsSource,
  'export const BIRDCODER_TERMINAL_EXECUTION_STORAGE_BINDING',
  ['terminal_execution', "storageMode: 'table'"],
  'terminal execution storage binding',
);

assert.match(
  runConfigStorageSource,
  /\bcreateBirdCoderTableRecordRepository\b/,
  'runConfigStorage must use the table repository pathway so run_configuration stays aligned with the canonical table entity.',
);
assert.match(
  runConfigStorageSource,
  /\bconfigKey\b/,
  'runConfigStorage must separate the globally unique storage row id from the public per-scope run configuration key.',
);
assert.doesNotMatch(
  runConfigStorageSource,
  /\bcreateJsonRecordRepository\b/,
  'runConfigStorage must not bypass the canonical run_configuration table entity through the JSON repository path.',
);

assert.match(
  workbenchPreferencesSource,
  /\bcreateBirdCoderTableRecordRepository\b/,
  'workbench preferences storage must use the table repository pathway so workbench_preference stays aligned with the canonical table entity.',
);
assert.doesNotMatch(
  workbenchPreferencesSource,
  /\bcreateJsonRecordRepository\b/,
  'workbench preferences storage must not bypass the canonical workbench_preference table entity through the JSON repository path.',
);

for (const expectation of [
  {
    tableName: 'workbench_preferences',
    fields: ['uuid', 'tenant_id', 'organization_id', 'created_at', 'updated_at'],
  },
  {
    tableName: 'run_configurations',
    fields: ['uuid', 'tenant_id', 'organization_id', 'config_key', 'created_at', 'updated_at'],
  },
  {
    tableName: 'terminal_executions',
    fields: ['uuid', 'tenant_id', 'organization_id', 'created_at', 'updated_at'],
  },
]) {
  const tableBodies = collectCreateTableBodies(desktopRustSource, expectation.tableName);
  assert.ok(tableBodies.length > 0, `desktop rust schema must declare ${expectation.tableName}.`);
  for (const body of tableBodies) {
    for (const fieldName of expectation.fields) {
      assert.match(
        body,
        new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
        `desktop ${expectation.tableName} schema must include "${fieldName}".`,
      );
    }
  }
}

assert.match(
  desktopRustSource,
  /\buk_run_configurations_scope_config_key\b/,
  'desktop rust schema must declare the scoped run configuration logical-key unique index.',
);

console.log('runtime plus entity standard contract passed.');
