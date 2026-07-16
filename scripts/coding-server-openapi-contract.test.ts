import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { readCanonicalTurnStreamBundle } from './birdcoder-canonical-server-rust-sources.mjs';

import { buildBirdCoderCodingServerOpenApiDocument } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts';

const document = buildBirdCoderCodingServerOpenApiDocument();
const rustServerSource = readCanonicalTurnStreamBundle();
const pcServerApiSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
    import.meta.url,
  ),
  'utf8',
);

function readJsonFixture<T>(url: URL): T {
  return JSON.parse(readFileSync(url, 'utf8').replace(/^\uFEFF/u, '')) as T;
}

type OpenApiParameterLike = {
  in?: string;
  name?: string;
  required?: boolean;
};

type OpenApiOperationWithParameters = {
  parameters?: OpenApiParameterLike[];
};

type OpenApiSchemaProperties = {
  additionalProperties?: boolean;
  allOf?: OpenApiSchemaProperties[];
  properties?: Record<
    string,
    {
      enum?: string[];
      maxLength?: number;
      minLength?: number;
      pattern?: string;
      writeOnly?: boolean;
    }
  >;
  required?: string[];
};

function assertOpenApiParameter(
  operation: OpenApiOperationWithParameters | undefined,
  name: string,
  location: string,
  required: boolean,
): void {
  const parameter = operation?.parameters?.find(
    (candidate) => candidate.name === name && candidate.in === location,
  );
  assert.ok(parameter, `OpenAPI operation must declare ${location} parameter ${name}.`);
  assert.equal(
    parameter.required === true,
    required,
    `OpenAPI ${location} parameter ${name} required state must remain stable.`,
  );
}

assert.equal(document.openapi, '3.1.0');
assert.equal(document.info.title, 'SDKWork BirdCoder Coding Server API');
assert.equal(document.info.version, 'v1');
assert.match(document.info.description, /unified same-port API gateway/i);
assert.equal(document.servers[0]?.url, '/');
assert.deepEqual(document.tags.map((tag) => tag.name), [
  'auth',
  'collaboration',
  'commerce',
  'content',
  'iam',
  'intelligence',
  'oauth',
  'platform',
  'runtime',
  'skills',
  'system',
  'templates',
]);
assert.equal(document.components.securitySchemes.bearerAuth.type, 'http');
assert.equal(document.components.securitySchemes.sdkworkAccessToken.type, 'apiKey');
assert.equal(document.components.securitySchemes.sdkworkAccessToken.in, 'header');
assert.equal(document.components.securitySchemes.sdkworkAccessToken.name, 'Access-Token');
assert.equal(document['x-sdkwork-api-cloud-gateway'].liveOpenApiPath, '/openapi.json');
assert.equal(document['x-sdkwork-api-cloud-gateway'].docsPath, '/docs');
assert.equal(document['x-sdkwork-api-cloud-gateway'].routeCatalogPath, '/app/v3/api/system/routes');
assert.equal(
  document['x-sdkwork-api-cloud-gateway'].routeCount,
  Object.values(document['x-sdkwork-api-cloud-gateway'].routesBySurface).reduce(
    (total, routeCount) => total + routeCount,
    0,
  ),
);
assert.deepEqual(
  document['x-sdkwork-api-cloud-gateway'].surfaces.map((surface) => surface.name),
  ['app', 'backend'],
);
assert.deepEqual(
  document['x-sdkwork-api-cloud-gateway'].surfaces.map((surface) => surface.routeCount),
  [
    document['x-sdkwork-api-cloud-gateway'].routesBySurface.app,
    document['x-sdkwork-api-cloud-gateway'].routesBySurface.backend,
  ],
);
assert.equal(
  document.paths['/api/v1/api-keys']?.post?.responses['201']?.content['application/json']?.schema
    ?.$ref,
  '#/components/schemas/BirdCoderCommerceApiKeyCreatedEnvelope',
  'commerce API key creation must declare the real one-time-secret response envelope.',
);
assert.equal(
  document.paths['/api/v1/api-keys']?.get?.responses['200']?.content['application/json']?.schema
    ?.$ref,
  '#/components/schemas/BirdCoderCommerceApiKeySummaryListEnvelope',
  'commerce API key list must declare the paginated API key summary envelope.',
);
assert.equal(
  document.paths['/api/v1/api-keys/{id}']?.delete?.responses['204']?.content,
  undefined,
  'commerce API key revoke must use API_SPEC delete semantics: 204 with no JSON success body.',
);
assert.equal(
  document.paths['/api/v1/api-keys/{id}']?.delete?.responses['200'],
  undefined,
  'commerce API key revoke must not keep a legacy 200 command envelope.',
);
assert.equal(
  document.paths['/api/v1/api-keys/{id}/rotate']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceApiKeyCreatedEnvelope',
  'commerce API key rotation must declare the real one-time-secret response envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications']?.get?.responses['200']?.content['application/json']
    ?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceNotificationSummaryListEnvelope',
  'commerce notification list must declare the paginated notification envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications']?.post?.responses['201']?.content['application/json']
    ?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceNotificationCreatedEnvelope',
  'commerce notification send must declare the notification-created response envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications/{id}']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceNotificationSummaryEnvelope',
  'commerce notification retrieve must declare the notification summary envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications/unread-count']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceUnreadCountEnvelope',
  'commerce unread-count must declare the unread-count response envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications/{id}/read']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceNotificationReadEnvelope',
  'commerce mark-read must declare the notification-read response envelope.',
);
assert.equal(
  document.paths['/api/v1/notifications/read-all']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceMarkAllReadEnvelope',
  'commerce mark-all-read must declare the bulk read command response envelope.',
);
assert.equal(
  document.paths['/api/v1/usage/record']?.post?.responses['200']?.content['application/json']
    ?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceRecordUsageEnvelope',
  'commerce usage record must declare the usage-record response envelope.',
);
assert.equal(
  document.paths['/api/v1/usage/current-period']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceCurrentPeriodUsageEnvelope',
  'commerce current-period usage must declare the current usage response envelope.',
);
assert.equal(
  document.paths['/api/v1/usage/history']?.get?.responses['200']?.content['application/json']
    ?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceUsageHistoryListEnvelope',
  'commerce usage history must declare the paginated usage history envelope.',
);
assert.equal(
  document.paths['/api/v1/usage/breakdown']?.get?.responses['200']?.content['application/json']
    ?.schema?.$ref,
  '#/components/schemas/BirdCoderCommerceUsageBreakdownEnvelope',
  'commerce usage breakdown must declare the usage breakdown response envelope.',
);
assert.equal(
  document.paths['/api/v1/usage/quota']?.get?.responses['200']?.content['application/json']?.schema
    ?.$ref,
  '#/components/schemas/BirdCoderCommerceQuotaStatusEnvelope',
  'commerce usage quota must declare the quota status response envelope.',
);
const operationsWithoutSuccessSchema = Object.entries(document.paths).flatMap(([pathKey, methods]) =>
  Object.entries(methods ?? {}).flatMap(([methodKey, operation]) => {
    if (operation['x-sdkwork-stream-kind'] === 'websocket') {
      return operation.responses['101']
        ? []
        : [{ method: methodKey.toUpperCase(), operationId: operation.operationId, path: pathKey }];
    }

    const successResponse = operation.responses['200'] ?? operation.responses['201'];
    if (operation.responses['204'] && !operation.responses['204'].content) {
      return [];
    }
    return successResponse?.content?.['application/json']?.schema
      ? []
      : [{ method: methodKey.toUpperCase(), operationId: operation.operationId, path: pathKey }];
  }),
);
assert.deepEqual(operationsWithoutSuccessSchema, []);
const publishedOperationIds = Object.values(document.paths).flatMap((methods) =>
  Object.values(methods ?? {}).map((operation) => operation.operationId),
);
assert.equal(
  publishedOperationIds.length,
  174,
  'OpenAPI must publish 174 HTTP operations; workspace realtime remains catalog-only WebSocket transport.',
);
assert.equal(
  publishedOperationIds.length,
  new Set(publishedOperationIds).size,
  'coding-server OpenAPI operationIds must stay globally unique without implementation-detail aliases.',
);
assert.equal(
  publishedOperationIds.includes('teamGovernance.list'),
  false,
  'backend IAM teams must use the canonical resource operationId teams.list instead of teamGovernance.list.',
);
assert.equal(
  publishedOperationIds.includes('teamGovernance.members.list'),
  false,
  'backend IAM team members must use the canonical resource operationId teams.members.list instead of teamGovernance.members.list.',
);
assert.equal(
  publishedOperationIds.includes('sessions.createWithEmailCode'),
  false,
  'email-code login must reuse POST /auth/sessions through sessions.create instead of publishing a duplicate OpenAPI operation.',
);
assert.equal(
  publishedOperationIds.includes('sessions.createWithPhoneCode'),
  false,
  'phone-code login must reuse POST /auth/sessions through sessions.create instead of publishing a duplicate OpenAPI operation.',
);
const runtimeLocationCollectionPath = '/app/v3/api/projects/{projectId}/runtime_locations';
const workspaceBindingPath = '/app/v3/api/projects/{projectId}/workspace_binding';
const workspaceBinding = document.paths[workspaceBindingPath];

