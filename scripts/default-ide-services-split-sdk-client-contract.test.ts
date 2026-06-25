import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const infrastructureServicesDir = path.resolve(
  import.meta.dirname,
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services',
);
const defaultIdeServicesSource = fs.readFileSync(
  path.join(infrastructureServicesDir, 'defaultIdeServices.ts'),
  'utf8',
);
const defaultIdeServicesSharedSource = fs.readFileSync(
  path.join(infrastructureServicesDir, 'defaultIdeServicesShared.ts'),
  'utf8',
);

assert.match(
  defaultIdeServicesSource,
  /createBirdCoderAppSdkApiClient/,
  'defaultIdeServices must compose the generated app SDK wrapper.',
);

assert.match(
  defaultIdeServicesSharedSource,
  /createBirdCoderBackendSdkApiClient/,
  'defaultIdeServicesShared must compose the generated backend SDK wrapper.',
);

assert.doesNotMatch(
  defaultIdeServicesSource,
  /createBirdCoderGeneratedAppAdminApiClient|BirdCoderAppAdminApiClient|appAdminClient/,
  'defaultIdeServices must not reference the retired app-admin facade.',
);

assert.match(
  defaultIdeServicesSharedSource,
  /createBirdCoderAppSdkApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the app SDK wrapper directly from the HTTP transport.',
);

assert.match(
  defaultIdeServicesSharedSource,
  /createBirdCoderBackendSdkApiClient\(\{\s*transport:\s*createBirdCoderHttpApiTransport\(/s,
  'runtime HTTP composition must build the backend SDK wrapper directly from the HTTP transport.',
);

assert.match(
  defaultIdeServicesSource,
  /export function createInProcessBirdCoderAppClient[\s\S]*createBirdCoderAppSdkApiClient\(\{\s*transport:\s*createBirdCoderInProcessAppSdkTransport\(/s,
  'test helpers may expose an explicit in-process app SDK client builder for isolated contracts.',
);

assert.match(
  defaultIdeServicesSource,
  /export function createInProcessBirdCoderBackendClient[\s\S]*createBirdCoderBackendSdkApiClient\(\{\s*transport:\s*createBirdCoderInProcessBackendSdkTransport\(/s,
  'test helpers may expose an explicit in-process backend SDK client builder for isolated contracts.',
);

assert.match(
  defaultIdeServicesSource,
  /const appClient =[\s\S]*runtime\.appClient \?\?[\s\S]*resolveRuntimeAppClient\(\)[\s\S]*createUnavailableBirdCoderAppClient\(\);/s,
  'defaultIdeServices must require a bound app SDK client instead of silently falling back to in-process authority.',
);

assert.match(
  defaultIdeServicesSharedSource,
  /const backendClient =[\s\S]*resolveRuntimeBackendClient\(\)[\s\S]*createUnavailableBirdCoderBackendClient\(\)/s,
  'defaultIdeServicesShared must require a bound backend SDK client instead of silently falling back to in-process authority when no explicit backend client is configured.',
);

console.log('default IDE services split SDK client contract passed.');
