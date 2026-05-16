import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildBirdCoderCodingServerOpenApiDocumentSeed,
  getBirdCoderCodingServerDescriptor,
  listBirdCoderCodingServerRouteCatalogEntries,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const APP_API_PREFIX = '/app/v3/api';
const BACKEND_API_PREFIX = '/backend/v3/api';
const FORBIDDEN_PREFIXES = [
  '/api/core/v1',
  '/api/app/v1',
  '/api/app/v2',
  '/api/app/v3',
  '/api/app/v3/api',
  '/api/admin/v1',
  '/api/backend/v1',
  '/api/backend/v2',
  '/api/backend/v3',
  '/api/backend/v3/api',
  '/app/v1',
  '/app/v2',
  '/backend/v1',
  '/backend/v2',
] as const;
const FORBIDDEN_RUNTIME_RESOURCE_PATHS = [
  '/app/v3/api/ai_coding_session',
] as const;

function assertNoForbiddenPrefix(value: string, context: string): void {
  for (const forbiddenPrefix of FORBIDDEN_PREFIXES) {
    assert.equal(
      value.startsWith(forbiddenPrefix),
      false,
      `${context} must not use forbidden API prefix ${forbiddenPrefix}: ${value}`,
    );
  }
}

function assertLowerSnakeStaticSegments(path: string, context: string): void {
  for (const segment of path.split('/').filter(Boolean)) {
    if (/^[:{]/u.test(segment)) {
      continue;
    }

    assert.match(
      segment,
      /^[a-z0-9]+(?:_[a-z0-9]+)*$/u,
      `${context} static path segment must be lower_snake_case: ${path}`,
    );
  }
}

function assertStandardOperationId(operationId: string, context: string): void {
  assert.match(
    operationId,
    /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/u,
    `${context} operationId must use API_SPEC lowerCamel dotted resource.action syntax: ${operationId}`,
  );
  assert.equal(
    /^(?:app|backend|core|admin)\./u.test(operationId),
    false,
    `${context} operationId must not include API surface or retired namespace prefixes: ${operationId}`,
  );
}

function assertStandardOpenApiTags(tags: readonly string[] | undefined, context: string): void {
  assert.equal(Array.isArray(tags), true, `${context} must declare exactly one resource-domain tag.`);
  assert.equal(tags?.length, 1, `${context} must declare exactly one resource-domain tag.`);
  const tag = tags?.[0] ?? '';
  assert.match(
    tag,
    /^[a-z][a-zA-Z0-9]*$/u,
    `${context} tag must use lowerCamel resource-domain naming: ${tag}`,
  );
  assert.equal(
    /^(?:app|backend|core|admin)$/u.test(tag),
    false,
    `${context} tag must be a resource domain, not an API surface or retired namespace: ${tag}`,
  );
}

function assertStandardOpenApiGovernanceExtensions(
  operation: {
    operationId: string;
    security?: unknown;
    tags?: readonly string[];
    'x-sdkwork-auth-mode'?: string;
    'x-sdkwork-data-scope'?: unknown;
    'x-sdkwork-deployment'?: unknown;
    'x-sdkwork-domain'?: unknown;
    'x-sdkwork-permission'?: unknown;
    'x-sdkwork-public'?: unknown;
    'x-sdkwork-resource'?: unknown;
    'x-sdkwork-tenant-scope'?: unknown;
  },
  context: string,
): void {
  const domain = operation['x-sdkwork-domain'];
  const resource = operation['x-sdkwork-resource'];
  const isPublic = operation['x-sdkwork-public'];
  const tenantScope = operation['x-sdkwork-tenant-scope'];
  const dataScope = operation['x-sdkwork-data-scope'];
  const deployment = operation['x-sdkwork-deployment'];
  const permission = operation['x-sdkwork-permission'];

  assert.equal(typeof domain, 'string', `${context} must declare x-sdkwork-domain.`);
  assert.match(
    String(domain),
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u,
    `${context} x-sdkwork-domain must be a canonical lower_snake_case bounded context.`,
  );
  assert.equal(typeof resource, 'string', `${context} must declare x-sdkwork-resource.`);
  assert.match(
    String(resource),
    /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/u,
    `${context} x-sdkwork-resource must be a canonical lowerCamel resource path.`,
  );
  assert.equal(typeof isPublic, 'boolean', `${context} must declare boolean x-sdkwork-public.`);
  assert.equal(typeof tenantScope, 'string', `${context} must declare x-sdkwork-tenant-scope.`);
  assert.match(
    String(tenantScope),
    /^(?:platform|tenant|organization|user|owner)$/u,
    `${context} x-sdkwork-tenant-scope must use an API_SPEC scope value.`,
  );
  assert.equal(typeof dataScope, 'string', `${context} must declare x-sdkwork-data-scope.`);
  assert.match(
    String(dataScope),
    /^(?:platform|tenant|organization|user|owner)$/u,
    `${context} x-sdkwork-data-scope must use an API_SPEC scope value.`,
  );
  assert.equal(deployment, 'all', `${context} x-sdkwork-deployment must be all for the shared coding server API.`);

  if (isPublic) {
    assert.deepEqual(operation.security, [], `${context} public operation must explicitly set security: [].`);
    assert.equal(
      permission,
      undefined,
      `${context} public operation must not declare x-sdkwork-permission.`,
    );
    return;
  }

  assert.deepEqual(
    operation.security,
    [{ bearerAuth: [], sdkworkAccessToken: [] }],
    `${context} protected operation must use dual-token security.`,
  );
  assert.equal(typeof permission, 'string', `${context} protected operation must declare x-sdkwork-permission.`);
  assert.match(
    String(permission),
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*\.(?:create|read|update|delete|write|execute|subscribe)$/u,
    `${context} x-sdkwork-permission must be a stable SDKWork permission code.`,
  );
}

const descriptor = getBirdCoderCodingServerDescriptor();
assert.equal(descriptor.gateway.routesBySurface.app, 73);
assert.equal(descriptor.gateway.routesBySurface.backend, 7);
assert.deepEqual(descriptor.surfaces, ['app', 'backend']);
assert.equal(
  descriptor.gateway.surfaces.find((surface) => surface.name === 'app')?.basePath,
  APP_API_PREFIX,
);
assert.equal(
  descriptor.gateway.surfaces.find((surface) => surface.name === 'backend')?.basePath,
  BACKEND_API_PREFIX,
);
assert.equal(
  descriptor.gateway.surfaces.map((surface) => String(surface.name)).includes('admin'),
  false,
  'HTTP API surface must be backend, not legacy admin.',
);
assert.equal(
  descriptor.gateway.surfaces.map((surface) => String(surface.name)).includes('core'),
  false,
  'HTTP API surface must be app/backend only; legacy core must be folded into app.',
);
assert.equal(
  'basePath' in descriptor.gateway,
  false,
  'API gateway metadata must not expose a third top-level basePath; app/backend surface base paths are the only HTTP API bases.',
);

const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
for (const route of routeCatalog) {
  assertNoForbiddenPrefix(route.path, `${route.operationId} route path`);
  assertNoForbiddenPrefix(route.openApiPath, `${route.operationId} OpenAPI path`);
  assert.equal(
    route.operationId.startsWith('core.'),
    false,
    `${route.operationId} must not expose the legacy core operationId namespace.`,
  );
  assert.equal(
    route.operationId.startsWith('admin.'),
    false,
    `${route.operationId} must not expose the legacy admin operationId namespace.`,
  );
  assertStandardOperationId(route.operationId, `${route.operationId} route catalog entry`);

  if (route.surface === 'app') {
    assert.equal(
      route.path.startsWith(APP_API_PREFIX),
      true,
      `${route.operationId} app route must use ${APP_API_PREFIX}: ${route.path}`,
    );
    assert.equal(
      route.openApiPath.startsWith(APP_API_PREFIX),
      true,
      `${route.operationId} app OpenAPI path must use ${APP_API_PREFIX}: ${route.openApiPath}`,
    );
    assertLowerSnakeStaticSegments(route.openApiPath, `${route.operationId} app OpenAPI path`);
  }

  if (route.surface === 'backend') {
    assert.equal(
      route.path.startsWith(BACKEND_API_PREFIX),
      true,
      `${route.operationId} backend route must use ${BACKEND_API_PREFIX}: ${route.path}`,
    );
    assert.equal(
      route.openApiPath.startsWith(BACKEND_API_PREFIX),
      true,
      `${route.operationId} backend OpenAPI path must use ${BACKEND_API_PREFIX}: ${route.openApiPath}`,
    );
    assert.equal(
      route.openApiPath.startsWith(`${BACKEND_API_PREFIX}/auth`),
      false,
      `backend API must not expose auth/session login namespace: ${route.openApiPath}`,
    );
    assertLowerSnakeStaticSegments(route.openApiPath, `${route.operationId} backend OpenAPI path`);
  }
}

const openApiDocument = buildBirdCoderCodingServerOpenApiDocumentSeed();
assert.deepEqual(openApiDocument.tags.map((tag) => tag.name), [
  'auth',
  'billing',
  'content',
  'iam',
  'intelligence',
  'platform',
  'runtime',
  'skills',
  'system',
  'templates',
]);
assert.equal(openApiDocument['x-sdkwork-api-gateway'].routesBySurface.app, 73);
assert.equal(openApiDocument['x-sdkwork-api-gateway'].routesBySurface.backend, 7);
assert.equal(
  'basePath' in openApiDocument['x-sdkwork-api-gateway'],
  false,
  'OpenAPI gateway extension must not publish a third top-level basePath outside /app/v3/api and /backend/v3/api.',
);
for (const [pathKey, methods] of Object.entries(openApiDocument.paths)) {
  assertNoForbiddenPrefix(pathKey, `OpenAPI path`);

  if (pathKey.startsWith(APP_API_PREFIX) || pathKey.startsWith(BACKEND_API_PREFIX)) {
    assertLowerSnakeStaticSegments(pathKey, `OpenAPI path`);
  }

  if (pathKey.startsWith(BACKEND_API_PREFIX)) {
    assert.equal(
      pathKey.startsWith(`${BACKEND_API_PREFIX}/auth`),
      false,
      `backend API must not publish auth/session login operations: ${pathKey}`,
    );
  }

  for (const operation of Object.values(methods ?? {})) {
    assertNoForbiddenPrefix(operation['x-sdkwork-surface'], `${operation.operationId} surface`);
    assertStandardOperationId(operation.operationId, `${operation.operationId} OpenAPI operation`);
    assertStandardOpenApiTags(operation.tags, `${operation.operationId} OpenAPI operation`);
    const tag = operation.tags?.[0] ?? '';
    assert.equal(
      operation.operationId.startsWith(`${tag}.`),
      false,
      `${operation.operationId} OpenAPI operationId must not repeat its tag ${tag}.`,
    );
    assertStandardOpenApiGovernanceExtensions(
      operation,
      `${operation.operationId} OpenAPI operation`,
    );
    if (
      operation['x-sdkwork-surface'] === 'backend' &&
      operation['x-sdkwork-domain'] === 'iam'
    ) {
      assert.equal(
        pathKey.startsWith(`${BACKEND_API_PREFIX}/iam/`),
        true,
        `${operation.operationId} backend IAM operation must live under ${BACKEND_API_PREFIX}/iam: ${pathKey}`,
      );
    }
  }
}

const rustHostSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
);
for (const forbiddenPrefix of FORBIDDEN_PREFIXES) {
  assert.equal(
    rustHostSource.includes(forbiddenPrefix),
    false,
    `Rust host source must not retain forbidden API prefix ${forbiddenPrefix}.`,
  );
}
for (const forbiddenResourcePath of FORBIDDEN_RUNTIME_RESOURCE_PATHS) {
  assert.equal(
    rustHostSource.includes(forbiddenResourcePath),
    false,
    `Rust host source must not expose database-table-style API resource path ${forbiddenResourcePath}.`,
  );
}
assert.equal(
  rustHostSource.includes('/app/v3/api/coding_sessions'),
  true,
  'Rust host source must expose canonical coding session API paths from API_SPEC.',
);

console.log('coding server API_SPEC path contract passed.');