assert.equal(workspaceBinding?.get?.operationId, 'projects.workspaceBinding.retrieve');
assert.equal(workspaceBinding?.put?.operationId, 'projects.workspaceBinding.update');
assert.equal(workspaceBinding?.delete?.operationId, 'projects.workspaceBinding.delete');
assertOpenApiParameter(workspaceBinding?.put, 'If-Match', 'header', false);
assertOpenApiParameter(workspaceBinding?.put, 'Idempotency-Key', 'header', true);
assertOpenApiParameter(workspaceBinding?.delete, 'If-Match', 'header', true);
assert.equal(workspaceBinding?.put?.['x-sdkwork-idempotent'], true);
assert.equal(
  workspaceBinding?.put?.['x-sdkwork-audit-event'],
  'project.workspace_binding.upsert',
);
assert.equal(
  workspaceBinding?.delete?.['x-sdkwork-audit-event'],
  'project.workspace_binding.delete',
);
assert.equal(
  workspaceBinding?.get?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectWorkspaceBindingEnvelope',
);
assert.equal(
  workspaceBinding?.put?.requestBody?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderUpsertProjectWorkspaceBindingRequest',
);
assert.equal(
  workspaceBinding?.put?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectWorkspaceBindingEnvelope',
);
assert.equal(
  workspaceBinding?.delete?.responses['204']?.content,
  undefined,
  'Workspace-binding delete must use 204 with no JSON success body.',
);

const runtimeLocationResourcePath =
  '/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}';
const runtimeLocationRebindPath = `${runtimeLocationResourcePath}/rebind`;
const runtimeLocationVerificationPath = `${runtimeLocationResourcePath}/request_verification`;
const runtimeLocationPreferencesPath =
  '/app/v3/api/projects/{projectId}/runtime_location_preferences';
const runtimeLocationPreferencePath = `${runtimeLocationPreferencesPath}/{capability}`;

const runtimeLocationCollection = document.paths[runtimeLocationCollectionPath];
const runtimeLocationResource = document.paths[runtimeLocationResourcePath];
const runtimeLocationRebind = document.paths[runtimeLocationRebindPath];
const runtimeLocationVerification = document.paths[runtimeLocationVerificationPath];
const runtimeLocationPreferences = document.paths[runtimeLocationPreferencesPath];
const runtimeLocationPreference = document.paths[runtimeLocationPreferencePath];

assert.equal(runtimeLocationCollection?.get?.operationId, 'projects.runtimeLocations.list');
assert.equal(runtimeLocationCollection?.post?.operationId, 'projects.runtimeLocations.create');
assert.equal(runtimeLocationResource?.get?.operationId, 'projects.runtimeLocations.retrieve');
assert.equal(runtimeLocationResource?.patch?.operationId, 'projects.runtimeLocations.update');
assert.equal(runtimeLocationResource?.delete?.operationId, 'projects.runtimeLocations.delete');
assert.equal(runtimeLocationRebind?.post?.operationId, 'projects.runtimeLocations.rebind');
assert.equal(
  runtimeLocationVerification?.post?.operationId,
  'projects.runtimeLocations.requestVerification',
);
assert.equal(
  runtimeLocationPreferences?.get?.operationId,
  'projects.runtimeLocations.preferences.list',
);
assert.equal(
  runtimeLocationPreference?.put?.operationId,
  'projects.runtimeLocations.preferences.update',
);

assertOpenApiParameter(runtimeLocationCollection?.get, 'page', 'query', false);
assertOpenApiParameter(runtimeLocationCollection?.get, 'page_size', 'query', false);
assertOpenApiParameter(runtimeLocationCollection?.post, 'Idempotency-Key', 'header', true);
assertOpenApiParameter(runtimeLocationResource?.patch, 'If-Match', 'header', true);
assertOpenApiParameter(runtimeLocationResource?.delete, 'If-Match', 'header', true);
assertOpenApiParameter(runtimeLocationRebind?.post, 'If-Match', 'header', true);
assertOpenApiParameter(runtimeLocationRebind?.post, 'Idempotency-Key', 'header', true);
assertOpenApiParameter(runtimeLocationVerification?.post, 'If-Match', 'header', true);
assertOpenApiParameter(runtimeLocationVerification?.post, 'Idempotency-Key', 'header', true);
assertOpenApiParameter(runtimeLocationPreferences?.get, 'page', 'query', false);
assertOpenApiParameter(runtimeLocationPreferences?.get, 'page_size', 'query', false);
assertOpenApiParameter(runtimeLocationPreference?.put, 'If-Match', 'header', false);
assertOpenApiParameter(runtimeLocationPreference?.put, 'Idempotency-Key', 'header', true);

assert.equal(
  runtimeLocationCollection?.get?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationListEnvelope',
);
assert.equal(
  runtimeLocationCollection?.post?.requestBody?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderCreateProjectRuntimeLocationRequest',
);
assert.equal(
  runtimeLocationCollection?.post?.responses['201']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationEnvelope',
);
assert.equal(
  runtimeLocationResource?.get?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationEnvelope',
);
assert.equal(
  runtimeLocationResource?.patch?.requestBody?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderUpdateProjectRuntimeLocationRequest',
);
assert.equal(
  runtimeLocationResource?.patch?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationEnvelope',
);
assert.equal(
  runtimeLocationResource?.delete?.responses['204']?.content,
  undefined,
  'Runtime-location delete must use 204 with no JSON success body.',
);
assert.equal(
  runtimeLocationRebind?.post?.requestBody?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderRebindProjectRuntimeLocationRequest',
);
assert.equal(
  runtimeLocationRebind?.post?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationCommandEnvelope',
);
assert.equal(
  runtimeLocationVerification?.post?.requestBody,
  undefined,
  'Verification must request trusted-target work, not accept renderer-supplied health or path payloads.',
);
assert.equal(
  runtimeLocationVerification?.post?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationCommandEnvelope',
);
assert.equal(
  runtimeLocationPreferences?.get?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationPreferenceListEnvelope',
);
assert.equal(
  runtimeLocationPreference?.put?.requestBody?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderSetProjectRuntimeLocationPreferenceRequest',
);
assert.equal(
  runtimeLocationPreference?.put?.responses['200']?.content['application/json']?.schema?.$ref,
  '#/components/schemas/BirdCoderProjectRuntimeLocationPreferenceEnvelope',
);

