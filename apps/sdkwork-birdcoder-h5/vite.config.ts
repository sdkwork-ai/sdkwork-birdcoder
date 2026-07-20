import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSdkworkCredentialEntryBootstrapVitePlugin } from '@sdkwork/iam-credential-entry/vite';
import { defineConfig, loadEnv } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  configureBirdcoderSdkworkProxyProblemResponse,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderViteRuntimeEnvSource,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '../..');
const dependencyRootDir = path.resolve(workspaceRootDir, '..');

function createBirdCoderH5WorkspaceFsAllowList(): string[] {
  return [
    workspaceRootDir,
    'sdkwork-appbase',
    'sdkwork-drive',
    'sdkwork-iam',
    'sdkwork-messaging',
    'sdkwork-sdk-commons',
    'sdkwork-ui',
    'sdkwork-utils',
  ].map((entry) => (
    entry === workspaceRootDir ? entry : path.join(dependencyRootDir, entry)
  ));
}

export default defineConfig(({ mode }) => {
  const env = resolveBirdcoderViteRuntimeEnvSource(loadEnv(mode, '.', ''));
  const applicationDevProxyTarget =
    process.env.BIRDCODER_DEV_PROXY_TARGET ??
    env.VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL ??
    env.VITE_BIRDCODER_API_BASE_URL ??
    'http://127.0.0.1:10240';
  return {
    plugins: [
      createSdkworkCredentialEntryBootstrapVitePlugin({
        accessToken: process.env.SDKWORK_ACCESS_TOKEN,
        allowTestInjection: mode === 'test',
        environment: mode,
      }),
      ...createBirdcoderVitePlugins({
        appRootDir: __dirname,
        mode,
        namespace: 'sdkwork-birdcoder-h5',
        runtimeEnvSource: env,
        toolingRootDir: __dirname,
      }),
    ],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
      ],
      dedupe: BIRDCODER_VITE_DEDUPE_PACKAGES,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
      },
    },
    server: {
      port: 3001,
      host: true,
      fs: {
        allow: createBirdCoderH5WorkspaceFsAllowList(),
      },
      proxy: {
        '/app': {
          target: applicationDevProxyTarget,
          changeOrigin: true,
          ws: true,
          configure: configureBirdcoderSdkworkProxyProblemResponse,
        },
      },
    },
  };
});
