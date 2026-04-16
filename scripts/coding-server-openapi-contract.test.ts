import assert from 'node:assert/strict';

import { buildBirdCoderCodingServerOpenApiDocumentSeed } from '../packages/sdkwork-birdcoder-server/src/index.ts';

const documentSeed = buildBirdCoderCodingServerOpenApiDocumentSeed();

assert.equal(documentSeed.openapi, '3.1.0');
assert.equal(documentSeed.info.title, 'SDKWork BirdCoder Coding Server API');
assert.equal(documentSeed.info.version, 'v1');
assert.equal(documentSeed.servers[0]?.url, 'http://127.0.0.1:10240');
assert.deepEqual(documentSeed.tags.map((tag) => tag.name), ['core', 'app', 'admin']);
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions']?.post?.operationId, 'core.createCodingSession');
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/:id/events']?.get?.operationId, 'core.listCodingSessionEvents');
assert.equal(documentSeed.paths['/api/core/v1/operations/:operationId']?.get?.operationId, 'core.getOperation');
assert.equal(documentSeed.paths['/api/app/v1/auth/config']?.get?.operationId, 'app.getUserCenterConfig');
assert.equal(documentSeed.paths['/api/app/v1/auth/session']?.get?.operationId, 'app.getCurrentUserSession');
assert.equal(documentSeed.paths['/api/app/v1/auth/login']?.post?.operationId, 'app.login');
assert.equal(documentSeed.paths['/api/app/v1/auth/register']?.post?.operationId, 'app.register');
assert.equal(documentSeed.paths['/api/app/v1/auth/logout']?.post?.operationId, 'app.logout');
assert.equal(documentSeed.paths['/api/app/v1/auth/session/exchange']?.post?.operationId, 'app.exchangeUserCenterSession');
assert.equal(documentSeed.paths['/api/app/v1/user-center/profile']?.get?.operationId, 'app.getCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/user-center/profile']?.patch?.operationId, 'app.updateCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/user-center/membership']?.get?.operationId, 'app.getCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/user-center/membership']?.patch?.operationId, 'app.updateCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.get?.operationId, 'app.listProjects');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.post?.operationId, 'app.createProject');
assert.equal(documentSeed.paths['/api/app/v1/projects/:projectId']?.patch?.operationId, 'app.updateProject');
assert.equal(documentSeed.paths['/api/app/v1/projects/:projectId']?.delete?.operationId, 'app.deleteProject');
assert.equal(documentSeed.paths['/api/app/v1/workspaces']?.post?.operationId, 'app.createWorkspace');
assert.equal(documentSeed.paths['/api/app/v1/workspaces/:workspaceId']?.patch?.operationId, 'app.updateWorkspace');
assert.equal(documentSeed.paths['/api/app/v1/workspaces/:workspaceId']?.delete?.operationId, 'app.deleteWorkspace');
assert.equal(documentSeed.paths['/api/admin/v1/releases']?.get?.operationId, 'admin.listReleases');

console.log('coding server openapi contract passed.');