const runtimeLocationResponseSchema = document.components.schemas
  .BirdCoderProjectRuntimeLocation as OpenApiSchemaProperties;
const workspaceBindingResponseSchema = document.components.schemas
  .BirdCoderProjectWorkspaceBinding as OpenApiSchemaProperties;
const workspaceBindingRequestSchema = document.components.schemas
  .BirdCoderUpsertProjectWorkspaceBindingRequest as OpenApiSchemaProperties;
const runtimeLocationPreferenceSchema = document.components.schemas
  .BirdCoderProjectRuntimeLocationPreference as OpenApiSchemaProperties;
const projectSummarySchema = document.components.schemas
  .BirdCoderProjectSummary as OpenApiSchemaProperties;
const createRuntimeLocationRequestSchema = document.components.schemas
  .BirdCoderCreateProjectRuntimeLocationRequest as OpenApiSchemaProperties;
const updateRuntimeLocationRequestSchema = document.components.schemas
  .BirdCoderUpdateProjectRuntimeLocationRequest as OpenApiSchemaProperties;
const rebindRuntimeLocationRequestSchema = document.components.schemas
  .BirdCoderRebindProjectRuntimeLocationRequest as OpenApiSchemaProperties;
const createRuntimeLocationProperties = Object.assign(
  {},
  ...(createRuntimeLocationRequestSchema.allOf ?? []).map((schema) => schema.properties ?? {}),
);

assert.equal(workspaceBindingResponseSchema.additionalProperties, false);
assert.equal(workspaceBindingRequestSchema.additionalProperties, false);
assert.deepEqual(workspaceBindingRequestSchema.required, [
  'logicalPath',
  'rootEntryId',
  'sandboxId',
]);
assert.equal(workspaceBindingRequestSchema.properties?.sandboxId?.minLength, 1);
assert.equal(workspaceBindingRequestSchema.properties?.sandboxId?.maxLength, 512);
assert.equal(workspaceBindingRequestSchema.properties?.rootEntryId?.minLength, 1);
assert.equal(workspaceBindingRequestSchema.properties?.rootEntryId?.maxLength, 512);

const opaqueDriveIdPattern = new RegExp(
  workspaceBindingRequestSchema.properties?.sandboxId?.pattern ?? '',
  'u',
);
assert.equal(opaqueDriveIdPattern.test('sandbox:primary'), true);
assert.equal(opaqueDriveIdPattern.test(' sandbox:primary'), false);
assert.equal(opaqueDriveIdPattern.test('sandbox:primary '), false);

const workspaceBindingLogicalPathPattern = new RegExp(
  workspaceBindingRequestSchema.properties?.logicalPath?.pattern ?? '',
  'u',
);
for (const acceptedLogicalPath of ['', 'src', 'source files/ feature ']) {
  assert.equal(
    workspaceBindingLogicalPathPattern.test(acceptedLogicalPath),
    true,
    `Workspace-binding logical path must accept canonical value ${JSON.stringify(acceptedLogicalPath)}.`,
  );
}
for (const rejectedLogicalPath of ['/absolute', 'src//feature', 'src/../feature', 'src\\feature', 'src/\u0000feature']) {
  assert.equal(
    workspaceBindingLogicalPathPattern.test(rejectedLogicalPath),
    false,
    `Workspace-binding logical path must reject non-canonical value ${JSON.stringify(rejectedLogicalPath)}.`,
  );
}

for (const sensitiveBindingField of [
  'absolutePath',
  'browserHandle',
  'filesystemHandle',
  'physicalPath',
  'providerRoot',
  'providerRootRef',
  'tauriPath',
]) {
  assert.equal(
    workspaceBindingResponseSchema.properties?.[sensitiveBindingField],
    undefined,
    `Workspace-binding responses must not reveal ${sensitiveBindingField}.`,
  );
  assert.equal(
    workspaceBindingRequestSchema.properties?.[sensitiveBindingField],
    undefined,
    `Workspace-binding requests must not persist ${sensitiveBindingField}.`,
  );
}

