import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const appbaseRootDir = path.resolve(rootDir, '../sdkwork-appbase');

function readText(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

function readAppbaseText(...segments) {
  return fs.readFileSync(path.join(appbaseRootDir, ...segments), 'utf8');
}

const authPageSource = readText(
  'packages',
  'sdkwork-birdcoder-auth',
  'src',
  'pages',
  'AuthPage.tsx',
);
const authSurfaceSource = readText(
  'packages',
  'sdkwork-birdcoder-auth',
  'src',
  'auth-surface.ts',
);
const iamRuntimeSource = readText(
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'iamRuntime.ts',
);
const vitePluginSource = readText('scripts', 'create-birdcoder-vite-plugins.mjs');
const iamAuthoritySource = readText(
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'src',
  'iam_authority.rs',
);
const serverLibSource = readText(
  'packages',
  'sdkwork-birdcoder-server',
  'src-host',
  'src',
  'lib.rs',
);
const sharedAuthPageSource = readAppbaseText(
  'packages',
  'pc-react',
  'iam',
  'sdkwork-auth-pc-react',
  'src',
  'pages',
  'AuthPage.tsx',
);
const sharedAuthRuntimeSource = readAppbaseText(
  'packages',
  'pc-react',
  'iam',
  'sdkwork-auth-pc-react',
  'src',
  'auth-iam-runtime.ts',
);
const appbaseAppOpenPlatformSdkSource = readAppbaseText(
  'sdks',
  'sdkwork-appbase-app-sdk',
  'sdkwork-appbase-app-sdk-typescript',
  'generated',
  'server-openapi',
  'src',
  'api',
  'open-platform.ts',
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
  'BirdCoder auth surface must use the sdkwork-appbase IAM runtime auth controller.',
);

assert.match(
  vitePluginSource,
  /find:\s*['"]@sdkwork\/auth-pc-react['"]/u,
  'BirdCoder Vite aliases must resolve @sdkwork/auth-pc-react from sdkwork-appbase.',
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
  'sdkwork-appbase IAM runtime must normalize generated SDK qrContent payloads before rendering.',
);
assert.doesNotMatch(
  sharedAuthRuntimeSource,
  /\bqrUrl\b/u,
  'sdkwork-appbase IAM runtime must not treat qrUrl as a QR status API URL; QR rendering is based on qrContent or qrCode media.',
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
  appbaseAppOpenPlatformSdkSource,
  /retrieve\(sessionKey:\s*string\)/u,
  'sdkwork-appbase generated app SDK must expose QR session retrieve(sessionKey) directly.',
);
assert.match(
  appbaseAppOpenPlatformSdkSource,
  /scans[\s\S]*create\(sessionKey:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose QR scan creation with semantic sessionKey arguments.',
);
assert.match(
  appbaseAppOpenPlatformSdkSource,
  /passwords[\s\S]*create\(sessionKey:\s*string,\s*body/u,
  'sdkwork-appbase generated app SDK must expose QR password completion with semantic sessionKey arguments.',
);

assert.doesNotMatch(
  iamAuthoritySource,
  /format!\(["']\{\/\}\/app\/v3\/api\/open_platform\/qr_auth\/sessions\/\{session_key\}["']/u,
  'BirdCoder local IAM must not return the JSON QR auth status endpoint as qrUrl; appbase treats qrUrl as an image source.',
);
assert.doesNotMatch(
  iamAuthoritySource,
  /request_base_url/u,
  'BirdCoder local IAM QR generation must not depend on request headers to synthesize a status API qrUrl.',
);
assert.match(
  iamAuthoritySource,
  /let qr_url:\s*Option<String>\s*=\s*None;/u,
  'BirdCoder local IAM must store no qrUrl unless it is a real image URL; appbase will render qrContent with qrcode.',
);
assert.doesNotMatch(
  serverLibSource,
  /resolve_request_base_url/u,
  'BirdCoder server must not keep request-base-url plumbing solely to create a non-image QR status URL.',
);

console.log('auth qr appbase integration contract passed.');
