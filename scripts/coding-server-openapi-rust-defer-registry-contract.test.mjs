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
  157,
  'HTTP OpenAPI contract must expose 157 governed app/backend operations; workspace realtime remains a route-catalog-only realtime entry and is not emitted as an HTTP OpenAPI operation.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount,
  157,
  'Product and federated IAM routes must implement all HTTP OpenAPI operations.',
);
assert.equal(
  liveRegistry.summary.deferredOperationCount,
  0,
  'No OpenAPI operation may remain outside host manifests.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount + liveRegistry.summary.deferredOperationCount,
  liveRegistry.summary.contractOperationCount,
);

assert.equal(
  liveRegistry.deferred.length,
  0,
  'Deferred route list must be empty once all governed app/backend routes are wired.',
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
assert.match(
  manifestGeneratorSource,
  /PAYMENT_CONFIRM_PATH/u,
  'Manifest generator must include commerce payment confirm route.',
);
assert.match(
  manifestGeneratorSource,
  /WORKSPACE_REALTIME_PATH[\s\S]*routeCatalogOnly: true[\s\S]*streamKind: 'websocket'/u,
  'Manifest generator must keep workspace realtime as a route-catalog-only WebSocket instead of requiring an HTTP OpenAPI operation.',
);

process.stdout.write('coding-server-openapi-rust-defer-registry contract passed\n');
