import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopVitePlugins } from './vite/createDesktopVitePlugins.mjs';
import { onBirdcoderRollupWarning } from '../../scripts/create-birdcoder-vite-plugins.mjs';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopDedupePackages = ['react', 'react-dom', 'react-i18next', 'scheduler', 'use-sync-external-store'];

export default defineConfig(({ mode }) => ({
  base: './',
  esbuild: false,
  plugins: createDesktopVitePlugins({
    desktopRootDir: __dirname,
    mode,
  }),
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  build: {
    minify: false,
    cssMinify: false,
    rollupOptions: {
      onwarn: onBirdcoderRollupWarning,
    },
  },
  resolve: {
    dedupe: [...desktopDedupePackages],
    alias: [
      { find: /^@sdkwork\/birdcoder-([^/]+)$/u, replacement: path.resolve(__dirname, '../sdkwork-birdcoder-$1/src') },
    ],
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
}));
