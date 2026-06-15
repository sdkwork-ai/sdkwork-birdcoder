import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(
  import.meta.dirname,
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.match(
  source,
  /createBirdCoderAppSdkApiClient/,
  'defaultIdeServices must compose the generated app SDK wrapper.',
);

assert.match(
  source,
  /createBirdCoderBackendSdkApiClient/,
  'defaultIdeServices must compose the generated backend SDK wrapper.',
);

assert.doesNotMatch(
  source,
  /createBirdCoderGeneratedAppAdminApiClient|BirdCoderAppAdminApiClient|appAdminClient/,
  'defaultIdeServices must not reference the retired app-admin facade.',
);

assert.match(
  source,
  /createBirdCoderAppSdkApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the app SDK wrapper directly from the HTTP transport.',
);

assert.match(
  source,
  /createBirdCoderBackendSdkApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the backend SDK wrapper directly from the HTTP transport.',
);

assert.match(
  source,
  /export function createInProcessBirdCoderAppClient[\s\S]*createBirdCoderAppSdkApiClient\(\{\s*transport:\s*createBirdCoderInProcessAppSdkTransport\(/s,
  'test helpers may expose an explicit in-process app SDK client builder for isolated contracts.',
);

assert.match(
  source,
  /export function createInProcessBirdCoderBackendClient[\s\S]*createBirdCoderBackendSdkApiClient\(\{\s*transport:\s*createBirdCoderInProcessBackendSdkTransport\(/s,
  'test helpers may expose an explicit in-process backend SDK client builder for isolated contracts.',
);

assert.match(
  source,
  /const appClient =[\s\S]*resolveRuntimeAppClient\(\)[\s\S]*createUnavailableBirdCoderAppClient\(\);/s,
  'defaultIdeServices must require a bound app SDK client instead of silently falling back to in-process authority.',
);

assert.match(
  source,
  /const backendClient =[\s\S]*resolveRuntimeBackendClient\(\)[\s\S]*createUnavailableBirdCoderBackendClient\(\);/s,
  'defaultIdeServices must require a bound backend SDK client instead of silently falling back to in-process authority.',
);

console.log('default IDE services split SDK client contract passed.');
