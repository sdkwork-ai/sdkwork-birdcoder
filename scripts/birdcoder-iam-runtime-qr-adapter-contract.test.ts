import assert from 'node:assert/strict';
import fs from 'node:fs';

const iamRuntimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts', import.meta.url),
  'utf8',
);
const appbaseOpenPlatformSdkSource = fs.readFileSync(
  new URL(
    '../../sdkwork-appbase/sdks/sdkwork-appbase-app-sdk/sdkwork-appbase-app-sdk-typescript/generated/server-openapi/src/api/open-platform.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  iamRuntimeSource,
  /createAppbaseAppSdkClient\(\{[\s\S]*baseUrl:\s*sdkBaseUrls\.appbaseAppApiBaseUrl[\s\S]*tokenManager/u,
  'BirdCoder IAM runtime must use the appbase app SDK as the QR auth authority.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /createBirdCoderIamAppClientForSdkworkIamRuntime|openPlatform:\s*\{[\s\S]*qrAuth:\s*\{[\s\S]*retrieve\(sessionKey:\s*string\)[\s\S]*\{\s*sessionKey\s*\}/u,
  'BirdCoder IAM runtime must not keep a product-local QR path-parameter adapter.',
);
assert.match(
  appbaseOpenPlatformSdkSource,
  /retrieve\(sessionKey:\s*string\)/u,
  'sdkwork-appbase generated app SDK must expose QR session retrieve(sessionKey).',
);
assert.match(
  appbaseOpenPlatformSdkSource,
  /scans[\s\S]*create\(sessionKey:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose QR scan create(sessionKey, body).',
);
assert.match(
  appbaseOpenPlatformSdkSource,
  /passwords[\s\S]*create\(sessionKey:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose QR password create(sessionKey, body).',
);

console.log('birdcoder IAM runtime QR adapter contract passed.');
