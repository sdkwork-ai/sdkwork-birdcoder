import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  IAM_AUTH_PC_REACT_ROOT_REL,
  SDKWORK_IAM_WORKSPACE_REL,
} from './birdcoder-iam-workspace-paths.mjs';

const rootDir = process.cwd();
const iamRootDir = path.resolve(rootDir, SDKWORK_IAM_WORKSPACE_REL);

function readText(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

function readIamText(...segments) {
  return fs.readFileSync(path.join(iamRootDir, ...segments), 'utf8');
}

const authPageSource = readText(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-auth',
  'src',
  'pages',
  'AuthPage.tsx',
);
const authSurfaceSource = readText(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-auth',
  'src',
  'auth-surface.ts',
);
const iamRuntimeSource = readText(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-infrastructure',
  'src',
  'services',
  'iamRuntime.ts',
);
const vitePluginSource = readText('scripts', 'create-birdcoder-vite-plugins.mjs');
const iamOauthSource = [
  readIamText('crates/sdkwork-routes-iam-app-api/src/directory.rs'),
  readIamText('crates/sdkwork-routes-iam-app-api/src/ephemeral.rs'),
  readIamText('crates/sdkwork-routes-iam-app-api/src/handlers.rs'),
].join('\n');
const birdcoderApiAssemblySource = [
  readText(
    'crates',
    'sdkwork-api-birdcoder-assembly',
    'src',
    'application_bootstrap',
    'auth.rs',
  ),
  readText(
    'crates',
    'sdkwork-api-birdcoder-assembly',
    'src',
    'application_bootstrap',
    'routers.rs',
  ),
].join('\n');
const sharedAuthPageSource = readIamText(
  `${IAM_AUTH_PC_REACT_ROOT_REL}/src/pages/AuthPage.tsx`,
);
const sharedAuthRuntimeSource = readIamText(
  `${IAM_AUTH_PC_REACT_ROOT_REL}/src/auth-iam-runtime.ts`,
);
const appbaseAppOauthSdkSource = readIamText(
  'sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi/src/api/oauth.ts',
);

assert.match(
  authPageSource,
  /from "@sdkwork\/auth-pc-react"/u,
  'BirdCoder login page must consume the sdkwork-appbase auth package entry.',
);
assert.match(
  authPageSource,
  /<SdkworkIamAuthRoutes/u,
  'BirdCoder login page must render the sdkwork-appbase SdkworkIamAuthRoutes component.',
);
assert.match(
  authSurfaceSource,
  /const DEFAULT_BIRDCODER_AUTH_LEFT_RAIL_MODE:\s*SdkworkAuthLeftRailMode\s*=\s*"qr-only"/u,
  'BirdCoder auth surface must default the shared login view to QR-first mode.',
);
assert.match(
  authSurfaceSource,
  /qrLoginEnabled:\s*true/u,
  'BirdCoder auth surface must keep QR login enabled through appbase runtime config.',
);
assert.match(
  authSurfaceSource,
  /createSdkworkIamRuntimeAuthController/u,
  'BirdCoder auth surface must use the sdkwork-iam runtime auth controller.',
);

assert.match(
  vitePluginSource,
  /find:\s*['"]@sdkwork\/auth-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/auth-pc-react from sdkwork-iam.',
);
assert.match(
  vitePluginSource,
  /find:\s*\/\^qrcode\$\/u/u,
  'BirdCoder Vite aliases must keep the qrcode browser compatibility alias for appbase QR rendering.',
);
assert.match(
  sharedAuthPageSource,
  /import\s+\*\s+as\s+QRCode\s+from\s+["']qrcode["']/u,
  'sdkwork-appbase auth page must own QR image rendering through the standard qrcode package.',
);
assert.match(
  sharedAuthPageSource,
  /QRCode\.toDataURL\(nextQrCode\.qrContent!\.trim\(\)/u,
  'sdkwork-appbase auth page must render a QR image from qrContent when no image qrUrl is provided.',
);
assert.match(
  sharedAuthRuntimeSource,
  /function resolvePlatformQrContent/u,
  'sdkwork-iam runtime must normalize generated SDK qrContent payloads before rendering.',
);
assert.doesNotMatch(
  sharedAuthRuntimeSource,
  /\bqrUrl\b/u,
  'sdkwork-iam runtime must not treat qrUrl as a QR status API URL; QR rendering is based on qrContent or qrCode media.',
);
assert.match(
  iamRuntimeSource,
  /createAppbaseAppSdkClient/u,
  'BirdCoder IAM runtime must construct the appbase app SDK for QR auth and login/session flows.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /createBirdCoderIamAppClientForSdkworkIamRuntime|app:\s*getBirdCoderGeneratedAppSdkClient\(\)/u,
  'BirdCoder IAM runtime must not use a BirdCoder product SDK QR adapter as the appbase login authority.',
);
assert.match(
  appbaseAppOauthSdkSource,
  /retrieve\(deviceAuthorizationId:\s*string\)/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization retrieve(deviceAuthorizationId) directly.',
);
assert.match(
  appbaseAppOauthSdkSource,
  /scans[\s\S]*create\(deviceAuthorizationId:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization scan creation with semantic deviceAuthorizationId arguments.',
);
assert.match(
  appbaseAppOauthSdkSource,
  /OauthDeviceAuthorizationsPasswordCompletionsApi[\s\S]*create\(deviceAuthorizationId:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose OAuth device authorization password completion with semantic deviceAuthorizationId arguments.',
);

assert.doesNotMatch(
  iamOauthSource,
  /format!\(["']\{\/\}\/app\/v3\/api\/open_platform\/qr_auth\/sessions\/\{session_key\}["']/u,
  'Appbase IAM must not return the JSON QR auth status endpoint as qrUrl; clients treat qrUrl as an image source.',
);
assert.doesNotMatch(
  iamOauthSource,
  /request_base_url/u,
  'Appbase IAM QR generation must not depend on request headers to synthesize a status API qrUrl.',
);
assert.match(
  iamOauthSource,
  /"qrContent":\s*\{\s*"content":\s*s\.qr_content,\s*"mode":\s*s\.qr_content_mode\s*\}/u,
  'Appbase IAM must expose structured qrContent payloads instead of legacy qrUrl status endpoints.',
);
assert.doesNotMatch(
  birdcoderApiAssemblySource,
  /sdkwork_routes_iam_app_api|build_sdkwork_iam_app_api_router/u,
  'BirdCoder API assembly must consume IAM request context without embedding dependency-owned IAM routes.',
);

console.log('auth qr appbase integration contract passed.');
