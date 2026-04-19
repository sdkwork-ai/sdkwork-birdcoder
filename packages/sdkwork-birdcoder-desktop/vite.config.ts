import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopVitePlugins } from './vite/createDesktopVitePlugins.mjs';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES as desktopDedupePackages,
  onBirdcoderRollupWarning,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig(({ mode }) => ({
  base: './',
  esbuild: false,
  plugins: createDesktopVitePlugins({
    desktopRootDir: __dirname,
    mode,
  }),
  optimizeDeps: {
    noDiscovery: true,
    include: ['@xterm/addon-unicode11'],
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
      { find: /^@sdkwork\/birdcoder-([^/]+)\/(.+)$/u, replacement: path.resolve(__dirname, '../sdkwork-birdcoder-$1/src/$2') },
      { find: /^@sdkwork\/birdcoder-([^/]+)$/u, replacement: path.resolve(__dirname, '../sdkwork-birdcoder-$1/src') },
      { find: /^@sdkwork\/terminal-([^/]+)\/(.+)$/u, replacement: path.resolve(__dirname, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src/$2') },
      { find: /^@sdkwork\/terminal-([^/]+)$/u, replacement: path.resolve(__dirname, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src') },
      { find: /^@xterm\/(.*)$/u, replacement: path.resolve(__dirname, '../../node_modules/@xterm/$1') },
    ],
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    fs: {
      allow: [
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../../sdkwork-terminal'),
      ],
    },
  },
}));
