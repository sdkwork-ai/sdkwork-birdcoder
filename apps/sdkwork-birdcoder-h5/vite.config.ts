import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import {
  createBirdcoderVitePlugins,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  onBirdcoderRollupWarning,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: createBirdcoderVitePlugins({
      appRootDir: __dirname,
      mode,
      namespace: 'sdkwork-birdcoder-h5',
      runtimeEnvSource: env,
    }),
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        ...createBirdcoderWorkspaceAliasEntries(__dirname),
      ],
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
        allow: createBirdcoderWorkspaceFsAllowList(__dirname),
      },
    },
  };
});
