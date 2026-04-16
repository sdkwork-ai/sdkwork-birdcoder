export const APP_NAME = 'SDKWork BirdCoder';
export const APP_VERSION = '1.0.0';

export * from './hooks/useDebounce';
export * from './hooks/useWorkspaces';
export * from './hooks/useProjects';
export * from './hooks/useDocuments';
export * from './hooks/useDeployments';
export * from './hooks/useAdminDeployments';
export * from './hooks/useAdminPolicies';
export * from './hooks/useAuditEvents';
export * from './hooks/useReleases';
export * from './hooks/useCodingServerOverview';
export * from './hooks/useCodingSessionProjection';
export * from './hooks/useFileSystem';
export * from './hooks/usePersistedState';
export * from './hooks/useProjectRunConfigurations';
export * from './hooks/useSessionRefreshActions';
export * from './hooks/useWorkbenchPreferences';
export * from './hooks/useCodingSessionActions';
export * from './context/AuthContext';
export * from './context/IDEContext';
export * from './contexts/ToastProvider';
export * from './utils/EventBus';
export * from './storage/dataKernel';
export * from './storage/localStore';
export * from './chat/persistence';
export * from './terminal/profiles';
export {
  TERMINAL_CLI_PROFILE_IDS,
  TERMINAL_CLI_PROFILE_REGISTRY,
  getTerminalCliProfileDefinition,
  isTerminalCliProfileId,
  normalizeTerminalCliExecutable,
  type TerminalCliProfileDefinition,
} from './terminal/registry';
export * from './terminal/runtime';
export * from './terminal/auditStore';
export * from './terminal/runConfigs';
export * from './terminal/sessions';
export * from './workbench/engines';
export * from './workbench/editorRecovery';
export * from './workbench/fileChangeRestore';
export * from './workbench/fileSearch';
export * from './workbench/localFolderProjectImport';
export * from './workbench/projectMountRecovery';
export * from './workbench/fileSelectionMutation';
export * from './workbench/fileSystemRequestGuard';
export * from './workbench/kernel';
export * from './workbench/nativeCodexSessionStore';
export * from './workbench/nativeCodexSessionMirror';
export * from './workbench/preferences';
export * from './workbench/recovery';
export * from './workbench/runtime';
export * from './workbench/sessionRefresh';
export * from './workbench/sessionInventory';
export {
  bindDefaultBirdCoderIdeServicesRuntime,
  configureDefaultBirdCoderIdeServicesRuntime,
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  resetDefaultBirdCoderIdeServicesRuntimeForTests,
  type BindDefaultBirdCoderIdeServicesRuntimeOptions,
  type BirdCoderDefaultIdeServicesRuntimeConfig,
} from '@sdkwork/birdcoder-infrastructure/runtime/defaultIdeServices';
export { default as i18n } from '@sdkwork/birdcoder-i18n';
