import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const authDeepLinkSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/auth_deep_link.dart',
);
const hostAdapterSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/lib/src/deep_link/birdcoder_deep_link_adapter.dart',
);
const hostPubspecSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_host/pubspec.yaml',
);
const authGateSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth_gate.dart');
const qrLoginPageSource = read('apps/sdkwork-birdcoder-flutter-mobile/lib/auth/qr_login_page.dart');

assert.match(
  authDeepLinkSource,
  /normalizeBirdCoderAuthDeepLinkPath/u,
  'Flutter core must normalize auth deep links into canonical IAM auth routes.',
);
assert.match(
  authDeepLinkSource,
  /isBirdCoderAuthRoutePath/u,
  'Flutter auth deep link normalization must reuse the canonical auth route catalog.',
);
assert.match(
  hostPubspecSource,
  /app_links/u,
  'Flutter host package must declare app_links for platform deep link delivery.',
);
assert.match(
  hostPubspecSource,
  /qr_flutter/u,
  'Flutter host package must declare qr_flutter for QR payload rendering.',
);
assert.match(
  hostPubspecSource,
  /url_launcher/u,
  'Flutter host package must declare url_launcher for external OAuth browser launch.',
);
assert.match(
  qrLoginPageSource,
  /BirdCoderQrPayloadView/u,
  'Flutter QR login page must render QR payloads through the host adapter.',
);
assert.match(
  hostAdapterSource,
  /getInitialLink/u,
  'Flutter deep link adapter must read the cold-start deep link.',
);
assert.match(
  hostAdapterSource,
  /uriLinkStream/u,
  'Flutter deep link adapter must subscribe to runtime deep link updates.',
);
assert.match(
  authGateSource,
  /getBirdCoderDeepLinkAdapter/u,
  'Flutter auth gate must consume the host deep link adapter.',
);
assert.match(
  authGateSource,
  /normalizeBirdCoderAuthDeepLinkPath/u,
  'Flutter auth gate must route deep links through canonical auth path normalization.',
);
assert.match(
  authGateSource,
  /parseBirdCoderOAuthCallbackQuery/u,
  'Flutter auth gate must parse OAuth callback deep links into auth surface query state.',
);

console.log('flutter mobile deep link auth contract passed.');
