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
} from '../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reserved bundle governance names retained for BirdCoder standards:
// birdcoder-platform
// birdcoder-commons-root
// birdcoder-infrastructure-root

export default defineConfig(({ mode }) => {
  const runtimeEnvSource = loadEnv(mode, __dirname, '');

  return ({
    esbuild: false,
    plugins: createBirdcoderVitePlugins({
      appRootDir: __dirname,
      mode,
      namespace: 'sdkwork-birdcoder-web',
      runtimeEnvSource,
    }),
    optimizeDeps: {
      noDiscovery: true,
      include: [...BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE],
    },
    build: {
      minify: false,
      cssMinify: false,
      modulePreload: {
        resolveDependencies(_filename, deps, context) {
          if (context.hostType !== 'html') {
            return deps;
          }

          return deps.filter(
            (dependency) =>
              !/^assets\/(?:birdcoder-identity-surface|birdcoder-user-center-core|birdcoder-platform|birdcoder-shell-bootstrap|birdcoder-code-surface|birdcoder-studio-surface|birdcoder-multiwindow-surface|birdcoder-settings-surface|birdcoder-skills-surface|birdcoder-templates-surface|birdcoder-terminal-desktop|birdcoder-terminal-infrastructure|ui-workbench|ui-workbench-editors|ui-workbench-preview|ui-run-dialogs|vendor-terminal-xterm|vendor-tauri|vendor-monaco|vendor-markdown|vendor-code-highlight)-/u.test(
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
            if (
              id.includes('/packages/sdkwork-birdcoder-i18n/src/') ||
              id.includes('/node_modules/react-i18next/') ||
              id.includes('/node_modules/i18next/')
            ) {
              return 'vendor-i18n';
            }

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

          if (
            id.includes('/node_modules/@xterm/xterm/') ||
            id.includes('sdkwork-birdcoder-web-xterm-xterm')
          ) {
            return 'vendor-terminal-xterm';
          }

          if (
            id.includes('/node_modules/@xterm/addon-canvas/') ||
            id.includes('sdkwork-birdcoder-web-xterm-addon-canvas')
          ) {
            return 'vendor-terminal-xterm-addon-canvas';
          }

          if (
            id.includes('/node_modules/@xterm/addon-fit/') ||
            id.includes('sdkwork-birdcoder-web-xterm-addon-fit')
          ) {
            return 'vendor-terminal-xterm-addon-fit';
          }

          if (
            id.includes('/node_modules/@xterm/addon-search/') ||
            id.includes('sdkwork-birdcoder-web-xterm-addon-search')
          ) {
            return 'vendor-terminal-xterm-addon-search';
          }

          if (
            id.includes('/node_modules/@xterm/addon-unicode11/') ||
            id.includes('sdkwork-birdcoder-web-xterm-addon-unicode11')
          ) {
            return 'vendor-terminal-xterm-addon-unicode11';
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
            id.includes('/packages/sdkwork-birdcoder-ui-shell/src/') ||
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

          if (isSourcePath('/packages/sdkwork-birdcoder-ui/src/index.ts')) {
            return 'birdcoder-ui';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/DiffEditor.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/monacoOverflowWidgets.ts',
              '/packages/sdkwork-birdcoder-ui/src/components/monacoRuntime.ts',
            ])
          ) {
            return 'ui-workbench-editors';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-ui/src/components/ContentPreviewer.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/ContentCodePreview.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/ContentMarkdownPreview.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/ContentStructuredDataPreview.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/ContentKeyValuePreview.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/ContentTablePreview.tsx',
              '/packages/sdkwork-birdcoder-ui/src/components/contentPreview.ts',
              '/packages/sdkwork-birdcoder-ui/src/components/contentPreviewStructuredData.ts',
            ])
          ) {
            return 'ui-workbench-preview';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-ui/src/components/RunConfigurationDialogs.tsx')
          ) {
            return 'ui-run-dialogs';
          }

          if (
            isSourcePath('/packages/sdkwork-birdcoder-web/src/loadAppRoot.ts')
          ) {
            return 'birdcoder-shell-entry';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-shell/src/index.ts',
              '/packages/sdkwork-birdcoder-shell/src/app.ts',
              '/packages/sdkwork-birdcoder-shell/src/application/app/AppRoot.tsx',
              '/packages/sdkwork-birdcoder-shell/src/application/app/loadBirdcoderApp.ts',
              '/packages/sdkwork-birdcoder-shell/src/application/providers/',
            ])
          ) {
            return 'birdcoder-shell-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-shell/src/application/app/',
            ])
          ) {
            return 'birdcoder-shell-app';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/runtime/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
            ])
          ) {
            return 'birdcoder-runtime-config';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-workbench-storage/src/',
              '/packages/sdkwork-birdcoder-commons/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-commons/src/storage/localStore.ts',
            ])
          ) {
            return 'birdcoder-workbench-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-workbench-state/src/')) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-commons/src/terminal/registry.ts',
              '/packages/sdkwork-birdcoder-commons/src/terminal/profiles.ts',
              '/packages/sdkwork-birdcoder-commons/src/terminal/runConfigStorage.ts',
            ])
          ) {
            return 'birdcoder-terminal-profiles';
          }

          if (
            isAnySourcePath([
              '/sdkwork-terminal/apps/desktop/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-ai-cli/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-diagnostics/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-i18n/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-resources/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-sessions/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-settings/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-shell/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-ui/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-workbench/src/',
            ])
          ) {
            return 'birdcoder-terminal-desktop';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
              '/packages/sdkwork-birdcoder-commons/src/terminal/terminalRuntimeSanitization.ts',
              '/sdkwork-terminal/packages/sdkwork-terminal-commons/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-contracts/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-core/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/',
              '/sdkwork-terminal/packages/sdkwork-terminal-types/src/',
            ])
          ) {
            return 'birdcoder-terminal-infrastructure';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-code/src/')) {
            return 'birdcoder-code-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-studio/src/')) {
            return 'birdcoder-studio-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-multiwindow/src/')) {
            return 'birdcoder-multiwindow-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-settings/src/')) {
            return 'birdcoder-settings-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-skills/src/')) {
            return 'birdcoder-skills-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-templates/src/')) {
            return 'birdcoder-templates-surface';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
            ])
          ) {
            return 'birdcoder-shell-bootstrap';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
              '/packages/sdkwork-birdcoder-commons/src/workbench/recovery.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/BootstrapGate.tsx',
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellRuntime.ts',
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/loadBootstrapShellRuntimeImpl.ts',
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
              '/packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapServerApiReady.ts',
              '/packages/sdkwork-birdcoder-shell-runtime/src/index.ts',
            ])
          ) {
            return 'birdcoder-shell-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-types/src/data.ts',
            ])
          ) {
            return 'birdcoder-types-data';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-types/src/server-api.ts',
              '/packages/sdkwork-birdcoder-types/src/generated/',
            ])
          ) {
            return 'birdcoder-types-api';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-types/src/storageBindings.ts',
            ])
          ) {
            return 'birdcoder-types-storage';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-types/src/')) {
            return 'birdcoder-types';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-codeengine/src/',
              '/packages/sdkwork-birdcoder-codeengine/src-host/generated/',
            ])
          ) {
            return 'birdcoder-codeengine';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/index.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-definition.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-appearance.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-config.ts',
            ])
          ) {
            return 'birdcoder-identity-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-authority.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-controller.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-copy.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-local-service.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-runtime-config.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-runtime-authority.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-service.ts',
            ])
          ) {
            return 'birdcoder-platform-auth-runtime';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth-intl.tsx',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/components/auth/',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/components/auth-page-shell.tsx',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/components/oauth-provider-grid.tsx',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/components/qr-login-panel.tsx',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/pages/',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/pages/userCenterAuthSurfacePage.tsx',
            ])
          ) {
            return 'birdcoder-identity-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/domain/userCenterAppearance.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/domain/userCenterSurfaceRouting.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/types/userCenterSurfaceTypes.ts',
            ])
          ) {
            return 'birdcoder-identity-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/',
            ])
          ) {
            return 'birdcoder-user-center-core';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-pc-react/src/',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/pages/canonicalSurfacePages.tsx',
            ])
          ) {
            return 'birdcoder-identity-surface';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/pages/userCenterProfileSurfacePage.tsx',
            ])
          ) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/index.ts')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/pages/')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/index.ts')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/pages/')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/')) {
            return 'birdcoder-identity-surface';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-git/src/')) {
            return 'birdcoder-git';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-commons/src/index.ts')) {
            return 'birdcoder-commons-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-infrastructure/src/index.ts')) {
            return 'birdcoder-infrastructure-root';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-identity/src/index.ts',
              '/packages/sdkwork-birdcoder-identity/src/identityIntegration.ts',
            ])
          ) {
            return 'birdcoder-identity-integration';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/runtime.ts',
            ])
          ) {
            return 'birdcoder-storage-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
            ])
          ) {
            return 'birdcoder-platform-api-client';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriRuntime.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
            ])
          ) {
            return 'birdcoder-platform-filesystem';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/lazyDefaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/bootstrapConsoleCatalog.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/promptEntryText.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/savedPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlRowCodec.ts',
            ])
          ) {
            return 'birdcoder-platform-storage';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/apiJson.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionMessageProjection.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionSelection.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/projectContentConfigData.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeApiRetry.ts',
            ])
          ) {
            return 'birdcoder-platform-service-core';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-provider-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAdminDeploymentService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAdminPolicyService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAuditService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCollaborationService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreWriteService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedDeploymentService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedDocumentService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedGitService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedReleaseService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedTeamService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-api-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-commons/src/context/ideServices.ts',
              '/packages/sdkwork-birdcoder-commons/src/context/IDEContext.ts',
              '/packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts',
              '/packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx',
              '/packages/sdkwork-birdcoder-commons/src/contexts/ToastProvider.tsx',
              '/packages/sdkwork-birdcoder-commons/src/utils/EventBus.ts',
              '/packages/sdkwork-birdcoder-commons/src/hooks/useDebounce.ts',
              '/packages/sdkwork-birdcoder-commons/src/',
              '/packages/sdkwork-birdcoder-infrastructure/src/',
            ])
          ) {
            return 'birdcoder-platform-runtime';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-ui/src/')) {
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
