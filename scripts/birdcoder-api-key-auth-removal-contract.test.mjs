import assert from 'node:assert/strict';
import fs from 'node:fs';

const forbiddenRuntimeFiles = [
  'crates/sdkwork-api-birdcoder-assembly/src/routes/api_keys.rs',
  'crates/sdkwork-api-birdcoder-assembly/src/routes/notifications.rs',
  'crates/sdkwork-api-birdcoder-assembly/src/routes/usage.rs',
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/routes/api_keys.rs',
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/routes/notifications.rs',
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/routes/usage.rs',
];

for (const file of forbiddenRuntimeFiles) {
  assert.equal(fs.existsSync(file), false, `${file} must remain removed.`);
}

const governedSources = [
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/routers.rs',
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/bootstrap/routers.rs',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiOperationDefinitions.ts',
];

for (const file of governedSources) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /api_key_auth|commerce_auth_middleware|invalid or revoked api key/u);
  assert.doesNotMatch(source, /\/api\/v1/u);
}

process.stdout.write('BirdCoder API-key auth removal contract passed\n');
