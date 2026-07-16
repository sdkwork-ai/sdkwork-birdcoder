import assert from 'node:assert/strict';

import { buildBirdCoderCodingServerOpenApiDocument } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts';

const document = buildBirdCoderCodingServerOpenApiDocument();

function operation(path: string, method: string) {
  const pathItem = document.paths[path];
  assert.ok(pathItem, `OpenAPI path must exist: ${path}`);
  const op = pathItem[method];
  assert.ok(op, `OpenAPI operation must exist: ${method.toUpperCase()} ${path}`);
  return op;
}

function responseStatuses(path: string, method: string): string[] {
  return Object.keys(operation(path, method).responses ?? {}).sort();
}

for (const [path, method] of [
  ['/app/v3/api/intelligence/coding_sessions/{sessionId}', 'delete'],
  ['/app/v3/api/intelligence/coding_sessions/{sessionId}/messages/{messageId}', 'delete'],
  ['/app/v3/api/auth/sessions/current', 'delete'],
  ['/app/v3/api/projects/{projectId}', 'delete'],
  ['/app/v3/api/workspaces/{workspaceId}', 'delete'],
  ['/app/v3/api/chat/conversations/{conversationId}', 'delete'],
  ['/backend/v3/api/iam/organizations/{organizationId}', 'delete'],
  ['/backend/v3/api/iam/permissions/{permissionId}', 'delete'],
  ['/backend/v3/api/iam/roles/{roleId}', 'delete'],
] as const) {
  const op = operation(path, method);
  assert.equal(op.responses['204']?.content, undefined, `${method.toUpperCase()} ${path} must declare 204 with no JSON body.`);
  assert.equal(op.responses['200'], undefined, `${method.toUpperCase()} ${path} must not declare a 200 success body.`);
}

assert.equal(operation('/app/v3/api/model_config', 'put').operationId, 'modelConfig.update');
assert.equal(
  operation('/app/v3/api/intelligence/coding_sessions/{sessionId}/checkpoints/{checkpointId}/approval', 'post')
    .operationId,
  'codingSessions.checkpoints.approval.create',
);
assert.equal(
  operation('/app/v3/api/intelligence/coding_sessions/{sessionId}/questions/{questionId}/answer', 'post')
    .operationId,
  'codingSessions.questions.answers.create',
);
assert.equal(operation('/app/v3/api/projects/{projectId}/publish', 'post').operationId, 'projects.publish.publish');
assert.equal(
  document.paths['/app/v3/api/workspaces/{workspaceId}/realtime'],
  undefined,
  'SSE/WebSocket realtime routes stay out of request/response OpenAPI authority; route catalogs keep the runtime subscribe operation.',
);

for (const [path, method] of [
  ['/app/v3/api/workspaces', 'get'],
  ['/app/v3/api/projects', 'get'],
  ['/app/v3/api/intelligence/coding_sessions', 'get'],
  ['/app/v3/api/documents', 'get'],
  ['/app/v3/api/deployments', 'get'],
] as const) {
  const names = (operation(path, method).parameters ?? [])
    .filter((parameter: { in?: string }) => parameter.in === 'query')
    .map((parameter: { name?: string }) => parameter.name);
  assert.ok(names.includes('page'), `${method.toUpperCase()} ${path} must expose page query parameter.`);
  assert.ok(names.includes('page_size'), `${method.toUpperCase()} ${path} must expose page_size query parameter.`);
  assert.equal(names.includes('limit'), false, `${method.toUpperCase()} ${path} must not expose limit query alias.`);
  assert.equal(names.includes('offset'), false, `${method.toUpperCase()} ${path} must not expose offset query alias.`);
}

console.log('OpenAPI operation pattern standard contract passed.');
