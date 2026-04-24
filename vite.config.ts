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
} from './scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootHostAppRootDir = path.resolve(__dirname, 'packages', 'sdkwork-birdcoder-web');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    esbuild: false,
    plugins: createBirdcoderVitePlugins({
      appRootDir: rootHostAppRootDir,
      mode,
      namespace: 'sdkwork-birdcoder-root',
      runtimeEnvSource: env,
    }),
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: false,
      cssMinify: false,
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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
    },
  };
});
