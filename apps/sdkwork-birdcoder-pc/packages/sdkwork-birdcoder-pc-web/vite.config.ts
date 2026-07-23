import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSdkworkCredentialEntryBootstrapVitePlugin } from '@sdkwork/iam-credential-entry/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_PLATFORM_DEV_PROXY_PATH,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  configureBirdcoderSdkworkProxyProblemResponse,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderProductionCssMinify,
  resolveBirdcoderProductionMinify,
  resolveBirdcoderDevelopmentApiEnvDefines,
  resolveBirdcoderDevProxyTargets,
  resolveBirdcoderViteRuntimeEnvSource,
  resolveBirdcoderWebRuntimeEnvSource,
  rewriteBirdcoderPlatformDevProxyPath,
} from '../../../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 自定义插件：为 /data/sdkwork-models/ 提供静态文件服务
function sdkworkModelsDataPlugin(): Plugin {
  // Five parents reach the workspace root; sdkwork-models is its sibling.
  const sdkworkModelsRoot = path.resolve(__dirname, '../../../../../sdkwork-models');
  const DATA_URL_PREFIX = '/data/sdkwork-models/';

  const isPathInside = (rootPath: string, candidatePath: string): boolean => {
    const relativePath = path.relative(rootPath, candidatePath);
    return (
      relativePath.length > 0 &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    );
  };

  const resolveModelFile = (requestPath: string): string | null => {
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(requestPath);
    } catch {
      return null;
    }

    if (!decodedPath || decodedPath.includes('\0') || path.isAbsolute(decodedPath)) {
      return null;
    }

    const rootPath = path.resolve(sdkworkModelsRoot);
    const candidatePath = path.resolve(rootPath, decodedPath);
    if (!isPathInside(rootPath, candidatePath)) {
      return null;
    }

    // Resolve symlinks/reparse points before serving so lexical containment
    // cannot be bypassed by a link inside the root.
    try {
      const canonicalRootPath = fs.realpathSync.native(rootPath);
      const canonicalCandidatePath = fs.realpathSync.native(candidatePath);
      return isPathInside(canonicalRootPath, canonicalCandidatePath)
        ? canonicalCandidatePath
        : null;
    } catch {
      return null;
    }
  };

  return {
    name: 'sdkwork-models-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = req.url;
        let pathname = '';
        try {
          pathname = requestUrl
            ? new URL(requestUrl, 'http://birdcoder.local').pathname
            : '';
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }

        if (!pathname.startsWith(DATA_URL_PREFIX)) {
          next();
          return;
        }

        const filePath = resolveModelFile(pathname.slice(DATA_URL_PREFIX.length));
        if (!filePath) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

          // 安全检查：确保路径在 sdkwork-models 目录内
          // 使用 sirv 或直接发送文件
        let fileStat: fs.Stats;
        try {
          fileStat = fs.statSync(filePath);
        } catch {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        if (fileStat.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.json': 'application/json',
              '.js': 'application/javascript',
              '.ts': 'application/typescript',
              '.css': 'text/css',
              '.html': 'text/html',
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            const stream = fs.createReadStream(filePath);
            stream.on('error', (error: Error) => {
              console.error('[sdkwork-models-data] Error reading file:', error);
              if (!res.headersSent) {
                res.statusCode = 500;
              }
              res.end('Internal Server Error');
            });
            stream.pipe(res);
            return;
        }

        res.statusCode = 404;
        res.end('Not Found');
      });
    },
  };
}

// Reserved governance names retained for BirdCoder standards:
// birdcoder-platform
// birdcoder-commons-root
// birdcoder-infrastructure-root

