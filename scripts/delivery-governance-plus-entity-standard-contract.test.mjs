import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  readCanonicalServerRustSource,
  readCanonicalSqliteSchemaBundle,
} from './birdcoder-canonical-server-rust-sources.mjs';

const serverTypesPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiSchemas.ts',
  import.meta.url,
);
const infrastructurePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);

const canonicalSqliteSchemaSource = readCanonicalSqliteSchemaBundle();
const documentModelsSource = readCanonicalServerRustSource(
  'crates/sdkwork-birdcoder-document-service/src/domain/models.rs',
);
const deploymentResultsSource = readCanonicalServerRustSource(
  'crates/sdkwork-birdcoder-deployment-service/src/domain/results.rs',
);
const rustSources = [
  {
    label: 'desktop',
    source: canonicalSqliteSchemaSource,
  },
  {
    label: 'server',
    source: `${documentModelsSource}\n${deploymentResultsSource}\n${canonicalSqliteSchemaSource}`,
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
const iamAuditCamelFields = [
  'id',
  'tenantId',
  'organizationId',
  'actorUserId',
  'action',
  'resourceType',
  'resourceId',
  'traceId',
  'appId',
  'environment',
  'shardingKey',
  'detail',
  'createdAt',
];
const iamPolicyCamelFields = ['id', 'tenantId', 'code', 'name', 'policy', 'status', 'createdAt', 'updatedAt'];

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
    anchor: 'export interface BirdCoderIamAuditEventSummary {',
    label: 'BirdCoderIamAuditEventSummary types',
    fields: iamAuditCamelFields,
  },
  {
    anchor: 'export interface BirdCoderIamPolicySummary {',
    label: 'BirdCoderIamPolicySummary types',
    fields: iamPolicyCamelFields,
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
    anchor: 'BirdCoderIamAuditEventSummary: createOpenApiObjectSchema(',
    label: 'BirdCoderIamAuditEventSummary openapi schema',
    fields: iamAuditCamelFields,
  },
  {
    anchor: 'BirdCoderIamPolicySummary: createOpenApiObjectSchema(',
    label: 'BirdCoderIamPolicySummary openapi schema',
    fields: iamPolicyCamelFields,
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

for (const { label, source: rustSource } of rustSources) {

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
      tableName: 'studio_project_document',
      fields: [...commonSnakeFields, 'project_id', 'document_kind', 'title', 'slug', 'body_ref', 'status'],
    },
    {
      tableName: 'studio_deployment_target',
      fields: [...commonSnakeFields, 'project_id', 'name', 'environment_key', 'runtime', 'status'],
    },
    {
      tableName: 'studio_deployment_record',
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
      tableName: 'ops_release_record',
      fields: [...commonSnakeFields, 'release_version', 'release_kind', 'rollout_stage', 'manifest_json', 'status'],
    },
    {
      tableName: 'ops_audit_event',
      fields: [...commonSnakeFields, 'scope_type', 'scope_id', 'event_type', 'payload_json'],
    },
    {
      tableName: 'ops_governance_policy',
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
