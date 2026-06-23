import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const authGateSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth_gate.dart');
const authSurfaceSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/auth_surface.dart');
const loginPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/login_page.dart');
const registerPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/register_page.dart');
const recoveryPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/recovery_page.dart');
const oauthCallbackPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/oauth_callback_page.dart');
const qrLoginPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/qr_login_page.dart');
const authDevPrefillSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/auth_dev_prefill.dart');
const appRouterSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/routes/app_router.dart');
const iamAuthServiceSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/iam_auth_service.dart',
);
const iamRuntimeSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
);

assert.doesNotMatch(
  authGateSource,
  /pending generated Dart auth UI integration/u,
  'Flutter auth gate must not keep placeholder auth copy.',
);
assert.match(
  authGateSource,
  /BirdCoderAuthSurface/u,
  'Flutter auth gate must mount the canonical auth surface.',
);
assert.match(
  loginPageSource,
  /birdCoderIamAuthService\.signInWithPassword/u,
  'Flutter login page must sign in through the generated IAM auth service.',
);
assert.match(
  registerPageSource,
  /birdCoderIamAuthService\.registerWithPassword/u,
  'Flutter register page must register through the generated IAM auth service.',
);
assert.match(
  recoveryPageSource,
  /birdCoderIamAuthService\.requestPasswordReset/u,
  'Flutter recovery page must request password reset through the generated IAM auth service.',
);
assert.match(
  recoveryPageSource,
  /birdCoderIamAuthService\.resetPassword/u,
  'Flutter recovery page must complete password reset through the generated IAM auth service.',
);
assert.match(
  authSurfaceSource,
  /BirdCoderLoginPage/u,
  'Flutter auth surface must compose the login page.',
);
assert.match(
  authSurfaceSource,
  /BirdCoderRegisterPage/u,
  'Flutter auth surface must compose the register page.',
);
assert.match(
  authSurfaceSource,
  /BirdCoderRecoveryPage/u,
  'Flutter auth surface must compose the recovery page.',
);
assert.match(
  authSurfaceSource,
  /BirdCoderQrLoginPage/u,
  'Flutter auth surface must compose the QR login page.',
);
assert.match(
  authSurfaceSource,
  /BirdCoderOAuthCallbackPage/u,
  'Flutter auth surface must compose the OAuth callback page.',
);
assert.match(
  oauthCallbackPageSource,
  /birdCoderIamAuthService\.completeOAuthCallback/u,
  'Flutter OAuth callback page must complete sign-in through the generated IAM auth service.',
);
assert.match(
  qrLoginPageSource,
  /birdCoderIamAuthService\.createQrLoginAuthorization/u,
  'Flutter QR login page must create device authorizations through the generated IAM auth service.',
);
assert.match(
  qrLoginPageSource,
  /birdCoderIamAuthService\.retrieveQrLoginAuthorization/u,
  'Flutter QR login page must poll device authorizations through the generated IAM auth service.',
);
assert.match(
  qrLoginPageSource,
  /birdCoderIamAuthService\.exchangeQrLoginSession/u,
  'Flutter QR login page must exchange confirmed QR authorizations through the generated IAM auth service.',
);
assert.match(
  authDevPrefillSource,
  /BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT/u,
  'Flutter auth dev prefill must support development account dart-defines.',
);
assert.match(
  loginPageSource,
  /BirdCoderAuthDevPrefill/u,
  'Flutter login page must apply development auth prefill.',
);
assert.match(
  appRouterSource,
  /parseBirdCoderOAuthCallbackQuery/u,
  'Flutter app router must parse OAuth callback query parameters.',
);
assert.match(
  iamAuthServiceSource,
  /sessionsCreate/u,
  'Flutter IAM auth service must create sessions through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /registrationsCreate/u,
  'Flutter IAM auth service must register users through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /passwordResetRequestsCreate/u,
  'Flutter IAM auth service must request password resets through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /completeOAuthCallback/u,
  'Flutter IAM auth service must complete OAuth callbacks through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /deviceAuthorizationsCreate/u,
  'Flutter IAM auth service must create QR device authorizations through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /deviceAuthorizationsSessionExchangesCreate/u,
  'Flutter IAM auth service must exchange QR device authorizations through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /authorizationUrlsCreate/u,
  'Flutter IAM auth service must resolve OAuth authorization URLs through the generated app SDK.',
);
assert.match(
  iamAuthServiceSource,
  /iamRuntimeRetrieve/u,
  'Flutter IAM auth service must read IAM runtime settings through the generated app SDK.',
);
assert.match(
  loginPageSource,
  /resolveOAuthAuthorizationUrl/u,
  'Flutter login page must resolve OAuth authorization URLs through the IAM auth service.',
);
assert.match(
  loginPageSource,
  /launchBirdCoderExternalAuthUrl/u,
  'Flutter login page must launch OAuth providers through the host external auth adapter.',
);
assert.match(
  appRouterSource,
  /resolveBirdCoderAuthSurfaceRoute/u,
  'Flutter app router must resolve canonical IAM auth routes.',
);
assert.match(
  iamRuntimeSource,
  /readIamPlatform/u,
  'BirdCoder IAM runtime must resolve platform from runtime target env.',
);
assert.match(
  iamRuntimeSource,
  /__SDKWORK_H5_REACT_ENV__/u,
  'BirdCoder IAM runtime must read H5 public runtime env for platform resolution.',
);
assert.doesNotMatch(
  iamRuntimeSource,
  /platform:\s*'pc'/u,
  'BirdCoder IAM runtime must not hardcode pc platform literals.',
);

console.log('flutter mobile auth surface contract passed.');
