import assert from 'node:assert/strict';
import fs from 'node:fs';

const iamRuntimeSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts', import.meta.url),
  'utf8',
);
const appbaseOauthSdkSource = fs.readFileSync(
  new URL(
    '../../sdkwork-iam/sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi/src/api/oauth.ts',
    import.meta.url,
  ),
  'utf8',
);
const pcRootViteConfigSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/vite.config.ts', import.meta.url),
  'utf8',
);
const pcWebViteConfigSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts', import.meta.url),
  'utf8',
);
const pcDesktopVitePluginsSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/vite/createDesktopVitePlugins.mjs',
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
  /retrieve\(deviceAuthorizationId:\s*string(?:,\s*requestOptions\?:\s*ApiRequestOptions)?\)/u,
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
assert.match(
  pcRootViteConfigSource,
  /loadEnv\(mode,\s*__dirname,\s*['"]['"]\)[\s\S]*accessToken:\s*env\.SDKWORK_ACCESS_TOKEN/u,
  'The PC root Vite config must inject the merged private bootstrap Access-Token from the PC app root.',
);
assert.match(
  pcWebViteConfigSource,
  /appRootDir\s*=\s*path\.resolve\(__dirname,\s*['"]\.\.\/\.\.['"]\)[\s\S]*loadEnv\(mode,\s*appRootDir,\s*['"]['"]\)[\s\S]*accessToken:\s*runtimeEnvSource\.SDKWORK_ACCESS_TOKEN/u,
  'The PC web Vite config must inject the private bootstrap Access-Token loaded from the PC app root.',
);
assert.match(
  pcDesktopVitePluginsSource,
  /createSdkworkCredentialEntryBootstrapVitePlugin\(\{[\s\S]*accessToken:\s*runtimeEnvSource\.SDKWORK_ACCESS_TOKEN/u,
  'The PC desktop renderer must inject the private bootstrap Access-Token before IAM credential-entry requests.',
);

console.log('birdcoder IAM runtime QR adapter contract passed.');
