import assert from 'node:assert/strict';

import { createSurfaceOpenApi } from './sync-birdcoder-sdk-openapi.mjs';

const canonicalDocument = {
  openapi: '3.1.0',
  info: { title: 'Composed gateway', version: '1.0.0' },
  tags: [
    { name: 'iam' },
    { name: 'platform' },
    { name: 'system' },
  ],
  paths: {
    '/app/v3/api/auth/sessions': {
      post: {
        operationId: 'sessions.create',
        tags: ['iam'],
      },
    },
    '/app/v3/api/projects': {
      get: {
        operationId: 'projects.list',
        tags: ['platform'],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProjectList' },
              },
            },
          },
        },
      },
    },
    '/app/v3/api/projects/{projectId}/collaborators': {
      get: {
        operationId: 'projects.collaborators.list',
        tags: ['iam'],
      },
    },
    '/app/v3/api/system/health': {
      get: {
        operationId: 'system.health.retrieve',
        tags: ['system'],
      },
    },
    '/backend/v3/api/iam/users': {
      get: {
        operationId: 'users.list',
        tags: ['iam'],
      },
    },
  },
  components: {
    schemas: {
      Project: { type: 'object' },
      ProjectList: {
        type: 'array',
        items: { $ref: '#/components/schemas/Project' },
      },
      User: { type: 'object' },
    },
  },
};

const appSurface = {
  apiAuthority: 'sdkwork-birdcoder-app-api',
  apiPrefix: '/app/v3/api',
  surface: 'app',
  version: '0.1.0',
};
const appDocument = createSurfaceOpenApi(canonicalDocument, appSurface, {
  owned: true,
  ownedPathPrefixes: [
    '/app/v3/api/projects',
    '/app/v3/api/system/health',
  ],
  forbiddenPathPrefixes: [
    '/app/v3/api/auth',
    '/app/v3/api/projects/{projectId}/collaborators',
  ],
});

assert.deepEqual(Object.keys(appDocument.paths).sort(), [
  '/app/v3/api/projects',
  '/app/v3/api/system/health',
]);
assert.equal(
  appDocument.paths['/app/v3/api/projects'].get['x-sdkwork-owner'],
  'sdkwork-birdcoder',
);
assert.equal(
  appDocument.paths['/app/v3/api/projects'].get['x-sdkwork-api-authority'],
  'sdkwork-birdcoder-app-api',
);
assert.deepEqual(Object.keys(appDocument.components.schemas).sort(), ['Project', 'ProjectList']);

const backendDocument = createSurfaceOpenApi(
  canonicalDocument,
  {
    apiAuthority: 'sdkwork-birdcoder-backend-api',
    apiPrefix: '/backend/v3/api',
    surface: 'backend',
    version: '0.1.0',
  },
  {
    owned: false,
    ownedPathPrefixes: [],
    forbiddenPathPrefixes: ['/backend/v3/api/iam'],
  },
);

assert.deepEqual(backendDocument.paths, {});
assert.deepEqual(backendDocument.tags, []);
assert.deepEqual(backendDocument.components, {});

console.log('BirdCoder SDK owner boundary contract passed.');
