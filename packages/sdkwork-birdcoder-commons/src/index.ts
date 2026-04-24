export const APP_NAME = 'SDKWork BirdCoder';
export const APP_VERSION = '1.0.0';

export * from './hooks/useDebounce.ts';
export * from './hooks/useWorkspaces.ts';
export * from './hooks/useProjects.ts';
export * from './hooks/useCodingSessionActions.ts';
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
export * from './hooks/useProjectGitOverview.ts';
export * from './hooks/useProjectGitMutationActions.ts';
export * from './hooks/useProjectRunConfigurations.ts';
export * from './hooks/useSelectedCodingSessionMessages.ts';
export * from './hooks/useSessionRefreshActions.ts';
export * from './hooks/useCodingSessionEngineModelSelection.ts';
export * from './hooks/useWorkbenchCodingSessionCreationActions.ts';
export * from './hooks/useWorkbenchChatSelection.ts';
export * from './hooks/useWorkbenchPreferences.ts';
export * from './hooks/useBirdcoderAppSettings.ts';
export * from './context/IDEContext.ts';
export * from './context/AuthContext.ts';
export * from './contexts/ToastProvider.ts';
export * from './events/projectMountRecoveryEvents.ts';
export * from './events/projectGitOverview.ts';
export * from './utils/EventBus.ts';
export * from './platform/fileSystem.ts';
export * from './storage/dataKernel.ts';
export * from './storage/localStore.ts';
export * from './chat/draftStore.ts';
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
export * from './terminal/runConfigStorage.ts';
export {
  buildRunConfigurationTerminalRequest,
  resolveRunConfigurationDirectory,
  resolveRunConfigurationTerminalLaunch,
  type ResolveRunConfigurationTerminalLaunchOptions,
  type RunConfigurationTerminalLaunchResult,
  type RunConfigurationTerminalRequest,
} from './terminal/runConfigs.ts';
export * from './terminal/sessions.ts';
export * from './terminal/useBirdcoderTerminalLaunchPlanResolver.ts';
export * from './settings/appSettings.ts';
export * from './theme/birdcoderIdentityTheme.ts';
export * from './workbench/editorRecovery.ts';
export * from './workbench/fileChangeRestore.ts';
export * from './workbench/fileSearch.ts';
export * from './workbench/importedProjectHydration.ts';
export * from './workbench/localFolderProjectImport.ts';
export * from './workbench/projectMountRecovery.ts';
export * from './workbench/gitBranches.ts';
export * from './workbench/fileSelectionMutation.ts';
export * from './workbench/fileSystemRequestGuard.ts';
export * from './workbench/codingSessionCreation.ts';
export * from './workbench/codingSessionSelection.ts';
export * from './workbench/preferences.ts';
export * from './workbench/recovery.ts';
export * from './workbench/sessionRefresh.ts';
export * from './workbench/sessionInventory.ts';
export * from './stores/workspaceRealtime.ts';
export { default as i18n } from '@sdkwork/birdcoder-i18n';
