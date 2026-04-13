import assert from 'node:assert/strict';

import { buildBirdCoderCodingServerOpenApiDocumentSeed } from '../packages/sdkwork-birdcoder-server/src/index.ts';

const documentSeed = buildBirdCoderCodingServerOpenApiDocumentSeed();

assert.equal(documentSeed.openapi, '3.1.0');
assert.equal(documentSeed.info.title, 'SDKWork BirdCoder Coding Server API');
assert.equal(documentSeed.info.version, 'v1');
assert.equal(documentSeed.servers[0]?.url, 'http://127.0.0.1:18989');
assert.deepEqual(documentSeed.tags.map((tag) => tag.name), ['core', 'app', 'admin']);
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions']?.post?.operationId, 'core.createCodingSession');
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/:id/events']?.get?.operationId, 'core.listCodingSessionEvents');
assert.equal(documentSeed.paths['/api/core/v1/operations/:operationId']?.get?.operationId, 'core.getOperation');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.get?.operationId, 'app.listProjects');
assert.equal(documentSeed.paths['/api/admin/v1/releases']?.get?.operationId, 'admin.listReleases');

console.log('coding server openapi contract passed.');
