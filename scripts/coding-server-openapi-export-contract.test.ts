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
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCatalogPath, '/api/core/v1/routes');
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCount, 79);
  assert.deepEqual(writtenDocument['x-sdkwork-api-gateway']?.routesBySurface, {
    core: 24,
    app: 48,
    admin: 7,
  });
  assert.equal(
    writtenDocument.paths['/api/core/v1/routes']?.get?.operationId,
    'core.listRoutes',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/native-sessions']?.get?.operationId,
    'core.listNativeSessions',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/native-sessions/{id}']?.get?.operationId,
    'core.getNativeSession',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}']?.patch?.operationId,
    'core.updateCodingSession',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}']?.delete?.operationId,
    'core.deleteCodingSession',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}/fork']?.post?.operationId,
    'core.forkCodingSession',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}/messages/{messageId}']?.delete?.operationId,
    'core.deleteCodingSessionMessage',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}/events']?.get?.operationId,
    'core.listCodingSessionEvents',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/questions/{questionId}/answer']?.post?.operationId,
    'core.submitUserQuestionAnswer',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}/fork']?.post?.responses['201']?.content[
      'application/json'
    ]?.schema?.['$ref'],
    '#/components/schemas/BirdCoderCodingSessionSummaryEnvelope',
  );
  assert.equal(
    writtenDocument.paths['/api/admin/v1/releases']?.get?.operationId,
    'admin.listReleases',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/overview']?.get?.operationId,
    'app.getProjectGitOverview',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/branches']?.post?.operationId,
    'app.createProjectGitBranch',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/branch-switch']?.post?.operationId,
    'app.switchProjectGitBranch',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/commits']?.post?.operationId,
    'app.commitProjectGitChanges',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/pushes']?.post?.operationId,
    'app.pushProjectGitBranch',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/worktrees']?.post?.operationId,
    'app.createProjectGitWorktree',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/worktree-removals']?.post?.operationId,
    'app.removeProjectGitWorktree',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/git/worktree-prune']?.post?.operationId,
    'app.pruneProjectGitWorktrees',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/publish']?.post?.operationId,
    'app.publishProject',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/login']?.post?.operationId,
    'app.login',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/logout']?.post?.operationId,
    'app.logout',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/register']?.post?.operationId,
    'app.register',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/email/login']?.post?.operationId,
    'app.loginWithEmailCode',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/phone/login']?.post?.operationId,
    'app.loginWithPhoneCode',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/qr/generate']?.post?.operationId,
    'app.generateLoginQrCode',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/auth/qr/status/{qrKey}']?.get?.operationId,
    'app.checkLoginQrCodeStatus',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/user/profile']?.get?.operationId,
    'app.getCurrentUserProfile',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/vip/info']?.get?.operationId,
    'app.getCurrentUserMembership',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/workspaces/{workspaceId}/realtime']?.get?.operationId,
    'app.subscribeWorkspaceRealtime',
  );
  assert.match(fs.readFileSync(explicitOutputPath, 'utf8'), /\n$/);
} finally {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
}

console.log('coding server openapi export contract passed.');
