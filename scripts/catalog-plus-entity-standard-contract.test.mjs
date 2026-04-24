import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverTypesPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);
const rustSources = [
  {
    label: 'desktop',
    path: new URL('../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs', import.meta.url),
  },
  {
    label: 'server',
    path: new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  },
];

const serverTypesSource = await readFile(serverTypesPath, 'utf8');
const openApiSource = await readFile(openApiPath, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  return source.slice(startIndex, startIndex + 9000);
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

function collectCreateTableBodies(source, tableName) {
  const pattern = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)? ${escapeRegExp(tableName)} \\(([\\s\\S]*?)\\);`,
    'g',
  );
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const commonCamelFields = ['uuid', 'tenantId', 'organizationId', 'createdAt', 'updatedAt'];
const commonSnakeFields = ['uuid', 'tenant_id', 'organization_id', 'created_at', 'updated_at'];

const typeExpectations = [
  {
    anchor: 'export interface BirdCoderSkillPackageSummary {',
    label: 'BirdCoderSkillPackageSummary types',
    fields: [
      ...commonCamelFields,
      'slug',
      'name',
      'description',
      'versionId',
      'versionLabel',
      'sourceUri',
      'installed',
      'skills',
    ],
  },
  {
    anchor: 'export interface BirdCoderSkillInstallationSummary {',
    label: 'BirdCoderSkillInstallationSummary types',
    fields: [
      ...commonCamelFields,
      'packageId',
      'scopeId',
      'scopeType',
      'status',
      'versionId',
      'installedAt',
    ],
  },
  {
    anchor: 'export interface BirdCoderAppTemplateSummary {',
    label: 'BirdCoderAppTemplateSummary types',
    fields: [
      ...commonCamelFields,
      'slug',
      'name',
      'description',
      'versionId',
      'versionLabel',
      'presetKey',
      'category',
      'targetProfiles',
      'status',
    ],
  },
];

for (const expectation of typeExpectations) {
  assertFields(serverTypesSource, expectation.anchor, expectation.fields, expectation.label);
}

const openApiExpectations = [
  {
    anchor: 'BirdCoderSkillPackageSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderSkillPackageSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'slug',
      'name',
      'description',
      'versionId',
      'versionLabel',
      'sourceUri',
      'installed',
      'skills',
    ],
  },
  {
    anchor: 'BirdCoderSkillInstallationSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderSkillInstallationSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'packageId',
      'scopeId',
      'scopeType',
      'status',
      'versionId',
      'installedAt',
    ],
  },
  {
    anchor: 'BirdCoderAppTemplateSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderAppTemplateSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'slug',
      'name',
      'description',
      'versionId',
      'versionLabel',
      'presetKey',
      'category',
      'targetProfiles',
      'status',
    ],
  },
];

for (const expectation of openApiExpectations) {
  assertFields(openApiSource, expectation.anchor, expectation.fields, expectation.label);
}

for (const { label, path } of rustSources) {
  const rustSource = await readFile(path, 'utf8');

  if (label === 'server') {
    assertFields(
      rustSource,
      'struct SkillPackagePayload {',
      [...commonSnakeFields, 'slug', 'name', 'description', 'version_id', 'version_label', 'source_uri', 'installed', 'skills'],
      'SkillPackagePayload',
    );
    assertFields(
      rustSource,
      'struct SkillInstallationPayload {',
      [...commonSnakeFields, 'package_id', 'scope_id', 'scope_type', 'status', 'version_id', 'installed_at'],
      'SkillInstallationPayload',
    );
    assertFields(
      rustSource,
      'struct AppTemplatePayload {',
      [...commonSnakeFields, 'slug', 'name', 'description', 'version_id', 'version_label', 'preset_key', 'category', 'target_profiles', 'status'],
      'AppTemplatePayload',
    );
  }

  const tableExpectations = [
    {
      tableName: 'skill_packages',
      fields: [...commonSnakeFields, 'slug', 'source_uri', 'manifest_json', 'status'],
    },
    {
      tableName: 'skill_versions',
      fields: [...commonSnakeFields, 'skill_package_id', 'version_label', 'manifest_json', 'status'],
    },
    {
      tableName: 'skill_capabilities',
      fields: [...commonSnakeFields, 'skill_version_id', 'capability_key', 'payload_json'],
    },
    {
      tableName: 'skill_installations',
      fields: [...commonSnakeFields, 'scope_type', 'scope_id', 'skill_version_id', 'status', 'installed_at'],
    },
    {
      tableName: 'app_templates',
      fields: [...commonSnakeFields, 'slug', 'name', 'category', 'status'],
    },
    {
      tableName: 'app_template_versions',
      fields: [...commonSnakeFields, 'app_template_id', 'version_label', 'manifest_json', 'status'],
    },
    {
      tableName: 'app_template_target_profiles',
      fields: [...commonSnakeFields, 'app_template_version_id', 'profile_key', 'status'],
    },
    {
      tableName: 'app_template_presets',
      fields: [...commonSnakeFields, 'app_template_version_id', 'preset_key', 'description_text', 'payload_json'],
    },
    {
      tableName: 'app_template_instantiations',
      fields: [...commonSnakeFields, 'app_template_version_id', 'preset_key', 'status', 'output_root'],
    },
  ];

  for (const expectation of tableExpectations) {
    const bodies = collectCreateTableBodies(rustSource, expectation.tableName);
    assert(bodies.length > 0, `${label} rust source must declare ${expectation.tableName} table.`);
    for (const body of bodies) {
      for (const fieldName of expectation.fields) {
        assert.match(
          body,
          new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
          `${label} ${expectation.tableName} schema must include "${fieldName}".`,
        );
      }
    }
  }
}

console.log('catalog plus entity standard contract passed.');
