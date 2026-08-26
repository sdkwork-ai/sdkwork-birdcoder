import { resolveBrowserDistOutDir } from '../../../sdkwork-specs/tools/browser-dist-layout.mjs';
function resolveViteEnvironment(mode: string | undefined, processEnv = process.env) {
  const profileMatch = /^(standalone|cloud)\.(development|test|staging|production)$/u.exec(mode ?? '');
  return profileMatch?.[2]
    ?? (['development', 'test', 'staging', 'production'].includes(processEnv.SDKWORK_ENVIRONMENT ?? '')
      ? (processEnv.SDKWORK_ENVIRONMENT ?? 'production')
      : 'production');
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSdkworkCredentialEntryBootstrapVitePlugin } from '@sdkwork/iam-credential-entry/vite';
import { defineConfig, loadEnv } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  configureBirdcoderSdkworkProxyProblemResponse,
  createBirdcoderCanonicalEmbeddedAppDevProxyEntries,
  createBirdcoderCanonicalPlatformDevProxyEntries,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
  resolveBirdcoderDevelopmentApiEnvDefines,
  resolveBirdcoderDevProxyTargets,
  resolveBirdcoderViteDevServer,
  resolveBirdcoderViteRuntimeEnvSource,
  resolveBirdcoderWebRuntimeEnvSource,
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootHostAppRootDir = path.resolve(__dirname, 'packages', 'sdkwork-birdcoder-pc-web');

export default defineConfig(({ command, mode }) => {
  const env = resolveBirdcoderViteRuntimeEnvSource(loadEnv(mode, __dirname, ''));
  const devProxyTargets = resolveBirdcoderDevProxyTargets(env, command === 'serve');
  return {
    define: resolveBirdcoderDevelopmentApiEnvDefines(mode),
    plugins: [
      createSdkworkCredentialEntryBootstrapVitePlugin({
        accessToken: env.SDKWORK_ACCESS_TOKEN,
        allowTestInjection: mode === 'test',
        environment: mode,
      }),
      ...createBirdcoderVitePlugins({
        appRootDir: rootHostAppRootDir,
        mode,
        namespace: 'sdkwork-birdcoder-pc',
        runtimeEnvSource: resolveBirdcoderWebRuntimeEnvSource(env, mode),
      }),
    ],
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      outDir: resolveBrowserDistOutDir(resolveViteEnvironment(mode, process.env)),
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
      ...resolveBirdcoderViteDevServer(env),
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(rootHostAppRootDir),
      },
      proxy: {
        ...createBirdcoderCanonicalEmbeddedAppDevProxyEntries(devProxyTargets.application),
        ...createBirdcoderCanonicalPlatformDevProxyEntries(devProxyTargets.platform),
        ...(devProxyTargets.application
          ? Object.fromEntries(
              ['/app', '/backend', '/api', '/readyz', '/healthz', '/livez', '/metrics', '/openapi.json']
                .map((prefix) => [
                  prefix,
                  {
                    target: devProxyTargets.application,
                    changeOrigin: true,
                    ws: prefix === '/app',
                    configure: configureBirdcoderSdkworkProxyProblemResponse,
                  },
                ]),
            )
          : {}),
      },
    },
  };
});
