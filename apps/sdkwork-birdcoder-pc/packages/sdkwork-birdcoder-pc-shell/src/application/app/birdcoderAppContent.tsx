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
import { hydrateImportedProjectFromAuthority } from '@sdkwork/birdcoder-pc-workbench/workbench/importedProjectHydration';
import { importSandboxDirectoryProject } from '@sdkwork/birdcoder-pc-workbench/workbench/sandboxDirectoryProjectImport';
import {
  buildDefaultTerminalCommandRequest,
  emitOpenTerminalRequest,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
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
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import { revealTauriPathInFileManager } from '@sdkwork/birdcoder-pc-workbench/platform/tauriFileManager';
import { ToastProvider, useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useAuth } from '@sdkwork/birdcoder-pc-workbench/context/AuthContext';
import { buildBirdCoderAuthSessionInventoryScope } from '@sdkwork/birdcoder-pc-workbench/context/authSessionScope';
import { usePersistedState } from '@sdkwork/birdcoder-pc-workbench/hooks/usePersistedState';
import { useProjects } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjects';
import { useWorkbenchChatSelection } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchChatSelection';
import { useWorkbenchAgentSessionCreationActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchAgentSessionCreationActions';
import type { CreateNewAgentSessionRequest } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionCreation';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { Button, TopMenu, type TopMenuItem } from '@sdkwork/birdcoder-pc-ui-shell';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';
import type { AppTab, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import { useSandboxDirectoryPicker } from '@sdkwork/drive-pc-sandbox-explorer';
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
import { AppProjectMenu } from './AppProjectMenu.tsx';
import {
  performNativeWindowControlAction,
  useNativeWindowControlsBridge,
} from './nativeWindowControlsBridge.ts';
import { BirdcoderAppHeader } from './BirdcoderAppHeader.tsx';
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
  const [activeTab, setActiveTab] = useState<AppTab>(() => resolveBirdCoderInitialAppTab());
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
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const {
    projects,
    error: projectsError,
    hasFetched: projectsHasFetched,
    hasMore: projectsHasMore,
    isLoading: isProjectsLoading,
    isLoadingMore: isProjectsLoadingMore,
    createProject,
    loadMoreProjects,
    refreshProjects,
    renameProject,
    archiveProject,
    deleteProject,
    createAgentSession,
  } = useProjects({
    isActive: Boolean(user),
    targetProjectId:
      scopedActiveProjectId || normalizedRecoverySnapshot.activeProjectId,
  });
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

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectActionsMenuId, setProjectActionsMenuId] = useState<string | null>(null);
  const [projectMountRecoveryNotice, setProjectMountRecoveryNotice] =
    useState<ProjectMountRecoveryEventPayload | null>(null);
  const [projectMountRecoveryStartedAt, setProjectMountRecoveryStartedAt] = useState<number | null>(
    null,
  );
  const projectMenuRef = useRef<HTMLDivElement>(null);
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
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
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
  const activeAgentSessionSelectionScopeKeyRef = useRef('');

  const clearActiveAgentSessionSelection = useCallback(() => {
    activeAgentSessionSelectionScopeKeyRef.current = '';
    setActiveAgentSessionId('');
  }, []);

  const commitActiveAgentSessionSelection = useCallback((
    projectId: string,
    agentSessionId: string,
  ) => {
    const normalizedProjectId = projectId.trim();
    const normalizedAgentSessionId = agentSessionId.trim();
    activeAgentSessionSelectionScopeKeyRef.current =
      normalizedProjectId && normalizedAgentSessionId
        ? buildAgentSessionProjectScopedKey(normalizedProjectId, normalizedAgentSessionId)
        : '';
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

  const closeProjectMenuSurface = useCallback(() => {
    setShowProjectMenu(false);
    setIsCreatingProject(false);
    setNewProjectName('');
    setProjectActionsMenuId(null);
  }, []);

  const resolvedProjectId = resolveStartupProjectId({
    projects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const effectiveProjectId = (scopedActiveProjectId || resolvedProjectId).trim();
  const activeProjectAgentSessions =
    projectsIndex.projectsById.get(effectiveProjectId)?.agentSessions ?? [];
  const activeProjectAgentSessionIds = useMemo(
    () => new Set(activeProjectAgentSessions.map((agentSession) => agentSession.id)),
    [activeProjectAgentSessions],
  );
  const resolvedAgentSessionId = resolveStartupAgentSessionId({
    projectId: effectiveProjectId,
    projects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const scopedActiveAgentSessionScopeKey =
    effectiveProjectId && scopedActiveAgentSessionId
      ? buildAgentSessionProjectScopedKey(effectiveProjectId, scopedActiveAgentSessionId)
      : '';
  const isScopedActiveAgentSessionInProject = Boolean(
    scopedActiveAgentSessionId &&
    activeProjectAgentSessionIds.has(scopedActiveAgentSessionId),
  );
  const isPendingScopedActiveAgentSession = Boolean(
    scopedActiveAgentSessionId &&
    scopedActiveAgentSessionScopeKey &&
    activeAgentSessionSelectionScopeKeyRef.current === scopedActiveAgentSessionScopeKey &&
    projectsIndex.projectsById.has(effectiveProjectId),
  );
  const effectiveAgentSessionId = (
    isScopedActiveAgentSessionInProject || isPendingScopedActiveAgentSession
      ? scopedActiveAgentSessionId
      : resolvedAgentSessionId
  ).trim();
  const currentUserFallbackRecoverySnapshot =
    lastPersistedRecoverySnapshotRef.current?.userScope === currentWorkbenchUserScope
      ? lastPersistedRecoverySnapshotRef.current
      : normalizedRecoverySnapshot;
  const persistedRecoverySelection = useMemo(() => resolveWorkbenchRecoveryPersistenceSelection({
      currentProjectId: effectiveProjectId,
      currentAgentSessionId: effectiveAgentSessionId,
      fallbackSnapshot: currentUserFallbackRecoverySnapshot,
      hasProjectsFetched: projectsHasFetched,
    }), [
      currentUserFallbackRecoverySnapshot,
      effectiveAgentSessionId,
      effectiveProjectId,
      projectsHasFetched,
    ]);
  const recoverySelectionResolutionReady = useMemo(
    () => isWorkbenchRecoverySelectionResolutionReady({
      hasProjectsFetched: projectsHasFetched,
    }),
    [projectsHasFetched],
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

  const hydrateImportedProjectSelectionInBackground = useCallback(
    (projectId: string) => {
      void (async () => {
        try {
          if (pendingImportedProjectIdRef.current !== projectId) {
            return;
          }

          const hydratedProject = await hydrateImportedProjectFromAuthority({
            agentSessionService,
            knownProjects: projects,
            projectId,
            projectService,
            userScope: user?.id,
          });
          if (!hydratedProject) {
            return;
          }

          commitActiveAgentSessionSelection(
            projectId,
            hydratedProject.latestAgentSessionId ?? '',
          );
          pendingImportedProjectIdRef.current = '';
        } catch (error) {
          console.error('Failed to hydrate imported project state from server authority', error);
        }
      })();
    },
    [
      agentSessionService,
      projects,
      projectService,
      commitActiveAgentSessionSelection,
      user?.id,
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
    setShowProjectMenu(false);
  }, [clearActiveAgentSessionSelection, currentWorkbenchSessionScope]);

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
    if (!projectsHasFetched) {
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
    projects,
    projectsHasMore,
    projectsHasFetched,
    projectsIndex,
    resolvedProjectId,
  ]);

  useEffect(() => {
    if (!projectsHasFetched) {
      return;
    }

    if (!effectiveProjectId) {
      if (activeAgentSessionId) {
        clearActiveAgentSessionSelection();
      }
      return;
    }

    if (activeAgentSessionId) {
      const activeSelectionScopeKey = buildAgentSessionProjectScopedKey(
        effectiveProjectId,
        activeAgentSessionId,
      );
      if (activeProjectAgentSessionIds.has(activeAgentSessionId)) {
        activeAgentSessionSelectionScopeKeyRef.current = activeSelectionScopeKey;
        return;
      }

      if (
        activeAgentSessionSelectionScopeKeyRef.current === activeSelectionScopeKey &&
        projectsIndex.projectsById.has(effectiveProjectId)
      ) {
        return;
      }

      if (resolvedAgentSessionId) {
        commitActiveAgentSessionSelection(effectiveProjectId, resolvedAgentSessionId);
        return;
      }

      clearActiveAgentSessionSelection();
      return;
    }

    if (
      activeProjectAgentSessions.length > 0 &&
      resolvedAgentSessionId
    ) {
      commitActiveAgentSessionSelection(effectiveProjectId, resolvedAgentSessionId);
    }
  }, [
    activeAgentSessionId,
    activeProjectAgentSessionIds,
    activeProjectAgentSessions.length,
    clearActiveAgentSessionSelection,
    commitActiveAgentSessionSelection,
    effectiveProjectId,
    projectsHasFetched,
    projectsIndex,
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
      const resolution = await projectRuntimeLocationService.resolveProjectRuntimeLocation(
        target.projectId,
        {
          allowFolderSelection: true,
          capability: 'terminal',
          mountedPath: target.mountedPath,
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
      if (
        !(await fileSystemService.revealProjectInFileManager(
          target.projectId,
          target.mountedPath,
        ))
      ) {
        addToast(t('app.revealInExplorerDesktopOnly'), 'info');
        return;
      }

      addToast(t('app.revealedInExplorer', { path: 'project' }), 'info');
    };
    const handleCopyProjectLocalPath = async (target: ProjectDeviceMountTarget) => {
      const localWorkingDirectory = await fileSystemService.resolveLocalWorkingDirectory(
        target.projectId,
        target.mountedPath,
      );
      if (!localWorkingDirectory || !(await copyLocalPath(localWorkingDirectory))) {
        addToast(t('code.projectFolderUnavailable'), 'error');
        return;
      }

      addToast('Copied local path', 'success');
    };
    const handleOpenSettings = () => {
      setActiveTab('settings');
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
    const unsubscribeTerminalReq = globalEventBus.on('terminalRequest', handleTerminalRequest);
    return () => {
      unsubscribeProjectMountRecovery();
      unsubscribeTerminal();
      unsubscribeReveal();
      unsubscribeProjectTerminal();
      unsubscribeProjectReveal();
      unsubscribeProjectPathCopy();
      unsubscribeSettings();
      unsubscribeTerminalReq();
    };
  }, [addToast, fileSystemService, projectRuntimeLocationService, t]);

  const hasOpenProjectMenuSurface =
    showProjectMenu ||
    isCreatingProject ||
    projectActionsMenuId !== null;

  const handleCreateTerminal = useCallback(async () => {
    if (!effectiveProjectId) {
      addToast('Select a project before opening a terminal.', 'error');
      return;
    }

    try {
      const resolution = await projectRuntimeLocationService.resolveProjectRuntimeLocation(
        effectiveProjectId,
        {
          allowFolderSelection: true,
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

  const handleProjectMenuClickOutside = useCallback(
    (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        closeProjectMenuSurface();
      }
    },
    [closeProjectMenuSurface],
  );

  useEffect(() => {
    if (!hasOpenProjectMenuSurface) {
      return;
    }

    document.addEventListener('mousedown', handleProjectMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleProjectMenuClickOutside);
  }, [handleProjectMenuClickOutside, hasOpenProjectMenuSurface]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        if (e.repeat) return;
        void createAgentSessionCommandRef.current({ source: 'keyboard-shortcut' });
      } else if (cmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        openFolderHandlerRef.current();
      } else if (cmdOrCtrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        globalEventBus.emit('saveActiveFile');
      } else if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        globalEventBus.emit('saveAllFiles');
      } else if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        setActiveTab('settings');
      } else if (cmdOrCtrl && e.key === 'b' && !e.altKey) {
        e.preventDefault();
        globalEventBus.emit('toggleSidebar');
      } else if (cmdOrCtrl && e.key === 'j') {
        e.preventDefault();
        globalEventBus.emit('toggleTerminal');
      } else if (cmdOrCtrl && e.altKey && e.key === 'b') {
        e.preventDefault();
        globalEventBus.emit('toggleDiffPanel');
      } else if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        globalEventBus.emit('findInFiles');
      } else if (cmdOrCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomHandlerRef.current('in');
      } else if (cmdOrCtrl && e.key === '-') {
        e.preventDefault();
        zoomHandlerRef.current('out');
      } else if (cmdOrCtrl && e.key === '0') {
        e.preventDefault();
        zoomHandlerRef.current('reset');
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreenHandlerRef.current();
      } else if (cmdOrCtrl && e.key === 'p') {
        e.preventDefault();
        globalEventBus.emit('openQuickOpen');
      } else if (cmdOrCtrl && e.shiftKey && e.key === '[') {
        e.preventDefault();
        globalEventBus.emit('previousAgentSession');
      } else if (cmdOrCtrl && e.shiftKey && e.key === ']') {
        e.preventDefault();
        globalEventBus.emit('nextAgentSession');
      } else if (cmdOrCtrl && e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        window.history.back();
      } else if (cmdOrCtrl && e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        window.history.forward();
      } else if (e.key === 'F5' && !cmdOrCtrl) {
        e.preventDefault();
        globalEventBus.emit('startDebugging');
      } else if (cmdOrCtrl && e.key === 'F5') {
        e.preventDefault();
        globalEventBus.emit('runWithoutDebugging');
      } else if (cmdOrCtrl && e.shiftKey && e.key === '`') {
        e.preventDefault();
        void handleCreateTerminal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateTerminal]);

  const selectFolderAndImportProject = async (fallbackProjectName: string) => {
    const selection = await pickDirectory({
      title: t('app.selectServerDirectory'),
    });
    if (!selection) {
      return null;
    }

    const importedProject = await importSandboxDirectoryProject({
      compositionPort: {
        bindProjectDrive: async (projectId, selectedDirectory) => {
          await projectService.bindProjectDrive(projectId, {
            driveId: selectedDirectory.sandboxId,
            logicalPath: selectedDirectory.logicalPath,
            rootEntryId: selectedDirectory.entryId,
          });
        },
      },
      createProject: async (name) => {
        const project = await createProject(name);
        return { projectId: project.projectId };
      },
      deleteCreatedProject: (projectId) => projectService.deleteProject(projectId),
      fallbackProjectName,
      selection,
    });

    return {
      ...importedProject,
      reusedExistingProject: false,
    };
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const normalizedProjectName = newProjectName.trim();
      const importedProject = await selectFolderAndImportProject(normalizedProjectName);
      if (!importedProject) {
        return;
      }

      if (
        !importedProject.reusedExistingProject &&
        importedProject.projectName !== normalizedProjectName
      ) {
        await renameProject(importedProject.projectId, normalizedProjectName);
      }

      activateImportedProject(importedProject.projectId);
      hydrateImportedProjectSelectionInBackground(importedProject.projectId);
      setIsCreatingProject(false);
      setNewProjectName('');
      setShowProjectMenu(false);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  const confirmDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setProjectActionsMenuId(null);
    setShowProjectMenu(false);
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

  const executeDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      if (activeProjectId === projectToDelete) {
        setActiveProjectId('');
        clearActiveAgentSessionSelection();
      }
      addToast(t('app.projectDeleted'), "success");
    } catch (error) {
      console.error("Failed to delete project", error);
      addToast(t('app.failedToDeleteProject'), "error");
    } finally {
      setProjectToDelete(null);
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

  const handleSelectMenuProject = useCallback(
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
      setProjectActionsMenuId(null);
      setShowProjectMenu(false);
    },
    [
      effectiveProjectId,
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
        hydrateImportedProjectSelectionInBackground(importedProject.projectId);
        addToast(t('app.openedFolder', { name: importedProject.projectName }), 'success');
      }
    } catch (e) {
      console.error("Failed to open folder", e);
      addToast(t('app.failedToOpenFolder'), 'error');
    }
  }, [
    activateImportedProject,
    addToast,
    hydrateImportedProjectSelectionInBackground,
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
      setShowProjectMenu(false);
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
  const availableNewSessionEngines = useMemo(() => newSessionEngineCatalog.availableEngines.map((engine) => ({
    ...engine,
    modelId: resolveWorkbenchCodeEngineSelectedModelId(engine.id, preferences),
  })), [newSessionEngineCatalog.availableEngines, preferences]);
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
        source: 'project-menu',
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

  const fileMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newSession'),
        shortcut: 'Ctrl+N',
        onClick: () =>
          handleCreateAgentSessionCommand({
            engineId: newSessionEngineCatalog.preferredSelection.engineId,
            modelId: newSessionEngineCatalog.preferredSelection.modelId,
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
      { label: t('app.menu.openFolder'), shortcut: 'Ctrl+O', onClick: handleOpenFolder },
      { label: '', divider: true },
      {
        label: t('app.menu.save'),
        shortcut: 'Ctrl+S',
        onClick: () => globalEventBus.emit('saveActiveFile'),
      },
      {
        label: t('app.menu.saveAll'),
        shortcut: 'Ctrl+Shift+S',
        onClick: () => globalEventBus.emit('saveAllFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.logOut'), onClick: () => void handleLogout() },
      { label: t('app.menu.exit'), onClick: handleClose },
      { label: t('app.menu.settings'), shortcut: 'Ctrl+,', onClick: () => setActiveTab('settings') },
      { label: '', divider: true },
      { label: t('app.menu.aboutBirdCoder'), onClick: () => setShowAboutModal(true) },
    ],
    [
      availableNewSessionEngines,
      handleClose,
      handleCreateAgentSessionCommand,
      handleOpenFolder,
      handleLogout,
      newSessionEngineCatalog.preferredSelection.engineId,
      newSessionEngineCatalog.preferredSelection.modelId,
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
        shortcut: 'Ctrl+B',
        onClick: () => globalEventBus.emit('toggleSidebar'),
      },
      {
        label: t('app.menu.toggleTerminal'),
        shortcut: 'Ctrl+J',
        onClick: () => {
          if (activeTab !== 'code') {
            setActiveTab('code');
          }
          setTimeout(() => globalEventBus.emit('toggleTerminal'), 100);
        },
      },
      {
        label: t('app.menu.toggleDiffPanel'),
        shortcut: 'Alt+Ctrl+B',
        onClick: () => globalEventBus.emit('toggleDiffPanel'),
      },
      {
        label: t('app.menu.find'),
        shortcut: 'Ctrl+F',
        onClick: () => globalEventBus.emit('findInFiles'),
      },
      { label: '', divider: true },
      { label: t('app.menu.zoomIn'), shortcut: 'Ctrl+=', onClick: () => handleZoom('in') },
      { label: t('app.menu.zoomOut'), shortcut: 'Ctrl+-', onClick: () => handleZoom('out') },
      { label: t('app.menu.actualSize'), shortcut: 'Ctrl+0', onClick: () => handleZoom('reset') },
      { label: '', divider: true },
      {
        label: t('app.menu.toggleFullScreen'),
        shortcut: 'F11',
        onClick: toggleFullScreen,
      },
    ],
    [activeTab, handleZoom, t, toggleFullScreen],
  );

  const goMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.goToFile'),
        shortcut: 'Ctrl+P',
        onClick: () => globalEventBus.emit('openQuickOpen'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.previousAgentSession'),
        shortcut: 'Ctrl+Shift+[',
        onClick: () => globalEventBus.emit('previousAgentSession'),
      },
      {
        label: t('app.menu.nextAgentSession'),
        shortcut: 'Ctrl+Shift+]',
        onClick: () => globalEventBus.emit('nextAgentSession'),
      },
      { label: t('app.menu.back'), shortcut: 'Ctrl+[', onClick: () => window.history.back() },
      {
        label: t('app.menu.forward'),
        shortcut: 'Ctrl+]',
        onClick: () => window.history.forward(),
      },
    ],
    [t],
  );

  const runMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.startDebugging'),
        shortcut: 'F5',
        onClick: () => globalEventBus.emit('startDebugging'),
      },
      {
        label: t('app.menu.runWithoutDebugging'),
        shortcut: 'Ctrl+F5',
        onClick: () => globalEventBus.emit('runWithoutDebugging'),
      },
      { label: '', divider: true },
      {
        label: t('app.menu.addConfiguration'),
        onClick: () => globalEventBus.emit('addRunConfiguration'),
      },
    ],
    [t],
  );

  const terminalMenuItems = useMemo<TopMenuItem[]>(
    () => [
      {
        label: t('app.menu.newTerminal'),
        shortcut: 'Ctrl+Shift+`',
        onClick: () => void handleCreateTerminal(),
      },
      { label: '', divider: true },
      { label: t('app.menu.runTask'), onClick: () => globalEventBus.emit('runTask') },
    ],
    [handleCreateTerminal, t],
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
        shortcut: 'Ctrl+K Ctrl+R',
        onClick: () => setShowShortcutsModal(true),
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
    [handleToggleRecording, isRecording, t],
  );

  const handleProjectMenuToggle = useCallback(() => {
    if (showProjectMenu) {
      closeProjectMenuSurface();
      return;
    }

    setShowProjectMenu(true);
  }, [closeProjectMenuSurface, showProjectMenu]);
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
  const handleStartCreatingProject = useCallback(() => {
    setIsCreatingProject(true);
  }, []);
  const handleCancelCreatingProject = useCallback(() => {
    setIsCreatingProject(false);
  }, []);
  const handleProjectNameChange = useCallback((value: string) => {
    setNewProjectName(value);
  }, []);
  const handleCloseProjectDeleteDialog = useCallback(() => {
    setProjectToDelete(null);
  }, []);

  return (
      <div
        className="birdcoder-app-shell flex flex-col h-full w-full bg-[#0e0e11] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30"
      >
      <BirdcoderAppHeader
        centerContent={shouldShowWorkbenchHeaderChrome ? (
          <AppProjectMenu
            projectMenuRef={projectMenuRef}
            activeProjectName={activeProject?.name ?? null}
            effectiveProjectId={effectiveProjectId}
            showProjectMenu={showProjectMenu}
            projects={projects}
            hasProjectsFetched={projectsHasFetched}
            hasMoreProjects={projectsHasMore}
            isProjectsLoading={isProjectsLoading}
            isLoadingMoreProjects={isProjectsLoadingMore}
            projectMountRecoveryNotice={projectMountRecoveryNotice}
            projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
            isCreatingProject={isCreatingProject}
            newProjectName={newProjectName}
            renamingProjectId={renamingProjectId}
            renameProjectValue={renameProjectValue}
            projectActionsMenuId={projectActionsMenuId}
            availableNewSessionEngines={availableNewSessionEngines}
            preferredEngineId={newSessionEngineCatalog.preferredSelection.engineId}
            preferredModelId={newSessionEngineCatalog.preferredSelection.modelId}
            onToggleMenu={handleProjectMenuToggle}
            onCloseMenuSurface={closeProjectMenuSurface}
            onSelectProject={handleSelectMenuProject}
            onLoadMoreProjects={handleLoadMoreProjects}
            onStartProjectRename={handleStartProjectRename}
            onProjectRenameValueChange={setRenameProjectValue}
            onFinishProjectRename={handleFinishProjectRename}
            onCommitProjectRename={handleRenameProject}
            onArchiveProject={handleArchiveProject}
            onCreateProjectSession={handleCreateProjectSession}
            onToggleProjectActionsMenu={handleToggleProjectActionsMenu}
            onOpenProjectInExplorer={handleOpenProjectInExplorer}
            onConfirmDeleteProject={confirmDeleteProject}
            onStartCreatingProject={handleStartCreatingProject}
            onCancelCreatingProject={handleCancelCreatingProject}
            onProjectNameChange={handleProjectNameChange}
            onCreateProject={handleCreateProject}
          />
        ) : null}
        closeButtonRef={closeWindowControlButtonRef}
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
        t={t}
        titleBarDragSurfaceClass={titleBarDragSurfaceClass}
      />

      <AppMainBody
        activeTab={activeTab}
        isAuthenticated={Boolean(user)}
        terminalRequest={terminalRequest}
        projectId={effectiveProjectId}
        projectName={activeProject?.name}
        agentSessionId={effectiveAgentSessionId}
        onActiveTabChange={handleActiveTabChange}
        onRequireAuth={openAuthenticationSurface}
        onProjectChange={handleActiveProjectChange}
        onAgentSessionChange={handleActiveAgentSessionChange}
      />

      <AppShellDialogs
        projectToDelete={projectToDelete}
        showAboutModal={showAboutModal}
        showWhatsNewModal={showWhatsNewModal}
        showShortcutsModal={showShortcutsModal}
        onCloseProjectDelete={handleCloseProjectDeleteDialog}
        onConfirmProjectDelete={executeDeleteProject}
        onCloseAbout={() => setShowAboutModal(false)}
        onCloseWhatsNew={() => setShowWhatsNewModal(false)}
        onCloseShortcuts={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
