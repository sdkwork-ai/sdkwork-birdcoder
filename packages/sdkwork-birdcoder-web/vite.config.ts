import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  esbuild: false,
  plugins: createBirdcoderVitePlugins({
    appRootDir: __dirname,
    mode,
    namespace: 'sdkwork-birdcoder-web',
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
      output: {
        manualChunks(id) {
          if (
            id.includes('sdkwork-birdcoder-web-react-dom-client') ||
            id.includes('sdkwork-birdcoder-web-react-dom')
          ) {
            return 'vendor-react-dom';
          }

          if (
            id.includes('sdkwork-birdcoder-web-react-jsx-runtime') ||
            id.includes('sdkwork-birdcoder-web-react-jsx-dev-runtime') ||
            id.includes('sdkwork-birdcoder-web-react') ||
            id.includes('sdkwork-birdcoder-web-scheduler') ||
            id.includes('sdkwork-birdcoder-web-use-sync-external-store-shim')
          ) {
            return 'vendor-react-core';
          }

          if (
            id.includes('/node_modules/monaco-editor/') ||
            id.includes('/node_modules/@monaco-editor/')
          ) {
            return 'vendor-monaco';
          }

          if (
            id.includes('/node_modules/react-markdown/') ||
            id.includes('/node_modules/react-syntax-highlighter/') ||
            id.includes('/node_modules/prismjs/') ||
            id.includes('/node_modules/refractor/') ||
            id.includes('/node_modules/lowlight/') ||
            id.includes('/node_modules/unified/') ||
            id.includes('/node_modules/remark-') ||
            id.includes('/node_modules/mdast-') ||
            id.includes('/node_modules/micromark') ||
            id.includes('/node_modules/hast-') ||
            id.includes('/node_modules/vfile') ||
            id.includes('/node_modules/unist-util')
          ) {
            return 'vendor-markdown';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/platform/') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/storage/') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/services/impl/') ||
            id.includes('/packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/')
          ) {
            return 'birdcoder-infrastructure';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-commons/src/context/ideServices.ts') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/context/AuthContext.tsx') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/contexts/ToastProvider.tsx') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/hooks/useWorkspaces.ts') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts') ||
            id.includes('/packages/sdkwork-birdcoder-commons/src/utils/EventBus.ts')
          ) {
            return 'commons-shell';
          }

          if (id.includes('/packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx')) {
            return 'ui-chat';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx') ||
            id.includes('/packages/sdkwork-birdcoder-ui/src/components/DiffEditor.tsx')
          ) {
            return 'ui-editors';
          }

          if (id.includes('/packages/sdkwork-birdcoder-ui/src/components/RunConfigurationDialogs.tsx')) {
            return 'ui-run-config';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    dedupe: [...BIRDCODER_VITE_DEDUPE_PACKAGES],
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
