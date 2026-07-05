import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCodingServerOpenApiRustDeferRegistry } from './build-coding-server-openapi-rust-defer-registry.mjs';

const workspaceRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(
  workspaceRootDir,
  'specs/coding-server-openapi-rust-defer-registry.json',
);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRootDir, relativePath), 'utf8'));
}

const liveRegistry = buildCodingServerOpenApiRustDeferRegistry();
const committedRegistry = readJson('specs/coding-server-openapi-rust-defer-registry.json');

assert.equal(committedRegistry.schemaVersion, 2);
assert.deepEqual(
  committedRegistry.summary,
  liveRegistry.summary,
  'Committed defer registry summary must match live OpenAPI vs host manifest diff.',
);
assert.deepEqual(
  committedRegistry.deferred.map((entry) => `${entry.method} ${entry.path}`),
  liveRegistry.deferred.map((entry) => `${entry.method} ${entry.path}`),
  'Committed defer registry deferred routes must match live diff.',
);

assert.ok(
  liveRegistry.summary.iamFederationManifestRouteCount >= 80,
  'Defer registry must count federated sdkwork-iam manifest routes.',
);
assert.equal(
  liveRegistry.summary.contractOperationCount,
  161,
  'OpenAPI contract must expose 161 operations (product/IAM/commerce gateway/commerce transactions/chat).',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount,
  161,
  'Product, federated IAM, and commerce gateway routes must implement all OpenAPI operations.',
);
assert.equal(
  liveRegistry.summary.deferredOperationCount,
  0,
  'No OpenAPI operation may remain outside host manifests or commerce gateway routes.',
);
assert.equal(
  liveRegistry.summary.commerceGatewayRouteCount,
  15,
  'Commerce gateway must register 15 /api/v1/* routes.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount + liveRegistry.summary.deferredOperationCount,
  liveRegistry.summary.contractOperationCount,
);

assert.equal(
  liveRegistry.deferred.length,
  0,
  'Deferred route list must be empty once commerce routes are published in OpenAPI and wired in standalone-gateway.',
);

const manifestGeneratorSource = fs.readFileSync(
  path.join(workspaceRootDir, 'scripts/generate-birdcoder-http-route-manifests.mjs'),
  'utf8',
);
assert.match(
  manifestGeneratorSource,
  /TEAMS_PATH/u,
  'Manifest generator must include workspace teams route.',
);

process.stdout.write('coding-server-openapi-rust-defer-registry contract passed\n');
