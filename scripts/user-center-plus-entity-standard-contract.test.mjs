import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverTypesPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);
const dataDefinitionsPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/data.ts',
  import.meta.url,
);
const userCenterRustPath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/user_center.rs',
  import.meta.url,
);

const serverTypesSource = await readFile(serverTypesPath, 'utf8');
const openApiSource = await readFile(openApiPath, 'utf8');
const dataDefinitionsSource = await readFile(dataDefinitionsPath, 'utf8');
const userCenterRustSource = await readFile(userCenterRustPath, 'utf8');

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
    anchor: 'export interface BirdCoderAuthenticatedUserSummary {',
    label: 'BirdCoderAuthenticatedUserSummary types',
    fields: [...commonCamelFields, 'id', 'name', 'email', 'avatarUrl'],
  },
  {
    anchor: 'export interface BirdCoderUserCenterSessionSummary {',
    label: 'BirdCoderUserCenterSessionSummary types',
    fields: [
      ...commonCamelFields,
      'accessToken',
      'authToken',
      'providerKey',
      'providerMode',
      'sessionId',
      'tokenType',
      'user',
    ],
  },
  {
    anchor: 'export interface BirdCoderUserCenterProfileSummary {',
    label: 'BirdCoderUserCenterProfileSummary types',
    fields: [
      ...commonCamelFields,
      'userId',
      'displayName',
      'email',
      'avatarUrl',
      'bio',
      'company',
      'location',
      'website',
    ],
  },
  {
    anchor: 'export interface BirdCoderUserCenterMembershipSummary {',
    label: 'BirdCoderUserCenterMembershipSummary types',
    fields: [
      ...commonCamelFields,
      'userId',
      'planId',
      'planTitle',
      'creditsPerMonth',
      'seats',
      'status',
      'renewAt',
    ],
  },
];

for (const expectation of typeExpectations) {
  assertFields(serverTypesSource, expectation.anchor, expectation.fields, expectation.label);
}

const openApiExpectations = [
  {
    anchor: 'BirdCoderAuthenticatedUserSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderAuthenticatedUserSummary openapi schema',
    fields: [...commonCamelFields, 'id', 'name', 'email', 'avatarUrl'],
  },
  {
    anchor: 'BirdCoderUserCenterSessionSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderUserCenterSessionSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'accessToken',
      'authToken',
      'providerKey',
      'providerMode',
      'sessionId',
      'tokenType',
      'user',
    ],
  },
  {
    anchor: 'BirdCoderUserCenterProfileSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderUserCenterProfileSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'userId',
      'displayName',
      'email',
      'avatarUrl',
      'bio',
      'company',
      'location',
      'website',
    ],
  },
  {
    anchor: 'BirdCoderUserCenterMembershipSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderUserCenterMembershipSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'userId',
      'planId',
      'planTitle',
      'creditsPerMonth',
      'seats',
      'status',
      'renewAt',
    ],
  },
];

for (const expectation of openApiExpectations) {
  assertFields(openApiSource, expectation.anchor, expectation.fields, expectation.label);
}

const dataDefinitionExpectations = [
  {
    anchor: "defineEntity(\n    'user_account'",
    label: 'user_account entity definition',
    fields: ['tenant_id', 'organization_id', 'username', 'nickname', 'provider_key', 'status'],
  },
  {
    anchor: "defineEntity(\n    'vip_subscription'",
    label: 'vip_subscription entity definition',
    fields: [
      'tenant_id',
      'organization_id',
      'user_id',
      'vip_level_id',
      'vip_level_name',
      'status',
      'monthly_credits',
      'seat_limit',
      'valid_to',
    ],
  },
];

for (const expectation of dataDefinitionExpectations) {
  assertFields(dataDefinitionsSource, expectation.anchor, expectation.fields, expectation.label);
}

