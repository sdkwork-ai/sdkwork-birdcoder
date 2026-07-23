export const APP_NAME = 'SDKWork BirdCoder';
export const APP_VERSION = '1.0.0';

export { parseBirdCoderApiJson } from '@sdkwork/birdcoder-pc-contracts-commons';
export * from './hooks/useDebounce.ts';
export * from './hooks/useProjects.ts';
export * from './hooks/useAgentSessionActions.ts';
export * from './hooks/useDocuments.ts';
export * from './hooks/useAgentSessionInteractions.ts';
export * from './hooks/useFileSystem.ts';
export * from './hooks/useProjectLocalWorkingDirectory.ts';
export * from './hooks/useProjectRuntimeLocation.ts';
export * from './hooks/usePersistedState.ts';
export * from './hooks/useProjectGitOverview.ts';
export * from './hooks/useProjectGitMutationActions.ts';
export * from './hooks/useProjectRunConfigurations.ts';
export * from './hooks/useSelectedAgentSessionItems.ts';
export * from './hooks/useSessionRefreshActions.ts';
export * from './hooks/useAgentSessionEngineModelSelection.ts';
export * from './hooks/useWorkbenchAgentSessionItemEditAction.ts';
export * from './hooks/useWorkbenchAgentSessionCreationActions.ts';
export * from './hooks/useWorkbenchChatSelection.ts';
export * from './hooks/useWorkbenchPreferences.ts';
export * from './hooks/useBirdcoderAppSettings.ts';
export * from './context/IDEContext.ts';
export * from './context/AuthContext.ts';
export * from './contexts/ToastProvider.ts';
export * from './events/projectMountRecoveryEvents.ts';
export * from './events/projectDeviceMountEvents.ts';
export * from './events/projectGitOverview.ts';
export * from './events/projectFileSystemSynchronization.ts';
export * from './legalLinks.ts';
export * from './utils/EventBus.ts';
export * from './components/ErrorBoundary.tsx';
export * from './platform/fileSystem.ts';
export * from './platform/tauriFileManager.ts';
export * from './storage/localStore.ts';
export * from './chat/draftStore.ts';
export * from './chat/messageQueueStore.ts';
export * from './chat/persistence.ts';
export * from './terminal/profiles.ts';
export * from './terminal/runtime.ts';
export * from './terminal/governanceDiagnostics.ts';
export * from './terminal/runConfigDefinitions.ts';
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
export * from './theme/birdcoderTheme.ts';
export * from './workbench/editorRecovery.ts';
export * from './workbench/fileChangeRestore.ts';
export * from './workbench/fileSearch.ts';
export * from './workbench/importedProjectHydration.ts';
export * from './workbench/localFolderProjectImport.ts';
export * from './workbench/projectMountRecovery.ts';
export * from './workbench/projectRuntimeLocationResolution.ts';
export * from './workbench/gitBranches.ts';
export * from './workbench/gitWorktrees.ts';
export * from './workbench/fileSelectionMutation.ts';
export * from './workbench/fileSystemRequestGuard.ts';
export * from './workbench/agentSessionCreation.ts';
export * from './workbench/agentSessionSelection.ts';
export * from './workbench/preferences.ts';
export * from './workbench/recovery.ts';
export * from './workbench/sessionRefresh.ts';
export * from './workbench/projectInventoryRender.ts';
export {
  buildDriveMediaResourceContentBlock,
  resolveChatAttachmentUploadProfile,
  uploadBirdCoderChatAttachmentToDrive,
} from '@sdkwork/birdcoder-pc-infrastructure/services/birdcoderDriveUpload';
export { default as i18n } from '@sdkwork/birdcoder-pc-i18n';
export {
  createBootstrapGateMessages,
  type BootstrapGateMessages,
} from './bootstrap/createBootstrapGateMessages.ts';
