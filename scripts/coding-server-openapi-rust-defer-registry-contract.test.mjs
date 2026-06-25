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
  132,
  'OpenAPI contract must expose 132 operations.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount,
  132,
  'All OpenAPI operations must be implemented in product or federated IAM manifests.',
);
assert.equal(
  liveRegistry.summary.deferredOperationCount,
  0,
  'Defer registry must not track residual OpenAPI gaps after teams lane closure.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount + liveRegistry.summary.deferredOperationCount,
  liveRegistry.summary.contractOperationCount,
);

assert.equal(liveRegistry.deferred.length, 0, 'Deferred route list must be empty when count is zero.');

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
  /ADMIN_TEAMS_PATH/u,
  'Manifest generator must include backend IAM teams routes.',
);

const iamBootstrapSource = fs.readFileSync(
  path.join(workspaceRootDir, 'crates/sdkwork-birdcoder-api-server/src/bootstrap/iam.rs'),
  'utf8',
);
assert.match(
  iamBootstrapSource,
  /build_sdkwork_iam_backend_api_router_from_env/u,
  'api-server must wire sdkwork-iam backend federation router.',
);

const commercialTruthDoc = fs.readFileSync(
  path.join(workspaceRootDir, 'docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md'),
  'utf8',
);
assert.match(
  commercialTruthDoc,
  /coding-server-openapi-rust-defer-registry\.json/u,
  'Commercial truth doc must reference the explicit defer registry artifact.',
);

assert.equal(fs.existsSync(registryPath), true, `${registryPath} must exist.`);

console.log('coding-server openapi rust defer registry contract passed.');