const rustPayloadExpectations = [
  {
    anchor: 'pub struct UserCenterUserPayload {',
    label: 'UserCenterUserPayload',
    fields: [...commonSnakeFields, 'id', 'name', 'email', 'avatar_url'],
  },
  {
    anchor: 'pub struct UserCenterSessionPayload {',
    label: 'UserCenterSessionPayload',
    fields: [
      ...commonSnakeFields,
      'access_token',
      'auth_token',
      'provider_key',
      'provider_mode',
      'session_id',
      'token_type',
      'user',
    ],
  },
  {
    anchor: 'pub struct UserCenterProfilePayload {',
    label: 'UserCenterProfilePayload',
    fields: [
      ...commonSnakeFields,
      'user_id',
      'display_name',
      'email',
      'avatar_url',
      'bio',
      'company',
      'location',
      'website',
    ],
  },
  {
    anchor: 'pub struct UserCenterVipMembershipPayload {',
    label: 'UserCenterVipMembershipPayload',
    fields: [
      ...commonSnakeFields,
      'user_id',
      'plan_id',
      'plan_title',
      'credits_per_month',
      'seats',
      'status',
      'renew_at',
    ],
  },
];

for (const expectation of rustPayloadExpectations) {
  assertFields(userCenterRustSource, expectation.anchor, expectation.fields, expectation.label);
}

const tableExpectations = [
  {
    tableName: 'plus_tenant',
    fields: ['id', 'uuid', 'code', 'name', 'created_at', 'updated_at'],
  },
  {
    tableName: 'plus_user',
    fields: [...commonSnakeFields, 'username', 'nickname', 'provider_key', 'status'],
  },
  {
    tableName: 'plus_oauth_account',
    fields: [...commonSnakeFields, 'user_id', 'oauth_provider', 'open_id', 'status'],
  },
  {
    tableName: 'plus_vip_user',
    fields: [...commonSnakeFields, 'user_id', 'vip_level_id', 'vip_level_name', 'status'],
  },
  {
    tableName: 'plus_user_auth_session',
    fields: [...commonSnakeFields, 'user_id', 'provider_key', 'provider_mode', 'status'],
  },
  {
    tableName: 'plus_user_verify_code',
    fields: [...commonSnakeFields, 'provider_key', 'verify_type', 'scene', 'target', 'status'],
  },
  {
    tableName: 'plus_user_login_qr',
    fields: [...commonSnakeFields, 'provider_key', 'qr_key', 'session_id', 'user_id', 'status'],
  },
];

const physicalTableExpectations = [
  {
    tableName: 'plus_tenant',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
    },
  },
  {
    tableName: 'plus_user',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
    },
  },
  {
    tableName: 'plus_oauth_account',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
      user_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'plus_vip_user',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
      user_id: 'INTEGER NOT NULL UNIQUE',
    },
  },
  {
    tableName: 'plus_user_auth_session',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
      user_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'plus_user_verify_code',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
    },
  },
  {
    tableName: 'plus_user_login_qr',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      tenant_id: 'INTEGER NULL',
      session_id: 'INTEGER NULL',
      user_id: 'INTEGER NULL',
    },
  },
];

function bodyMatchesColumnType(body, columnName, columnDefinition) {
  return new RegExp(
    `\\b${escapeRegExp(columnName)}\\s+${escapeRegExp(columnDefinition)}\\b`,
    'i',
  ).test(body);
}

for (const expectation of tableExpectations) {
  const bodies = collectCreateTableBodies(userCenterRustSource, expectation.tableName);
  assert(bodies.length > 0, `user_center rust source must declare ${expectation.tableName} table.`);
  for (const body of bodies) {
    for (const fieldName of expectation.fields) {
      assert.match(
        body,
        new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
        `${expectation.tableName} schema must include "${fieldName}".`,
      );
    }
  }
}

for (const expectation of physicalTableExpectations) {
  const bodies = collectCreateTableBodies(userCenterRustSource, expectation.tableName);
  assert(
    bodies.length > 0,
    `user_center rust source must declare ${expectation.tableName} table.`,
  );
  assert(
    bodies.some((body) =>
      Object.entries(expectation.requiredColumns).every(([columnName, columnDefinition]) =>
        bodyMatchesColumnType(body, columnName, columnDefinition),
      ),
    ),
    `${expectation.tableName} schema must expose INTEGER-based storage for ${Object.keys(expectation.requiredColumns).join(', ')}.`,
  );
}

console.log('user center plus entity standard contract passed.');
