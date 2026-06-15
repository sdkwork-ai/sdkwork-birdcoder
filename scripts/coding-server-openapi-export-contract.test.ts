import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveBirdCoderCodingServerOpenApiSnapshotPath,
  writeBirdCoderCodingServerOpenApiSnapshot,
} from './coding-server-openapi-export.ts';

const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-openapi-export-'));

try {
  const resolvedDefaultPath = resolveBirdCoderCodingServerOpenApiSnapshotPath({
    rootDir: workspaceDir,
  });
  assert.equal(
    resolvedDefaultPath.replaceAll('\\', '/'),
    path.join(workspaceDir, 'artifacts', 'openapi', 'coding-server-v1.json').replaceAll('\\', '/'),
  );

  const explicitOutputPath = path.join(workspaceDir, 'generated', 'coding-server-openapi.json');
  const result = writeBirdCoderCodingServerOpenApiSnapshot({
    distributionId: 'global',
    outputPath: explicitOutputPath,
    rootDir: workspaceDir,
  });

  assert.equal(result.outputPath.replaceAll('\\', '/'), explicitOutputPath.replaceAll('\\', '/'));
  assert.equal(fs.existsSync(explicitOutputPath), true);

  const writtenDocument = JSON.parse(fs.readFileSync(explicitOutputPath, 'utf8'));
  assert.equal(writtenDocument.openapi, '3.1.0');
  assert.equal(writtenDocument.info.version, 'v1');
  assert.equal(writtenDocument.servers[0]?.url, '/');
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCatalogPath, '/app/v3/api/system/routes');
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCount, 129);
  assert.deepEqual(writtenDocument['x-sdkwork-api-gateway']?.routesBySurface, {
    app: 80,
    backend: 49,
  });
  const publishedOperationIds = Object.values(writtenDocument.paths).flatMap((methods) =>
    Object.values(methods ?? {}).map((operation: { operationId?: string }) => operation.operationId),
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
      writtenDocument.paths[oldAppbasePath],
      undefined,
      `${oldAppbasePath} must not be exposed because BirdCoder uses the canonical SDKWork IAM and commerce route set.`,
    );
  }
  assert.equal(
    writtenDocument.paths['/app/v3/api/system/iam/runtime']?.get?.operationId,
    'iam.runtime.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/system/iam/verification_policy']?.get?.operationId,
    'iam.verificationPolicy.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/system/routes']?.get?.operationId,
    'routes.list',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/native_sessions']?.get?.operationId,
    'nativeSessions.list',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/native_sessions/{id}']?.get?.operationId,
    'nativeSessions.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/model_config']?.get?.operationId,
    'modelConfig.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/model_config']?.put?.operationId,
    'modelConfig.sync',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}']?.patch?.operationId,
    'codingSessions.update',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}']?.delete?.operationId,
    'codingSessions.delete',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}/fork']?.post?.operationId,
    'codingSessions.forks.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}/messages/{messageId}']?.patch?.operationId,
    'codingSessions.messages.update',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}/messages/{messageId}']?.delete?.operationId,
    'codingSessions.messages.delete',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}/events']?.get?.operationId,
    'codingSessions.events.list',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/questions/{questionId}/answer']?.post?.operationId,
    'questions.answers.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/coding_sessions/{id}/fork']?.post?.responses['201']?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderCodingSessionSummaryEnvelope',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/releases']?.get?.operationId,
    'releases.list',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/overview']?.get?.operationId,
    'projects.git.overview.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/branches']?.post?.operationId,
    'projects.git.branches.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/branch_switch']?.post?.operationId,
    'projects.git.branchSwitch.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/commits']?.post?.operationId,
    'projects.git.commits.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/pushes']?.post?.operationId,
    'projects.git.pushes.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/worktrees']?.post?.operationId,
    'projects.git.worktrees.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/worktree_removals']?.post?.operationId,
    'projects.git.worktreeRemovals.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/git/worktree_prune']?.post?.operationId,
    'projects.git.worktreePrune.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/projects/{projectId}/publish']?.post?.operationId,
    'projects.publish.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions']?.post?.operationId,
    'sessions.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions/current']?.delete?.operationId,
    'sessions.current.delete',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions/current']?.patch?.operationId,
    'sessions.current.update',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions/refresh']?.post?.operationId,
    'sessions.refresh',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/registrations']?.post?.operationId,
    'registrations.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/password_reset_requests']?.post?.operationId,
    'passwordResetRequests.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/password_resets']?.post?.operationId,
    'passwordResets.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/device_authorizations']?.post?.operationId,
    'oauth.deviceAuthorizations.create',
  );
  assert.ok(
    writtenDocument.paths['/app/v3/api/oauth/device_authorizations']?.post?.requestBody,
    'exported coding-server OpenAPI must keep appbase POST body contract for OAuth device authorization creation.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}']?.get
      ?.operationId,
    'oauth.deviceAuthorizations.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}/scans']?.post
      ?.operationId,
    'oauth.deviceAuthorizations.scans.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}/password_completions']?.post
      ?.operationId,
    'oauth.deviceAuthorizations.passwordCompletions.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/open_platform/qr_auth/sessions'],
    undefined,
    'exported coding-server OpenAPI must not keep retired appbase openPlatform QR auth session routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}'],
    undefined,
    'exported coding-server OpenAPI must not keep retired appbase openPlatform QR auth status routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}/scans'],
    undefined,
    'exported coding-server OpenAPI must not keep retired appbase openPlatform QR auth scan routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/open_platform/qr_auth/sessions/{sessionKey}/passwords'],
    undefined,
    'exported coding-server OpenAPI must not keep retired appbase openPlatform QR auth password routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/verification_codes'],
    undefined,
    'BirdCoder export must not publish messaging-owned verification-code delivery routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/verification_codes/verify'],
    undefined,
    'BirdCoder export must not publish messaging-owned verification-code verify routes.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/authorization_urls']?.post?.operationId,
    'oauth.authorizationUrls.create',
  );
  assert.ok(
    writtenDocument.paths['/app/v3/api/oauth/authorization_urls']?.post?.requestBody,
    'exported coding-server OpenAPI must keep appbase POST body contract for OAuth authorization URL creation.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/oauth_authorization_urls'],
    undefined,
    'exported coding-server OpenAPI must not keep the retired appbase auth/oauth_authorization_urls route.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/oauth/sessions']?.post?.operationId,
    'oauth.sessions.create',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/oauth_sessions'],
    undefined,
    'exported coding-server OpenAPI must not keep the retired appbase auth/oauth_sessions route.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/iam/users/current']?.get?.operationId,
    'users.current.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users']?.get?.operationId,
    'users.list',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users']?.get?.responses['200']?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderIamUserSummaryListEnvelope',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users']?.post?.operationId,
    'users.create',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users']?.post?.requestBody?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderCreateIamUserRequest',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users/{userId}']?.get?.operationId,
    'users.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users/{userId}']?.patch?.operationId,
    'users.update',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/users/{userId}']?.delete?.operationId,
    'users.delete',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/iam/role_bindings']?.get?.operationId,
    'roleBindings.list',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/role_bindings']?.post?.operationId,
    'roleBindings.create',
  );
  assert.equal(
    writtenDocument.paths['/backend/v3/api/iam/role_bindings/{roleBindingId}']?.delete?.operationId,
    'roleBindings.delete',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/iam/role_bindings']?.get?.responses['200']
      ?.content['application/json']?.schema?.['$ref'],
    '#/components/schemas/BirdCoderIamUserRoleSummaryListEnvelope',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/current']?.get?.operationId,
    'memberships.current.retrieve',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/current']?.get?.['x-sdkwork-domain'],
    'commerce',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/current']?.patch,
    undefined,
    'exported coding-server OpenAPI must not keep a local current-membership patch route.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/package_groups']?.get?.operationId,
    'memberships.packageGroups.list',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/package_groups']?.get?.['x-sdkwork-domain'],
    'commerce',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/memberships/package_groups']?.patch,
    undefined,
    'exported coding-server OpenAPI must not keep a local membership package group patch route.',
  );
  assert.equal(
    Object.keys(writtenDocument.components?.schemas ?? {}).some((schemaName) =>
      /UserCenter/u.test(schemaName),
    ),
    false,
    'exported coding-server OpenAPI must not publish retired UserCenter schemas.',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions']?.post?.requestBody?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderIamCreateSessionRequest',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/auth/sessions/current']?.get?.responses['200']?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderIamSessionEnvelope',
  );
  assert.equal(
    writtenDocument.paths['/app/v3/api/workspaces/{workspaceId}/realtime']?.get?.operationId,
    'workspaces.realtime.subscribe',
  );
  assert.match(fs.readFileSync(explicitOutputPath, 'utf8'), /\n$/);
} finally {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
}

console.log('coding server openapi export contract passed.');
