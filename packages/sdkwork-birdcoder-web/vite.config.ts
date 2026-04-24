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
              !/^assets\/(?:birdcoder-auth|birdcoder-user|birdcoder-platform|birdcoder-platform-services|birdcoder-shell-bootstrap|ui-workbench|ui-workbench-editors|ui-workbench-preview|ui-run-dialogs|vendor-monaco|vendor-markdown|vendor-code-highlight)-/u.test(
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
            return 'birdcoder-auth-root';
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
            return 'birdcoder-auth-root';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/domain/userCenterAppearance.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/domain/userCenterSurfaceRouting.ts',
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/types/userCenterSurfaceTypes.ts',
            ])
          ) {
            return 'birdcoder-user-center-surface';
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
            return 'birdcoder-user-root';
          }

          if (
            isAnySourcePath([
              '/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/pages/userCenterProfileSurfacePage.tsx',
            ])
          ) {
            return 'birdcoder-user-pages';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/index.ts')) {
            return 'birdcoder-auth-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/pages/')) {
            return 'birdcoder-auth-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-auth/src/')) {
            return 'birdcoder-auth-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/index.ts')) {
            return 'birdcoder-user-root';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/pages/')) {
            return 'birdcoder-user-pages';
          }

          if (isSourcePath('/packages/sdkwork-birdcoder-user/src/')) {
            return 'birdcoder-user-root';
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
              '/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriRuntime.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
            ])
          ) {
            return 'birdcoder-platform-api-backed';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/lazyDefaultIdeServices.ts',
            ])
          ) {
            return 'birdcoder-platform-bootstrap';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeApiRetry.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
            ])
          ) {
            return 'birdcoder-platform-transport';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
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
              '/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionSelection.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
            ])
          ) {
            return 'birdcoder-platform-provider';
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
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
            ])
          ) {
            return 'birdcoder-platform-api-backed';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionSelection.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeApiRetry.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/promptEntryText.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/runtime.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/savedPromptEntryRepository.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/storage/sqlRowCodec.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedPromptService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
              '/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
            ])
          ) {
            return 'birdcoder-platform-services';
          }

          if (
            isAnySourcePath([
              '/packages/sdkwork-birdcoder-commons/src/context/ideServices.ts',
              '/packages/sdkwork-birdcoder-commons/src/context/IDEContext.ts',
              '/packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts',
              '/packages/sdkwork-birdcoder-commons/src/hooks/useBirdcoderAppSettings.ts',
              '/packages/sdkwork-birdcoder-commons/src/settings/appSettings.ts',
              '/packages/sdkwork-birdcoder-commons/src/theme/birdcoderIdentityTheme.ts',
            ])
          ) {
            return 'birdcoder-identity-runtime';
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
