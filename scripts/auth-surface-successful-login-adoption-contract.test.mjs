import assert from 'node:assert/strict';
import fs from 'node:fs';

const authPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx', import.meta.url),
  'utf8',
);
const iamIntegrationSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-iam/src/iamIntegration.ts', import.meta.url),
  'utf8',
);
const runtimeAuthServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts', import.meta.url),
  'utf8',
);
const iamRuntimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts', import.meta.url),
  'utf8',
);

assert.match(
  authPageSource,
  /import \{\s*SdkworkIamAuthRoutes,[\s\S]*\} from "@sdkwork\/auth-pc-react";/u,
  'AuthPage must render the standard SDKWork IAM auth routes.',
);

assert.match(
  authPageSource,
  /getRuntime=\{getRuntime\}/u,
  'AuthPage must receive the canonical BirdCoder SDKWork IAM runtime from the IAM integration boundary.',
);

assert.match(
  iamIntegrationSource,
  /loadAuthPage\(\{ getRuntime: getBirdCoderIamRuntime \}\)/u,
  'IAM integration must give the shared auth UI the canonical BirdCoder SDKWork IAM runtime.',
);

assert.match(
  authPageSource,
  /runtimeConfig=\{resolveBirdCoderAuthRuntimeConfig\(\)\}/u,
  'AuthPage must pass BirdCoder runtime metadata to the standard SDKWork IAM auth UI.',
);

assert.doesNotMatch(
  authPageSource,
  /authService\.|createSdkworkCanonicalAuthController|createSdkworkSyntheticAuthSession|exchangeUserCenterSession|getUserCenterConfig/u,
  'AuthPage must not keep app-local auth controllers, synthetic sessions, or retired identity bridge calls.',
);

assert.match(
  runtimeAuthServiceSource,
  /runtime\.service\.iam\.users\.current\.retrieve\(\)/u,
  'RuntimeAuthService must hydrate current users from the SDKWork IAM generated app SDK surface.',
);

assert.match(
  runtimeAuthServiceSource,
  /runtime\.service\.auth\.sessions\.current\.delete\(\)/u,
  'RuntimeAuthService logout must revoke the current SDKWork IAM app session.',
);

assert.match(
  iamRuntimeSource,
  /createAppbaseAppSdkClient\(\{[\s\S]*baseUrl:\s*sdkBaseUrls\.appbaseAppApiBaseUrl[\s\S]*tokenManager/u,
  'BirdCoder IAM runtime must construct the appbase app SDK client as the login/session authority.',
);
assert.match(
  iamRuntimeSource,
  /createIamRuntime\(\{[\s\S]*clients:\s*\{[\s\S]*appbaseApp[\s\S]*appbaseBackend[\s\S]*sdkClients:\s*\[[\s\S]*birdcoderApp[\s\S]*birdcoderBackend[\s\S]*driveApp/u,
  'BirdCoder IAM runtime must compose appbase, BirdCoder product, and Drive SDK clients through the standard runtime clients shape.',
);

console.log('auth surface successful login adoption contract passed.');