assert.equal(
  createRuntimeLocationProperties.absolutePath?.writeOnly,
  true,
  'Runtime-location create must declare absolutePath as a write-only sensitive input.',
);
assert.equal(
  createRuntimeLocationRequestSchema.allOf?.some((schema) => schema.required?.includes('absolutePath')),
  true,
  'Runtime-location create must require the write-only absolutePath input.',
);
assert.equal(
  rebindRuntimeLocationRequestSchema.properties?.absolutePath?.writeOnly,
  true,
  'Runtime-location rebind must declare replacement absolutePath as write-only.',
);
assert.equal(
  rebindRuntimeLocationRequestSchema.required?.includes('absolutePath'),
  true,
  'Runtime-location rebind must require replacement absolutePath.',
);
assert.equal(
  updateRuntimeLocationRequestSchema.properties?.absolutePath,
  undefined,
  'Generic runtime-location update must not silently replace the protected root.',
);
assert.deepEqual(
  runtimeLocationPreferenceSchema.properties?.capability?.enum,
  ['terminal', 'git', 'build', 'file_system'],
  'Runtime-location preferences must use the canonical terminal/git/build/file_system capability vocabulary.',
);
for (const sensitivePathField of ['absolutePath', 'cwd', 'rootPath', 'sitePath']) {
  assert.equal(
    runtimeLocationResponseSchema.properties?.[sensitivePathField],
    undefined,
    `Runtime-location responses must not reveal ${sensitivePathField}.`,
  );
  assert.equal(
    projectSummarySchema.properties?.[sensitivePathField],
    undefined,
    `Generic Project responses must not reveal ${sensitivePathField}.`,
  );
}
for (const oldAppbasePath of [
  '/app/v3/api/auth/email_login',
  '/app/v3/api/auth/password_login',
  '/app/v3/api/auth/password_reset',
  '/app/v3/api/auth/phone_login',
  '/app/v3/api/auth/qr_generate',
  '/app/v3/api/auth/qr_status/{qrKey}',
  '/app/v3/api/auth/config',
  '/app/v3/api/auth/session',
  '/app/v3/api/auth/session_exchanges',
  '/app/v3/api/auth/qr_login_codes',
  '/app/v3/api/auth/qr_login_codes/{qrKey}',
  '/app/v3/api/auth/qr_login_codes/{qrKey}/entry',
  '/app/v3/api/auth/qr_login_codes/{qrKey}/callback',
  '/app/v3/api/auth/qr_login_codes/confirm',
  '/app/v3/api/auth/verify_send',
  '/app/v3/api/iam/user_profile',
  '/app/v3/api/billing/vip_info',
  '/app/v3/api/billing/vip/info',
]) {
  assert.equal(
    document.paths[oldAppbasePath],
    undefined,
    `${oldAppbasePath} must not be exposed because BirdCoder uses the canonical SDKWork IAM and commerce route set.`,
  );
}
assert.equal(document.paths['/app/v3/api/system/routes']?.get?.operationId, 'routes.list');
assert.equal(document.paths['/app/v3/api/system/routes']?.get?.['x-sdkwork-auth-mode'], 'user');
assert.equal(document.paths['/app/v3/api/native_sessions']?.get?.operationId, 'nativeSessions.list');
assert.equal(document.paths['/app/v3/api/native_sessions/{id}']?.get?.operationId, 'nativeSessions.retrieve');
assert.equal(document.paths['/app/v3/api/intelligence/coding_sessions']?.post?.operationId, 'codingSessions.create');
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions']?.post?.['x-sdkwork-resource'],
  'birdcoder.intelligence-coding-sessions',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions']?.post?.['x-sdkwork-permission'],
  'birdcoder.intelligence-coding-sessions.create',
);
assert.equal(document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.patch?.operationId, 'codingSessions.update');
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.patch?.['x-sdkwork-resource'],
  'birdcoder.intelligence-coding-sessions',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.patch?.['x-sdkwork-permission'],
  'birdcoder.intelligence-coding-sessions.update',
);
assert.equal(document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.delete?.operationId, 'codingSessions.delete');
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.delete?.['x-sdkwork-resource'],
  'birdcoder.intelligence-coding-sessions',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.delete?.['x-sdkwork-permission'],
  'birdcoder.intelligence-coding-sessions.delete',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/fork']?.post?.operationId,
  'codingSessions.forks.create',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/fork']?.post?.['x-sdkwork-resource'],
  'birdcoder.intelligence-coding-sessions-forks',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/fork']?.post?.['x-sdkwork-permission'],
  'birdcoder.intelligence-coding-sessions-forks.create',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/events']?.get?.operationId,
  'codingSessions.events.list',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/events']?.get?.['x-sdkwork-resource'],
  'birdcoder.intelligence-coding-sessions-events',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/events']?.get?.['x-sdkwork-permission'],
  'birdcoder.intelligence-coding-sessions-events.read',
);
assert.equal(document.paths['/app/v3/api/operations/{operationId}']?.get?.operationId, 'operations.retrieve');
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/questions/{questionId}/answer']?.post
    ?.operationId,
  'codingSessions.questions.answers.create',
);
assert.equal(document.paths['/app/v3/api/system/iam/runtime']?.get?.operationId, 'iam.runtime.retrieve');
assert.equal(
  document.paths['/app/v3/api/system/iam/verification_policy']?.get?.operationId,
  'iam.verificationPolicy.retrieve',
);
assert.equal(document.paths['/app/v3/api/auth/sessions/current']?.get?.operationId, 'sessions.current.retrieve');
assert.equal(document.paths['/app/v3/api/auth/sessions/current']?.patch?.operationId, 'sessions.current.update');
assert.equal(document.paths['/app/v3/api/auth/sessions/current']?.delete?.operationId, 'sessions.current.delete');
assert.equal(document.paths['/app/v3/api/auth/sessions']?.post?.operationId, 'sessions.create');
assert.equal(
  document.paths['/app/v3/api/auth/sessions/refresh']?.post?.operationId,
  'sessions.refresh',
);
assert.equal(
  document.paths['/app/v3/api/oauth/authorization_urls']?.post?.operationId,
  'oauth.authorizationUrls.create',
);
assert.ok(
  document.paths['/app/v3/api/oauth/authorization_urls']?.post?.requestBody,
  'OAuth authorization URL creation must use the appbase POST body contract.',
);
assert.equal(
  document.paths['/app/v3/api/oauth/device_authorizations']?.post?.operationId,
  'oauth.deviceAuthorizations.create',
);
assert.ok(
  document.paths['/app/v3/api/oauth/device_authorizations']?.post?.requestBody,
  'OAuth device authorization creation must use the appbase POST body contract.',
);
assert.equal(
  document.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}']?.get?.operationId,
  'oauth.deviceAuthorizations.retrieve',
);
assert.equal(
  document.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}/scans']?.post
    ?.operationId,
  'oauth.deviceAuthorizations.scans.create',
);
assert.equal(
  document.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}/password_completions']?.post
    ?.operationId,
  'oauth.deviceAuthorizations.passwordCompletions.create',
);
assert.equal(
  document.paths['/app/v3/api/open_platform/qr_auth/sessions'],
  undefined,
  'BirdCoder OpenAPI must not publish retired appbase openPlatform QR auth session routes.',
);
assert.equal(
  document.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}'],
  undefined,
  'BirdCoder OpenAPI must not publish retired appbase openPlatform QR auth status routes.',
);
assert.equal(
  document.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}/scans'],
  undefined,
  'BirdCoder OpenAPI must not publish retired appbase openPlatform QR auth scan routes.',
);
assert.equal(
  document.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}/passwords'],
  undefined,
  'BirdCoder OpenAPI must not publish retired appbase openPlatform QR auth password routes.',
);
assert.equal(
  document.paths['/app/v3/api/auth/oauth_authorization_urls'],
  undefined,
  'BirdCoder OpenAPI must not publish the retired appbase auth/oauth_authorization_urls route.',
);
assert.equal(
  document.paths['/app/v3/api/oauth/sessions']?.post?.operationId,
  'oauth.sessions.create',
);
assert.equal(
  document.paths['/app/v3/api/auth/oauth_sessions'],
  undefined,
  'BirdCoder OpenAPI must not publish the retired appbase auth/oauth_sessions route.',
);
assert.equal(document.paths['/app/v3/api/auth/registrations']?.post?.operationId, 'registrations.create');
assert.equal(
  document.paths['/app/v3/api/auth/verification_codes'],
  undefined,
  'BirdCoder OpenAPI must not publish messaging-owned verification-code delivery routes.',
);
assert.equal(
  document.paths['/app/v3/api/auth/verification_codes/verify'],
  undefined,
  'BirdCoder OpenAPI must not publish messaging-owned verification-code verify routes.',
);
assert.equal(
  document.paths['/app/v3/api/auth/password_reset_requests']?.post?.operationId,
  'passwordResetRequests.create',
);
assert.equal(
  document.paths['/app/v3/api/auth/password_resets']?.post?.operationId,
  'passwordResets.create',
);
assert.equal(document.paths['/app/v3/api/iam/users/current']?.get?.operationId, 'users.current.retrieve');
assert.equal(document.paths['/app/v3/api/iam/users/current']?.patch?.operationId, 'users.current.update');
assert.equal(
  document.paths['/app/v3/api/memberships/current']?.get?.operationId,
  'memberships.current.retrieve',
);
assert.equal(
  document.paths['/app/v3/api/memberships/current']?.get?.['x-sdkwork-domain'],
  'commerce',
);
assert.equal(
  document.paths['/app/v3/api/memberships/current']?.patch,
  undefined,
  'Current membership is commerce read state; BirdCoder must not keep a local patch mutation endpoint.',
);
assert.equal(
  document.paths['/app/v3/api/memberships/package_groups']?.get?.operationId,
  'memberships.packageGroups.list',
);
assert.equal(
  document.paths['/app/v3/api/memberships/package_groups']?.get?.['x-sdkwork-domain'],
  'commerce',
);
assert.equal(
  document.paths['/app/v3/api/memberships/package_groups']?.patch,
  undefined,
  'Membership package groups are commerce catalog read state; BirdCoder must not keep a local patch mutation endpoint.',
);
assert.equal(document.paths['/app/v3/api/projects']?.get?.operationId, 'projects.list');
assert.equal(document.paths['/app/v3/api/projects']?.post?.operationId, 'projects.create');
assertOpenApiParameter(
  document.paths['/app/v3/api/projects/{projectId}/git/overview']?.get,
  'runtime_location_id',
  'query',
  true,
);
assertOpenApiParameter(
  document.paths['/app/v3/api/projects/{projectId}/git/diff']?.get,
  'runtime_location_id',
  'query',
  true,
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/overview']?.get?.operationId,
  'projects.git.overview.retrieve',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.operationId,
  'projects.git.branches.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.operationId,
  'projects.git.branchSwitch.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.operationId,
  'projects.git.commits.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.operationId,
  'projects.git.pushes.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.operationId,
  'projects.git.worktrees.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktree_removals']?.post?.operationId,
  'projects.git.worktreeRemovals.create',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktree_prune']?.post?.operationId,
  'projects.git.worktreePrune.create',
);
assert.equal(document.paths['/app/v3/api/projects/{projectId}']?.patch?.operationId, 'projects.update');
assert.equal(document.paths['/app/v3/api/projects/{projectId}']?.delete?.operationId, 'projects.delete');
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/publish']?.post?.operationId,
  'projects.publish.publish',
);
assert.equal(document.paths['/app/v3/api/workspaces']?.post?.operationId, 'workspaces.create');
assert.equal(document.paths['/app/v3/api/workspaces/{workspaceId}']?.patch?.operationId, 'workspaces.update');
assert.equal(document.paths['/app/v3/api/workspaces/{workspaceId}']?.delete?.operationId, 'workspaces.delete');
assert.equal(
  document.paths['/app/v3/api/workspaces/{workspaceId}/realtime'],
  undefined,
  'SSE/WebSocket realtime subscribe remains in the route catalog and must not be emitted as a request/response OpenAPI operation.',
);
assert.equal(document.paths['/app/v3/api/teams']?.get?.operationId, 'workspaceTeams.list');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-domain'], 'collaboration');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-resource'], 'birdcoder.collaboration-workspace-teams');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-permission'], 'birdcoder.collaboration-workspace-teams.read');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.operationId, 'teams.list');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-resource'], 'birdcoder.iam-teams');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-permission'], 'birdcoder.iam-teams.read');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.operationId, 'users.list');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-resource'], 'birdcoder.iam-users');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-permission'], 'birdcoder.iam-users.read');
assert.equal(
  document.paths['/backend/v3/api/iam/users']?.get?.responses['200']?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamUserSummaryListEnvelope',
);
assert.equal(document.paths['/backend/v3/api/iam/users']?.post?.operationId, 'users.create');
assert.equal(
  document.paths['/backend/v3/api/iam/users']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateIamUserRequest',
);
assert.equal(document.paths['/backend/v3/api/iam/users/{userId}']?.get?.operationId, 'users.retrieve');
assert.equal(document.paths['/backend/v3/api/iam/users/{userId}']?.patch?.operationId, 'users.update');
assert.equal(document.paths['/backend/v3/api/iam/users/{userId}']?.delete?.operationId, 'users.delete');
assert.equal(
  document.paths['/app/v3/api/iam/role_bindings']?.get?.operationId,
  'roleBindings.list',
);
assert.equal(document.paths['/app/v3/api/iam/role_bindings']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/app/v3/api/iam/role_bindings']?.get?.['x-sdkwork-resource'], 'birdcoder.iam-role-bindings');
assert.equal(
  document.paths['/app/v3/api/iam/role_bindings']?.get?.['x-sdkwork-permission'],
  'birdcoder.iam-role-bindings.read',
);
assert.equal(
  document.paths['/app/v3/api/iam/role_bindings']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamUserRoleSummaryListEnvelope',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings']?.post?.operationId,
  'roleBindings.create',
);
assert.equal(document.paths['/backend/v3/api/iam/role_bindings']?.post?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/role_bindings']?.post?.['x-sdkwork-resource'], 'birdcoder.iam-role-bindings');
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings']?.post?.['x-sdkwork-permission'],
  'birdcoder.iam-role-bindings.create',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.operationId,
  'roleBindings.delete',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.['x-sdkwork-domain'],
  'iam',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.['x-sdkwork-resource'],
  'birdcoder.iam-role-bindings',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.['x-sdkwork-permission'],
  'birdcoder.iam-role-bindings.delete',
);
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.operationId, 'teams.members.list');
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-resource'], 'birdcoder.iam-teams-members');
assert.equal(
  document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-permission'],
  'birdcoder.iam-teams-members.read',
);
assert.equal(document.paths['/backend/v3/api/releases']?.get?.operationId, 'releases.list');
assert.ok(document.components.schemas?.BirdCoderCodingSessionSummary);
const codingSessionSummaryRequired = Array.isArray(
  document.components.schemas?.BirdCoderCodingSessionSummary?.required,
)
  ? document.components.schemas.BirdCoderCodingSessionSummary.required
  : [];
