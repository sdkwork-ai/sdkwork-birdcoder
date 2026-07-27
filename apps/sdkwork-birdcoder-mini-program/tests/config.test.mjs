import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  DEPLOYMENT_PROFILES,
  ENVIRONMENTS,
  MINI_PROGRAM_ROOT,
  runtimeConfigPath,
} from '../scripts/lib/build-context.mjs';

test('all eight mini program runtime profiles are materialized and consistent', () => {
  for (const deploymentProfile of DEPLOYMENT_PROFILES) {
    for (const environment of ENVIRONMENTS) {
      const file = runtimeConfigPath(deploymentProfile, environment);
      assert.ok(fs.existsSync(file), path.relative(MINI_PROGRAM_ROOT, file));
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(config.SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE, deploymentProfile);
      assert.equal(config.SDKWORK_BIRDCODER_ENVIRONMENT, environment);
      assert.equal(config.SDKWORK_PROFILE_ID, `${deploymentProfile}.${environment}`);
      assert.equal(config.SDKWORK_BIRDCODER_PROFILE_ID, `${deploymentProfile}.${environment}`);
      assert.equal(config.SDKWORK_BIRDCODER_RUNTIME_TARGET, 'mini-program');
      assert.ok(config.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL);
      if (deploymentProfile === 'cloud') {
        assert.ok(config.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL);
      }
      assert.equal(config.SDKWORK_ACCESS_TOKEN, undefined);
    }
  }
});

test('private WeChat project config remains ignored', () => {
  const ignore = fs.readFileSync(path.resolve(MINI_PROGRAM_ROOT, '..', '..', '.gitignore'), 'utf8');
  assert.match(ignore, /apps\/sdkwork-birdcoder-mini-program\/project\.private\.config\.json/u);
});
