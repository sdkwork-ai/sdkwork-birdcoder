import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { buildBirdCoderCodingServerOpenApiDocument } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts';

const document = buildBirdCoderCodingServerOpenApiDocument();
const rustServerSource = readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
);

function readJsonFixture<T>(url: URL): T {
  return JSON.parse(readFileSync(url, 'utf8').replace(/^\uFEFF/u, '')) as T;
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
assert.equal(document['x-sdkwork-api-gateway'].liveOpenApiPath, '/openapi.json');
assert.equal(document['x-sdkwork-api-gateway'].docsPath, '/docs');
assert.equal(document['x-sdkwork-api-gateway'].routeCatalogPath, '/app/v3/api/system/routes');
assert.equal(
  document['x-sdkwork-api-gateway'].routeCount,
  Object.values(document['x-sdkwork-api-gateway'].routesBySurface).reduce(
    (total, routeCount) => total + routeCount,
    0,
  ),
);
assert.deepEqual(
  document['x-sdkwork-api-gateway'].surfaces.map((surface) => surface.name),
  ['app', 'backend'],
);
assert.deepEqual(
  document['x-sdkwork-api-gateway'].surfaces.map((surface) => surface.routeCount),
  [
    document['x-sdkwork-api-gateway'].routesBySurface.app,
    document['x-sdkwork-api-gateway'].routesBySurface.backend,
  ],
);
const operationsWithoutSuccessSchema = Object.entries(document.paths).flatMap(([pathKey, methods]) =>
  Object.entries(methods ?? {}).flatMap(([methodKey, operation]) => {
    if (operation['x-sdkwork-stream-kind'] === 'websocket') {
      return operation.responses['101']
        ? []
        : [{ method: methodKey.toUpperCase(), operationId: operation.operationId, path: pathKey }];
    }

    const successResponse = operation.responses['200'] ?? operation.responses['201'];
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
assert.equal(document.paths['/app/v3/api/coding_sessions']?.post?.operationId, 'codingSessions.create');
assert.equal(document.paths['/app/v3/api/coding_sessions/{id}']?.patch?.operationId, 'codingSessions.update');
assert.equal(document.paths['/app/v3/api/coding_sessions/{id}']?.delete?.operationId, 'codingSessions.delete');
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/messages/{messageId}']?.patch?.operationId,
  'codingSessions.messages.update',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/messages/{messageId}']?.delete?.operationId,
  'codingSessions.messages.delete',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/fork']?.post?.operationId,
  'codingSessions.forks.create',
);
assert.equal(document.paths['/app/v3/api/coding_sessions/{id}/events']?.get?.operationId, 'codingSessions.events.list');
assert.equal(document.paths['/app/v3/api/operations/{operationId}']?.get?.operationId, 'operations.retrieve');
assert.equal(
  document.paths['/app/v3/api/questions/{questionId}/answer']?.post?.operationId,
  'questions.answers.create',
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
  'projects.publish.create',
);
assert.equal(document.paths['/app/v3/api/workspaces']?.post?.operationId, 'workspaces.create');
assert.equal(document.paths['/app/v3/api/workspaces/{workspaceId}']?.patch?.operationId, 'workspaces.update');
assert.equal(document.paths['/app/v3/api/workspaces/{workspaceId}']?.delete?.operationId, 'workspaces.delete');
assert.equal(
  document.paths['/app/v3/api/workspaces/{workspaceId}/realtime']?.get?.operationId,
  'workspaces.realtime.subscribe',
);
assert.equal(
  document.paths['/app/v3/api/workspaces/{workspaceId}/realtime']?.get?.['x-sdkwork-stream-kind'],
  'websocket',
);
assert.equal(document.paths['/app/v3/api/teams']?.get?.operationId, 'workspaceTeams.list');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-domain'], 'collaboration');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-resource'], 'collaboration.workspaceTeams');
assert.equal(document.paths['/app/v3/api/teams']?.get?.['x-sdkwork-permission'], 'collaboration.workspaceTeams.read');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.operationId, 'teams.list');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-resource'], 'iam.teams');
assert.equal(document.paths['/backend/v3/api/iam/teams']?.get?.['x-sdkwork-permission'], 'iam.teams.read');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.operationId, 'users.list');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-resource'], 'iam.users');
assert.equal(document.paths['/backend/v3/api/iam/users']?.get?.['x-sdkwork-permission'], 'iam.users.read');
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
assert.equal(document.paths['/app/v3/api/iam/role_bindings']?.get?.['x-sdkwork-resource'], 'iam.roleBindings');
assert.equal(
  document.paths['/app/v3/api/iam/role_bindings']?.get?.['x-sdkwork-permission'],
  'iam.roleBindings.read',
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
assert.equal(document.paths['/backend/v3/api/iam/role_bindings']?.post?.['x-sdkwork-resource'], 'iam.roleBindings');
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings']?.post?.['x-sdkwork-permission'],
  'iam.roleBindings.create',
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
  'iam.roleBindings',
);
assert.equal(
  document.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.['x-sdkwork-permission'],
  'iam.roleBindings.delete',
);
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.operationId, 'teams.members.list');
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-domain'], 'iam');
assert.equal(document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-resource'], 'iam.teams.members');
assert.equal(
  document.paths['/backend/v3/api/iam/teams/{teamId}/members']?.get?.['x-sdkwork-permission'],
  'iam.teams.members.read',
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
    createCodingSessionRequestRequired.includes('modelId'),
  'create coding session request schema must require explicit engineId and modelId.',
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
  ['BirdCoderCreateProjectRequest', createProjectRequestProperties],
  ['BirdCoderUpdateProjectRequest', updateProjectRequestProperties],
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
assert.match(
  rustServerSource,
  /struct CreateCodingSessionTurnRequest \{[\s\S]*stream:\s*Option<bool>/,
  'Rust create-turn request payload must accept the optional stream flag instead of dropping the client default.',
);
assert.match(
  rustServerSource,
  /struct CreateCodingSessionTurnInput \{[\s\S]*stream:\s*bool/,
  'Rust create-turn input must normalize stream into an explicit boolean so turn execution has a stable default.',
);
assert.match(
  rustServerSource,
  /stream:\s*true,/,
  'Rust create-turn input must normalize stream to true so stream:false cannot downgrade IDE turns out of live event mode.',
);
assert.match(
  rustServerSource,
  /let\s+should_stream_turn\s*=\s*true;/,
  'Rust create-turn route must always execute provider turns through execute_native_session_turn_with_events.',
);
assert.doesNotMatch(
  rustServerSource,
  /let\s+should_stream_turn\s*=\s*input\.stream;/,
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
assert.equal(document.components.schemas?.BirdCoderIamVerificationCodeCreateRequest, undefined);
assert.equal(document.components.schemas?.BirdCoderIamVerificationCodeVerifyRequest, undefined);
assert.ok(document.components.schemas?.BirdCoderIamPasswordResetRequestCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamPasswordResetCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamOAuthAuthorizationSummary);
assert.ok(document.components.schemas?.BirdCoderIamOAuthSessionCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationSummary);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationCreateRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationScanRequest);
assert.ok(document.components.schemas?.BirdCoderIamDeviceAuthorizationPasswordCompletionRequest);
assert.equal(document.components.schemas?.BirdCoderIamQrAuthSessionSummary, undefined);
assert.equal(document.components.schemas?.BirdCoderIamQrAuthSessionCreateRequest, undefined);
assert.equal(document.components.schemas?.BirdCoderIamQrAuthSessionScanRequest, undefined);
assert.equal(document.components.schemas?.BirdCoderIamQrAuthSessionPasswordRequest, undefined);
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
  document.paths['/app/v3/api/coding_sessions']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}']?.patch?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUpdateCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/fork']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderForkCodingSessionRequest',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}']?.delete?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeletedResourceEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/messages/{messageId}']?.delete?.responses[
    '200'
  ]?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeleteCodingSessionMessageResultEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/fork']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions/{id}/turns']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionTurnRequest',
);
assert.equal(
  document.paths['/app/v3/api/questions/{questionId}/answer']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderSubmitUserQuestionAnswerRequest',
);
assert.equal(
  document.paths['/app/v3/api/coding_sessions']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryListEnvelope',
);
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
  document.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.responses['200']
    ?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_removals'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  document.paths[
    '/app/v3/api/projects/{projectId}/git/worktree_prune'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
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
    manifestPath: 'server/windows/x64/release-asset-manifest.json',
    openApiPath: 'server/windows/x64/openapi/coding-server-v1.json',
    platform: 'windows',
  },
  {
    arch: 'x64',
    manifestPath: 'server/win32/x64/release-asset-manifest.json',
    openApiPath: 'server/win32/x64/openapi/coding-server-v1.json',
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
  const openApiArtifact = manifest.artifacts?.find(
    (artifact) => artifact.relativePath === bundledServerFamily.openApiPath,
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
