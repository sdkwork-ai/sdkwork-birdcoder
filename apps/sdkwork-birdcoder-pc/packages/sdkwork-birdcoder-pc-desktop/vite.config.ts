import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createDesktopVitePlugins } from './vite/createDesktopVitePlugins.mjs';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES as desktopDedupePackages,
  BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE,
  BIRDCODER_VITE_DEV_WATCH_IGNORED,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
  resolveBirdcoderViteRuntimeEnvSource,
} from '../../../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const runtimeEnvSource = resolveBirdcoderViteRuntimeEnvSource(
    loadEnv(mode, __dirname, ''),
  );

  return {
    base: './',
    esbuild: false,
    oxc: false,
    plugins: createDesktopVitePlugins({
      desktopRootDir: __dirname,
      mode,
      runtimeEnvSource,
    }),
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: resolveBirdcoderProductionMinify(mode),
      cssMinify: resolveBirdcoderProductionCssMinify(mode),
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
      },
    },
    resolve: {
      dedupe: [...desktopDedupePackages],
      alias: createBirdcoderWorkspaceAliasEntries(__dirname),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [...BIRDCODER_VITE_DEV_WATCH_IGNORED],
      },
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(__dirname),
      },
    },
  };
});