assert.ok(
  codingSessionSummaryRequired.includes('modelId'),
  'coding session summary schema must require modelId so server contracts match immutable session engine/model selection.',
);
const initialCodingSessionSummaryProperties =
  (document.components.schemas?.BirdCoderCodingSessionSummary?.properties ?? {}) as Record<
    string,
    { type?: string }
  >;
assert.ok(
  initialCodingSessionSummaryProperties.nativeSessionId,
  'coding session summary schema must expose nativeSessionId so terminal resume can use the provider-native session id instead of the BirdCoder session id.',
);
assert.equal(
  initialCodingSessionSummaryProperties.nativeSessionId.type,
  'string',
  'BirdCoderCodingSessionSummary.nativeSessionId must be a string when present.',
);
assert.equal(
  codingSessionSummaryRequired.includes('nativeSessionId'),
  false,
  'nativeSessionId is optional because newly-created sessions may not have a provider session until the first engine turn completes.',
);
assert.ok(document.components.schemas?.BirdCoderCreateCodingSessionRequest);
const createCodingSessionRequestRequired = Array.isArray(
  document.components.schemas?.BirdCoderCreateCodingSessionRequest?.required,
)
  ? document.components.schemas.BirdCoderCreateCodingSessionRequest.required
  : [];
assert.ok(
  createCodingSessionRequestRequired.includes('engineId') &&
    createCodingSessionRequestRequired.includes('modelId') &&
    createCodingSessionRequestRequired.includes('runtimeLocationId'),
  'create coding session request schema must require explicit engineId, modelId, and runtimeLocationId.',
);
assert.ok(document.components.schemas?.BirdCoderUpdateCodingSessionRequest);
assert.ok(document.components.schemas?.BirdCoderForkCodingSessionRequest);
assert.ok(document.components.schemas?.BirdCoderDeleteCodingSessionMessageResult);
assert.ok(document.components.schemas?.BirdCoderCreateCodingSessionTurnRequest);
assert.ok(document.components.schemas?.BirdCoderWorkspaceSummary);
assert.ok(document.components.schemas?.BirdCoderProjectSummary);
const workspaceSummaryProperties = document.components.schemas.BirdCoderWorkspaceSummary
  .properties as Record<string, { type?: string }>;
const createWorkspaceRequestProperties = document.components.schemas.BirdCoderCreateWorkspaceRequest
  .properties as Record<string, { type?: string }>;
const updateWorkspaceRequestProperties = document.components.schemas.BirdCoderUpdateWorkspaceRequest
  .properties as Record<string, { type?: string }>;
const projectSummaryProperties = document.components.schemas.BirdCoderProjectSummary
  .properties as Record<string, { type?: string }>;
