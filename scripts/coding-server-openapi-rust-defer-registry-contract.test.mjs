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

// Commerce lane disposition (option 1: pre-launch deferred).
// The 15 commerce operations (api-keys / notifications / usage) are designed in
// the OpenAPI contract ahead of Rust route crate implementation. They are tracked
// as pre-launch deferred until commercial capabilities reach launch readiness
// (expected close: P3 commercial capability phase). See `deferredLanePolicy` in
// the registry and docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md.
assert.ok(
  liveRegistry.summary.iamFederationManifestRouteCount >= 80,
  'Defer registry must count federated sdkwork-iam manifest routes.',
);
assert.equal(
  liveRegistry.summary.contractOperationCount,
  147,
  'OpenAPI contract must expose 147 operations (132 product/IAM + 15 commerce).',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount,
  132,
  'Product and federated IAM manifests must implement 132 OpenAPI operations.',
);
assert.equal(
  liveRegistry.summary.deferredOperationCount,
  15,
  'Commerce lane (api-keys / notifications / usage) is pre-launch deferred until commercial launch readiness.',
);
assert.equal(
  liveRegistry.summary.implementedOperationCount + liveRegistry.summary.deferredOperationCount,
  liveRegistry.summary.contractOperationCount,
);

assert.equal(
  liveRegistry.deferred.length,
  15,
  'Deferred route list must contain the 15 commerce pre-launch deferred operations.',
);
assert.ok(
  liveRegistry.deferred.every((entry) => entry.reason === 'commerce-pre-launch-deferred'),
  'Every deferred operation must belong to the commerce pre-launch deferred lane.',
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
  /ADMIN_TEAMS_PATH/u,
  'Manifest generator must include backend IAM teams routes.',
);

const iamBootstrapSource = fs.readFileSync(
  path.join(workspaceRootDir, 'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/iam.rs'),
  'utf8',
);
assert.match(
  iamBootstrapSource,
  /build_sdkwork_iam_backend_api_router_from_env/u,
  'standalone-gateway must wire sdkwork-iam backend federation router.',
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
