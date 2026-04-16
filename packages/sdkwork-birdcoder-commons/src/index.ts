export const APP_NAME = 'SDKWork BirdCoder';
export const APP_VERSION = '1.0.0';

export * from './hooks/useDebounce.ts';
export * from './hooks/useWorkspaces.ts';
export * from './hooks/useProjects.ts';
export * from './hooks/useDocuments.ts';
export * from './hooks/useDeployments.ts';
export * from './hooks/useAdminDeployments.ts';
export * from './hooks/useAdminPolicies.ts';
export * from './hooks/useAuditEvents.ts';
export * from './hooks/useReleases.ts';
export * from './hooks/useCodingServerOverview.ts';
export * from './hooks/useCodingSessionProjection.ts';
export * from './hooks/useFileSystem.ts';
export * from './hooks/usePersistedState.ts';
export * from './hooks/useProjectRunConfigurations.ts';
export * from './hooks/useSessionRefreshActions.ts';
export * from './hooks/useWorkbenchPreferences.ts';
export * from './hooks/useCodingSessionActions.ts';
export * from './context/AuthContext.ts';
export * from './context/IDEContext.ts';
export * from './contexts/ToastProvider.ts';
export * from './utils/EventBus.ts';
export * from './storage/dataKernel.ts';
export * from './storage/localStore.ts';
export * from './chat/persistence.ts';
export * from './terminal/profiles.ts';
export {
  TERMINAL_CLI_PROFILE_IDS,
  TERMINAL_CLI_PROFILE_REGISTRY,
  getTerminalCliProfileDefinition,
  isTerminalCliProfileId,
  normalizeTerminalCliExecutable,
  type TerminalCliProfileDefinition,
} from './terminal/registry.ts';
export * from './terminal/runtime.ts';
export * from './terminal/auditStore.ts';
export * from './terminal/runConfigs.ts';
export * from './terminal/sessions.ts';
export * from './workbench/engines.ts';
export * from './workbench/editorRecovery.ts';
export * from './workbench/fileChangeRestore.ts';
export * from './workbench/fileSearch.ts';
export * from './workbench/localFolderProjectImport.ts';
export * from './workbench/projectMountRecovery.ts';
export * from './workbench/fileSelectionMutation.ts';
export * from './workbench/fileSystemRequestGuard.ts';
export * from './workbench/kernel.ts';
export * from './workbench/nativeCodexSessionStore.ts';
export * from './workbench/nativeCodexSessionMirror.ts';
export * from './workbench/preferences.ts';
export * from './workbench/recovery.ts';
export * from './workbench/runtime.ts';
export * from './workbench/sessionRefresh.ts';
export * from './workbench/sessionInventory.ts';
export {
  bindDefaultBirdCoderIdeServicesRuntime,
  configureDefaultBirdCoderIdeServicesRuntime,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
  type BindDefaultBirdCoderIdeServicesRuntimeOptions,
  type BirdCoderDefaultIdeServicesRuntimeConfig,
} from '@sdkwork/birdcoder-infrastructure/runtime/defaultIdeServices';
export { default as i18n } from '@sdkwork/birdcoder-i18n';
