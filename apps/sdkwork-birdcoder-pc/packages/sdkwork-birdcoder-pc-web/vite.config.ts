import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
} from '../../../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 自定义插件：为 /data/sdkwork-models/ 提供静态文件服务
function sdkworkModelsDataPlugin(): Plugin {
  const sdkworkModelsRoot = path.resolve(__dirname, '../../../../../../sdkwork-models');
  const DATA_URL_PREFIX = '/data/sdkwork-models/';

  return {
    name: 'sdkwork-models-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith(DATA_URL_PREFIX)) {
          const relativePath = req.url.slice(DATA_URL_PREFIX.length);
          const filePath = path.join(sdkworkModelsRoot, relativePath);

          // 安全检查：确保路径在 sdkwork-models 目录内
          if (!filePath.startsWith(sdkworkModelsRoot)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }

          // 使用 sirv 或直接发送文件
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.json': 'application/json',
              '.js': 'application/javascript',
              '.ts': 'application/typescript',
              '.css': 'text/css',
              '.html': 'text/html',
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            stream.on('error', (error: Error) => {
              console.error('[sdkwork-models-data] Error reading file:', error);
              res.statusCode = 500;
              res.end('Internal Server Error');
            });
            return;
          } else {
            res.statusCode = 404;
            res.end('Not Found');
            return;
          }
        }
        next();
      });
    },
  };
}

// Reserved governance names retained for BirdCoder standards:
// birdcoder-platform
// birdcoder-commons-root
// birdcoder-infrastructure-root