export default defineConfig(({ command, mode }) => {
  const runtimeEnvSource = resolveBirdcoderViteRuntimeEnvSource(
    loadEnv(mode, __dirname, ''),
  ) as Record<string, string | undefined>;
  const devProxyTargets = resolveBirdcoderDevProxyTargets(
    runtimeEnvSource,
    command === 'serve',
  );
  const publicRuntimeEnvSource = resolveBirdcoderWebRuntimeEnvSource(
    runtimeEnvSource,
    mode,
  );

  return ({
    esbuild: false,
    oxc: false,
    define: resolveBirdcoderDevelopmentApiEnvDefines(mode),
    plugins: [
      createSdkworkCredentialEntryBootstrapVitePlugin({
        accessToken: process.env.SDKWORK_ACCESS_TOKEN,
        allowTestInjection: mode === 'test',
        environment: mode,
      }),
      ...createBirdcoderVitePlugins({
        appRootDir: __dirname,
        mode,
        namespace: 'sdkwork-birdcoder-pc-web',
        runtimeEnvSource: publicRuntimeEnvSource,
      }),
      sdkworkModelsDataPlugin(),
    ],
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: resolveBirdcoderProductionMinify(mode),
      terserOptions: {
        compress: {
          passes: 5,
          drop_console: true,
          toplevel: true,
        },
        module: true,
        mangle: true,
        format: {
          comments: false,
        },
      },
      cssMinify: resolveBirdcoderProductionCssMinify(mode),
      sourcemap: false,
      modulePreload: {
        resolveDependencies(_filename, deps, context) {
          if (context.hostType !== 'html') {
            return deps;
          }

          return deps.filter(
            (dependency) =>
              !/^assets\/(?:birdcoder-iam-surface|birdcoder-platform|birdcoder-shell-bootstrap|birdcoder-code|birdcoder-studio-surface|birdcoder-multiwindow-surface|birdcoder-settings-surface|birdcoder-terminal-desktop|birdcoder-terminal-infrastructure|ui-workbench|ui-workbench-editors|ui-workbench-preview|ui-file-explorer|ui-chat|ui-run-dialogs|vendor-terminal-xterm|vendor-tauri|vendor-monaco|vendor-markdown|vendor-code-highlight)-/u.test(
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
            return id.includes('/node_modules/') ? 'vendor-i18n' : 'birdcoder-code-workbench';
            }

          if (
            id.includes('/node_modules/react-dom/') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom-client') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom')
          ) {
            return 'vendor-react-dom';
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/use-sync-external-store/') ||
            id.includes('sdkwork-birdcoder-pc-web-react-dom-client') ||
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
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('react-router@')
          ) {
            return 'birdcoder-shell-app';
          }

          if (id.includes('/node_modules/i18next/') || id.includes('i18next@')) {
            return 'vendor-i18n';
          }

          if (
            id.includes('/node_modules/yaml/') ||
            id.includes('/node_modules/jsonc-parser/') ||
            id.includes('/node_modules/smol-toml/')
          ) {
            return 'vendor-structured-data';
          }

          if (id.includes('/node_modules/tailwind-merge/') || id.includes('tailwind-merge@')) {
            return 'ui-workbench';
          }

          if (id.includes('/node_modules/sonner/') || id.includes('sonner@')) {
            return 'ui-workbench';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          if (id.includes('/node_modules/qrcode/')) {
            return 'vendor-qrcode';
          }

          if (
            isAnySourcePath([
              '/sdkwork-utils/packages/sdkwork-utils-typescript/dist/',
              '/sdkwork-utils/packages/sdkwork-utils-typescript/src/',
              '/node_modules/@sdkwork/utils/',
            ])
          ) {
            return 'birdcoder-platform-utils';
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
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/fileExplorer')
          ) {
            return 'ui-file-explorer';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat') ||
            isSourcePath('/packages/sdkwork-birdcoder-pc-ui/src/components/chat/')
          ) {
            return 'ui-chat';
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
            ])
          ) {
            return 'birdcoder-runtime-config';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/appbasePcAuthRuntime.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/appbasePcAuthSessionBridge.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/attachSdkworkSdkSessionAuthBoundary.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/createSdkworkSessionAuthUnauthorizedIntegration.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/handleSdkworkSessionAuthUnauthorizedError.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sdkSessionAuthError.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sessionAuthUnauthorized.ts',
              '/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/sessionAuthUnauthorizedEnv.ts',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-workbench-storage/src/',
              '/packages/sdkwork-birdcoder-pc-workbench/src/storage/localStore.ts',
            ])
          ) {
            return 'birdcoder-workbench-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench-state/src/')) {
            if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench-state/src/runConfigurations.ts')) {
              return 'birdcoder-run-config-storage';
            }
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-workbench/src/terminal/profiles.ts',
            ])
          ) {
            return 'birdcoder-terminal-profiles';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigStorage.ts')) {
            return 'birdcoder-run-config-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/terminal/requests.ts')) {
            return 'birdcoder-terminal-requests';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/terminal/profileAvailability.ts')) {
            return 'birdcoder-terminal-profile-availability';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runtimeTarget.ts')) {
            return 'birdcoder-terminal-profile-availability';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigDefinitions.ts')) {
            return 'birdcoder-run-config-definitions';
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
              '/packages/sdkwork-birdcoder-pc-workbench/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/terminal/terminalRuntimeSanitization.ts',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-commons/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-contracts/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-infrastructure/src/',
              '/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-types/src/',
            ])
          ) {
            return 'birdcoder-terminal-infrastructure';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx')
          ) {
            return 'birdcoder-code-topbar';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer',
            ])
          ) {
            return 'birdcoder-code-sidebar';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodeMobileProgrammingPanel.tsx')
          ) {
            return 'birdcoder-code-mobile';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageDialogs.tsx')
          ) {
            return 'birdcoder-code-dialogs';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/CodeWorkspaceOverlays.tsx')
          ) {
            return 'birdcoder-code-overlays';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorSurface.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageSurface.tsx',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/CodeTerminalIntegrationPanel.tsx',
            ])
          ) {
            return 'birdcoder-code-workbench';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts')
          ) {
            return 'birdcoder-code-workbench';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEffectiveWorkspaceId.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeServerDirectoryProjectImport.ts',
            ])
          ) {
            return 'birdcoder-code-project-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeProjectSessionResolution.ts')) {
            return 'birdcoder-code-session-location-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/codeFileSearch.ts')) {
            return 'birdcoder-code-search-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSessionSelection.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePendingInteractions.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeNewAgentSessionRequestState.ts',
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeDeleteConfirmation.ts',
            ])
          ) {
            return 'birdcoder-code-session-runtime';
          }

          if (isAnySourcePath([
            '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEditorChatLayout.ts',
            '/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageShared.tsx',
          ])) {
            return 'birdcoder-code-workbench';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageClipboardActions.ts')) {
            return 'birdcoder-code-clipboard-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts',
            ])
          ) {
            return 'birdcoder-code-terminal-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeRunEntryActions.ts')) {
            return 'birdcoder-code-run-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts')) {
            return 'birdcoder-code-commands-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-code/src/pages/')) {
            return 'birdcoder-code-runtime';
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
              '/packages/sdkwork-birdcoder-pc-workbench/src/workbench/preferences.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/workbench/recovery.ts',
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

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-contracts-commons/src/')) {
            return 'birdcoder-types';
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

          if (isSourcePath('/packages/sdkwork-birdcoder-pc-workbench/src/index.ts')) {
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
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdCoderSdkClient.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/dependencyAppSdkClients.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkSessionErrorHandler.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sessionService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeAuthService.ts',
              '/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/',
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
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localBusinessUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localServerRequestId.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localUuid.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/apiJson.ts',
              '/packages/sdkwork-birdcoder-pc-core/src/appSessionEvents.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionEvents.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeApiRetry.ts',
            ])
          ) {
            return 'birdcoder-platform-service-core';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedGitService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-api-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-pc-workbench/src/context/ideServices.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/context/IDEContext.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/context/AuthContext.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/context/ServiceContext.tsx',
              '/packages/sdkwork-birdcoder-pc-workbench/src/contexts/ToastProvider.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/utils/EventBus.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useDebounce.ts',
              '/packages/sdkwork-birdcoder-pc-workbench/src/',
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
      proxy: {
        ...(devProxyTargets.platform
          ? {
              [BIRDCODER_PLATFORM_DEV_PROXY_PATH]: {
                target: devProxyTargets.platform,
                changeOrigin: true,
                ws: true,
                rewrite: rewriteBirdcoderPlatformDevProxyPath,
                configure: configureBirdcoderSdkworkProxyProblemResponse,
              },
            }
          : {}),
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
  });
});
