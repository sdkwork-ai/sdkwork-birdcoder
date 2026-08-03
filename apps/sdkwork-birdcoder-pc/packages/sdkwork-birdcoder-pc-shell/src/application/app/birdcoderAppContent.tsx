/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings, Terminal } from 'lucide-react';
import {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  buildWorkbenchRecoveryAnnouncement,
  buildWorkbenchRecoverySnapshot,
  isWorkbenchRecoverySelectionResolutionReady,
  normalizeWorkbenchRecoverySnapshot,
  normalizeWorkbenchRecoveryUserScope,
  recoverySnapshotsEqual,
  resolveWorkbenchRecoverySnapshotForUser,
  resolveStartupAgentSessionId,
  resolveStartupProjectId,
  resolveWorkbenchRecoveryPersistenceSelection,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-pc-workbench/workbench/recovery';
import {
  buildAgentSessionProjectScopedKey,
  buildProjectAgentSessionIndex,
} from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import {
  buildDesktopTraySessionMenuSnapshot,
  type DesktopTrayAction,
} from '@sdkwork/birdcoder-pc-workbench/workbench/desktopTraySessionMenu';
import {
  getProviderSessionImportFailureCount,
  importProjectProviderSessions,
} from '@sdkwork/birdcoder-pc-workbench/workbench/importedProjectHydration';
import {
  importSelectedProjectDirectory,
  resolveProjectDirectorySelectionName,
  selectProjectDirectory,
  type ProjectDirectorySelection,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectDirectorySelection';
import {
  buildDefaultTerminalCommandRequest,
  emitOpenTerminalRequest,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { resolveBirdcoderWorkbenchHostMode } from '@sdkwork/birdcoder-pc-workbench/terminal/runtimeTarget';
import {
  emitRevealProjectInFileManager,
  subscribeCopyProjectLocalPath,
  subscribeOpenProjectTerminal,
  subscribeRevealProjectInFileManager,
  type ProjectDeviceMountTarget,
} from '@sdkwork/birdcoder-pc-workbench/events/projectDeviceMountEvents';
import {
  subscribeProjectMountRecoveryState,
  type ProjectMountRecoveryEventPayload,
} from '@sdkwork/birdcoder-pc-workbench/events/projectMountRecoveryEvents';
import { emitRevealAgentSession } from '@sdkwork/birdcoder-pc-workbench/events/agentSessionRevealEvents';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import {
  formatKeyboardShortcut,
  isMacKeyboardPlatform,
  resolveKeyboardShortcutCommand,
  useKeyboardShortcuts,
  type KeyboardShortcutCommand,
} from '@sdkwork/birdcoder-pc-workbench';
import { revealTauriPathInFileManager } from '@sdkwork/birdcoder-pc-workbench/platform/tauriFileManager';
import { ToastProvider, useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useAuth } from '@sdkwork/birdcoder-pc-workbench/context/AuthContext';
import { buildBirdCoderAuthSessionInventoryScope } from '@sdkwork/birdcoder-pc-workbench/context/authSessionScope';
import { usePersistedState } from '@sdkwork/birdcoder-pc-workbench/hooks/usePersistedState';
import { useProjects } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjects';
import { useWorkspaces } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkspaces';
import { useWorkbenchChatSelection } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchChatSelection';
import { useWorkbenchAgentSessionCreationActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchAgentSessionCreationActions';
import type { CreateNewAgentSessionRequest } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionCreation';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { Button, TopMenu, type TopMenuItem } from '@sdkwork/birdcoder-pc-ui-shell';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
import type {
  AppTab,
  AgentProjectView,
  AgentWorkspaceView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  isSettingsTab,
  type SettingsTab,
} from '@sdkwork/birdcoder-pc-settings';
import {
  loadWorkbenchCodeEngineCatalog,
  resetWorkbenchCodeEngineCatalog,
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import {
  filterWorkbenchModeCatalogEngines,
  normalizeWorkbenchMode,
  resolveWorkbenchModeForEngineId,
} from '@sdkwork/birdcoder-pc-workbench/workbench/workbenchMode';
import { useTranslation } from 'react-i18next';
import {
  createAppHeaderWindowDragController,
  isAppHeaderNoDragTarget,
} from './appHeaderWindowDrag.ts';
import {
  resolveBirdCoderInitialAppTab,
  useBirdCoderAuthAppTabRouting,
} from './authAppTabRouting.ts';
import { AppShellDialogs } from './AppShellDialogs.tsx';
import { AppWorkspaceProjectPopover } from './AppWorkspaceProjectPopover.tsx';
import { CreateProjectDialog } from './CreateProjectDialog.tsx';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog.tsx';
import {
  performNativeWindowControlAction,
  useNativeWindowControlsBridge,
} from './nativeWindowControlsBridge.ts';
import { useNativeTrayMenuBridge } from './nativeTrayMenuBridge.ts';
import { BirdcoderAppHeader } from './BirdcoderAppHeader.tsx';
import {
  BirdcoderCommandMenu,
  type BirdcoderCommandGroup,
} from './BirdcoderCommandMenu.tsx';
import { AppMainBody, isProjectTerminalRequest } from './birdcoderAppMainBody.tsx';
import {
  DESKTOP_WINDOW_FRAME_STATE_CACHE_TTL_MS,
  DESKTOP_WINDOW_FRAME_STATE_RECONCILIATION_DELAY_MS,
  WORKBENCH_RECOVERY_PERSIST_DELAY_MS,
} from './birdcoderAppConstants.ts';
import { applyWorkbenchStartupSelectionLink } from './workbenchStartupSelection.ts';
import {
  createWorkbenchRecoverySessionId,
  persistWorkbenchRecoverySnapshot,
  readDesktopWindowFrameStateClockMs,
  type DesktopWindowHandle,
} from './workbenchRecoveryPersistence.ts';

interface PendingProjectCreationRequest {
  promise: Promise<string | undefined>;
  resolve: (projectId: string | undefined) => void;
}

export function AppContent() {
  const { t } = useTranslation();
  const { pickDirectory } = useSandboxDirectoryPicker();
  const {
    agentSessionService,
    fileSystemService,
    projectRuntimeLocationService,
    projectService,
  } = useIDEServices();
  const { user, isLoading: isAuthLoading, logout, sessionRevision } = useAuth();
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const { bindings: keyboardShortcutBindings } = useKeyboardShortcuts();
  const isMacKeyboard = useMemo(() => isMacKeyboardPlatform(), []);
  const shortcutFor = useCallback((command: KeyboardShortcutCommand) => {
    const shortcut = keyboardShortcutBindings[command][0];
    return shortcut ? formatKeyboardShortcut(shortcut, isMacKeyboard) : undefined;
  }, [isMacKeyboard, keyboardShortcutBindings]);
  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveBirdCoderInitialAppTab());
  const [storedSettingsTab, setStoredSettingsTab] = usePersistedState<unknown>(
    'settings',
    'active-tab',
    'general',
  );
  const settingsTab: SettingsTab = isSettingsTab(storedSettingsTab)
    ? storedSettingsTab
    : 'general';
  const setSettingsTab = useCallback((tab: SettingsTab) => {
    setStoredSettingsTab(tab);
  }, [setStoredSettingsTab]);
  const [recoverySnapshot, , isRecoveryHydrated] = usePersistedState<WorkbenchRecoverySnapshot>(
    'workbench',
    'recovery-context',
    DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  );
  const currentWorkbenchUserScope = normalizeWorkbenchRecoveryUserScope(user?.id);
  const currentWorkbenchSessionScope = buildBirdCoderAuthSessionInventoryScope(
    user?.id,
    sessionRevision,
  );
  const isAuthenticated = Boolean(user);
  useEffect(() => {
    if (isAuthLoading) {
      return undefined;
    }
    if (!isAuthenticated) {
      resetWorkbenchCodeEngineCatalog();
      return undefined;
    }

    let disposed = false;
    void loadWorkbenchCodeEngineCatalog().catch((error) => {
      if (!disposed) {
        console.warn('[sdkwork-agents] failed to load code-engine catalog:', error);
      }
    });
    return () => {
      disposed = true;
      resetWorkbenchCodeEngineCatalog();
    };
    // Key the catalog lifecycle on the authenticated user identity, not the
    // token-pair revision: every token refresh bumps `sessionRevision` and
    // would otherwise reset+reload the global catalog, flipping its snapshot
    // identity and re-triggering every consumer effect that derives data from
    // it (the UniversalChat model-catalog load included) — the request-loop
    // source observed in the desktop session.
  }, [user?.id, isAuthLoading, isAuthenticated]);
  const normalizedStoredRecoverySnapshot = useMemo(
    () => normalizeWorkbenchRecoverySnapshot(recoverySnapshot),
    [recoverySnapshot],
  );
  const normalizedRecoverySnapshot = useMemo(
    () => applyWorkbenchStartupSelectionLink(
      resolveWorkbenchRecoverySnapshotForUser(
        normalizedStoredRecoverySnapshot,
        currentWorkbenchUserScope,
      ),
    ),
    [currentWorkbenchUserScope, normalizedStoredRecoverySnapshot],
  );
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeAgentSessionId, setActiveAgentSessionId] = useState<string>('');
  const previousWorkbenchSessionScopeRef = useRef(currentWorkbenchSessionScope);
  const isWorkbenchSelectionForCurrentSession =
    previousWorkbenchSessionScopeRef.current === currentWorkbenchSessionScope;
  const scopedActiveProjectId = isWorkbenchSelectionForCurrentSession ? activeProjectId : '';
  const scopedActiveAgentSessionId =
    isWorkbenchSelectionForCurrentSession ? activeAgentSessionId : '';
  const [showWorkspaceProjectPopover, setShowWorkspaceProjectPopover] = useState(false);
  const {
    error: workspacesError,
    hasFetched: workspacesHasFetched,
    hasMore: workspacesHasMore,
    isLoading: isWorkspacesLoading,
    isLoadingMore: isWorkspacesLoadingMore,
    archiveWorkspace,
    createWorkspace,
    deleteWorkspace,
    loadMoreWorkspaces,
    refreshWorkspaces,
    selectedWorkspace,
    selectedWorkspaceId,
    selectWorkspace,
    updateWorkspace,
    workspaces,
  } = useWorkspaces({
    isActive: Boolean(user) && isRecoveryHydrated,
    preferredWorkspaceId: normalizedRecoverySnapshot.activeWorkspaceId,
  });
  const {
    projects,
    error: projectsError,
    hasFetched: projectsHasFetched,
    hasMore: projectsHasMore,
    isLoading: isProjectsLoading,
    isLoadingMore: isProjectsLoadingMore,
    createProject,
    ensureProject,
    importProject,
    loadMoreProjects,
    refreshProjects,
    renameProject,
    archiveProject,
    deleteProject,
    createAgentSession,
  } = useProjects({
    isActive: Boolean(user) && isRecoveryHydrated && Boolean(selectedWorkspaceId),
    targetProjectId:
      scopedActiveProjectId || normalizedRecoverySnapshot.activeProjectId,
    workspaceId: selectedWorkspaceId,
  });
  const isRecoveryProjectInventoryReady = isRecoveryHydrated && projectsHasFetched;
  const projectsIndex = useMemo(
    () => buildProjectAgentSessionIndex(projects),
    [projects],
  );

  useEffect(() => {
    if (projectsError) {
      addToast(projectsError, 'error');
    }
  }, [addToast, projectsError]);

  const handleLoadMoreProjects = useCallback(async () => {
    try {
      await loadMoreProjects();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t('code.failedToLoadMoreProjects');
      addToast(message, 'error');
    }
  }, [addToast, loadMoreProjects, t]);

  const handleLoadMoreWorkspaces = useCallback(async () => {
    try {
      await loadMoreWorkspaces();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t('app.failedToLoadMoreWorkspaces');
      addToast(message, 'error');
    }
  }, [addToast, loadMoreWorkspaces, t]);

  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [isProjectCreationPending, setIsProjectCreationPending] = useState(false);
  const [isProjectFolderPickerPending, setIsProjectFolderPickerPending] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSourceFolder, setNewProjectSourceFolder] =
    useState<ProjectDirectorySelection | null>(null);
  const newProjectSourceFolderName = useMemo(
    () => newProjectSourceFolder
      ? resolveProjectDirectorySelectionName(newProjectSourceFolder, t('app.localFolder'))
      : null,
    [newProjectSourceFolder, t],
  );
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const [projectToRemove, setProjectToRemove] = useState<string | null>(null);
  const [projectActionsMenuId, setProjectActionsMenuId] = useState<string | null>(null);
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  const [isWorkspaceCreationPending, setIsWorkspaceCreationPending] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState('');
  const [workspaceActionsMenuId, setWorkspaceActionsMenuId] = useState<string | null>(null);
  const pendingProjectCreationRequestRef = useRef<PendingProjectCreationRequest | null>(null);
  const [projectMountRecoveryNotice, setProjectMountRecoveryNotice] =
    useState<ProjectMountRecoveryEventPayload | null>(null);
  const [projectMountRecoveryStartedAt, setProjectMountRecoveryStartedAt] = useState<number | null>(
    null,
  );
  const workspaceProjectPopoverRef = useRef<HTMLDivElement>(null);
  const minimizeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const maximizeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeWindowControlButtonRef = useRef<HTMLButtonElement | null>(null);
  const createAgentSessionCommandRef = useRef<(request?: CreateNewAgentSessionRequest) => void>(() => {});
  const openFolderHandlerRef = useRef<() => void>(() => {});
  const zoomHandlerRef = useRef<(direction: 'in' | 'out' | 'reset') => void>(() => {});
  const toggleFullScreenHandlerRef = useRef<() => void>(() => {});

  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [isDesktopWindowAvailable, setIsDesktopWindowAvailable] = useState(false);
  const [isDesktopWindowMaximized, setIsDesktopWindowMaximized] = useState(false);
  const [isDesktopWindowMinimized, setIsDesktopWindowMinimized] = useState(false);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const titleBarWindowDragControllerRef = useRef<ReturnType<typeof createAppHeaderWindowDragController> | null>(null);
  const desktopWindowPromiseRef = useRef<Promise<DesktopWindowHandle | null> | null>(null);
  const desktopWindowHandleRef = useRef<DesktopWindowHandle | null>(null);
  const isDesktopWindowAvailableRef = useRef(false);
  const isDesktopWindowMaximizedRef = useRef(false);
  const isDesktopWindowMinimizedRef = useRef(false);
  const isDocumentFullscreenRef = useRef(false);
  const desktopWindowStateSyncTokenRef = useRef(0);
  const desktopWindowFrameStateReconciliationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopWindowFrameStateSyncPromiseRef = useRef<Promise<void> | null>(null);
  const desktopWindowFrameStateLastVerifiedAtRef = useRef(0);
  const recoverySnapshotPersistTimeoutRef = useRef<number | null>(null);
  const desktopWindowToggleInFlightRef = useRef(false);
  const hasAnnouncedRecoveryRef = useRef(false);
  const recoverySessionIdRef = useRef('');
  const lastPersistedRecoverySnapshotRef = useRef<WorkbenchRecoverySnapshot | null>(null);
  const pendingImportedProjectIdRef = useRef('');
  const projectMountRecoveryIdentityRef = useRef('');
  const projectMountRecoveryActiveSurfaceRef = useRef('');
  const activeAgentSessionSelectionProjectIdRef = useRef('');

  const clearActiveAgentSessionSelection = useCallback(() => {
    activeAgentSessionSelectionProjectIdRef.current = '';
    setActiveAgentSessionId('');
  }, []);

  const commitActiveAgentSessionSelection = useCallback((
    projectId: string,
    agentSessionId: string,
  ) => {
    const normalizedProjectId = projectId.trim();
    const normalizedAgentSessionId = agentSessionId.trim();
    activeAgentSessionSelectionProjectIdRef.current = normalizedProjectId;
    setActiveAgentSessionId(normalizedAgentSessionId);
  }, []);

  const {
    handleActiveTabChange,
    handleLogout,
    openAuthenticationSurface,
  } = useBirdCoderAuthAppTabRouting({
    activeTab,
    isAuthLoading,
    isRecoveryHydrated,
    logout,
    recoveredTab: normalizedRecoverySnapshot.activeTab,
    setActiveTab,
    user,
  });

  const closeWorkspaceProjectPopover = useCallback(() => {
    setShowWorkspaceProjectPopover(false);
    setRenamingProjectId(null);
    setRenameProjectValue('');
    setProjectActionsMenuId(null);
    setRenamingWorkspaceId(null);
    setWorkspaceRenameValue('');
    setWorkspaceActionsMenuId(null);
  }, []);

  const handleOpenCommandMenu = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }
    closeWorkspaceProjectPopover();
    setShowCommandMenu(true);
  }, [closeWorkspaceProjectPopover, isAuthenticated]);

  const settleProjectCreationRequest = useCallback((projectId?: string) => {
    const pendingRequest = pendingProjectCreationRequestRef.current;
    if (!pendingRequest) {
      return;
    }

    pendingProjectCreationRequestRef.current = null;
    pendingRequest.resolve(projectId);
  }, []);

  const closeCreateProjectDialog = useCallback(() => {
    setShowCreateProjectDialog(false);
    setNewProjectName('');
    setNewProjectSourceFolder(null);
    settleProjectCreationRequest();
  }, [settleProjectCreationRequest]);

  useEffect(() => () => {
    const pendingRequest = pendingProjectCreationRequestRef.current;
    pendingProjectCreationRequestRef.current = null;
    pendingRequest?.resolve(undefined);
  }, []);

  const closeCreateWorkspaceDialog = useCallback(() => {
    setShowCreateWorkspaceDialog(false);
    setNewWorkspaceName('');
  }, []);

  const resolvedProjectId = selectedWorkspaceId
    ? resolveStartupProjectId({
        hasProjectsFetched: projectsHasFetched,
        projects,
        recoverySnapshot: normalizedRecoverySnapshot,
      })
    : '';
  const effectiveProjectId = (scopedActiveProjectId || resolvedProjectId).trim();
  const activeProjectAgentSessions =
    projectsIndex.projectsById.get(effectiveProjectId)?.agentSessions ?? [];
  const resolvedAgentSessionId = resolveStartupAgentSessionId({
    projectId: effectiveProjectId,
    projects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const hasInitializedActiveAgentSessionSelection = Boolean(
    effectiveProjectId &&
    activeAgentSessionSelectionProjectIdRef.current === effectiveProjectId,
  );
  const effectiveAgentSessionId = (
    hasInitializedActiveAgentSessionSelection
      ? scopedActiveAgentSessionId
      : resolvedAgentSessionId
  ).trim();
  const effectiveAgentSessionRuntimeLocationId = activeProjectAgentSessions.find(
    (agentSession) => agentSession.id === effectiveAgentSessionId,
  )?.runtimeLocationId;
  const currentUserFallbackRecoverySnapshot =
    lastPersistedRecoverySnapshotRef.current?.userScope === currentWorkbenchUserScope
      ? lastPersistedRecoverySnapshotRef.current
      : normalizedRecoverySnapshot;
  const persistedRecoverySelection = useMemo(() => resolveWorkbenchRecoveryPersistenceSelection({
      currentWorkspaceId: selectedWorkspaceId,
      currentProjectId: effectiveProjectId,
      currentAgentSessionId: effectiveAgentSessionId,
      fallbackSnapshot: currentUserFallbackRecoverySnapshot,
      hasProjectsFetched: projectsHasFetched,
      hasWorkspacesFetched: workspacesHasFetched,
    }), [
      currentUserFallbackRecoverySnapshot,
      effectiveAgentSessionId,
      effectiveProjectId,
      projectsHasFetched,
      selectedWorkspaceId,
      workspacesHasFetched,
    ]);
  const recoverySelectionResolutionReady = useMemo(
    () => isWorkbenchRecoverySelectionResolutionReady({
      currentWorkspaceId: selectedWorkspaceId,
      hasProjectsFetched: projectsHasFetched,
      hasWorkspacesFetched: workspacesHasFetched,
    }),
    [projectsHasFetched, selectedWorkspaceId, workspacesHasFetched],
  );
  const recoveryAnnouncement = buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: normalizedRecoverySnapshot,
    activeProjectId: effectiveProjectId,
    activeAgentSessionId: effectiveAgentSessionId,
  });

  const activateImportedProject = useCallback(
    (projectId: string) => {
      pendingImportedProjectIdRef.current = projectId;
      setActiveProjectId(projectId);

      const latestAgentSessionId =
        projectsIndex.latestAgentSessionIdByProjectId.get(projectId) ?? null;
      commitActiveAgentSessionSelection(projectId, latestAgentSessionId ?? '');
    },
    [commitActiveAgentSessionSelection, projectsIndex],
  );

  const importProjectProviderSessionsAndSelect = useCallback(
    async (projectId: string) => {
      if (pendingImportedProjectIdRef.current !== projectId) {
        return null;
      }

      const importedInventory = await importProjectProviderSessions({
        agentSessionService,
        knownProjects: projects,
        projectId,
        projectService,
        userScope: currentWorkbenchSessionScope,
        workspaceId: selectedWorkspaceId,
      });
      if (!importedInventory) {
        throw new Error('The imported project Session inventory could not be refreshed.');
      }
      if (pendingImportedProjectIdRef.current !== projectId) {
        return importedInventory;
      }

      commitActiveAgentSessionSelection(
        projectId,
        importedInventory.latestAgentSessionId ?? '',
      );
      pendingImportedProjectIdRef.current = '';
      return importedInventory;
    },
    [
      agentSessionService,
      projects,
      projectService,
      commitActiveAgentSessionSelection,
      currentWorkbenchSessionScope,
      selectedWorkspaceId,
    ],
  );

  useEffect(() => {
    const previousWorkbenchSessionScope = previousWorkbenchSessionScopeRef.current;
    if (previousWorkbenchSessionScope === currentWorkbenchSessionScope) {
      return;
    }

    previousWorkbenchSessionScopeRef.current = currentWorkbenchSessionScope;
    pendingImportedProjectIdRef.current = '';
    lastPersistedRecoverySnapshotRef.current = null;
    hasAnnouncedRecoveryRef.current = false;
    setActiveProjectId('');
    clearActiveAgentSessionSelection();
    setProjectActionsMenuId(null);
    setShowWorkspaceProjectPopover(false);
  }, [clearActiveAgentSessionSelection, currentWorkbenchSessionScope]);

  const previousSelectedWorkspaceIdRef = useRef(selectedWorkspaceId);
  useEffect(() => {
    const previousWorkspaceId = previousSelectedWorkspaceIdRef.current;
    previousSelectedWorkspaceIdRef.current = selectedWorkspaceId;
    if (!previousWorkspaceId || previousWorkspaceId === selectedWorkspaceId) {
      return;
    }

    pendingImportedProjectIdRef.current = '';
    setActiveProjectId('');
    clearActiveAgentSessionSelection();
  }, [
    clearActiveAgentSessionSelection,
    selectedWorkspaceId,
  ]);

  useEffect(() => {
    if (!isRecoveryHydrated || recoverySessionIdRef.current) {
      return;
    }

    recoverySessionIdRef.current =
      normalizedRecoverySnapshot.sessionId || createWorkbenchRecoverySessionId();
    lastPersistedRecoverySnapshotRef.current = buildWorkbenchRecoverySnapshot({
      userScope: currentWorkbenchUserScope,
      sessionId: recoverySessionIdRef.current,
      activeTab: normalizedRecoverySnapshot.activeTab,
      activeWorkspaceId: normalizedRecoverySnapshot.activeWorkspaceId,
      activeProjectId: normalizedRecoverySnapshot.activeProjectId,
      activeAgentSessionId: normalizedRecoverySnapshot.activeAgentSessionId,
      cleanExit: normalizedRecoverySnapshot.cleanExit,
    });
  }, [currentWorkbenchUserScope, isRecoveryHydrated, normalizedRecoverySnapshot]);

  useEffect(() => {
    if (
      !isRecoveryHydrated ||
      !recoverySelectionResolutionReady ||
      hasAnnouncedRecoveryRef.current ||
      !recoveryAnnouncement
    ) {
      return;
    }

    hasAnnouncedRecoveryRef.current = true;
    addToast(recoveryAnnouncement, 'info');
  }, [
    addToast,
    isRecoveryHydrated,
    recoveryAnnouncement,
    recoverySelectionResolutionReady,
  ]);

  useEffect(() => {
    if (!isRecoveryProjectInventoryReady) {
      return;
    }

    if (projects.length === 0) {
      if (pendingImportedProjectIdRef.current) {
        return;
      }
      if (activeProjectId) {
        setActiveProjectId('');
      }
      return;
    }

    if (
      activeProjectId &&
      !projectsIndex.projectsById.has(activeProjectId) &&
      projectsHasMore
    ) {
      return;
    }

    if (
      pendingImportedProjectIdRef.current &&
      projectsIndex.projectsById.has(pendingImportedProjectIdRef.current)
    ) {
      pendingImportedProjectIdRef.current = '';
    }

    if (!projectsIndex.projectsById.has(activeProjectId) && resolvedProjectId) {
      setActiveProjectId(resolvedProjectId);
    }
  }, [
    activeProjectId,
    isRecoveryProjectInventoryReady,
    projects,
    projectsHasMore,
    projectsIndex,
    resolvedProjectId,
  ]);

  useEffect(() => {
    if (!isRecoveryProjectInventoryReady) {
      return;
    }

    if (!effectiveProjectId) {
      if (activeAgentSessionId || activeAgentSessionSelectionProjectIdRef.current) {
        clearActiveAgentSessionSelection();
      }
      return;
    }

    if (hasInitializedActiveAgentSessionSelection) {
      return;
    }

    commitActiveAgentSessionSelection(effectiveProjectId, resolvedAgentSessionId);
  }, [
    activeAgentSessionId,
    clearActiveAgentSessionSelection,
    commitActiveAgentSessionSelection,
    effectiveProjectId,
    hasInitializedActiveAgentSessionSelection,
    isRecoveryProjectInventoryReady,
    resolvedAgentSessionId,
  ]);

  const clearPendingRecoverySnapshotPersistence = useCallback(() => {
    if (
      recoverySnapshotPersistTimeoutRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(recoverySnapshotPersistTimeoutRef.current);
      recoverySnapshotPersistTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRecoveryHydrated) {
      return;
    }

    const nextRecoverySnapshot = buildWorkbenchRecoverySnapshot({
      userScope: currentWorkbenchUserScope,
      sessionId:
        recoverySessionIdRef.current ||
      normalizedRecoverySnapshot.sessionId ||
      createWorkbenchRecoverySessionId(),
      activeTab,
      activeWorkspaceId: persistedRecoverySelection.activeWorkspaceId,
      activeProjectId: persistedRecoverySelection.activeProjectId,
      activeAgentSessionId: persistedRecoverySelection.activeAgentSessionId,
      cleanExit: false,
    });

    recoverySessionIdRef.current = nextRecoverySnapshot.sessionId;

    if (
      lastPersistedRecoverySnapshotRef.current &&
      recoverySnapshotsEqual(lastPersistedRecoverySnapshotRef.current, nextRecoverySnapshot)
    ) {
      return;
    }

    lastPersistedRecoverySnapshotRef.current = nextRecoverySnapshot;
    if (typeof window === 'undefined') {
      persistWorkbenchRecoverySnapshot(nextRecoverySnapshot);
      return;
    }

    clearPendingRecoverySnapshotPersistence();
    recoverySnapshotPersistTimeoutRef.current = window.setTimeout(() => {
      recoverySnapshotPersistTimeoutRef.current = null;
      persistWorkbenchRecoverySnapshot(nextRecoverySnapshot);
    }, WORKBENCH_RECOVERY_PERSIST_DELAY_MS);
  }, [
    activeTab,
    clearPendingRecoverySnapshotPersistence,
    currentWorkbenchUserScope,
    isRecoveryHydrated,
    normalizedRecoverySnapshot,
    persistedRecoverySelection,
  ]);

  useEffect(() => {
    return () => {
      clearPendingRecoverySnapshotPersistence();
    };
  }, [clearPendingRecoverySnapshotPersistence]);

  useEffect(() => {
    if (!isRecoveryHydrated || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      clearPendingRecoverySnapshotPersistence();
      persistWorkbenchRecoverySnapshot(
        buildWorkbenchRecoverySnapshot({
          userScope: currentWorkbenchUserScope,
          sessionId:
            recoverySessionIdRef.current ||
            normalizedRecoverySnapshot.sessionId ||
            createWorkbenchRecoverySessionId(),
          activeTab,
          activeWorkspaceId: persistedRecoverySelection.activeWorkspaceId,
          activeProjectId: persistedRecoverySelection.activeProjectId,
          activeAgentSessionId: persistedRecoverySelection.activeAgentSessionId,
          cleanExit: true,
        }),
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    activeTab,
    clearPendingRecoverySnapshotPersistence,
    currentWorkbenchUserScope,
    isRecoveryHydrated,
    normalizedRecoverySnapshot.sessionId,
    persistedRecoverySelection,
  ]);

  useEffect(() => {
    const focusTerminalSurface = (options?: { forceProjectTerminal?: boolean }) => {
      setActiveTab((previousTab) => {
        if (options?.forceProjectTerminal) {
          return 'terminal';
        }

        if (
          previousTab !== 'terminal' &&
          previousTab !== 'code' &&
          previousTab !== 'studio'
        ) {
          return 'terminal';
        }

        return previousTab;
      });
    };
    const handleOpenTerminal = () => {
      focusTerminalSurface();
    };
    const handleRevealInExplorer = async (path?: string) => {
      try {
        if (await revealTauriPathInFileManager(path || '')) {
          addToast(t('app.revealedInExplorer', { path: path || 'project' }), 'info');
          return;
        }
        addToast(t('app.revealInExplorerDesktopOnly'), 'info');
      } catch {
        addToast(t('app.revealInExplorerDesktopOnly'), 'info');
      }
    };
    const copyLocalPath = copyTextToClipboard;
    const handleOpenProjectTerminal = async (target: ProjectDeviceMountTarget) => {
      if (resolveBirdcoderWorkbenchHostMode() === 'web') {
        emitOpenTerminalRequest({
          surface: 'project',
          timestamp: Date.now(),
        });
        return;
      }

      const resolution = await projectRuntimeLocationService.resolveProjectRuntimeLocation(
        target,
        {
          allowFolderSelection: false,
          capability: 'terminal',
        },
      );
      if (resolution.status === 'cancelled') {
        return;
      }
      if (resolution.status !== 'resolved') {
        addToast(
          resolution.status === 'unsupported'
            ? resolution.message
            : resolution.message || t('app.revealInExplorerDesktopOnly'),
          'error',
        );
        return;
      }

      emitOpenTerminalRequest({
        path: resolution.location.localWorkingDirectory,
        surface: 'project',
        timestamp: Date.now(),
      });
      focusTerminalSurface({ forceProjectTerminal: true });
    };
    const handleRevealProjectInFileManager = async (target: ProjectDeviceMountTarget) => {
      if (!(await projectRuntimeLocationService.revealProjectInFileManager(target))) {
        addToast(t('app.revealInExplorerDesktopOnly'), 'info');
        return;
      }

      addToast(t('app.revealedInExplorer', { path: 'project' }), 'info');
    };
    const handleCopyProjectLocalPath = async (target: ProjectDeviceMountTarget) => {
      const localWorkingDirectory =
        await projectRuntimeLocationService.resolveProjectLocalWorkingDirectory(target, {
          allowFolderSelection: false,
          capability: 'file_system',
        });
      if (!localWorkingDirectory || !(await copyLocalPath(localWorkingDirectory))) {
        addToast(t('code.projectFolderUnavailable'), 'error');
        return;
      }

      addToast('Copied local path', 'success');
    };
    const handleOpenSettings = (requestedTab?: unknown) => {
      if (isSettingsTab(requestedTab)) {
        setSettingsTab(requestedTab);
      }
      setActiveTab('settings');
    };
    const handleOpenWorkResources = () => {
      setActiveTab('work-resources');
    };
    const handleTerminalRequest = (req: TerminalCommandRequest) => {
      if (!isProjectTerminalRequest(req)) {
        return;
      }

      setTerminalRequest(req);
      focusTerminalSurface({ forceProjectTerminal: true });
    };
    const unsubscribeProjectMountRecovery = subscribeProjectMountRecoveryState((payload) => {
      if (payload.state.status !== 'recovering') {
        if (
          projectMountRecoveryActiveSurfaceRef.current &&
          projectMountRecoveryActiveSurfaceRef.current !== payload.surface
        ) {
          return;
        }

        projectMountRecoveryActiveSurfaceRef.current = '';
        projectMountRecoveryIdentityRef.current = '';
        setProjectMountRecoveryNotice(null);
        setProjectMountRecoveryStartedAt(null);
        return;
      }

      projectMountRecoveryActiveSurfaceRef.current = payload.surface;
        const recoveryIdentity = [
          payload.surface,
          payload.projectId ?? '',
          payload.state.displayName ?? '',
        ].join('::');
      if (projectMountRecoveryIdentityRef.current !== recoveryIdentity) {
        projectMountRecoveryIdentityRef.current = recoveryIdentity;
        setProjectMountRecoveryStartedAt(Date.now());
      }

      setProjectMountRecoveryNotice(payload);
    });
    const unsubscribeTerminal = globalEventBus.on('openTerminal', handleOpenTerminal);
    const unsubscribeReveal = globalEventBus.on('revealInExplorer', handleRevealInExplorer);
    const unsubscribeProjectTerminal = subscribeOpenProjectTerminal(handleOpenProjectTerminal);
    const unsubscribeProjectReveal = subscribeRevealProjectInFileManager(
      handleRevealProjectInFileManager,
    );
    const unsubscribeProjectPathCopy = subscribeCopyProjectLocalPath(handleCopyProjectLocalPath);
    const unsubscribeSettings = globalEventBus.on('openSettings', handleOpenSettings);
    const unsubscribeWorkResources = globalEventBus.on('openWorkResources', handleOpenWorkResources);
    const unsubscribeTerminalReq = globalEventBus.on('terminalRequest', handleTerminalRequest);
    return () => {
      unsubscribeProjectMountRecovery();
      unsubscribeTerminal();
      unsubscribeReveal();
      unsubscribeProjectTerminal();
      unsubscribeProjectReveal();
      unsubscribeProjectPathCopy();
      unsubscribeSettings();
      unsubscribeWorkResources();
      unsubscribeTerminalReq();
    };
  }, [addToast, projectRuntimeLocationService, setSettingsTab, t]);

  const hasOpenHeaderSelectionSurface =
    showWorkspaceProjectPopover ||
    projectActionsMenuId !== null ||
    workspaceActionsMenuId !== null ||
    renamingWorkspaceId !== null;

  const handleCreateTerminal = useCallback(async () => {
    if (!effectiveProjectId) {
      addToast('Select a project before opening a terminal.', 'error');
      return;
    }

    if (resolveBirdcoderWorkbenchHostMode() === 'web') {
      emitOpenTerminalRequest({
        surface: 'project',
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const resolution = await projectRuntimeLocationService.resolveProjectRuntimeLocation(
        { projectId: effectiveProjectId },
        {
          allowFolderSelection: false,
          capability: 'terminal',
        },
      );
      if (resolution.status === 'cancelled') {
        return;
      }
      if (resolution.status !== 'resolved') {
        addToast(resolution.message, 'error');
        return;
      }
      emitOpenTerminalRequest(
        buildDefaultTerminalCommandRequest({
          path: resolution.location.localWorkingDirectory,
        }),
      );
    } catch (error) {
      console.error('Failed to create a project terminal', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to prepare the selected project folder for terminal access.',
        'error',
      );
    }
  }, [addToast, effectiveProjectId, projectRuntimeLocationService]);

  const handleWorkspaceProjectPopoverClickOutside = useCallback(
    (event: MouseEvent) => {
      if (showCreateWorkspaceDialog) {
        return;
      }
      const target = event.target as Node;
      const isInsidePopover = workspaceProjectPopoverRef.current?.contains(target) ?? false;
      if (!isInsidePopover) {
        closeWorkspaceProjectPopover();
      }
    },
    [closeWorkspaceProjectPopover, showCreateWorkspaceDialog],
  );

  useEffect(() => {
    if (!hasOpenHeaderSelectionSurface) {
      return;
    }

    document.addEventListener('mousedown', handleWorkspaceProjectPopoverClickOutside);
    return () => document.removeEventListener('mousedown', handleWorkspaceProjectPopoverClickOutside);
  }, [handleWorkspaceProjectPopoverClickOutside, hasOpenHeaderSelectionSurface]);

  useEffect(() => {
    if (!hasOpenHeaderSelectionSurface) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showCreateWorkspaceDialog) {
        closeWorkspaceProjectPopover();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeWorkspaceProjectPopover, hasOpenHeaderSelectionSurface, showCreateWorkspaceDialog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const command = resolveKeyboardShortcutCommand(
        event,
        keyboardShortcutBindings,
        isMacKeyboard,
      );
      if (!command) {
        return;
      }

      event.preventDefault();
      if (event.repeat) {
        return;
      }

      const emitCodeSurfaceEvent = (eventName: string) => {
        if (activeTab === 'code') {
          globalEventBus.emit(eventName);
          return;
        }
        setActiveTab('code');
        window.setTimeout(() => globalEventBus.emit(eventName), 0);
      };
      const emitTaskNavigationEvent = (eventName: string) => {
        if (activeTab === 'code' || activeTab === 'studio') {
          globalEventBus.emit(eventName);
          return;
        }
        setActiveTab('code');
        window.setTimeout(() => globalEventBus.emit(eventName), 0);
      };

      switch (command) {
        case 'newSession':
          void createAgentSessionCommandRef.current({ source: 'keyboard-shortcut' });
          break;
        case 'openFolder':
          openFolderHandlerRef.current();
          break;
        case 'openCommandMenu':
          handleOpenCommandMenu();
          break;
        case 'openSettings':
          setSettingsTab('general');
          setActiveTab('settings');
          break;
        case 'showKeyboardShortcuts':
          setSettingsTab('shortcuts');
          setActiveTab('settings');
          break;
        case 'saveActiveFile':
          emitCodeSurfaceEvent('saveActiveFile');
          break;
        case 'saveAllFiles':
          emitCodeSurfaceEvent('saveAllFiles');
          break;
        case 'toggleSidebar':
          emitCodeSurfaceEvent('toggleSidebar');
          break;
        case 'toggleTerminal':
          emitCodeSurfaceEvent('toggleTerminal');
          break;
        case 'toggleReview':
          emitCodeSurfaceEvent('toggleDiffPanel');
          break;
        case 'findInSessionTranscript':
          globalEventBus.emit('findInSessionTranscript');
          break;
        case 'findInFiles':
          emitCodeSurfaceEvent('findInFiles');
          break;
        case 'openQuickOpen':
          emitCodeSurfaceEvent('openQuickOpen');
          break;
        case 'previousAgentSession':
          emitTaskNavigationEvent('previousAgentSession');
          break;
        case 'nextAgentSession':
          emitTaskNavigationEvent('nextAgentSession');
          break;
        case 'historyBack':
          window.history.back();
          break;
        case 'historyForward':
          window.history.forward();
          break;
        case 'zoomIn':
          zoomHandlerRef.current('in');
          break;
        case 'zoomOut':
          zoomHandlerRef.current('out');
          break;
        case 'zoomReset':
          zoomHandlerRef.current('reset');
          break;
        case 'toggleFullScreen':
          toggleFullScreenHandlerRef.current();
          break;
        case 'startDebugging':
          emitCodeSurfaceEvent('startDebugging');
          break;
        case 'runWithoutDebugging':
          emitCodeSurfaceEvent('runWithoutDebugging');
          break;
        case 'createTerminal':
          void handleCreateTerminal();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleCreateTerminal, handleOpenCommandMenu, isMacKeyboard, keyboardShortcutBindings]);

  const selectFolderAndImportProject = useCallback(async (fallbackProjectName: string) => {
    if (!selectedWorkspaceId) {
      throw new Error('Select a Workspace before importing a Project.');
    }
    const selection = await selectProjectDirectory({
      pickSandboxDirectory: pickDirectory,
      sandboxPickerTitle: t('app.selectServerDirectory'),
    });
    if (!selection) {
      return null;
    }

    return importSelectedProjectDirectory({
      bindLocalProjectRuntimeLocation: (projectId, source) =>
        projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
      ensureProject,
      fallbackProjectName,
      importPort: { importProject },
      selection,
      workspaceId: selectedWorkspaceId,
    });
  }, [
    ensureProject,
    importProject,
    pickDirectory,
    projectRuntimeLocationService,
    selectedWorkspaceId,
    t,
  ]);

  const handleSelectProjectSourceFolder = useCallback(async () => {
    if (isProjectFolderPickerPending || isProjectCreationPending) {
      return;
    }

    setIsProjectFolderPickerPending(true);
    try {
      const selection = await selectProjectDirectory({
        pickSandboxDirectory: pickDirectory,
        sandboxPickerTitle: t('app.selectServerDirectory'),
      });
      if (!selection) {
        return;
      }

      const folderName = resolveProjectDirectorySelectionName(selection, t('app.localFolder'));
      setNewProjectSourceFolder(selection);
      setNewProjectName((currentName) => currentName.trim() ? currentName : folderName);
    } catch (error) {
      console.error('Failed to select project source folder', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('app.failedToSelectSourceFolder'),
        'error',
      );
    } finally {
      setIsProjectFolderPickerPending(false);
    }
  }, [addToast, isProjectCreationPending, isProjectFolderPickerPending, pickDirectory, t]);

  const handleCreateProject = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedProjectName = newProjectName.trim();
    if (!normalizedProjectName || isProjectCreationPending) {
      return;
    }

    setIsProjectCreationPending(true);
    try {
      if (newProjectSourceFolder) {
        if (!selectedWorkspaceId) {
          throw new Error(t('app.selectWorkspaceBeforeCreatingProject'));
        }
        const importedProject = await importSelectedProjectDirectory({
          bindLocalProjectRuntimeLocation: (projectId, source) =>
            projectRuntimeLocationService.bindLocalProjectRuntimeLocation(projectId, source),
          ensureProject,
          fallbackProjectName: normalizedProjectName,
          importPort: { importProject },
          projectName: normalizedProjectName,
          selection: newProjectSourceFolder,
          workspaceId: selectedWorkspaceId,
        });
        activateImportedProject(importedProject.projectId);
        const importedInventory = await importProjectProviderSessionsAndSelect(
          importedProject.projectId,
        );
        const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
        settleProjectCreationRequest(importedProject.projectId);
        closeCreateProjectDialog();
        addToast(
          failedSessionCount
            ? t('app.providerSessionsPartiallyImported', {
                count: failedSessionCount,
                name: importedProject.projectName,
              })
            : t('app.folderProjectCreated', { name: importedProject.projectName }),
          failedSessionCount ? 'info' : 'success',
        );
      } else {
        const project = await createProject(normalizedProjectName);
        activateImportedProject(project.projectId);
        settleProjectCreationRequest(project.projectId);
        closeCreateProjectDialog();
        addToast(t('app.projectCreated'), 'success');
      }
    } catch (error) {
      console.error('Failed to create project', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : newProjectSourceFolder
            ? t('app.failedToCreateProjectFromFolder')
            : t('app.failedToCreateProject'),
        'error',
      );
    } finally {
      setIsProjectCreationPending(false);
    }
  }, [
    activateImportedProject,
    addToast,
    closeCreateProjectDialog,
    createProject,
    ensureProject,
    importProjectProviderSessionsAndSelect,
    importProject,
    isProjectCreationPending,
    newProjectName,
    newProjectSourceFolder,
    projectRuntimeLocationService,
    selectedWorkspaceId,
    settleProjectCreationRequest,
    t,
  ]);

  const confirmRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjectToRemove(id);
    closeWorkspaceProjectPopover();
  };

  const handleRenameProject = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await renameProject(id, newName.trim());
    } catch (error) {
      console.error("Failed to rename project", error);
      addToast(t('app.failedToRenameProject'), "error");
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      await archiveProject(projectId);
      await refreshProjects();
      if (activeProjectId === projectId) {
        setActiveProjectId('');
        clearActiveAgentSessionSelection();
      }
    } catch (error) {
      console.error('Failed to archive project', error);
      addToast(t('app.failedToDeleteProject'), 'error');
    }
  };

  const executeRemoveProject = async () => {
    if (!projectToRemove) return;
    try {
      await deleteProject(projectToRemove);
      if (activeProjectId === projectToRemove) {
        setActiveProjectId('');
        clearActiveAgentSessionSelection();
      }
      addToast(t('app.projectRemoved'), 'success');
    } catch (error) {
      console.error('Failed to remove project', error);
      addToast(t('app.failedToRemoveProject'), 'error');
    } finally {
      setProjectToRemove(null);
    }
  };

  const handleOpenProjectInExplorer = useCallback(
    (projectId: string, projectName?: string) => {
      const normalizedProjectId = projectId.trim();
      if (!normalizedProjectId) {
        addToast(t('app.projectPathUnavailable', { name: projectName ?? 'project' }), 'error');
        return;
      }

      emitRevealProjectInFileManager({ projectId: normalizedProjectId });
    },
    [addToast, t],
  );

  const handleSelectPopoverProject = useCallback(
    (projectId: string) => {
      const nextProjectId = projectId.trim();
      if (
        !nextProjectId ||
        !projectsIndex.projectsById.has(nextProjectId)
      ) {
        return;
      }

      const nextAgentSessionId =
        projectsIndex.latestAgentSessionIdByProjectId.get(nextProjectId) ?? '';
      const shouldResetAgentSession = nextProjectId !== effectiveProjectId;

      setActiveProjectId(nextProjectId);
      if (shouldResetAgentSession || nextAgentSessionId) {
        commitActiveAgentSessionSelection(nextProjectId, nextAgentSessionId);
      }
      closeWorkspaceProjectPopover();
    },
    [
      effectiveProjectId,
      closeWorkspaceProjectPopover,
      commitActiveAgentSessionSelection,
      projectsIndex,
    ],
  );

  const getDesktopWindow = useCallback(async (): Promise<DesktopWindowHandle | null> => {
    if (desktopWindowHandleRef.current) {
      return desktopWindowHandleRef.current;
    }

    if (desktopWindowPromiseRef.current) {
      return desktopWindowPromiseRef.current;
    }

    const desktopWindowPromise = (async () => {
      const { isTauri } = await import('@tauri-apps/api/core');
      if (!isTauri()) {
        return null;
      }

      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const desktopWindow = getCurrentWindow() as DesktopWindowHandle;
      desktopWindowHandleRef.current = desktopWindow;
      return desktopWindow;
    })();

    desktopWindowPromiseRef.current = desktopWindowPromise;

    try {
      return await desktopWindowPromise;
    } catch (error) {
      desktopWindowPromiseRef.current = null;
      desktopWindowHandleRef.current = null;
      throw error;
    }
  }, []);

  const applyDesktopWindowFrameState = useCallback(
    (nextState: {
      isAvailable: boolean;
      isMaximized: boolean;
      isMinimized: boolean;
    }) => {
      isDesktopWindowAvailableRef.current = nextState.isAvailable;
      isDesktopWindowMaximizedRef.current = nextState.isMaximized;
      isDesktopWindowMinimizedRef.current = nextState.isMinimized;
      setIsDesktopWindowAvailable(nextState.isAvailable);
      setIsDesktopWindowMaximized(nextState.isMaximized);
      setIsDesktopWindowMinimized(nextState.isMinimized);
    },
    [],
  );

  const syncDesktopWindowFrameState = useCallback(
    async (
      desktopWindow: DesktopWindowHandle,
      options: { force?: boolean } = {},
    ) => {
      const force = options.force === true;
      const now = readDesktopWindowFrameStateClockMs();

      if (!force && desktopWindowFrameStateSyncPromiseRef.current) {
        return desktopWindowFrameStateSyncPromiseRef.current;
      }

      if (
        !force &&
        isDesktopWindowAvailableRef.current &&
        desktopWindowFrameStateLastVerifiedAtRef.current > 0 &&
        now - desktopWindowFrameStateLastVerifiedAtRef.current < DESKTOP_WINDOW_FRAME_STATE_CACHE_TTL_MS
      ) {
        return Promise.resolve();
      }

      const syncToken = ++desktopWindowStateSyncTokenRef.current;
      const syncPromise = (async () => {
        const [nextIsMaximized, nextIsMinimized] = await Promise.all([
          desktopWindow.isMaximized(),
          desktopWindow.isMinimized(),
        ]);

        if (syncToken !== desktopWindowStateSyncTokenRef.current) {
          return;
        }

        desktopWindowFrameStateLastVerifiedAtRef.current = readDesktopWindowFrameStateClockMs();
        applyDesktopWindowFrameState({
          isAvailable: true,
          isMaximized: nextIsMaximized,
          isMinimized: nextIsMinimized,
        });
      })().finally(() => {
        if (desktopWindowFrameStateSyncPromiseRef.current === syncPromise) {
          desktopWindowFrameStateSyncPromiseRef.current = null;
        }
      });

      desktopWindowFrameStateSyncPromiseRef.current = syncPromise;
      return syncPromise;
    },
    [applyDesktopWindowFrameState],
  );

  const cancelDesktopWindowFrameStateReconciliation = useCallback(() => {
    if (
      desktopWindowFrameStateReconciliationTimeoutRef.current !== null &&
      typeof window !== 'undefined'
    ) {
      window.clearTimeout(desktopWindowFrameStateReconciliationTimeoutRef.current);
      desktopWindowFrameStateReconciliationTimeoutRef.current = null;
    }
  }, []);

  const scheduleDesktopWindowFrameStateReconciliation = (
    desktopWindow: DesktopWindowHandle,
  ) => {
    if (typeof window === 'undefined') {
      void syncDesktopWindowFrameState(desktopWindow);
      return;
    }

    if (desktopWindowFrameStateReconciliationTimeoutRef.current !== null) {
      clearTimeout(desktopWindowFrameStateReconciliationTimeoutRef.current);
    }

    desktopWindowFrameStateReconciliationTimeoutRef.current = setTimeout(() => {
      desktopWindowFrameStateReconciliationTimeoutRef.current = null;
      void syncDesktopWindowFrameState(desktopWindow);
    }, DESKTOP_WINDOW_FRAME_STATE_RECONCILIATION_DELAY_MS);
  };

  useEffect(() => {
    let cancelled = false;
    const unlistenCallbacks: Array<() => void> = [];

    const cancelPendingWork = () => {
      if (typeof window === 'undefined') {
        if (desktopWindowFrameStateReconciliationTimeoutRef.current === null) {
          return;
        }
      }

      cancelDesktopWindowFrameStateReconciliation();
    };

    const registerWindowListener = async (
      register: Promise<() => void>,
    ) => {
      const unlisten = await register;
      if (cancelled) {
        unlisten();
        return;
      }

      unlistenCallbacks.push(unlisten);
    };

    void (async () => {
      try {
        const desktopWindow = await getDesktopWindow();
        if (cancelled) {
          return;
        }

        if (!desktopWindow) {
          applyDesktopWindowFrameState({
            isAvailable: false,
            isMaximized: false,
            isMinimized: false,
          });
          return;
        }

        await syncDesktopWindowFrameState(desktopWindow, { force: true });
        await registerWindowListener(
          desktopWindow.onResized(() => {
            scheduleDesktopWindowFrameStateReconciliation(desktopWindow);
          }),
        );
        await registerWindowListener(
          desktopWindow.onScaleChanged(() => {
            scheduleDesktopWindowFrameStateReconciliation(desktopWindow);
          }),
        );
      } catch {
        if (cancelled) {
          return;
        }

        applyDesktopWindowFrameState({
          isAvailable: false,
          isMaximized: false,
          isMinimized: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      cancelPendingWork();
      desktopWindowStateSyncTokenRef.current += 1;
      desktopWindowFrameStateSyncPromiseRef.current = null;
      for (const unlisten of unlistenCallbacks) {
        unlisten();
      }
    };
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    syncDesktopWindowFrameState,
    getDesktopWindow,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const syncFullscreenState = () => {
      const nextIsFullscreen = Boolean(document.fullscreenElement);
      isDocumentFullscreenRef.current = nextIsFullscreen;
      setIsDocumentFullscreen(nextIsFullscreen);
      if (nextIsFullscreen) {
        titleBarWindowDragControllerRef.current?.cancel();
      }
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  useNativeWindowControlsBridge({
    enabled: isDesktopWindowAvailable,
    isFullscreen: isDocumentFullscreen,
    minimizeButtonRef: minimizeWindowControlButtonRef,
    maximizeButtonRef: maximizeWindowControlButtonRef,
    closeButtonRef: closeWindowControlButtonRef,
  });

  if (titleBarWindowDragControllerRef.current === null) {
    titleBarWindowDragControllerRef.current = createAppHeaderWindowDragController({
      canStartDragging: () => isDesktopWindowAvailableRef.current && !isDocumentFullscreenRef.current,
      startDragging: () => {
        try {
          const desktopWindow = desktopWindowHandleRef.current;
          if (desktopWindow) {
            void desktopWindow.startDragging().catch((error) => {
              console.warn('Failed to start window dragging', error);
            });
            return;
          }

          void getDesktopWindow()
            .then((resolvedDesktopWindow) => {
              if (!resolvedDesktopWindow) {
                return undefined;
              }

              return resolvedDesktopWindow.startDragging();
            })
            .catch((error) => {
              console.warn('Failed to start window dragging', error);
            });
        } catch (error) {
          console.warn('Failed to start window dragging', error);
        }
      },
    });
  }

  useEffect(() => {
    const titleBarWindowDragController = titleBarWindowDragControllerRef.current;
    return () => {
      titleBarWindowDragController?.dispose();
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      cancelDesktopWindowFrameStateReconciliation();
      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: isDesktopWindowMaximizedRef.current,
        isMinimized: true,
      });
      const handledByNativeBridge = await performNativeWindowControlAction('minimize');
      if (!handledByNativeBridge) {
        await desktopWindow.minimize();
      }
      await syncDesktopWindowFrameState(desktopWindow, { force: true });
    } catch (error) {
      console.warn('Failed to minimize desktop window', error);
    }
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    getDesktopWindow,
    syncDesktopWindowFrameState,
  ]);

  const handleMaximize = useCallback(async () => {
    try {
      if (desktopWindowToggleInFlightRef.current) {
        return;
      }

      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      desktopWindowToggleInFlightRef.current = true;
      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: !isDesktopWindowMaximizedRef.current,
        isMinimized: false,
      });
      cancelDesktopWindowFrameStateReconciliation();

      const settleDesktopWindowToggle = () => {
        desktopWindowToggleInFlightRef.current = false;
        return syncDesktopWindowFrameState(desktopWindow, { force: true });
      };

      const recoverDesktopWindowToggleFailure = (error: unknown) => {
        desktopWindowToggleInFlightRef.current = false;
        console.warn('Failed to toggle desktop window maximize state', error);
        return syncDesktopWindowFrameState(desktopWindow, { force: true });
      };

      void performNativeWindowControlAction('toggleMaximize')
        .then((handledByNativeBridge) => {
          if (handledByNativeBridge) {
            return settleDesktopWindowToggle();
          }

          void desktopWindow
            .toggleMaximize()
            .then(() => {
              void settleDesktopWindowToggle();
            })
            .catch((error) => {
              void recoverDesktopWindowToggleFailure(error);
            });

          return undefined;
        })
        .catch((error) => {
          void recoverDesktopWindowToggleFailure(error);
        });
    } catch (error) {
      desktopWindowToggleInFlightRef.current = false;
      console.warn('Failed to toggle desktop window maximize state', error);
    }
  }, [
    applyDesktopWindowFrameState,
    cancelDesktopWindowFrameStateReconciliation,
    getDesktopWindow,
    syncDesktopWindowFrameState,
  ]);

  const handleClose = useCallback(async () => {
    try {
      const handledByNativeBridge = await performNativeWindowControlAction('close');
      if (handledByNativeBridge) {
        return;
      }

      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        window.close();
        return;
      }

      await desktopWindow.close();
    } catch (error) {
      console.warn('Failed to close desktop window', error);
      window.close();
    }
  }, [getDesktopWindow]);

  const handleTitleBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const scheduled = titleBarWindowDragControllerRef.current?.handlePointerDown({
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      isPrimary: event.isPrimary,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      target: event.target,
    });
    if (scheduled) {
      event.preventDefault();
    }
  };

  const handleTitleBarDoubleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      !isDesktopWindowAvailableRef.current ||
      isDocumentFullscreenRef.current ||
      isAppHeaderNoDragTarget(event.target)
    ) {
      return;
    }

    void handleMaximize();
  };

  const handleTitleBarContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!titleBarDragEnabled || isAppHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  const handleTitleBarDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!titleBarDragEnabled || isAppHeaderNoDragTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  const handleOpenFolder = useCallback(async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('app.serverDirectory'));
      if (importedProject) {
        activateImportedProject(importedProject.projectId);
        const importedInventory = await importProjectProviderSessionsAndSelect(
          importedProject.projectId,
        );
        const failedSessionCount = getProviderSessionImportFailureCount(importedInventory);
        addToast(
          failedSessionCount
            ? t('app.providerSessionsPartiallyImported', {
                count: failedSessionCount,
                name: importedProject.projectName,
              })
            : t('app.openedFolder', { name: importedProject.projectName }),
          failedSessionCount ? 'info' : 'success',
        );
      }
    } catch (e) {
      console.error("Failed to open folder", e);
      addToast(t('app.failedToOpenFolder'), 'error');
    }
  }, [
    activateImportedProject,
    addToast,
    importProjectProviderSessionsAndSelect,
    selectFolderAndImportProject,
    t,
  ]);

  const handleEditCommand = useCallback((command: string) => {
    const activeEl = document.activeElement;
    const isMonaco = activeEl && activeEl.classList.contains('inputarea');
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !isMonaco) {
      document.execCommand(command);
    } else {
      globalEventBus.emit('editorCommand', command);
    }
  }, []);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    const currentZoom = parseFloat(document.body.style.zoom || '1');
    if (direction === 'in') document.body.style.zoom = (currentZoom + 0.1).toString();
    else if (direction === 'out') document.body.style.zoom = Math.max(0.5, currentZoom - 0.1).toString();
    else document.body.style.zoom = '1';
  }, []);

  openFolderHandlerRef.current = () => {
    void handleOpenFolder();
  };
  zoomHandlerRef.current = handleZoom;
  toggleFullScreenHandlerRef.current = toggleFullScreen;

  const activeProject = projectsIndex.projectsById.get(effectiveProjectId) ?? null;
  const activeAgentSession =
    projectsIndex.agentSessionLocationsByProjectIdAndId.get(
      buildAgentSessionProjectScopedKey(effectiveProjectId, effectiveAgentSessionId),
    )?.agentSession ??
    null;
  const { createAgentSessionWithSelection } = useWorkbenchChatSelection({
    createAgentSession,
    currentSessionEngineId: activeAgentSession?.engineId,
    currentSessionModelId: activeAgentSession?.modelId,
    preferences,
    updatePreferences,
  });
  const handleSelectCreatedAgentSession = useCallback(
    (
      agentSessionId: string,
      options?: {
        projectId?: string;
      },
    ) => {
      const normalizedAgentSessionId = agentSessionId.trim();
      if (!normalizedAgentSessionId) {
        return;
      }

      const targetProjectId = options?.projectId?.trim() || effectiveProjectId;
      if (targetProjectId) {
        setActiveProjectId(targetProjectId);
      }

      commitActiveAgentSessionSelection(targetProjectId, normalizedAgentSessionId);
      setActiveTab((previousActiveTab) =>
        previousActiveTab === 'code' || previousActiveTab === 'studio'
          ? previousActiveTab
          : 'code',
      );
      setProjectActionsMenuId(null);
      setShowWorkspaceProjectPopover(false);
    },
    [commitActiveAgentSessionSelection, effectiveProjectId],
  );
  const handleActiveProjectChange = useCallback((projectId: string) => {
    const normalizedProjectId = projectId.trim();
    setActiveProjectId(normalizedProjectId);
    clearActiveAgentSessionSelection();
  }, [clearActiveAgentSessionSelection]);
  const handleActiveAgentSessionChange = useCallback((
    agentSessionId: string,
    projectId?: string,
  ) => {
    const normalizedProjectId = projectId?.trim() ?? '';
    if (normalizedProjectId) {
      setActiveProjectId(normalizedProjectId);
    }
    commitActiveAgentSessionSelection(
      normalizedProjectId || effectiveProjectId,
      agentSessionId,
    );
  }, [commitActiveAgentSessionSelection, effectiveProjectId]);
  const {
    createAgentSessionFromRequest,
  } = useWorkbenchAgentSessionCreationActions({
    addToast,
    createAgentSessionWithSelection,
    currentProjectId: effectiveProjectId,
    selectAgentSession: handleSelectCreatedAgentSession,
    labels: {
      creationFailed: t('code.failedToCreateSession'),
      creationSucceeded: t('code.newSessionCreated'),
      noProjectSelected: t('code.selectProjectFirst'),
    },
  });
  const newSessionEngineCatalog = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId: activeAgentSession?.engineId,
          currentSessionModelId: activeAgentSession?.modelId,
          preferredEngineId: preferences.codeEngineId,
          preferredModelId: preferences.codeModelId,
        },
        preferences,
      ),
    [
      activeAgentSession?.engineId,
      activeAgentSession?.modelId,
      preferences,
    ],
  );
  const modeAvailableNewSessionEngines = useMemo(
    () => filterWorkbenchModeCatalogEngines(
      normalizeWorkbenchMode(preferences.workbenchMode),
      newSessionEngineCatalog.availableEngines,
    ),
    [newSessionEngineCatalog.availableEngines, preferences.workbenchMode],
  );
  const availableNewSessionEngines = useMemo(() => modeAvailableNewSessionEngines.map((engine) => ({
    ...engine,
    modelId: resolveWorkbenchCodeEngineSelectedModelId(engine.id, preferences),
  })), [modeAvailableNewSessionEngines, preferences]);
  const modePreferredNewSessionEngine =
    modeAvailableNewSessionEngines.find(
      (engine) => engine.id === newSessionEngineCatalog.preferredSelection.engineId,
    ) ?? modeAvailableNewSessionEngines[0] ?? newSessionEngineCatalog.preferredSelection.engine;
  const modePreferredNewSessionModelId = resolveWorkbenchCodeEngineSelectedModelId(
    modePreferredNewSessionEngine.id,
    preferences,
  );
  const titleBarDragEnabled = isDesktopWindowAvailable && !isDocumentFullscreen;
  const titleBarDragSurfaceClass = titleBarDragEnabled
    ? 'cursor-grab border-white/[0.10] text-gray-200 hover:border-white/[0.16] hover:bg-white/[0.04] active:cursor-grabbing active:bg-white/[0.06]'
    : isDesktopWindowMinimized
      ? 'cursor-default border-white/[0.06] text-gray-500'
      : 'cursor-default border-white/[0.06] text-gray-400';
  const shouldShowWorkbenchHeaderChrome = Boolean(user) && activeTab !== 'auth';

  const handleToggleRecording = useCallback(() => {
    const nextRecordingState = !isRecording;
    setIsRecording(nextRecordingState);
    addToast(
      nextRecordingState ? t('app.traceRecordingStarted') : t('app.traceRecordingStopped'),
      'success',
    );
  }, [addToast, isRecording, t]);
  const handleCreateProjectSession = useCallback(
    async (projectId: string, requestedEngineId?: string, requestedModelId?: string) => {
      const normalizedProjectId = projectId.trim();
      if (!projectsIndex.projectsById.has(normalizedProjectId)) {
        addToast(t('app.noProjectsFound'), 'error');
        return;
      }

      await createAgentSessionFromRequest({
        engineId: requestedEngineId,
        modelId: requestedModelId,
        projectId: normalizedProjectId,
        source: 'workspace-project-popover',
      });
    },
    [addToast, createAgentSessionFromRequest, projectsIndex, t],
  );
  const handleCreateAgentSessionCommand = useCallback(
    (request?: CreateNewAgentSessionRequest) => {
      void createAgentSessionFromRequest(request);
    },
    [createAgentSessionFromRequest],
  );
  createAgentSessionCommandRef.current = handleCreateAgentSessionCommand;

  const desktopTrayMenuSnapshot = useMemo(
    () => buildDesktopTraySessionMenuSnapshot({
      labels: {
        exit: t('app.tray.exit'),
        more: t('app.tray.more'),
        newChat: t('app.tray.newChat'),
        openApplication: t('app.tray.openApplication'),
        pinned: t('app.tray.pinned'),
        recent: t('app.tray.recent'),
        running: t('app.tray.running'),
        untitledSession: t('app.tray.untitledSession'),
      },
      newChatEnabled: Boolean(user && effectiveProjectId),
      projects,
    }),
    [effectiveProjectId, projects, t, user],
  );
  const handleDesktopTrayAction = useCallback((action: DesktopTrayAction) => {
    if (action.type === 'newChat') {
      createAgentSessionCommandRef.current({ source: 'tray-menu' });
      return;
    }

    const location = projectsIndex.agentSessionLocationsByProjectIdAndId.get(
      buildAgentSessionProjectScopedKey(action.projectId, action.sessionId),
    );
    if (!location) {
      addToast(t('app.tray.sessionUnavailable'), 'error');
      return;
    }

    const targetWorkbenchMode = resolveWorkbenchModeForEngineId(location.agentSession.engineId);
    updatePreferences((previousPreferences) => ({
      sessionInboxFilter: 'all',
      sessionInboxGroupMode: 'project',
      sessionInboxProviderId: '',
      workbenchMode: targetWorkbenchMode ?? previousPreferences.workbenchMode,
    }));
    setActiveTab('code');
    handleSelectCreatedAgentSession(action.sessionId, { projectId: action.projectId });
    window.setTimeout(() => {
      emitRevealAgentSession({
        projectId: action.projectId,
        sessionId: action.sessionId,
      });
    }, 0);
  }, [
    addToast,
    handleSelectCreatedAgentSession,
    projectsIndex,
    t,
    updatePreferences,
  ]);
  useNativeTrayMenuBridge(desktopTrayMenuSnapshot, handleDesktopTrayAction);

  const fileMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newSession'),
        shortcut: shortcutFor('newSession'),
        onClick: () =>
          handleCreateAgentSessionCommand({
            engineId: modePreferredNewSessionEngine.id,
            modelId: modePreferredNewSessionModelId,
            source: 'file-menu',
          }),
      },
      ...availableNewSessionEngines.map((engine) => ({
        label: `${engine.label} ${t('app.menu.newSession')}`,
        onClick: () => handleCreateAgentSessionCommand({
          engineId: engine.id,
          modelId: engine.modelId,
          source: 'file-menu',
        }),
      })),
      { label: '', divider: true },
      { label: t('app.menu.openFolder'), shortcut: shortcutFor('openFolder'), onClick: handleOpenFolder },
      { label: '', divider: true },
      {
        label: t('app.menu.save'),
        shortcut: shortcutFor('saveActiveFile'),
        onClick: () => globalEventBus.emit('saveActiveFile'),
      },
      {
        label: t('app.menu.saveAll'),
        shortcut: shortcutFor('saveAllFiles'),
        onClick: () => globalEventBus.emit('saveAllFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.logOut'), onClick: () => void handleLogout() },
      { label: t('app.menu.exit'), onClick: handleClose },
      {
        label: t('app.menu.settings'),
        shortcut: shortcutFor('openSettings'),
        onClick: () => {
          setSettingsTab('general');
          setActiveTab('settings');
        },
      },
      { label: '', divider: true },
      { label: t('app.menu.aboutBirdCoder'), onClick: () => setShowAboutModal(true) },
    ],
    [
      availableNewSessionEngines,
      handleClose,
      handleCreateAgentSessionCommand,
      handleOpenFolder,
      handleLogout,
      modePreferredNewSessionEngine.id,
      modePreferredNewSessionModelId,
      shortcutFor,
      t,
    ],
  );

  const editMenuItems = useMemo<TopMenuItem[]>(
    () => [
      { label: t('app.menu.undo'), shortcut: 'Ctrl+Z', onClick: () => handleEditCommand('undo') },
      { label: t('app.menu.redo'), shortcut: 'Ctrl+Y', onClick: () => handleEditCommand('redo') },
      { label: '', divider: true },
      { label: t('app.menu.cut'), shortcut: 'Ctrl+X', onClick: () => handleEditCommand('cut') },
      { label: t('app.menu.copy'), shortcut: 'Ctrl+C', onClick: () => handleEditCommand('copy') },
      { label: t('app.menu.paste'), shortcut: 'Ctrl+V', onClick: () => handleEditCommand('paste') },
      {
        label: t('app.menu.delete'),
        shortcut: 'Del',
        onClick: () => handleEditCommand('delete'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.selectAll'),
        shortcut: 'Ctrl+A',
        onClick: () => handleEditCommand('selectAll'),
      },
    ],
    [handleEditCommand, t],
  );

  const viewMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.toggleSidebar'),
        shortcut: shortcutFor('toggleSidebar'),
        onClick: () => globalEventBus.emit('toggleSidebar'),
      },
      {
        label: t('app.menu.toggleTerminal'),
        shortcut: shortcutFor('toggleTerminal'),
        onClick: () => {
          if (activeTab !== 'code') {
            setActiveTab('code');
          }
          setTimeout(() => globalEventBus.emit('toggleTerminal'), 100);
        },
      },
      {
        label: t('app.menu.toggleDiffPanel'),
        shortcut: shortcutFor('toggleReview'),
        onClick: () => globalEventBus.emit('toggleDiffPanel'),
      },
      {
        label: t('app.menu.findInSessionTranscript'),
        shortcut: shortcutFor('findInSessionTranscript'),
        onClick: () => globalEventBus.emit('findInSessionTranscript'),
      },
      {
        label: t('app.menu.findInFiles'),
        shortcut: shortcutFor('findInFiles'),
        onClick: () => globalEventBus.emit('findInFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.zoomIn'), shortcut: shortcutFor('zoomIn'), onClick: () => handleZoom('in') },
      { label: t('app.menu.zoomOut'), shortcut: shortcutFor('zoomOut'), onClick: () => handleZoom('out') },
      { label: t('app.menu.actualSize'), shortcut: shortcutFor('zoomReset'), onClick: () => handleZoom('reset') },
      { label: '', divider: true },
      {
        label: t('app.menu.toggleFullScreen'),
        shortcut: shortcutFor('toggleFullScreen'),
        onClick: toggleFullScreen,
      },
    ],
    [activeTab, handleZoom, shortcutFor, t, toggleFullScreen],
  );

  const goMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.goToFile'),
        shortcut: shortcutFor('openQuickOpen'),
        onClick: () => globalEventBus.emit('openQuickOpen'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.previousAgentSession'),
        shortcut: shortcutFor('previousAgentSession'),
        onClick: () => globalEventBus.emit('previousAgentSession'),
      },
      {
        label: t('app.menu.nextAgentSession'),
        shortcut: shortcutFor('nextAgentSession'),
        onClick: () => globalEventBus.emit('nextAgentSession'),
      },
      { label: t('app.menu.back'), shortcut: shortcutFor('historyBack'), onClick: () => window.history.back() },
      {
        label: t('app.menu.forward'),
        shortcut: shortcutFor('historyForward'),
        onClick: () => window.history.forward(),
      },
    ],
    [shortcutFor, t],
  );

  const runMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.startDebugging'),
        shortcut: shortcutFor('startDebugging'),
        onClick: () => globalEventBus.emit('startDebugging'),
      },
      {
        label: t('app.menu.runWithoutDebugging'),
        shortcut: shortcutFor('runWithoutDebugging'),
        onClick: () => globalEventBus.emit('runWithoutDebugging'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.addConfiguration'),
        onClick: () => globalEventBus.emit('addRunConfiguration'),
      },
    ],
    [shortcutFor, t],
  );

  const terminalMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newTerminal'),
        shortcut: shortcutFor('createTerminal'),
        onClick: () => void handleCreateTerminal(),
      },
      { label: '', divider: true },
      { label: t('app.menu.runTask'), onClick: () => globalEventBus.emit('runTask') },
    ],
    [handleCreateTerminal, shortcutFor, t],
  );

  const windowMenuItems = useMemo<TopMenuItem[]>(
    () => [
      { label: t('app.menu.minimize'), onClick: handleMinimize },
      { label: t('app.menu.maximize'), onClick: handleMaximize },
      { label: t('app.menu.close'), onClick: handleClose },
    ],
    [handleClose, handleMaximize, handleMinimize, t],
  );

  const helpMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.documentation'),
        onClick: () =>
          window.open(
            'https://sdkwork.com/apps/sdkwork-birdcoder',
            '_blank',
            'noopener,noreferrer',
          ),
      },
      { label: t('app.menu.whatsNew'), onClick: () => setShowWhatsNewModal(true) },
      { label: '', divider: true },
      {
        label: t('app.menu.keyboardShortcuts'),
        shortcut: shortcutFor('showKeyboardShortcuts'),
        onClick: () => {
          setSettingsTab('shortcuts');
          setActiveTab('settings');
        },
      },
      { label: '', divider: true },
      {
        label: isRecording
          ? t('app.menu.stopTraceRecording')
          : t('app.menu.startTraceRecording'),
        onClick: handleToggleRecording,
      },
      { label: '', divider: true },
      { label: t('app.menu.aboutBirdCoder'), onClick: () => setShowAboutModal(true) },
    ],
    [handleToggleRecording, isRecording, shortcutFor, t],
  );

  const commandMenuGroups = useMemo<readonly BirdcoderCommandGroup[]>(() => [
    { id: 'file', label: t('app.menu.file'), items: fileMenuItems },
    { id: 'view', label: t('app.menu.view'), items: viewMenuItems },
    { id: 'go', label: t('app.menu.go'), items: goMenuItems },
    { id: 'run', label: t('app.menu.run'), items: runMenuItems },
    { id: 'terminal', label: t('app.menu.terminal'), items: terminalMenuItems },
    { id: 'help', label: t('app.menu.help'), items: helpMenuItems },
  ], [
    fileMenuItems,
    goMenuItems,
    helpMenuItems,
    runMenuItems,
    t,
    terminalMenuItems,
    viewMenuItems,
  ]);

  const handleWorkspaceProjectPopoverToggle = useCallback(() => {
    if (showWorkspaceProjectPopover) {
      closeWorkspaceProjectPopover();
      return;
    }

    setShowWorkspaceProjectPopover(true);
  }, [closeWorkspaceProjectPopover, showWorkspaceProjectPopover]);
  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId || normalizedWorkspaceId === selectedWorkspaceId) {
      return;
    }
    selectWorkspace(normalizedWorkspaceId);
    setProjectActionsMenuId(null);
    setWorkspaceActionsMenuId(null);
  }, [selectWorkspace, selectedWorkspaceId]);
  const handleStartCreatingWorkspace = useCallback(() => {
    setNewWorkspaceName('');
    setWorkspaceActionsMenuId(null);
    setRenamingWorkspaceId(null);
    setShowCreateWorkspaceDialog(true);
  }, []);
  const handleCreateWorkspace = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) {
      return;
    }
    setIsWorkspaceCreationPending(true);
    try {
      let createdWorkspace: AgentWorkspaceView;
      try {
        createdWorkspace = await createWorkspace(name);
      } catch (error) {
        console.error('Failed to create Workspace', error);
        addToast(
          error instanceof Error && error.message.trim()
            ? error.message
            : t('app.failedToCreateWorkspace'),
          'error',
        );
        return;
      }

      try {
        await refreshWorkspaces();
      } catch (error) {
        console.error('Failed to refresh Workspaces after creation', error);
        addToast(t('app.failedToLoadWorkspaces'), 'error');
      }

      selectWorkspace(createdWorkspace.workspaceId);
      setShowCreateWorkspaceDialog(false);
      setNewWorkspaceName('');
      setActiveProjectId('');
      clearActiveAgentSessionSelection();
      addToast(t('app.workspaceCreated'), 'success');
    } finally {
      setIsWorkspaceCreationPending(false);
    }
  }, [
    addToast,
    clearActiveAgentSessionSelection,
    createWorkspace,
    newWorkspaceName,
    refreshWorkspaces,
    selectWorkspace,
    t,
  ]);
  const handleStartWorkspaceRename = useCallback((workspace: AgentWorkspaceView) => {
    setRenamingWorkspaceId(workspace.workspaceId);
    setWorkspaceRenameValue(workspace.name);
    setWorkspaceActionsMenuId(null);
  }, []);
  const handleFinishWorkspaceRename = useCallback(() => {
    setRenamingWorkspaceId(null);
    setWorkspaceRenameValue('');
  }, []);
  const handleRenameWorkspace = useCallback(async (
    workspace: AgentWorkspaceView,
    name: string,
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName === workspace.name) {
      handleFinishWorkspaceRename();
      return;
    }
    try {
      await updateWorkspace(workspace.workspaceId, workspace.version, {
        name: normalizedName,
      });
      handleFinishWorkspaceRename();
      addToast(t('app.workspaceRenamed'), 'success');
    } catch (error) {
      console.error('Failed to rename Workspace', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('app.failedToRenameWorkspace'),
        'error',
      );
    }
  }, [addToast, handleFinishWorkspaceRename, t, updateWorkspace]);
  const handleToggleWorkspaceActionsMenu = useCallback((workspaceId: string) => {
    setWorkspaceActionsMenuId((current) => current === workspaceId ? null : workspaceId);
  }, []);
  const handleArchiveWorkspace = useCallback(async (workspace: AgentWorkspaceView) => {
    setWorkspaceActionsMenuId(null);
    try {
      await archiveWorkspace(workspace.workspaceId, workspace.version);
      if (selectedWorkspaceId === workspace.workspaceId) {
        setActiveProjectId('');
        clearActiveAgentSessionSelection();
      }
      addToast(t('app.workspaceArchived'), 'success');
    } catch (error) {
      console.error('Failed to archive Workspace', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('app.failedToArchiveWorkspace'),
        'error',
      );
    }
  }, [
    addToast,
    archiveWorkspace,
    clearActiveAgentSessionSelection,
    selectedWorkspaceId,
    t,
  ]);
  const handleDeleteWorkspace = useCallback(async (workspace: AgentWorkspaceView) => {
    setWorkspaceActionsMenuId(null);
    if (!window.confirm(t('app.deleteWorkspaceConfirmation', { name: workspace.name }))) {
      return;
    }
    try {
      await deleteWorkspace(workspace.workspaceId, workspace.version);
      if (selectedWorkspaceId === workspace.workspaceId) {
        setActiveProjectId('');
        clearActiveAgentSessionSelection();
      }
      addToast(t('app.workspaceDeleted'), 'success');
    } catch (error) {
      console.error('Failed to delete Workspace', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('app.failedToDeleteWorkspace'),
        'error',
      );
    }
  }, [
    addToast,
    clearActiveAgentSessionSelection,
    deleteWorkspace,
    selectedWorkspaceId,
    t,
  ]);
  const handleStartProjectRename = useCallback((projectId: string, currentName: string) => {
    setRenamingProjectId(projectId);
    setRenameProjectValue(currentName);
  }, []);
  const handleFinishProjectRename = useCallback(() => {
    setRenamingProjectId(null);
  }, []);
  const handleToggleProjectActionsMenu = useCallback((projectId: string) => {
    setProjectActionsMenuId((currentValue) => (currentValue === projectId ? null : projectId));
  }, []);
  const handleOpenCreateProjectDialog = useCallback((): Promise<string | undefined> => {
    closeWorkspaceProjectPopover();

    const pendingRequest = pendingProjectCreationRequestRef.current;
    if (pendingRequest) {
      return pendingRequest.promise;
    }

    setNewProjectName('');
    setNewProjectSourceFolder(null);
    setShowCreateProjectDialog(true);

    let resolveRequest: PendingProjectCreationRequest['resolve'] = () => undefined;
    const promise = new Promise<string | undefined>((resolve) => {
      resolveRequest = resolve;
    });
    pendingProjectCreationRequestRef.current = {
      promise,
      resolve: resolveRequest,
    };
    return promise;
  }, [closeWorkspaceProjectPopover]);
  const handleClearProjectSourceFolder = useCallback(() => {
    setNewProjectSourceFolder(null);
  }, []);
  const handleProjectNameChange = useCallback((value: string) => {
    setNewProjectName(value);
  }, []);
  const handleCloseProjectRemoveDialog = useCallback(() => {
    setProjectToRemove(null);
  }, []);

  return (
      <div
        className="birdcoder-app-shell flex flex-col h-full w-full bg-[#0e0e11] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30"
      >
      <BirdcoderAppHeader
        brandLabel={preferences.workbenchMode === 'work' ? t('app.workMode') : 'BirdCoder'}
        centerContent={shouldShowWorkbenchHeaderChrome ? (
          <div className="flex h-full min-w-0 items-center justify-center">
            <AppWorkspaceProjectPopover
              activeProjectName={activeProject?.name ?? null}
              availableNewSessionEngines={availableNewSessionEngines}
              effectiveProjectId={effectiveProjectId}
              hasMoreProjects={projectsHasMore}
              hasMoreWorkspaces={workspacesHasMore}
              hasProjectsFetched={projectsHasFetched}
              hasWorkspacesFetched={workspacesHasFetched}
              isLoadingMoreProjects={isProjectsLoadingMore}
              isLoadingMoreWorkspaces={isWorkspacesLoadingMore}
              isProjectCreationPending={isProjectCreationPending}
              isProjectsLoading={isProjectsLoading}
              isWorkspacesLoading={isWorkspacesLoading}
              onArchiveProject={handleArchiveProject}
              onArchiveWorkspace={handleArchiveWorkspace}
              onClosePopover={closeWorkspaceProjectPopover}
              onCommitProjectRename={handleRenameProject}
              onCommitWorkspaceRename={handleRenameWorkspace}
              onConfirmDeleteProject={confirmRemoveProject}
              onCreateProjectSession={handleCreateProjectSession}
              onDeleteWorkspace={handleDeleteWorkspace}
              onFinishProjectRename={handleFinishProjectRename}
              onFinishWorkspaceRename={handleFinishWorkspaceRename}
              onLoadMoreProjects={handleLoadMoreProjects}
              onLoadMoreWorkspaces={handleLoadMoreWorkspaces}
              onOpenProjectInExplorer={handleOpenProjectInExplorer}
              onProjectRenameValueChange={setRenameProjectValue}
              onRefreshProjects={refreshProjects}
              onRefreshWorkspaces={refreshWorkspaces}
              onSelectProject={handleSelectPopoverProject}
              onSelectWorkspace={handleSelectWorkspace}
              onRequestProjectCreation={handleOpenCreateProjectDialog}
              onStartProjectRename={handleStartProjectRename}
              onStartWorkspaceCreation={handleStartCreatingWorkspace}
              onStartWorkspaceRename={handleStartWorkspaceRename}
              onTogglePopover={handleWorkspaceProjectPopoverToggle}
              onToggleProjectActions={handleToggleProjectActionsMenu}
              onToggleWorkspaceActions={handleToggleWorkspaceActionsMenu}
              onWorkspaceRenameValueChange={setWorkspaceRenameValue}
              popoverRef={workspaceProjectPopoverRef}
              preferredEngineId={newSessionEngineCatalog.preferredSelection.engineId}
              preferredModelId={newSessionEngineCatalog.preferredSelection.modelId}
              projectActionsMenuId={projectActionsMenuId}
              projectMountRecoveryNotice={projectMountRecoveryNotice}
              projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
              projects={projects}
              projectsError={projectsError}
              renameProjectValue={renameProjectValue}
              renamingProjectId={renamingProjectId}
              renamingWorkspaceId={renamingWorkspaceId}
              selectedWorkspace={selectedWorkspace}
              showPopover={showWorkspaceProjectPopover}
              workspaceActionsMenuId={workspaceActionsMenuId}
              workspaceError={workspacesError}
              workspaceRenameValue={workspaceRenameValue}
              workspaces={workspaces}
            />
          </div>
        ) : null}
        closeButtonRef={closeWindowControlButtonRef}
        commandMenuLabel={t('app.menu.commandMenu')}
        commandMenuShortcut={shortcutFor('openCommandMenu')}
        handleClose={handleClose}
        handleMaximize={handleMaximize}
        handleMinimize={handleMinimize}
        isDesktopWindowAvailable={isDesktopWindowAvailable}
        isDesktopWindowMaximized={isDesktopWindowMaximized}
        isDesktopWindowMinimized={isDesktopWindowMinimized}
        leftAddon={shouldShowWorkbenchHeaderChrome ? (
          <div className="hidden md:contents">
            <TopMenu label={t('app.menu.file')} items={fileMenuItems} />
            <TopMenu label={t('app.menu.edit')} items={editMenuItems} />
            <TopMenu label={t('app.menu.view')} items={viewMenuItems} />
            <TopMenu label={t('app.menu.go')} items={goMenuItems} />
            <TopMenu label={t('app.menu.run')} items={runMenuItems} />
            <TopMenu label={t('app.menu.terminal')} items={terminalMenuItems} />
            <TopMenu label={t('app.menu.window')} items={windowMenuItems} />
            <TopMenu label={t('app.menu.help')} items={helpMenuItems} />
          </div>
        ) : null}
        maximizeButtonRef={maximizeWindowControlButtonRef}
        minimizeButtonRef={minimizeWindowControlButtonRef}
        onContextMenu={handleTitleBarContextMenu}
        onDoubleClick={handleTitleBarDoubleClick}
        onDragStart={handleTitleBarDragStart}
        onPointerDown={handleTitleBarPointerDown}
        onOpenCommandMenu={shouldShowWorkbenchHeaderChrome ? handleOpenCommandMenu : undefined}
        t={t}
        titleBarDragSurfaceClass={titleBarDragSurfaceClass}
      />

      <AppMainBody
        activeTab={activeTab}
        isAuthenticated={isAuthenticated}
        terminalRequest={terminalRequest}
        workspaceId={selectedWorkspaceId}
        projectId={effectiveProjectId}
        projectName={activeProject?.name}
        agentSessionId={effectiveAgentSessionId}
        runtimeLocationId={effectiveAgentSessionRuntimeLocationId}
        settingsTab={settingsTab}
        onActiveTabChange={handleActiveTabChange}
        onSettingsTabChange={setSettingsTab}
        onRequireAuth={openAuthenticationSurface}
        onRequestProjectCreation={handleOpenCreateProjectDialog}
        onProjectChange={handleActiveProjectChange}
        onAgentSessionChange={handleActiveAgentSessionChange}
      />

      <BirdcoderCommandMenu
        closeLabel={t('app.menu.closeCommandMenu')}
        groups={commandMenuGroups}
        isOpen={showCommandMenu}
        noResultsLabel={t('app.menu.commandMenuNoResults')}
        onClose={() => setShowCommandMenu(false)}
        searchLabel={t('app.menu.commandMenuSearch')}
        title={t('app.menu.commandMenu')}
      />

      <CreateProjectDialog
        isCreating={isProjectCreationPending}
        isOpen={showCreateProjectDialog}
        isSelectingSourceFolder={isProjectFolderPickerPending}
        onClearSourceFolder={handleClearProjectSourceFolder}
        onClose={closeCreateProjectDialog}
        onNameChange={handleProjectNameChange}
        onSelectSourceFolder={handleSelectProjectSourceFolder}
        onSubmit={handleCreateProject}
        projectName={newProjectName}
        sourceFolderName={newProjectSourceFolderName}
      />

      <CreateWorkspaceDialog
        isCreating={isWorkspaceCreationPending}
        isOpen={showCreateWorkspaceDialog}
        onClose={closeCreateWorkspaceDialog}
        onNameChange={setNewWorkspaceName}
        onSubmit={handleCreateWorkspace}
        workspaceName={newWorkspaceName}
      />

      <AppShellDialogs
        projectToRemoveName={projectToRemove
          ? projectsIndex.projectsById.get(projectToRemove)?.name ?? t('app.projectType')
          : null}
        showAboutModal={showAboutModal}
        showWhatsNewModal={showWhatsNewModal}
        onCloseProjectRemove={handleCloseProjectRemoveDialog}
        onConfirmProjectRemove={executeRemoveProject}
        onCloseAbout={() => setShowAboutModal(false)}
        onCloseWhatsNew={() => setShowWhatsNewModal(false)}
      />
    </div>
  );
}
