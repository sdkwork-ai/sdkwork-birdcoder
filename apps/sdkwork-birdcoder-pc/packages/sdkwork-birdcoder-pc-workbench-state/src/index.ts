export {
  MIN_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  normalizeWorkbenchCodeEditorChatWidth,
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchTerminalProfileId,
  normalizeWorkbenchPreferences,
  setWorkbenchCodeEngineDefaultModel,
  setWorkbenchActiveCodeEngine,
  setWorkbenchActiveChatSelection,
  setWorkbenchActiveCodeModel,
  ensureWorkbenchPreferences,
  getWorkbenchPreferencesStore,
  readWorkbenchPreferences,
  writeWorkbenchPreferences,
} from '@sdkwork/birdcoder-pc-workbench';
export {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  normalizeWorkbenchRecoverySnapshot,
  buildWorkbenchRecoverySnapshot,
  resolveStartupWorkspaceId,
  resolveWorkbenchRecoveryPersistenceSelection,
  isWorkbenchRecoverySelectionResolutionReady,
  resolveStartupProjectId,
  resolveStartupAgentSessionId,
  buildWorkbenchRecoveryAnnouncement,
  recoverySnapshotsEqual,
} from '@sdkwork/birdcoder-pc-workbench';
export type {
  RunConfigurationCwdMode,
  RunConfigurationGroup,
  RunConfigurationRecord,
} from '@sdkwork/birdcoder-pc-workbench';
export type {
  WorkbenchPreferencesStore,
  WorkbenchPreferences,
} from '@sdkwork/birdcoder-pc-workbench';
export type {
  WorkbenchRecoverySnapshot,
  ResolveStartupWorkspaceIdOptions,
  ResolveStartupProjectIdOptions,
  ResolveStartupAgentSessionIdOptions,
  BuildWorkbenchRecoveryAnnouncementOptions,
  ResolveWorkbenchRecoveryPersistenceSelectionOptions,
} from '@sdkwork/birdcoder-pc-workbench';
