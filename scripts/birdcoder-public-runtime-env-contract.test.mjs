import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
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

const webMainSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/src/main.tsx',
    import.meta.url,
  ),
  'utf8',
);
const bootstrapPublicRuntimeConfigSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapPublicRuntimeConfig.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.match(
  webMainSource,
  /isBirdCoderDevelopmentBrowserRuntime\(\)/u,
  'Web bootstrap must use the shared public runtime authority when deciding whether local API traffic uses the same-origin proxy.',
);
assert.match(
  webMainSource,
  /readConfiguredBirdCoderRealtimeTransport\(\)/u,
  'Web bootstrap must resolve the realtime transport through the shared public runtime authority.',
);
assert.doesNotMatch(
  webMainSource,
  /import\.meta\.env/u,
  'Web bootstrap must not create a second compile-time runtime configuration path.',
);
assert.match(
  bootstrapPublicRuntimeConfigSource,
  /mode === 'development' \|\| mode === 'test'/u,
  'Browser same-origin proxy selection must cover both development and test Vite modes.',
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
assert.equal(
  isBirdcoderPublicRuntimeEnvKey('VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL'),
  true,
);

const webDevelopmentRuntimeEnv = resolveBirdcoderWebRuntimeEnvSource({
  VITE_BIRDCODER_API_BASE_URL: 'http://127.0.0.1:10240',
  VITE_SDKWORK_APPBASE_APP_API_BASE_URL: 'http://127.0.0.1:3900',
  VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL: 'http://127.0.0.1:10240',
  VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL: 'http://127.0.0.1:3900',
  VITE_SDKWORK_DRIVE_APP_API_BASE_URL: 'http://127.0.0.1:3900',
  VITE_SDKWORK_RUNTIME_TARGET: 'browser',
}, 'development');
assert.equal(webDevelopmentRuntimeEnv.VITE_BIRDCODER_API_BASE_URL, undefined);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_APPBASE_APP_API_BASE_URL, undefined);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL, undefined);
assert.equal(
  webDevelopmentRuntimeEnv.VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL,
  'http://127.0.0.1:3900',
);
assert.equal(
  webDevelopmentRuntimeEnv.VITE_SDKWORK_DRIVE_APP_API_BASE_URL,
  'http://127.0.0.1:3900',
);
assert.equal(
  resolveBirdcoderDevelopmentApiEnvDefines('test')['import.meta.env.VITE_SDKWORK_DRIVE_APP_API_BASE_URL'],
  undefined,
);
assert.equal(webDevelopmentRuntimeEnv.VITE_SDKWORK_RUNTIME_TARGET, 'browser');

const webProductionRuntimeEnv = resolveBirdcoderWebRuntimeEnvSource({
  VITE_BIRDCODER_API_BASE_URL: 'https://birdcoder.example.test',
}, 'production');
assert.equal(
  webProductionRuntimeEnv.VITE_BIRDCODER_API_BASE_URL,
  'https://birdcoder.example.test',
  'Production web builds must preserve the configured public API authority.',
);

const credentialEntryViteConfigs = [
  '../apps/sdkwork-birdcoder-pc/vite.config.ts',
  '../apps/sdkwork-birdcoder-h5/vite.config.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
];
for (const relativePath of credentialEntryViteConfigs) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  assert.match(source, /from ['"]@sdkwork\/iam-credential-entry\/vite['"]/u);
  assert.doesNotMatch(source, /sdkwork-iam-credential-entry\/src\/vite\.ts/u);
  assert.match(source, /createSdkworkCredentialEntryBootstrapVitePlugin/u);
  assert.doesNotMatch(source, /['"]process\.env\.SDKWORK_ACCESS_TOKEN['"]\s*:/u);
}

const viteHelperSource = fs.readFileSync(
  new URL('./create-birdcoder-vite-plugins.mjs', import.meta.url),
  'utf8',
);
assert.doesNotMatch(viteHelperSource, /createBirdcoderCredentialEntryBootstrapPlugin/u);
assert.doesNotMatch(viteHelperSource, /__SDKWORK_IAM_CREDENTIAL_ENTRY_ENV__/u);

console.log('birdcoder public runtime env contract passed.');
