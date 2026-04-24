import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverTypesPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);
const infrastructurePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
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
const infrastructureSource = await readFile(infrastructurePath, 'utf8');

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

const serverTypeExpectations = [
  {
    anchor: 'export interface BirdCoderProjectDocumentSummary {',
    label: 'BirdCoderProjectDocumentSummary types',
    fields: [...commonCamelFields, 'projectId', 'documentKind', 'title', 'slug', 'bodyRef', 'status'],
  },
  {
    anchor: 'export interface BirdCoderDeploymentTargetSummary {',
    label: 'BirdCoderDeploymentTargetSummary types',
    fields: [...commonCamelFields, 'projectId', 'name', 'environmentKey', 'runtime', 'status'],
  },
  {
    anchor: 'export interface BirdCoderDeploymentRecordSummary {',
    label: 'BirdCoderDeploymentRecordSummary types',
    fields: [
      ...commonCamelFields,
      'projectId',
      'targetId',
      'releaseRecordId',
      'status',
      'endpointUrl',
      'startedAt',
      'completedAt',
    ],
  },
  {
    anchor: 'export interface BirdCoderReleaseSummary {',
    label: 'BirdCoderReleaseSummary types',
    fields: [...commonCamelFields, 'releaseVersion', 'releaseKind', 'rolloutStage', 'manifest', 'status'],
  },
  {
    anchor: 'export interface BirdCoderAdminAuditEventSummary {',
    label: 'BirdCoderAdminAuditEventSummary types',
    fields: [...commonCamelFields, 'scopeType', 'scopeId', 'eventType', 'payload'],
  },
  {
    anchor: 'export interface BirdCoderAdminPolicySummary {',
    label: 'BirdCoderAdminPolicySummary types',
    fields: [
      ...commonCamelFields,
      'scopeType',
      'scopeId',
      'policyCategory',
      'targetType',
      'targetId',
      'approvalPolicy',
      'rationale',
      'status',
    ],
  },
];

for (const expectation of serverTypeExpectations) {
  assertFields(serverTypesSource, expectation.anchor, expectation.fields, expectation.label);
}

const openApiExpectations = [
  {
    anchor: 'BirdCoderProjectDocumentSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderProjectDocumentSummary openapi schema',
    fields: [...commonCamelFields, 'projectId', 'documentKind', 'title', 'slug', 'bodyRef', 'status'],
  },
  {
    anchor: 'BirdCoderDeploymentTargetSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderDeploymentTargetSummary openapi schema',
    fields: [...commonCamelFields, 'projectId', 'name', 'environmentKey', 'runtime', 'status'],
  },
  {
    anchor: 'BirdCoderDeploymentRecordSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderDeploymentRecordSummary openapi schema',
    fields: [
      ...commonCamelFields,
      'projectId',
      'targetId',
      'releaseRecordId',
      'status',
      'endpointUrl',
      'startedAt',
      'completedAt',
    ],
  },
  {
    anchor: 'BirdCoderReleaseSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderReleaseSummary openapi schema',
    fields: [...commonCamelFields, 'releaseVersion', 'releaseKind', 'rolloutStage', 'manifest', 'status'],
  },
  {
    anchor: 'BirdCoderAdminAuditEventSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderAdminAuditEventSummary openapi schema',
    fields: [...commonCamelFields, 'scopeType', 'scopeId', 'eventType', 'payload'],
  },
  {
    anchor: 'BirdCoderAdminPolicySummary: createOpenApiObjectSchema(',
    label: 'BirdCoderAdminPolicySummary openapi schema',
    fields: [
      ...commonCamelFields,
      'scopeType',
      'scopeId',
      'policyCategory',
      'targetType',
      'targetId',
      'approvalPolicy',
      'rationale',
      'status',
    ],
  },
];

for (const expectation of openApiExpectations) {
  assertFields(openApiSource, expectation.anchor, expectation.fields, expectation.label);
}

