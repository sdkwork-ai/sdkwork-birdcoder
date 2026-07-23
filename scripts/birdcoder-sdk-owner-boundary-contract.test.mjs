import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const authorityPath = 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json';
const sdkgenInputPath = 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.sdkgen.json';
const manifestPath = 'sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json';
const componentSpecPath = 'sdks/sdkwork-birdcoder-app-sdk/specs/component.spec.json';
const permissionManifestPath = 'specs/iam.module.manifest.json';
const domainOwnershipPath = 'specs/domain-ownership.spec.json';
const httpMethods = new Set(['delete', 'get', 'patch', 'post', 'put']);

function absolutePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolutePath(relativePath), 'utf8'));
}

function collectOperations(document) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (httpMethods.has(method)) {
        operations.push({ method, operation, routePath });
      }
    }
  }
  return operations;
}

for (const retiredPath of [
  'apps/sdkwork-birdcoder-pc/sdks',
  'sdks/sdkwork-birdcoder-backend-sdk',
  'sdks/specs/openapi',
]) {
  assert.equal(
    fs.existsSync(absolutePath(retiredPath)),
    false,
    `Retired SDK authority or mirror must remain absent: ${retiredPath}`,
  );
}

const authority = readJson(authorityPath);
const sdkgenInput = readJson(sdkgenInputPath);
const sdkManifest = readJson(manifestPath);
const componentSpec = readJson(componentSpecPath);
const permissionManifest = readJson(permissionManifestPath);
const domainOwnership = readJson(domainOwnershipPath);

assert.deepEqual(sdkgenInput, authority, 'sdkgen input must equal the single App API authority.');
assert.equal(authority['x-sdkwork-owner'], 'sdkwork-birdcoder');
assert.equal(authority['x-sdkwork-api-authority'], 'sdkwork-birdcoder-app-api');
assert.equal(authority.servers?.[0]?.url, '/app/v3/api');

const operations = collectOperations(authority);
assert.equal(operations.length, 39, 'BirdCoder must own exactly 39 App API operations.');
assert.equal(sdkManifest.ownerOnlyOperationCount, operations.length);
assert.equal(componentSpec.contracts?.apiAuthority?.operationCount, operations.length);
assert.equal(domainOwnership.apiOwnership?.appApi?.operationCount, operations.length);
assert.equal(domainOwnership.apiOwnership?.backendApi?.owned, false);
assert.equal(domainOwnership.apiOwnership?.backendApi?.operationCount, 0);
assert.equal(domainOwnership.apiOwnership?.openApi?.owned, false);
assert.equal(domainOwnership.apiOwnership?.openApi?.operationCount, 0);

assert.equal(sdkManifest.sdkFamily, 'sdkwork-birdcoder-app-sdk');
assert.equal(sdkManifest.sdkOwner, 'sdkwork-birdcoder');
assert.equal(sdkManifest.apiAuthority, 'sdkwork-birdcoder-app-api');
assert.equal(sdkManifest.authoritySpec, 'openapi/sdkwork-birdcoder-app-api.openapi.json');
assert.equal(sdkManifest.generationInputSpec, 'openapi/sdkwork-birdcoder-app-api.sdkgen.json');
assert.equal(sdkManifest.discoverySurface?.sdkTarget, 'app');
assert.equal(sdkManifest.discoverySurface?.apiPrefix, '/app/v3/api');
assert.deepEqual(
  componentSpec.contracts?.sdkDependencies,
  sdkManifest.sdkDependencies,
  'SDK family and component spec must declare the same dependency SDKs.',
);

const operationIds = new Set();
const expectedPermissions = new Map();
for (const { method, operation, routePath } of operations) {
  const context = `${method.toUpperCase()} ${routePath}`;
  assert.ok(routePath.startsWith('/app/v3/api/'), `${context} must remain on App API.`);
  assert.equal(operation['x-sdkwork-owner'], 'sdkwork-birdcoder', `${context} owner drifted.`);
  assert.equal(
    operation['x-sdkwork-api-authority'],
    'sdkwork-birdcoder-app-api',
    `${context} authority drifted.`,
  );
  assert.equal(operation['x-sdkwork-api-surface'], 'app-api', `${context} surface drifted.`);
  assert.equal(operation['x-sdkwork-request-context'], 'WebRequestContext', `${context} context drifted.`);
  assert.deepEqual(
    operation.security,
    [{ AuthToken: [], AccessToken: [] }],
    `${context} must require the standard dual-token security pair.`,
  );
  assert.equal(operationIds.has(operation.operationId), false, `Duplicate operationId ${operation.operationId}.`);
  operationIds.add(operation.operationId);

  const permission = operation['x-sdkwork-permission'];
  const resource = operation['x-sdkwork-resource'];
  assert.match(permission, /^birdcoder\.[a-z0-9-]+\.(?:create|delete|read|update)$/u, `${context} permission is invalid.`);
  assert.match(resource, /^birdcoder\.[a-z0-9-]+$/u, `${context} resource is invalid.`);
  const action = permission.slice(permission.lastIndexOf('.') + 1);
  const previous = expectedPermissions.get(permission);
  if (previous) {
    assert.deepEqual(previous, { action, resource }, `${permission} metadata must be stable.`);
  } else {
    expectedPermissions.set(permission, { action, resource });
  }
}

assert.equal(expectedPermissions.size, 33, 'The 39 operations must resolve to 33 unique permissions.');
assert.equal(permissionManifest.moduleId, 'birdcoder');
assert.equal(permissionManifest.domain, 'birdcoder');
assert.equal(permissionManifest.owner, 'sdkwork-birdcoder');
assert.deepEqual(permissionManifest.permissions?.openapiAuthorities, [authorityPath]);

const permissionCatalog = permissionManifest.permissions?.catalog ?? [];
assert.equal(permissionCatalog.length, expectedPermissions.size);
assert.deepEqual(
  permissionCatalog.map((entry) => entry.code),
  [...expectedPermissions.keys()].sort(),
  'IAM permission catalog must be the exact sorted set referenced by the App authority.',
);
for (const entry of permissionCatalog) {
  const expected = expectedPermissions.get(entry.code);
  assert.ok(expected, `Permission ${entry.code} is not referenced by the BirdCoder App authority.`);
  assert.equal(entry.resource, expected.resource, `${entry.code} resource drifted.`);
  assert.equal(entry.action, expected.action, `${entry.code} action drifted.`);
  assert.equal(entry.status, 'active', `${entry.code} must be active.`);
  assert.equal(entry.replacementCode, null, `${entry.code} must not retain a compatibility alias.`);
}

console.log('BirdCoder SDK owner and IAM permission boundary contract passed.');