const codingSessionSummaryProperties = document.components.schemas.BirdCoderCodingSessionSummary
  .properties as Record<string, { type?: string }>;
const codingSessionEventProperties = document.components.schemas.BirdCoderCodingSessionEvent
  .properties as Record<string, { type?: string }>;
const createCodingSessionTurnRequestProperties = document.components.schemas
  .BirdCoderCreateCodingSessionTurnRequest.properties as Record<string, { type?: string }>;
const nativeSessionSummaryProperties = document.components.schemas.BirdCoderNativeSessionSummary
  .properties as Record<string, { type?: string }>;
const nativeSessionAttributesProperties = document.components.schemas.BirdCoderNativeSessionAttributes
  .properties as Record<string, { type?: string }>;
const createProjectRequestProperties = document.components.schemas.BirdCoderCreateProjectRequest
  .properties as Record<string, { type?: string }>;
const updateProjectRequestProperties = document.components.schemas.BirdCoderUpdateProjectRequest
  .properties as Record<string, { type?: string }>;
const skillCatalogEntryProperties = document.components.schemas.BirdCoderSkillCatalogEntrySummary
  .properties as Record<string, { type?: string }>;
const skillPackageProperties = document.components.schemas.BirdCoderSkillPackageSummary
  .properties as Record<string, { type?: string }>;
const commerceMembershipCurrentProperties = document.components.schemas.BirdCoderCommerceMembershipCurrentSummary
  .properties as Record<string, { type?: string }>;
const standardDataScopeEnum = ['DEFAULT', 'PRIVATE', 'ORGANIZATION', 'TENANT', 'PUBLIC'];
assert.equal(
  codingSessionSummaryProperties.runtimeLocationId?.type,
  'string',
  'coding session summaries must expose the opaque runtime-location binding when one was persisted.',
);
assert.equal(
  codingSessionSummaryRequired.includes('runtimeLocationId'),
  false,
  'legacy coding sessions may omit runtimeLocationId and must remain readable while execution fails closed.',
);
assert.equal(
  nativeSessionAttributesProperties.cwd,
  undefined,
  'public native session attributes must not expose a local cwd.',
);
assert.equal(
  nativeSessionSummaryProperties.nativeCwd,
  undefined,
  'public native session summaries must not expose a local nativeCwd.',
);
for (const [schemaName, properties] of [
  ['BirdCoderWorkspaceSummary', workspaceSummaryProperties],
  ['BirdCoderCreateWorkspaceRequest', createWorkspaceRequestProperties],
  ['BirdCoderUpdateWorkspaceRequest', updateWorkspaceRequestProperties],
] as const) {
  assert.deepEqual(
    (properties.dataScope as { enum?: unknown })?.enum,
    standardDataScopeEnum,
    `${schemaName}.dataScope must expose the DATABASE_SPEC.md standard enum.`,
  );
  assert.equal(
    properties.maxStorage?.type,
    'string',
    `${schemaName}.maxStorage must be a string because it maps to a Java Long/BIGINT field.`,
  );
  assert.equal(
    properties.usedStorage?.type,
    'string',
    `${schemaName}.usedStorage must be a string because it maps to a Java Long/BIGINT field.`,
  );
}
for (const [schemaName, properties] of [
  ['BirdCoderProjectSummary', projectSummaryProperties],
] as const) {
  assert.deepEqual(
    (properties.dataScope as { enum?: unknown })?.enum,
    standardDataScopeEnum,
    `${schemaName}.dataScope must expose the DATABASE_SPEC.md standard enum.`,
  );
  assert.equal(
    properties.budgetAmount?.type,
    'string',
    `${schemaName}.budgetAmount must be a string because it maps to a Java Long/BIGINT field.`,
  );
}

function assertPublicSchemaShape(
  schemaName: string,
  expectedFields: readonly string[],
  expectedRequiredFields: readonly string[],
): void {
  const schema = document.components.schemas?.[schemaName] as
    | { properties?: Record<string, unknown>; required?: unknown }
    | undefined;
  assert.ok(schema, `${schemaName} must be published.`);
  assert.deepEqual(
    Object.keys(schema.properties ?? {}).sort(),
    [...expectedFields].sort(),
    `${schemaName} must expose exactly the approved public fields.`,
  );
  const requiredFields = Array.isArray(schema.required)
    ? schema.required.map((field) => String(field))
    : [];
  assert.deepEqual(
    requiredFields.sort(),
    [...expectedRequiredFields].sort(),
    `${schemaName} must declare exactly the approved required fields.`,
  );
}

