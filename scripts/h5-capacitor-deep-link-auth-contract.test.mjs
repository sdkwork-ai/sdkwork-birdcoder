import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hostConfigDir = 'apps/sdkwork-birdcoder-h5/config/host';

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

for (const fileName of [
  'capacitor.development.example.json',
  'capacitor.test.example.json',
  'capacitor.staging.example.json',
  'capacitor.production.example.json',
]) {
  const config = readJson(path.join(hostConfigDir, fileName));
  assert.equal(config.iosBundleId, 'com.sdkwork.birdcoder.h5', `${fileName} must declare iosBundleId.`);
  assert.equal(
    config.androidPackageName,
    'com.sdkwork.birdcoder.h5',
    `${fileName} must declare androidPackageName.`,
  );
  assert.ok(config.deepLinks, `${fileName} must declare deepLinks metadata.`);
  assert.equal(config.deepLinks.customScheme, 'birdcoderh5', `${fileName} must declare birdcoderh5 custom scheme.`);
}

const coreOAuthSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/bootstrap/authOAuthDeepLink.ts',
);
const capacitorDeepLinkSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src/adapters/capacitorDeepLinkAdapter.ts',
);
const mainSource = read('apps/sdkwork-birdcoder-h5/src/main.tsx');
const authSurfaceSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth-surface.ts');

assert.match(
  coreOAuthSource,
  /buildBirdCoderH5OAuthCallbackReturnUrl/u,
  'H5 core must expose OAuth callback return URL builder.',
);
assert.match(
  capacitorDeepLinkSource,
  /appUrlOpen/u,
  'H5 capacitor adapter must subscribe to native appUrlOpen deep links.',
);
assert.match(
  mainSource,
  /startBirdCoderAuthDeepLinkRouting/u,
  'H5 entrypoint must start auth deep link routing after host adapter registration.',
);
assert.doesNotMatch(
  authSurfaceSource,
  /oauthLoginEnabled:\s*false/u,
  'BirdCoder auth surface must not hard-disable OAuth; IAM runtime settings should govern providers.',
);

console.log('h5 capacitor deep link auth contract passed.');
