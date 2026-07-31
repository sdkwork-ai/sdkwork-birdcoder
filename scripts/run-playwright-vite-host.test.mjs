import assert from 'node:assert/strict';
import path from 'node:path';

import {
  applyPlaywrightViteHostEnv,
  createPlaywrightViteHostShutdown,
  resolvePlaywrightViteHostOptions,
} from './run-playwright-vite-host.mjs';

const workspaceRootDir = path.resolve('.');
const options = resolvePlaywrightViteHostOptions({
  argv: [
    'serve',
    '--cwd',
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
    '--host',
    '127.0.0.1',
    '--port',
    '4265',
    '--strictPort',
    '--mode',
    'test',
  ],
  env: {},
  workspaceRootDir,
});

assert.equal(options.command, 'serve');
assert.equal(options.cwd, path.join(
  workspaceRootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-web',
));
assert.equal(options.deploymentProfile, 'standalone');
assert.equal(options.environment, 'test');
assert.equal(options.mode, 'test');
assert.equal(options.port, 4265);
assert.equal(options.runtimeTarget, 'browser');
assert.equal(options.strictPort, true);

assert.throws(
  () => resolvePlaywrightViteHostOptions({
    argv: ['serve', '--cwd', '..'],
    env: {},
    workspaceRootDir,
  }),
  /must stay inside/u,
);
assert.throws(
  () => resolvePlaywrightViteHostOptions({
    argv: ['serve', '--cwd', 'apps/sdkwork-birdcoder-pc', '--port', '70000'],
    env: {},
    workspaceRootDir,
  }),
  /Invalid Vite host port/u,
);

const runtimeEnv = {
  CUSTOM_ENV: 'retained',
  SDKWORK_ENVIRONMENT: 'explicit-test',
};
const processEnv = {};
applyPlaywrightViteHostEnv({
  env: runtimeEnv,
  options,
  processEnv,
  profileEnv: {
    CUSTOM_ENV: 'profile-value',
    PROFILE_ONLY: 'profile-value',
    VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE: 'standalone',
  },
});
assert.equal(runtimeEnv.CUSTOM_ENV, 'retained');
assert.equal(runtimeEnv.PROFILE_ONLY, 'profile-value');
assert.equal(runtimeEnv.SDKWORK_DEPLOYMENT_PROFILE, 'standalone');
assert.equal(runtimeEnv.SDKWORK_ENVIRONMENT, 'test');
assert.equal(runtimeEnv.SDKWORK_RUNTIME_TARGET, 'browser');
assert.equal(runtimeEnv.SDKWORK_VITE_MODE, 'test');
assert.equal(processEnv.PROFILE_ONLY, 'profile-value');
assert.equal(processEnv.VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE, 'standalone');

let closeCalls = 0;
const exitCodes = [];
const shutdown = createPlaywrightViteHostShutdown({
  exit(code) {
    exitCodes.push(code);
  },
  server: {
    async close() {
      closeCalls += 1;
    },
  },
});
await Promise.all([shutdown(), shutdown()]);
assert.equal(closeCalls, 1);
assert.deepEqual(exitCodes, [0]);

console.log('run Playwright Vite host contract passed.');