assertPublicSchemaShape(
  'BirdCoderProjectSummary',
  [
    'author',
    'budgetAmount',
    'code',
    'collaboratorCount',
    'conversationId',
    'coverImage',
    'createdAt',
    'createdByUserId',
    'dataScope',
    'description',
    'domainPrefix',
    'endTime',
    'fileId',
    'id',
    'isTemplate',
    'leaderId',
    'name',
    'organizationId',
    'ownerId',
    'parentId',
    'parentMetadata',
    'parentUuid',
    'startTime',
    'status',
    'tenantId',
    'title',
    'type',
    'updatedAt',
    'userId',
    'uuid',
    'viewerRole',
    'workspaceId',
    'workspaceUuid',
  ],
  ['createdAt', 'id', 'workspaceId', 'name', 'status', 'updatedAt'],
);
assertPublicSchemaShape(
  'BirdCoderCreateProjectRequest',
  ['description', 'name', 'workspaceId'],
  ['name', 'workspaceId'],
);
assertPublicSchemaShape(
  'BirdCoderUpdateProjectRequest',
  ['description', 'name', 'status'],
  [],
);
assertPublicSchemaShape(
  'BirdCoderGitStatusCounts',
  ['staged', 'unstaged', 'untracked'],
  ['staged', 'unstaged', 'untracked'],
);
assertPublicSchemaShape(
  'BirdCoderGitBranchSummary',
  ['isCurrent', 'isRemote', 'name'],
  ['isCurrent', 'isRemote', 'name'],
);
assertPublicSchemaShape(
  'BirdCoderGitWorktreeSummary',
  ['branch', 'head', 'isCurrent', 'prunableReason', 'worktreeKey'],
  ['isCurrent'],
);
assertPublicSchemaShape(
  'BirdCoderProjectGitOverview',
  ['branches', 'currentBranch', 'currentRevision', 'detachedHead', 'status', 'statusCounts', 'worktrees'],
  ['branches', 'detachedHead', 'status', 'statusCounts', 'worktrees'],
);
assertPublicSchemaShape(
  'BirdCoderCreateProjectGitBranchRequest',
  ['branchName', 'runtimeLocationId'],
  ['branchName', 'runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderSwitchProjectGitBranchRequest',
  ['branchName', 'runtimeLocationId'],
  ['branchName', 'runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderCommitProjectGitChangesRequest',
  ['includeUnstaged', 'message', 'runtimeLocationId'],
  ['message', 'runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderPushProjectGitBranchRequest',
  ['branchName', 'remoteName', 'runtimeLocationId'],
  ['runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderCreateProjectGitWorktreeRequest',
  ['branchName', 'runtimeLocationId'],
  ['branchName', 'runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderRemoveProjectGitWorktreeRequest',
  ['force', 'runtimeLocationId', 'worktreeKey'],
  ['runtimeLocationId', 'worktreeKey'],
);
assertPublicSchemaShape(
  'BirdCoderPruneProjectGitWorktreesRequest',
  ['runtimeLocationId'],
  ['runtimeLocationId'],
);
assertPublicSchemaShape(
  'BirdCoderUpsertProjectCollaboratorRequest',
  ['role', 'status', 'userId'],
  ['userId'],
);
const projectCollaboratorRequestProperties = document.components.schemas
  .BirdCoderUpsertProjectCollaboratorRequest.properties as Record<string, { enum?: unknown }>;
assert.deepEqual(
  projectCollaboratorRequestProperties.status?.enum,
  ['invited', 'active', 'suspended'],
  'Project collaborator writes must expose only the Rust repository status whitelist.',
);
const projectListParameters = (document.paths['/app/v3/api/projects']?.get?.parameters ?? []) as Array<{
  name?: string;
}>;
assert.equal(
  projectListParameters.some((parameter) => parameter.name === 'rootPath'),
  false,
  'projects.list must not expose a client filesystem rootPath query parameter.',
);
assert.equal(
  codingSessionSummaryProperties.sortTimestamp?.type,
  'string',
  'BirdCoderCodingSessionSummary.sortTimestamp must be a string because coding_session.sort_timestamp is a BIGINT field.',
);
assert.equal(
  nativeSessionSummaryProperties.sortTimestamp?.type,
  'string',
  'BirdCoderNativeSessionSummary.sortTimestamp must be a string because native session records store epoch millis in an i64/BIGINT field.',
);
assert.equal(
  codingSessionEventProperties.sequence?.type,
  'string',
  'BirdCoderCodingSessionEvent.sequence must be a string because coding_session_events.sequence_no is a BIGINT field.',
);
assert.equal(
  createCodingSessionTurnRequestProperties.stream?.type,
  'boolean',
  'create coding session turn request schema must expose stream as a compatibility hint while the server standard always executes streamed turns.',
);
assert.equal(
  createCodingSessionTurnRequestProperties.engineId,
  undefined,
  'A turn must inherit its immutable engine from the persisted coding session instead of accepting an engine override.',
);
assert.equal(
  createCodingSessionTurnRequestProperties.modelId,
  undefined,
  'A turn must inherit its immutable model from the persisted coding session instead of accepting a model override.',
);
const authoredCreateCodingSessionTurnRequest =
  pcServerApiSource.match(/export interface BirdCoderCreateCodingSessionTurnRequest \{[\s\S]*?\n\}/)?.[0] ?? '';
assert.match(
  authoredCreateCodingSessionTurnRequest,
  /runtimeId\?: string;[\s\S]*requestKind:[\s\S]*inputSummary:[\s\S]*stream\?: boolean;/,
  'The authored PC turn contract must retain runtime and streaming controls.',
);
assert.doesNotMatch(
  authoredCreateCodingSessionTurnRequest,
  /engineId\?:/,
  'The authored PC turn contract must not expose a per-turn engine override.',
);
assert.doesNotMatch(
  authoredCreateCodingSessionTurnRequest,
  /modelId\?:/,
  'The authored PC turn contract must not expose a per-turn model override.',
);
assert.match(
  rustServerSource,
  /pub struct CreateCodingSessionTurnRequest \{[\s\S]*pub stream: Option<bool>/,
  'Rust create-turn request payload must accept the optional stream flag instead of dropping the client default.',
);
assert.match(
  rustServerSource,
  /pub struct CreateCodingSessionTurnInput \{[\s\S]*pub stream: bool/,
  'Rust create-turn input must normalize stream into an explicit boolean so turn execution has a stable default.',
);
assert.match(
  rustServerSource,
  /stream: true,/,
  'Rust create-turn input must normalize stream to true so stream:false cannot downgrade IDE turns out of live event mode.',
);
assert.doesNotMatch(
  rustServerSource,
  /stream:\s*request\.stream\.unwrap_or\(false\)/,
  'Rust create-turn route must not let request.stream=false bypass streamed provider execution.',
);
for (const [schemaName, properties] of [
  ['BirdCoderSkillCatalogEntrySummary', skillCatalogEntryProperties],
  ['BirdCoderSkillPackageSummary', skillPackageProperties],
] as const) {
  assert.equal(
    properties.installCount?.type,
    'string',
    `${schemaName}.installCount must be a string because it maps to a Java Long/BIGINT field.`,
  );
}
assert.equal(
  commerceMembershipCurrentProperties.points?.type,
  'string',
  'BirdCoderCommerceMembershipCurrentSummary.points must be a string because it maps to a Java Long/BIGINT field.',
);
assert.equal(
  commerceMembershipCurrentProperties.totalSpent?.type,
  'string',
  'BirdCoderCommerceMembershipCurrentSummary.totalSpent must be a string because monetary totals are serialized as strings.',
);
for (const retiredSchemaName of [
  'BirdCoderBillingVipMembershipEnvelope',
  'BirdCoderBillingVipMembershipSummary',
  'BirdCoderUpdateCurrentUserMembershipRequest',
]) {
  assert.equal(
    document.components.schemas?.[retiredSchemaName],
    undefined,
    `${retiredSchemaName} must not be published; BirdCoder membership uses SDKWork commerce current-membership schemas.`,
  );
}
assert.ok(document.components.schemas?.BirdCoderProjectGitOverview);
assert.ok(document.components.schemas?.BirdCoderCreateProjectGitBranchRequest);
assert.ok(document.components.schemas?.BirdCoderSwitchProjectGitBranchRequest);
assert.ok(document.components.schemas?.BirdCoderCommitProjectGitChangesRequest);
assert.ok(document.components.schemas?.BirdCoderPushProjectGitBranchRequest);
assert.ok(document.components.schemas?.BirdCoderCreateProjectGitWorktreeRequest);
assert.ok(document.components.schemas?.BirdCoderRemoveProjectGitWorktreeRequest);
for (const retiredSchemaName of Object.keys(document.components.schemas ?? {}).filter((schemaName) =>
  /UserCenter/u.test(schemaName),
)) {
  assert.fail(
    `${retiredSchemaName} must not be published; BirdCoder coding-server contracts use standard SDKWork IAM schemas.`,
  );
}
assert.ok(document.components.schemas?.BirdCoderIamRuntimeSettingsSummary);
assert.ok(document.components.schemas?.BirdCoderIamVerificationPolicySummary);
assert.ok(document.components.schemas?.BirdCoderIamSessionSummary);
assert.ok(document.components.schemas?.BirdCoderIamCreateSessionRequest);
assert.ok(document.components.schemas?.BirdCoderIamUpdateCurrentSessionRequest);
assert.ok(document.components.schemas?.BirdCoderIamRefreshSessionRequest);
assert.ok(document.components.schemas?.BirdCoderIamRegistrationCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamVerificationCodeCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamVerificationCodeVerifyRequest);
assert.ok(document.components.schemas?.BirdCoderIamPasswordResetRequestCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamPasswordResetCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamOAuthAuthorizationSummary);
assert.ok(document.components.schemas?.BirdCoderIamOAuthSessionCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationSummary);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationScanRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationPasswordCompletionRequest);
assert.ok(document.components.schemas?.BirdCoderIamQrAuthSessionSummary);
assert.ok(document.components.schemas?.BirdCoderIamQrAuthSessionCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamQrAuthSessionScanRequest);
assert.ok(document.components.schemas?.BirdCoderIamQrAuthSessionPasswordRequest);
assert.ok(document.components.schemas?.BirdCoderIamUserProfileSummary);
assert.deepEqual(
  document.components.schemas.BirdCoderIamRuntimeSettingsSummary.required,
  [
    'leftRailMode',
    'loginMethods',
    'oauthLoginEnabled',
    'oauthProviders',
    'qrLoginEnabled',
    'qrLoginType',
    'recoveryMethods',
    'registerMethods',
    'verificationPolicy',
  ],
  'IAM runtime settings schema must expose the standard Auth UI capability matrix.',
);
assert.equal(
  document.components.schemas?.BirdCoderAdminAuditEventSummary,
  undefined,
  'coding-server OpenAPI must not keep retired admin audit schemas after IAM auditEvents becomes standard.',
);
assert.equal(
  document.components.schemas?.BirdCoderAdminPolicySummary,
  undefined,
  'coding-server OpenAPI must not keep retired admin policy schemas after IAM policies becomes standard.',
);
assert.ok(document.components.schemas?.BirdCoderIamPolicySummary);
assert.ok(document.components.schemas?.BirdCoderCreateIamPolicyRequest);
assert.ok(document.components.schemas?.BirdCoderUpdateIamPolicyRequest);
assert.ok(document.components.schemas?.BirdCoderEngineDescriptor);
const engineDescriptorRequired = Array.isArray(
  document.components.schemas?.BirdCoderEngineDescriptor?.required,
)
  ? document.components.schemas.BirdCoderEngineDescriptor.required
  : [];
assert.ok(
  engineDescriptorRequired.includes('defaultModelId'),
  'engine descriptor schema must require defaultModelId so every engine catalog consumer sees an explicit default model contract.',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.patch?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUpdateCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/fork']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderForkCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}']?.delete?.responses['204']?.content,
  undefined,
  'Coding session delete must use 204 with no JSON success body.',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/fork']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/turns']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionTurnRequest',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions/{sessionId}/questions/{questionId}/answer']?.post
    ?.requestBody?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderSubmitUserQuestionAnswerRequest',
);
assert.equal(
  document.paths['/app/v3/api/intelligence/coding_sessions']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryListEnvelope',
);
const codingSessionListParameters = (document.paths['/app/v3/api/intelligence/coding_sessions']?.get
  ?.parameters ?? []) as Array<{ name?: string; required?: boolean }>;
const nativeSessionListParameters = (document.paths['/app/v3/api/native_sessions']?.get?.parameters ??
  []) as Array<{ name?: string; required?: boolean }>;
const nativeSessionRetrieveParameters = (document.paths['/app/v3/api/native_sessions/{id}']?.get
  ?.parameters ?? []) as Array<{ name?: string; required?: boolean }>;
assert.equal(
  codingSessionListParameters.find((parameter) => parameter.name === 'runtimeLocationId')?.required,
  false,
  'coding-session list may omit runtimeLocationId only when it intentionally skips native discovery.',
);
assert.equal(
  nativeSessionListParameters.find((parameter) => parameter.name === 'runtimeLocationId')?.required,
  true,
  'native-session list must require an explicit runtimeLocationId.',
);
assert.equal(
  nativeSessionRetrieveParameters.find((parameter) => parameter.name === 'runtimeLocationId')?.required,
  true,
  'native-session retrieve must require an explicit runtimeLocationId.',
);
for (const [path, method] of [
  ['/app/v3/api/intelligence/coding_sessions', 'get'],
  ['/app/v3/api/intelligence/coding_sessions', 'post'],
  ['/app/v3/api/native_sessions', 'get'],
  ['/app/v3/api/native_sessions/{id}', 'get'],
] as const) {
  const operation = document.paths[path]?.[method];
  assert.ok(
    operation?.responses['503']?.content['application/problem+json'],
    `${method.toUpperCase()} ${path} must declare a typed 503 unavailable response for an unverified or unavailable runtime location.`,
  );
}
assert.equal(
  document.paths['/app/v3/api/native_sessions/{id}']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderNativeSessionDetailEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/auth/sessions']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamCreateSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/auth/sessions/current']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamSessionEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/auth/sessions/current']?.patch?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamUpdateCurrentSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/auth/sessions/refresh']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamRefreshSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/workspaces']?.get?.responses['200']?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderWorkspaceSummaryListEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/workspaces']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateWorkspaceRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/overview']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectGitBranchRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderSwitchProjectGitBranchRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCommitProjectGitChangesRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderPushProjectGitBranchRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectGitWorktreeRequest',
);
assert.equal(
    document.paths[
      '/app/v3/api/projects/{projectId}/git/worktree_removals'
    ]?.post?.requestBody?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderRemoveProjectGitWorktreeRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktree_prune']?.post?.requestBody
    ?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderPruneProjectGitWorktreesRequest',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  undefined,
  'Project Git branch creation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  undefined,
  'Project Git branch switch creation-style operation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  undefined,
  'Project Git commit creation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  undefined,
  'Project Git push creation-style operation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.responses['200']
    ?.content['application/json']?.schema?.['$ref'],
  undefined,
  'Project Git worktree creation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.responses['201']
    ?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_removals'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
  undefined,
  'Project Git worktree removal creation-style operation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_removals'
  ]?.post?.responses['201']?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_prune'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
  undefined,
  'Project Git worktree prune creation-style operation must not keep a legacy 200 success body.',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_prune'
  ]?.post?.responses['201']?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/collaborators']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUpsertProjectCollaboratorRequest',
);
assert.equal(
  document.paths['/backend/v3/api/iam/policies']?.get?.responses['200']?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderIamPolicySummaryListEnvelope',
);
assert.equal(
  document.paths['/backend/v3/api/projects/{projectId}/deployment_targets']?.get?.responses[
    '200'
  ]?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeploymentTargetSummaryListEnvelope',
);

