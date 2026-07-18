import assert from 'node:assert/strict';
import fs from 'node:fs';

const forbiddenRuntimeFiles = [
  'crates/sdkwork-birdcoder-gateway-assembly/src/routes/api_keys.rs',
  'crates/sdkwork-birdcoder-gateway-assembly/src/routes/notifications.rs',
  'crates/sdkwork-birdcoder-gateway-assembly/src/routes/usage.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/routes/api_keys.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/routes/notifications.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/routes/usage.rs',
];

for (const file of forbiddenRuntimeFiles) {
  assert.equal(fs.existsSync(file), false, `${file} must remain removed.`);
}

const governedSources = [
  'crates/sdkwork-birdcoder-gateway-assembly/src/application_bootstrap/routers.rs',
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/routers.rs',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiOperationDefinitions.ts',
];

for (const file of governedSources) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /api_key_auth|commerce_auth_middleware|invalid or revoked api key/u);
  assert.doesNotMatch(source, /\/api\/v1/u);
}

for (const file of [
  'etc/sdkwork-api-cloud-gateway.birdcoder.development.toml',
  'etc/sdkwork-api-cloud-gateway.birdcoder.production.toml',
]) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /serviceId = "sdkwork-drive-app-api"/u);
  assert.match(source, /apiPrefix = "\/app\/v3\/api\/drive"/u);
  assert.match(source, /requiredBaseUrlKey = "SDKWORK_DRIVE_APP_API_BASE_URL"/u);
}

process.stdout.write('BirdCoder API-key auth removal contract passed\n');
