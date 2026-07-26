import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  BIRDCODER_DEPLOYMENT_PROFILES,
  BIRDCODER_ENVIRONMENTS,
  createBirdcoderFlutterProfileValues,
  createBirdcoderProfileId,
  createBirdcoderViteProfileValues,
  loadBirdcoderTopologyProfile,
  materializeBirdcoderClientEnv,
  resolveBirdcoderSurfaceProfilePath,
} from './birdcoder-client-env.mjs';

const workspaceRootDir = process.cwd();
const expectedProfileCount =
  BIRDCODER_DEPLOYMENT_PROFILES.length * BIRDCODER_ENVIRONMENTS.length;

assert.equal(createBirdcoderProfileId('standalone', 'dev'), 'standalone.development');
assert.equal(createBirdcoderProfileId('cloud', 'prod'), 'cloud.production');

const cloudDevelopment = loadBirdcoderTopologyProfile({
  workspaceRootDir,
  deploymentProfile: 'cloud',
  environment: 'development',
});
assert.equal(cloudDevelopment.profileId, 'cloud.development');
assert.ok(cloudDevelopment.values.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL);
assert.ok(cloudDevelopment.values.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL);

const viteValues = createBirdcoderViteProfileValues({
  deploymentProfile: 'cloud',
  environment: 'development',
  runtimeTarget: 'browser',
  devBind: '127.0.0.1:3001',
  topologyValues: cloudDevelopment.values,
});
assert.equal(viteValues.VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE, 'cloud');
assert.equal(viteValues.VITE_SDKWORK_BIRDCODER_ENVIRONMENT, 'development');
assert.equal(viteValues.VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET, 'browser');
assert.equal(viteValues.SDKWORK_ACCESS_TOKEN, '');

const flutterValues = createBirdcoderFlutterProfileValues({
  deploymentProfile: 'standalone',
  environment: 'production',
  runtimeTarget: 'flutter-android',
  topologyValues: loadBirdcoderTopologyProfile({
    workspaceRootDir,
    deploymentProfile: 'standalone',
    environment: 'production',
  }).values,
});
assert.equal(flutterValues.FLUTTER_ENV, 'production');
assert.equal(flutterValues.SDKWORK_DEPLOYMENT_PROFILE, 'standalone');
assert.equal(flutterValues.SDKWORK_RUNTIME_TARGET, 'flutter-android');
assert.equal(flutterValues.API_BASE_URL, flutterValues.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL);

const verifiedFiles = materializeBirdcoderClientEnv({
  workspaceRootDir,
  check: true,
});
assert.equal(verifiedFiles.length, expectedProfileCount * 3);

for (const surface of ['pc', 'h5', 'flutter']) {
  for (const deploymentProfile of BIRDCODER_DEPLOYMENT_PROFILES) {
    for (const environment of BIRDCODER_ENVIRONMENTS) {
      const profilePath = resolveBirdcoderSurfaceProfilePath({
        workspaceRootDir,
        surface,
        deploymentProfile,
        environment,
      });
      assert.ok(fs.existsSync(profilePath), `${path.relative(workspaceRootDir, profilePath)} must exist.`);
      const content = fs.readFileSync(profilePath, 'utf8');
      assert.doesNotMatch(content, /SDKWORK_ACCESS_TOKEN=\S+/u);
      assert.doesNotMatch(content, /"SDKWORK_ACCESS_TOKEN":\s*"[^"]+"/u);
    }
  }
}

console.log('BirdCoder client env profile contract passed.');