for (const bundledServerFamily of [
  {
    arch: 'x64',
    manifestPath: 'deployments/server-windows/x64/release-asset-manifest.json',
    openApiPath: 'deployments/server-windows/x64/openapi/coding-server-v1.json',
    platform: 'windows',
  },
  {
    arch: 'x64',
    manifestPath: 'deployments/server-win32/x64/release-asset-manifest.json',
    openApiPath: 'deployments/server-win32/x64/openapi/coding-server-v1.json',
    platform: 'win32',
  },
] as const) {
  const manifestUrl = new URL(`../${bundledServerFamily.manifestPath}`, import.meta.url);
  const openApiUrl = new URL(`../${bundledServerFamily.openApiPath}`, import.meta.url);
  const manifest = readJsonFixture<{
    arch?: string;
    artifacts?: Array<{ relativePath?: string; size?: number }>;
    family?: string;
    platform?: string;
  }>(manifestUrl);
  const openApiSize = statSync(openApiUrl).size;
  const openApiArtifact = manifest.artifacts?.find((artifact) =>
    artifact.relativePath?.endsWith('openapi/coding-server-v1.json'),
  );

  assert.equal(manifest.family, 'server', `${bundledServerFamily.manifestPath} must describe a server asset family.`);
  assert.equal(
    manifest.platform,
    bundledServerFamily.platform,
    `${bundledServerFamily.manifestPath} must preserve its explicit bundled platform dimension.`,
  );
  assert.equal(
    manifest.arch,
    bundledServerFamily.arch,
    `${bundledServerFamily.manifestPath} must preserve its explicit bundled architecture dimension.`,
  );
  assert.ok(
    openApiArtifact,
    `${bundledServerFamily.manifestPath} must reference the bundled coding-server OpenAPI sidecar.`,
  );
  assert.equal(
    openApiArtifact?.size,
    openApiSize,
    `${bundledServerFamily.manifestPath} OpenAPI sidecar size must match the actual bundled file.`,
  );
}

console.log('coding server openapi contract passed.');
