import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hostConfigDir = 'apps/sdkwork-birdcoder-flutter-mobile/config/host';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const hostConfigs = [
  'flutter.development.example.json',
  'flutter.test.example.json',
  'flutter.staging.example.json',
  'flutter.production.example.json',
];

for (const fileName of hostConfigs) {
  const config = readJson(path.join(hostConfigDir, fileName));
  assert.equal(config.iosBundleId, 'com.sdkwork.birdcoder.mobile', `${fileName} must declare iosBundleId.`);
  assert.equal(
    config.androidPackageName,
    'com.sdkwork.birdcoder.mobile',
    `${fileName} must declare androidPackageName.`,
  );
  assert.ok(config.deepLinks, `${fileName} must declare deepLinks metadata.`);
  assert.equal(
    config.deepLinks.customScheme,
    'sdkwork.birdcoder',
    `${fileName} must declare sdkwork.birdcoder custom scheme.`,
  );
  assert.equal(
    config.deepLinks.oauthCallbackAuthority,
    'auth',
    `${fileName} must declare OAuth callback authority.`,
  );
  assert.equal(
    config.deepLinks.oauthCallbackPath,
    '/oauth/callback',
    `${fileName} must declare OAuth callback path.`,
  );
  assert.ok(
    Array.isArray(config.deepLinks.universalLinkHosts) && config.deepLinks.universalLinkHosts.length > 0,
    `${fileName} must declare universal link hosts.`,
  );
}

const androidSnippet = read(
  'apps/sdkwork-birdcoder-flutter-mobile/config/host/native/android/deep-link-intent-filter.snippet.xml',
);
const iosSnippet = read(
  'apps/sdkwork-birdcoder-flutter-mobile/config/host/native/ios/deep-link-capabilities.snippet.plist',
);

assert.match(
  androidSnippet,
  /android:scheme="sdkwork\.birdcoder"/u,
  'Android deep link snippet must declare sdkwork.birdcoder scheme.',
);
assert.match(
  iosSnippet,
  /sdkwork\.birdcoder/u,
  'iOS deep link snippet must declare sdkwork.birdcoder URL scheme.',
);

const oauthDeepLinkSource = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/auth_oauth_deep_link.dart',
);
assert.match(
  oauthDeepLinkSource,
  /buildBirdCoderOAuthCallbackReturnUrl/u,
  'Flutter core must expose OAuth callback return URL builder.',
);
assert.match(
  oauthDeepLinkSource,
  /birdCoderMobileOAuthScheme/u,
  'Flutter core must declare the mobile OAuth custom scheme constant.',
);

console.log('flutter mobile host config contract passed.');
