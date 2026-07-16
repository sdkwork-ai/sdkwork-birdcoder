import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
  resolveBirdcoderDevelopmentApiEnvDefines,
  resolveBirdcoderViteRuntimeEnvSource,
  resolveBirdcoderWebRuntimeEnvSource,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootHostAppRootDir = path.resolve(__dirname, 'packages', 'sdkwork-birdcoder-pc-web');

export default defineConfig(({ mode }) => {
  const env = resolveBirdcoderViteRuntimeEnvSource(loadEnv(mode, '.', ''));

  return {
    define: resolveBirdcoderDevelopmentApiEnvDefines(mode),
    plugins: createBirdcoderVitePlugins({
      appRootDir: rootHostAppRootDir,
      mode,
      namespace: 'sdkwork-birdcoder-pc',
      runtimeEnvSource: resolveBirdcoderWebRuntimeEnvSource(env, mode),
    }),
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: resolveBirdcoderProductionMinify(mode),
      cssMinify: resolveBirdcoderProductionCssMinify(mode),
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
      },
    },
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        ...createBirdcoderWorkspaceAliasEntries(rootHostAppRootDir),
      ],
      dedupe: [...BIRDCODER_VITE_DEDUPE_PACKAGES],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(rootHostAppRootDir),
      },
      proxy: {
        '/app': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
          ws: true,
        },
        '/backend': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/api': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/readyz': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/healthz': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/livez': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/metrics': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
        '/openapi.json': {
          target: process.env.BIRDCODER_DEV_PROXY_TARGET ?? 'http://127.0.0.1:10240',
          changeOrigin: true,
        },
      },
    },
  };
});