const infrastructureExpectations = [
  {
    anchor: 'export interface BirdCoderRepresentativeProjectDocumentRecord {',
    label: 'BirdCoderRepresentativeProjectDocumentRecord',
    fields: [...commonCamelFields, 'projectId', 'documentKind', 'title', 'slug', 'bodyRef', 'status'],
  },
  {
    anchor: 'export interface BirdCoderRepresentativeDeploymentRecord {',
    label: 'BirdCoderRepresentativeDeploymentRecord',
    fields: [
      ...commonCamelFields,
      'projectId',
      'targetId',
      'releaseRecordId',
      'status',
      'endpointUrl',
      'startedAt',
      'completedAt',
    ],
  },
  {
    anchor: 'export interface BirdCoderRepresentativeDeploymentTargetRecord {',
    label: 'BirdCoderRepresentativeDeploymentTargetRecord',
    fields: [...commonCamelFields, 'projectId', 'name', 'environmentKey', 'runtime', 'status'],
  },
  {
    anchor: 'export interface BirdCoderRepresentativeReleaseRecord {',
    label: 'BirdCoderRepresentativeReleaseRecord',
    fields: [...commonCamelFields, 'releaseVersion', 'releaseKind', 'rolloutStage', 'manifest', 'status'],
  },
  {
    anchor: 'export interface BirdCoderRepresentativeAuditRecord {',
    label: 'BirdCoderRepresentativeAuditRecord',
    fields: [...commonCamelFields, 'scopeType', 'scopeId', 'eventType', 'payload'],
  },
  {
    anchor: 'export interface BirdCoderRepresentativePolicyRecord {',
    label: 'BirdCoderRepresentativePolicyRecord',
    fields: [
      ...commonCamelFields,
      'scopeType',
      'scopeId',
      'policyCategory',
      'targetType',
      'targetId',
      'approvalPolicy',
      'rationale',
      'status',
    ],
  },
];

for (const expectation of infrastructureExpectations) {
  assertFields(
    infrastructureSource,
    expectation.anchor,
    expectation.fields,
    expectation.label,
  );
}

for (const { label, path } of rustSources) {
  const rustSource = await readFile(path, 'utf8');

  if (label === 'server') {
    assertFields(
      rustSource,
      'struct DocumentPayload {',
      [...commonSnakeFields, 'project_id', 'document_kind', 'title', 'slug', 'body_ref', 'status'],
      'DocumentPayload',
    );
    assertFields(
      rustSource,
      'struct DeploymentPayload {',
      [
        ...commonSnakeFields,
        'project_id',
        'target_id',
        'release_record_id',
        'status',
        'endpoint_url',
        'started_at',
        'completed_at',
      ],
      'DeploymentPayload',
    );
    assertFields(
      rustSource,
      'struct DeploymentTargetPayload {',
      [...commonSnakeFields, 'project_id', 'name', 'environment_key', 'runtime', 'status'],
      'DeploymentTargetPayload',
    );
    assertFields(
      rustSource,
      'struct ReleasePayload {',
      [...commonSnakeFields, 'release_version', 'release_kind', 'rollout_stage', 'manifest', 'status'],
      'ReleasePayload',
    );
    assertFields(
      rustSource,
      'struct AuditPayload {',
      [...commonSnakeFields, 'scope_type', 'scope_id', 'event_type', 'payload'],
      'AuditPayload',
    );
    assertFields(
      rustSource,
      'struct PolicyPayload {',
      [
        ...commonSnakeFields,
        'scope_type',
        'scope_id',
        'policy_category',
        'target_type',
        'target_id',
        'approval_policy',
        'rationale',
        'status',
      ],
      'PolicyPayload',
    );
  }

  const tableExpectations = [
    {
      tableName: 'project_documents',
      fields: [...commonSnakeFields, 'project_id', 'document_kind', 'title', 'slug', 'body_ref', 'status'],
    },
    {
      tableName: 'deployment_targets',
      fields: [...commonSnakeFields, 'project_id', 'name', 'environment_key', 'runtime', 'status'],
    },
    {
      tableName: 'deployment_records',
      fields: [
        ...commonSnakeFields,
        'project_id',
        'target_id',
        'release_record_id',
        'status',
        'endpoint_url',
        'started_at',
        'completed_at',
      ],
    },
    {
      tableName: 'release_records',
      fields: [...commonSnakeFields, 'release_version', 'release_kind', 'rollout_stage', 'manifest_json', 'status'],
    },
    {
      tableName: 'audit_events',
      fields: [...commonSnakeFields, 'scope_type', 'scope_id', 'event_type', 'payload_json'],
    },
    {
      tableName: 'governance_policies',
      fields: [
        ...commonSnakeFields,
        'scope_type',
        'scope_id',
        'policy_category',
        'target_type',
        'target_id',
        'approval_policy',
        'rationale',
        'status',
      ],
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

console.log('delivery governance plus entity standard contract passed.');
