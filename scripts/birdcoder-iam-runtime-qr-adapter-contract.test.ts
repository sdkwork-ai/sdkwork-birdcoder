import assert from 'node:assert/strict';
import fs from 'node:fs';

const iamRuntimeSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts', import.meta.url),
  'utf8',
);
const appbaseOauthSdkSource = fs.readFileSync(
  new URL(
    '../../sdkwork-appbase/sdks/sdkwork-appbase-app-sdk/sdkwork-appbase-app-sdk-typescript/generated/server-openapi/src/api/oauth.ts',
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
  appbaseOauthSdkSource,
  /retrieve\(deviceAuthorizationId:\s*string\)/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization retrieve(deviceAuthorizationId).',
);
assert.match(
  appbaseOauthSdkSource,
  /scans[\s\S]*create\(deviceAuthorizationId:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization scan create(deviceAuthorizationId, body).',
);
assert.match(
  appbaseOauthSdkSource,
  /OauthDeviceAuthorizationsPasswordCompletionsApi[\s\S]*create\(deviceAuthorizationId:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization password completion create(deviceAuthorizationId, body).',
);

console.log('birdcoder IAM runtime QR adapter contract passed.');