export default defineConfig(({ mode }) => {
  const runtimeEnvSource = loadEnv(mode, __dirname, '');

  return ({
    esbuild: false,
    plugins: [
      ...createBirdcoderVitePlugins({
        appRootDir: __dirname,
        mode,
        namespace: 'sdkwork-birdcoder-pc-web',
        runtimeEnvSource,
      }),
      sdkworkModelsDataPlugin(),
    ],
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: resolveBirdcoderProductionMinify(mode),
      cssMinify: resolveBirdcoderProductionCssMinify(mode),
      sourcemap: false,
      modulePreload: {
        resolveDependencies(_filename, deps, context) {
          if (context.hostType !== 'html') {
            return deps;
          }

          return deps.filter(
            (dependency) =>
              !/^assets\/(?:birdcoder-iam-surface|birdcoder-platform|birdcoder-shell-bootstrap|birdcoder-code-surface|birdcoder-studio-surface|birdcoder-multiwindow-surface|birdcoder-settings-surface|birdcoder-skills-surface|birdcoder-templates-surface|birdcoder-terminal-desktop|birdcoder-terminal-infrastructure|ui-workbench|ui-workbench-editors|ui-workbench-preview|ui-run-dialogs|vendor-terminal-xterm|vendor-tauri|vendor-monaco|vendor-markdown|vendor-code-highlight)-/u.test(
                dependency,
              ),
          );
        },
      },
      rollupOptions: {
        onwarn: onBirdcoderRollupWarning,
        output: {
          manualChunks(id) {
            const isSourcePath = (sourcePath: string) => id.includes(sourcePath);
            const isAnySourcePath = (sourcePaths: readonly string[]) =>
              sourcePaths.some((sourcePath) => isSourcePath(sourcePath));
            const getSourcePathFileStem = (sourcePath: string) => {
              const sourcePathIndex = id.indexOf(sourcePath);
              if (sourcePathIndex < 0) {
                return '';
              }

              const relativePath = id.slice(sourcePathIndex + sourcePath.length).split('?')[0] ?? '';
              return (relativePath.split('/').pop() ?? '')
                .replace(/\.[cm]?[jt]sx?$/u, '')
                .replace(/[^A-Za-z0-9_-]+/gu, '-')
                .replace(/^-+|-+$/gu, '')
                .toLowerCase();
            };
            const appSdkSourceRoot = '/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/';
            const appSdkApiSourceRoot = `${appSdkSourceRoot}api/`;
            const sdkCommonSourceRoot = '/sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/';
          if (
            id === '\0vite/preload-helper.js' ||
            id.includes('/node_modules/vite/modulepreload-polyfill')
          ) {
            return 'vite-preload-helper';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-pc-i18n/src/') ||
            id.includes('/node_modules/react-i18next/') ||
            id.includes('/node_modules/i18next/')
          ) {
            return 'vendor-i18n';
            }

          if (
            id.includes('sdkwork-birdcoder-pc-web-react-dom-client') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom')
          ) {
            return 'vendor-react-dom';
          }

          if (
            id.includes('sdkwork-birdcoder-pc-web-react-jsx-runtime') ||
            id.includes('sdkwork-birdcoder-pc-web-react-jsx-dev-runtime') ||
            id.includes('sdkwork-birdcoder-pc-web-react') ||
            id.includes('sdkwork-birdcoder-pc-web-scheduler') ||
            id.includes('sdkwork-birdcoder-pc-web-use-sync-external-store-shim')
          ) {
            return 'vendor-react-core';
          }

          if (
            id.includes('/node_modules/react-router/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'vendor-react-router';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          if (id.includes('/node_modules/qrcode/')) {
            return 'vendor-qrcode';
          }

          if (isSourcePath(sdkCommonSourceRoot)) {
            return 'birdcoder-platform-sdk-common';
          }

          if (isSourcePath(appSdkApiSourceRoot)) {
            const appSdkApiModule = getSourcePathFileStem(appSdkApiSourceRoot);
            if (appSdkApiModule === 'base' || appSdkApiModule === 'index') {
              return 'birdcoder-platform-app-sdk-client';
            }
            return appSdkApiModule
              ? `birdcoder-platform-app-sdk-api-${appSdkApiModule}`
              : 'birdcoder-platform-app-sdk-api';
          }

          if (
            isAnySourcePath([
              `${appSdkSourceRoot}http/`,
              `${appSdkSourceRoot}auth/`,
            ])
          ) {
            return 'birdcoder-platform-app-sdk-runtime';
          }

          if (isSourcePath(`${appSdkSourceRoot}types/`)) {
            return 'birdcoder-platform-app-sdk-types';
          }

          if (
            isAnySourcePath([
              `${appSdkSourceRoot}index.ts`,
              `${appSdkSourceRoot}sdk.ts`,
            ])
          ) {
            return 'birdcoder-platform-app-sdk-client';
          }

          if (
            id.includes('/node_modules/@xterm/xterm/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-xterm')
          ) {
            return 'vendor-terminal-xterm';
          }

          if (
            id.includes('/node_modules/@xterm/addon-canvas/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-canvas')
          ) {
            return 'vendor-terminal-xterm-addon-canvas';
          }

          if (
            id.includes('/node_modules/@xterm/addon-fit/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-fit')
          ) {
            return 'vendor-terminal-xterm-addon-fit';
          }

          if (
            id.includes('/node_modules/@xterm/addon-search/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-search')
          ) {
            return 'vendor-terminal-xterm-addon-search';
          }

          if (
            id.includes('/node_modules/@xterm/addon-unicode11/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-unicode11')
          ) {
            return 'vendor-terminal-xterm-addon-unicode11';
          }

          if (
            id.includes('/node_modules/@xterm/addon-web-links/') ||
            id.includes('sdkwork-birdcoder-pc-web-xterm-addon-web-links')
          ) {
            return 'vendor-terminal-xterm-addon-web-links';
          }

          if (
            id.includes('/node_modules/@tauri-apps/api/window') ||
            id.includes('/node_modules/@tauri-apps/api/dpi')
          ) {
            return 'vendor-tauri-window';
          }

          if (id.includes('/node_modules/@tauri-apps/api/event')) {
            return 'vendor-tauri-event';
          }

          if (id.includes('/node_modules/@tauri-apps/api/core')) {
            return 'vendor-tauri-core';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/node_modules/@sdkwork/ui-pc-react/src/',
              '/sdkwork-ui/sdkwork-ui-pc-react/src/',
            ])
          ) {
            return 'sdkwork-ui-core';
          }

          if (
            id.includes('/packages/sdkwork-birdcoder-pc-ui-shell/src/') ||
            id.includes('/node_modules/@radix-ui/react-slot/') ||
            id.includes('/node_modules/class-variance-authority/') ||
            id.includes('/node_modules/clsx/') ||
            id.includes('/node_modules/tailwind-merge/')
          ) {
            return 'ui-shell';
          }

          if (
            id.includes('/node_modules/monaco-editor/') ||
            id.includes('/node_modules/@monaco-editor/')
          ) {
            return 'vendor-monaco';
          }

          if (
            id.includes('/node_modules/react-syntax-highlighter/') ||
            id.includes('/node_modules/prismjs/') ||
            id.includes('/node_modules/refractor/') ||
            id.includes('/node_modules/lowlight/')
          ) {
            return 'vendor-code-highlight';
          }

          if (
            id.includes('/node_modules/react-markdown/') ||
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

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/index.ts')) {
            return 'birdcoder-ui';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-ui/src/components/CodeEditor.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/DiffEditor.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/monacoOverflowWidgets.ts',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/monacoRuntime.ts',
            ])
          ) {
            return 'ui-workbench-editors';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentPreviewer.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentCodePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentMarkdownPreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentStructuredDataPreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentKeyValuePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/ContentTablePreview.tsx',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/contentPreview.ts',
              '/packages/sdkwork-birdcoder-pc-ui/src/components/contentPreviewStructuredData.ts',
            ])
          ) {
            return 'ui-workbench-preview';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/RunConfigurationDialogs.tsx')
          ) {
            return 'ui-run-dialogs';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-web/src/loadAppRoot.ts')
          ) {
            return 'birdcoder-shell-entry';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell/src/index.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/app.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/AppRoot.tsx',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/loadBirdcoderApp.ts',
              '/packages/sdkwork-birdcoder-pc-shell/src/application/providers/',
            ])
          ) {
            return 'birdcoder-shell-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell/src/application/app/',
            ])
          ) {
            return 'birdcoder-shell-app';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/runtime/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
            ])
          ) {
            return 'birdcoder-runtime-config';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-workbench-storage/src/',
              '/packages/sdkwork-birdcoder-pc-commons/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/storage/localStore.ts',
            ])
          ) {
            return 'birdcoder-workbench-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench-state/src/')) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/registry.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/profiles.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/runConfigStorage.ts',
            ])
          ) {
            return 'birdcoder-terminal-profiles';
          }

          if (
            isAnySourcePath([
              '/sdkwork-terminal/apps/desktop/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-desktop/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-ai-cli/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-diagnostics/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-i18n/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-resources/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-sessions/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-settings/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-shell/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-ui/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-workbench/src/',
            ])
          ) {
            return 'birdcoder-terminal-desktop';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/terminal/terminalRuntimeSanitization.ts',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-commons/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-contracts/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-infrastructure/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-types/src/',
            ])
          ) {
            return 'birdcoder-terminal-infrastructure';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/')) {
            return 'birdcoder-code-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-studio/src/')) {
            return 'birdcoder-studio-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-multiwindow/src/')) {
            return 'birdcoder-multiwindow-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-settings/src/')) {
            return 'birdcoder-settings-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-skills/src/')) {
            return 'birdcoder-skills-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-templates/src/')) {
            return 'birdcoder-templates-surface';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
            ])
          ) {
            return 'birdcoder-shell-bootstrap';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/workbench/preferences.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/workbench/recovery.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/BootstrapGate.tsx',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/loadBootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerApiReady.ts',
              '/packages/sdkwork-birdcoder-pc-shell-runtime/src/index.ts',
            ])
          ) {
            return 'birdcoder-shell-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/data.ts',
            ])
          ) {
            return 'birdcoder-types-data';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
              '/packages/sdkwork-birdcoder-pc-types/src/generated/',
            ])
          ) {
            return 'birdcoder-types-api';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-types/src/storageBindings.ts',
            ])
          ) {
            return 'birdcoder-types-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-types/src/')) {
            return 'birdcoder-types';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-codeengine/src/',
            ])
          ) {
            return 'birdcoder-codeengine';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/index.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-definition.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-appearance.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-config.ts',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-authority.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-controller.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-copy.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-local-service.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-runtime-config.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-runtime-authority.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-service.ts',
            ])
          ) {
            return 'birdcoder-platform-auth-runtime';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth-intl.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/auth/',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/auth-page-shell.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/oauth-provider-grid.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/components/qr-login-panel.tsx',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/pages/',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/',
            ])
          ) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/index.ts')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/pages/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-auth/src/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/index.ts')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/pages/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-user/src/')) {
            return 'birdcoder-iam-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-git/src/')) {
            return 'birdcoder-git';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-commons/src/index.ts')) {
            return 'birdcoder-commons-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts')) {
            return 'birdcoder-infrastructure-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-iam/src/index.ts',
              '/packages/sdkwork-birdcoder-pc-iam/src/iamIntegration.ts',
            ])
          ) {
            return 'birdcoder-iam-integration';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/runtime.ts',
            ])
          ) {
            return 'birdcoder-storage-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sessionService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
              '/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/',
              '/sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
            ])
          ) {
            return 'birdcoder-platform-filesystem';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeAuthService.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/bootstrapConsoleCatalog.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptEntryText.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/providers.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/savedPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlBackendExecutors.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlExecutor.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlPlans.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/sqlRowCodec.ts',
            ])
          ) {
            return 'birdcoder-platform-storage';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localBusinessUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localServerRequestId.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/apiJson.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionEvents.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/codingSessionMessageProjection.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/codingSessionSelection.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/projectContentConfigData.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeApiRetry.ts',
            ])
          ) {
            return 'birdcoder-platform-service-core';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-provider-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAdminDeploymentService.ts',
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAdminPolicyService.ts',
              '/packages/sdkwork-birdcoder-pc-admin-core/src/services/impl/ApiBackedAuditService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCollaborationService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeWriteService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedDeploymentService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedDocumentService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedGitService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedReleaseService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedTeamService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-api-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-commons/src/context/ideServices.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/IDEContext.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/AuthContext.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/context/ServiceContext.tsx',
              '/packages/sdkwork-birdcoder-pc-commons/src/contexts/ToastProvider.tsx',
              '/packages/sdkwork-birdcoder-pc-commons/src/utils/EventBus.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/hooks/useDebounce.ts',
              '/packages/sdkwork-birdcoder-pc-commons/src/',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/')) {
            return 'ui-workbench';
          }

            return undefined;
          },
        },
      },
    },
    resolve: {
      dedupe: [...BIRDCODER_VITE_DEDUPE_PACKAGES],
      alias: createBirdcoderWorkspaceAliasEntries(__dirname),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(__dirname),
      },
    },
  });
});
