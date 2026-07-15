import assert from 'node:assert/strict';

import {
  createBirdcoderCredentialEntryBootstrapPlugin,
  isBirdcoderPublicRuntimeEnvKey,
  resolveBirdcoderPublicRuntimeEnv,
  resolveBirdcoderDevelopmentApiEnvDefines,
  resolveBirdcoderViteRuntimeEnvSource,
  resolveBirdcoderWebRuntimeEnvSource,
} from './create-birdcoder-vite-plugins.mjs';

const mergedRuntimeEnv = resolveBirdcoderViteRuntimeEnvSource(
  {
    SDKWORK_ACCESS_TOKEN: 'file-token',
    VITE_BIRDCODER_API_BASE_URL: 'http://127.0.0.1:3900',
  },
  {
    SDKWORK_ACCESS_TOKEN: 'process-token',
    VITE_BIRDCODER_API_BASE_URL: 'http://127.0.0.1:10240',
  },
);
assert.equal(mergedRuntimeEnv.SDKWORK_ACCESS_TOKEN, 'process-token');
assert.equal(mergedRuntimeEnv.VITE_BIRDCODER_API_BASE_URL, 'http://127.0.0.1:10240');
assert.equal(
  resolveBirdcoderDevelopmentApiEnvDefines('test')['import.meta.env.VITE_BIRDCODER_API_BASE_URL'],
  'undefined',
);
assert.deepEqual(resolveBirdcoderDevelopmentApiEnvDefines('production'), {});

const resolved = resolveBirdcoderPublicRuntimeEnv({
  SDKWORK_ACCESS_TOKEN: 'secret-bootstrap-token',
  SDKWORK_BIRDCODER_APP_API_BASE_URL: 'http://127.0.0.1:10240/app/v3/api',
  SDKWORK_IAM_DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SDKWORK_SIGNING_KEY: 'tenant-signing-secret',
  VITE_PRIVATE_KEY: 'private-key-material',
  VITE_UNDOCUMENTED_RUNTIME_FLAG: 'must-not-be-forwarded',
  VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD: 'dev-password',
  VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: 'http://127.0.0.1:3000',
}, 'development');

assert.equal(resolved.SDKWORK_ACCESS_TOKEN, undefined);
assert.equal(resolved.SDKWORK_IAM_DATABASE_URL, undefined);
assert.equal(resolved.VITE_SDKWORK_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD, undefined);
assert.equal(resolved.SDKWORK_SIGNING_KEY, undefined);
assert.equal(resolved.VITE_PRIVATE_KEY, undefined);
assert.equal(resolved.VITE_UNDOCUMENTED_RUNTIME_FLAG, undefined);
assert.equal(
  resolved.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL,
  'http://127.0.0.1:3000',
);
assert.equal(
  resolved.SDKWORK_BIRDCODER_APP_API_BASE_URL,
  'http://127.0.0.1:10240/app/v3/api',
);
assert.equal(isBirdcoderPublicRuntimeEnvKey('SDKWORK_ACCESS_TOKEN'), false);
assert.equal(isBirdcoderPublicRuntimeEnvKey('SDKWORK_SIGNING_KEY'), false);
assert.equal(isBirdcoderPublicRuntimeEnvKey('VITE_PRIVATE_KEY'), false);
assert.equal(isBirdcoderPublicRuntimeEnvKey('VITE_SDKWORK_BIRDCODER_API_BASE_URL'), true);

const webDevelopmentRuntimeEnv = resolveBirdcoderWebRuntimeEnvSource({
  VITE_BIRDCODER_API_BASE_URL: 'http://127.0.0.1:10240',
  VITE_SDKWORK_APPBASE_APP_API_BASE_URL: 'http://127.0.0.1:3900',
  VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL: 'http://127.0.0.1:10240',
  VITE_SDKWORK_RUNTIME_TARGET: 'browser',
}, 'development');
assert.equal(webDevelopmentRuntimeEnv.VITE_BIRDCODER_API_BASE_URL, undefined);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_APPBASE_APP_API_BASE_URL, undefined);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL, undefined);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_RUNTIME_TARGET, 'browser');

const webProductionRuntimeEnv = resolveBirdcoderWebRuntimeEnvSource({
  VITE_BIRDCODER_API_BASE_URL: 'https://birdcoder.example.test',
}, 'production');
assert.equal(
  webProductionRuntimeEnv.VITE_BIRDCODER_API_BASE_URL,
  'https://birdcoder.example.test',
  'Production web builds must preserve the configured public API authority.',
);

const productionCredentialPlugin = createBirdcoderCredentialEntryBootstrapPlugin({
  mode: 'production',
  runtimeEnvSource: { SDKWORK_ACCESS_TOKEN: 'production-token' },
});
assert.deepEqual(
  productionCredentialPlugin.transformIndexHtml?.(),
  [],
  'Production Vite builds must never inject SDKWORK_ACCESS_TOKEN into index.html.',
);

const stagingCredentialPlugin = createBirdcoderCredentialEntryBootstrapPlugin({
  mode: 'staging',
  runtimeEnvSource: { SDKWORK_ACCESS_TOKEN: 'staging-token' },
});
assert.deepEqual(
  stagingCredentialPlugin.transformIndexHtml?.(),
  [],
  'Staging Vite builds must not inject SDKWORK_ACCESS_TOKEN into static HTML.',
);

const developmentCredentialPlugin = createBirdcoderCredentialEntryBootstrapPlugin({
  mode: 'development',
  runtimeEnvSource: { SDKWORK_ACCESS_TOKEN: 'development-token' },
});
assert.match(
  developmentCredentialPlugin.transformIndexHtml?.()?.[0]?.children ?? '',
  /development-token/u,
  'Development Vite builds may inject the explicit local bootstrap token for the credential-entry adapter.',
);

console.log('birdcoder public runtime env contract passed.');
