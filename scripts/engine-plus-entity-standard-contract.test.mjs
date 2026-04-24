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
const engineTypesPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/engine.ts',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);
const rustCatalogPath = new URL(
  '../packages/sdkwork-birdcoder-codeengine/src-host/src/catalog.rs',
  import.meta.url,
);
const desktopRustPath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs',
  import.meta.url,
);

const dataDefinitionsSource = await readFile(dataDefinitionsPath, 'utf8');
const storageBindingsSource = await readFile(storageBindingsPath, 'utf8');
const engineTypesSource = await readFile(engineTypesPath, 'utf8');
const openApiSource = await readFile(openApiPath, 'utf8');
const rustCatalogSource = await readFile(rustCatalogPath, 'utf8');
const desktopRustSource = await readFile(desktopRustPath, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  return source.slice(startIndex, startIndex + 7000);
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

const commonCamelFields = ['id', 'uuid', 'tenantId', 'organizationId', 'createdAt', 'updatedAt'];
const commonSnakeFields = ['id', 'uuid', 'tenant_id', 'organization_id', 'created_at', 'updated_at'];

for (const expectation of [
  {
    entityName: 'engine_registry',
    label: 'engine_registry entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'engine_id',
      'display_name',
      'default_model_id',
      'transport_kinds_json',
      'capability_matrix_json',
      'status',
    ],
  },
  {
    entityName: 'model_catalog',
    label: 'model_catalog entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'engine_id',
      'model_id',
      'display_name',
      'provider_id',
      'transport_kinds_json',
      'capability_matrix_json',
      'is_default',
      'status',
    ],
  },
  {
    entityName: 'engine_binding',
    label: 'engine_binding entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'scope_type',
      'scope_id',
      'engine_id',
      'model_id',
      'host_modes_json',
    ],
  },
]) {
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
  'export const BIRDCODER_ENGINE_REGISTRY_STORAGE_BINDING',
  ['engine_registry', "storageMode: 'table'"],
  'engine registry storage binding',
);
assertContains(
  storageBindingsSource,
  'export const BIRDCODER_MODEL_CATALOG_STORAGE_BINDING',
  ['model_catalog', "storageMode: 'table'"],
  'model catalog storage binding',
);
assertContains(
  storageBindingsSource,
  'export const BIRDCODER_ENGINE_BINDING_STORAGE_BINDING',
  ['engine_binding', "storageMode: 'table'"],
  'engine binding storage binding',
);

assertFields(
  engineTypesSource,
  'export interface BirdCoderEngineCatalogEntitySummary {',
  commonCamelFields,
  'BirdCoderEngineCatalogEntitySummary types',
);
assertFields(
  engineTypesSource,
  'export interface BirdCoderEngineDescriptor extends BirdCoderEngineCatalogEntitySummary {',
  ['engineKey', 'displayName', 'vendor', 'installationKind', 'defaultModelId', 'transportKinds', 'capabilityMatrix', 'status'],
  'BirdCoderEngineDescriptor types',
);
assertFields(
  engineTypesSource,
  'export interface BirdCoderModelCatalogEntry extends BirdCoderEngineCatalogEntitySummary {',
  ['engineKey', 'modelId', 'displayName', 'providerId', 'status', 'defaultForEngine', 'transportKinds', 'capabilityMatrix'],
  'BirdCoderModelCatalogEntry types',
);
assertFields(
  engineTypesSource,
  'export interface BirdCoderEngineBindingSummary extends BirdCoderEngineCatalogEntitySummary {',
  ['scopeType', 'scopeId', 'engineKey', 'modelId', 'hostModes'],
  'BirdCoderEngineBindingSummary types',
);

assertFields(
  openApiSource,
  'BirdCoderEngineDescriptor: createOpenApiObjectSchema(',
  [
    ...commonCamelFields,
    'engineKey',
    'displayName',
    'vendor',
    'installationKind',
    'defaultModelId',
    'transportKinds',
    'capabilityMatrix',
    'status',
  ],
  'BirdCoderEngineDescriptor openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderModelCatalogEntry: createOpenApiObjectSchema(',
  [
    ...commonCamelFields,
    'engineKey',
    'modelId',
    'displayName',
    'providerId',
    'status',
    'defaultForEngine',
    'transportKinds',
    'capabilityMatrix',
  ],
  'BirdCoderModelCatalogEntry openapi schema',
);

assertFields(
  rustCatalogSource,
  'pub struct CodeEngineDescriptorRecord {',
  [
    ...commonSnakeFields,
    'engine_key',
    'display_name',
    'vendor',
    'installation_kind',
    'default_model_id',
    'transport_kinds',
    'capability_matrix',
    'status',
  ],
  'CodeEngineDescriptorRecord rust payload',
);
assertFields(
  rustCatalogSource,
  'pub struct CodeEngineModelCatalogEntryRecord {',
  [
    ...commonSnakeFields,
    'engine_key',
    'model_id',
    'display_name',
    'provider_id',
    'status',
    'default_for_engine',
    'transport_kinds',
    'capability_matrix',
  ],
  'CodeEngineModelCatalogEntryRecord rust payload',
);

for (const expectation of [
  {
    tableName: 'workbench_preferences',
    fields: [...commonSnakeFields, 'scope_type', 'scope_id', 'code_engine_id', 'code_model_id', 'terminal_profile_id', 'payload_json'],
  },
  {
    tableName: 'engine_registry',
    fields: [...commonSnakeFields, 'engine_id', 'display_name', 'vendor', 'installation_kind', 'default_model_id', 'transport_kinds_json', 'capability_matrix_json', 'status'],
  },
  {
    tableName: 'model_catalog',
    fields: [...commonSnakeFields, 'engine_id', 'model_id', 'display_name', 'provider_id', 'transport_kinds_json', 'capability_matrix_json', 'is_default', 'status'],
  },
  {
    tableName: 'engine_bindings',
    fields: [...commonSnakeFields, 'scope_type', 'scope_id', 'engine_id', 'model_id', 'host_modes_json'],
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
  /\buk_workbench_preferences_scope\b/,
  'desktop rust schema must declare the workbench preference scope unique index.',
);
assert.match(
  desktopRustSource,
  /\buk_engine_registry_engine_id\b/,
  'desktop rust schema must declare the engine registry unique index.',
);
assert.match(
  desktopRustSource,
  /\buk_model_catalog_engine_model\b/,
  'desktop rust schema must declare the model catalog unique index.',
);
assert.match(
  desktopRustSource,
  /\buk_engine_bindings_scope_engine\b/,
  'desktop rust schema must declare the engine binding scope/engine unique index.',
);

console.log('engine plus entity standard contract passed.');
