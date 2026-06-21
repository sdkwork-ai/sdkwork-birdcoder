import assert from 'node:assert/strict';

import {
  isBirdcoderPublicRuntimeEnvKey,
  resolveBirdcoderPublicRuntimeEnv,
} from './create-birdcoder-vite-plugins.mjs';

const resolved = resolveBirdcoderPublicRuntimeEnv({
  SDKWORK_ACCESS_TOKEN: 'secret-bootstrap-token',
  SDKWORK_BIRDCODER_APP_API_BASE_URL: 'http://127.0.0.1:10240/app/v3/api',
  SDKWORK_IAM_DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD: 'dev-password',
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: 'http://127.0.0.1:3000',
}, 'development');

assert.equal(resolved.SDKWORK_ACCESS_TOKEN, undefined);
assert.equal(resolved.SDKWORK_IAM_DATABASE_URL, undefined);
assert.equal(resolved.VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD, undefined);
assert.equal(
  resolved.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
  'http://127.0.0.1:3000',
);
assert.equal(
  resolved.SDKWORK_BIRDCODER_APP_API_BASE_URL,
  'http://127.0.0.1:10240/app/v3/api',
);
assert.equal(isBirdcoderPublicRuntimeEnvKey('SDKWORK_ACCESS_TOKEN'), false);
assert.equal(isBirdcoderPublicRuntimeEnvKey('VITE_SDKWORK_BIRDCODER_API_BASE_URL'), true);

console.log('birdcoder public runtime env contract passed.');
