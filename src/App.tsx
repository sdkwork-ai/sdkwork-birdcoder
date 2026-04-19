/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, lazy, Suspense, type ErrorInfo, useState, useRef, useEffect, useCallback } from 'react';
import { Code2, Sparkles, Terminal, Settings, UserCircle, Shield, Zap, LayoutTemplate, Minus, Square, SquareSquare, X, ChevronDown, Folder, Briefcase, Globe, User, Plus, Trash2, AlertTriangle, ChevronRight, Check, Edit, MoreHorizontal } from 'lucide-react';
import {
  usePersistedState,
  useWorkspaces,
  IDEProvider,
  useAuth,
  AuthProvider,
  ToastProvider,
  useToast,
  globalEventBus,
  useProjects,
  useIDEServices,
} from '@sdkwork/birdcoder-commons/shell';
import {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  buildWorkbenchRecoveryAnnouncement,
  buildWorkbenchRecoverySnapshot,
  hydrateImportedProjectFromAuthority,
  importLocalFolderProject,
  normalizeWorkbenchRecoverySnapshot,
  recoverySnapshotsEqual,
  resolveLatestCodingSessionIdForProject,
  resolveStartupCodingSessionId,
  resolveStartupProjectId,
  resolveStartupWorkspaceId,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-commons/workbench';
import { setStoredJson } from '@sdkwork/birdcoder-commons/storage/localStore';
import { Button, TopMenu } from '@sdkwork/birdcoder-ui/shell';
import type { AppTab, BirdCoderProject } from '@sdkwork/birdcoder-types';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons/shell';
import { useTranslation } from 'react-i18next';
import {
  createAppHeaderWindowDragController,
  isAppHeaderNoDragTarget,
} from './appHeaderWindowDrag.ts';

const CodePage = lazy(async () => {
  const { loadCodePage } = await import('./pageLoaders.ts');
  return loadCodePage();
});

const StudioPage = lazy(async () => {
  const { loadStudioPage } = await import('./pageLoaders.ts');
  return loadStudioPage();
});

const TerminalPage = lazy(async () => {
  const { loadTerminalPage } = await import('./pageLoaders.ts');
  return loadTerminalPage();
});

const SettingsPage = lazy(async () => {
  const { loadSettingsPage } = await import('./pageLoaders.ts');
  return loadSettingsPage();
});

const AuthPage = lazy(async () => {
  const { loadAuthPage } = await import('./pageLoaders.ts');
  return loadAuthPage();
});

const UserCenterPage = lazy(async () => {
  const { loadUserCenterPage } = await import('./pageLoaders.ts');
  return loadUserCenterPage();
});

const VipPage = lazy(async () => {
  const { loadVipPage } = await import('./pageLoaders.ts');
  return loadVipPage();
});

const SkillsPage = lazy(async () => {
  const { loadSkillsPage } = await import('./pageLoaders.ts');
  return loadSkillsPage();
});

const TemplatesPage = lazy(async () => {
  const { loadTemplatesPage } = await import('./pageLoaders.ts');
  return loadTemplatesPage();
});

type ErrorBoundaryProps = {
  children: React.ReactNode;
  t: (key: string) => string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full w-full bg-[#0e0e11] text-white items-center justify-center p-8">
          <AlertTriangle size={48} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{this.props.t('app.somethingWentWrong')}</h1>
          <p className="text-gray-400 mb-6 text-center max-w-md">
            {this.props.t('app.unexpectedError')}
          </p>
          <div className="bg-[#18181b] p-4 rounded-lg border border-white/10 w-full max-w-2xl overflow-auto text-sm text-red-400 font-mono">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            {this.props.t('app.reloadApplication')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundaryWithTranslation = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
};

function SurfaceLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className="flex h-full w-full bg-[#0e0e11] text-white items-center justify-center"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
    </div>
  );
}

function createWorkbenchRecoverySessionId() {
  return `recovery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  return (
    <ErrorBoundaryWithTranslation>
      <ToastProvider>
        <IDEProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </IDEProvider>
      </ToastProvider>
    </ErrorBoundaryWithTranslation>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { fileSystemService, projectService } = useIDEServices();
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<AppTab>('code');
  const [recoverySnapshot, setRecoverySnapshot, isRecoveryHydrated] = usePersistedState<WorkbenchRecoverySnapshot>(
    'workbench',
    'recovery-context',
    DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  );
  const {
    workspaces,
    isLoading: isWorkspacesLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces,
  } = useWorkspaces();
  const normalizedRecoverySnapshot = normalizeWorkbenchRecoverySnapshot(recoverySnapshot);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeCodingSessionId, setActiveCodingSessionId] = useState<string>('');
  
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [menuActiveWorkspaceId, setMenuActiveWorkspaceId] = useState<string>('');
  const resolvedWorkspaceId = resolveStartupWorkspaceId({
    workspaces,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const fallbackWorkspaceId = workspaces[0]?.id ?? '';
  const effectiveWorkspaceId = (activeWorkspaceId || resolvedWorkspaceId || fallbackWorkspaceId).trim();
  const effectiveMenuWorkspaceId = (menuActiveWorkspaceId || effectiveWorkspaceId).trim();
  const projectsWorkspaceId = user ? effectiveWorkspaceId : '';
  const menuProjectsScopeWorkspaceId =
    user && showWorkspaceMenu ? effectiveMenuWorkspaceId : '';
  const shouldUseDistinctMenuProjectsStore =
    !!menuProjectsScopeWorkspaceId && menuProjectsScopeWorkspaceId !== projectsWorkspaceId;

  // Fetch projects for the active workspace to know the active project's name
  const {
    projects: activeProjects,
    hasFetched: activeProjectsHasFetched,
    createProject: createActiveProject,
    refreshProjects: refreshActiveProjects,
    updateProject: updateActiveProject,
    deleteProject: deleteActiveProject,
    createCodingSession: createActiveCodingSession,
  } = useProjects(projectsWorkspaceId);
  const {
    projects: distinctMenuProjects,
    hasFetched: distinctMenuProjectsHasFetched,
    createProject: createDistinctMenuProject,
    createCodingSession: createDistinctMenuCodingSession,
    refreshProjects: refreshDistinctMenuProjects,
    updateProject: updateDistinctMenuProject,
    deleteProject: deleteDistinctMenuProject,
  } = useProjects(
    shouldUseDistinctMenuProjectsStore ? menuProjectsScopeWorkspaceId : '',
    {
      enableRealtime: false,
    },
  );
  const menuProjects = shouldUseDistinctMenuProjectsStore ? distinctMenuProjects : activeProjects;
  const menuProjectsHasFetched =
    shouldUseDistinctMenuProjectsStore
      ? distinctMenuProjectsHasFetched
      : activeProjectsHasFetched;
  const createMenuProject =
    shouldUseDistinctMenuProjectsStore ? createDistinctMenuProject : createActiveProject;
  const createMenuCodingSession =
    shouldUseDistinctMenuProjectsStore
      ? createDistinctMenuCodingSession
      : createActiveCodingSession;
  const refreshMenuProjects =
    shouldUseDistinctMenuProjectsStore ? refreshDistinctMenuProjects : refreshActiveProjects;
  const updateMenuProject =
    shouldUseDistinctMenuProjectsStore ? updateDistinctMenuProject : updateActiveProject;
  const deleteProject =
    shouldUseDistinctMenuProjectsStore ? deleteDistinctMenuProject : deleteActiveProject;

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [renameWorkspaceValue, setRenameWorkspaceValue] = useState('');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectActionsMenuId, setProjectActionsMenuId] = useState<string | null>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
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
  const isDesktopWindowAvailableRef = useRef(false);
  const isDocumentFullscreenRef = useRef(false);
  const desktopWindowStateSyncTokenRef = useRef(0);
  const hasAppliedRecoveredTabRef = useRef(false);
  const hasAnnouncedRecoveryRef = useRef(false);
  const pendingImportedProjectIdRef = useRef('');
  const pendingImportedWorkspaceIdRef = useRef('');
  const previousShowWorkspaceMenuRef = useRef(false);

  const commitWorkspaceSelection = useCallback((workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    setActiveWorkspaceId(normalizedWorkspaceId);
    setMenuActiveWorkspaceId(normalizedWorkspaceId);
    setActiveProjectId('');
    setActiveCodingSessionId('');
    setProjectActionsMenuId(null);
  }, []);

  const previewWorkspaceSelection = useCallback((workspaceId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return;
    }

    setMenuActiveWorkspaceId(normalizedWorkspaceId);
    setProjectActionsMenuId(null);
  }, []);

  const resolvedProjectId = resolveStartupProjectId({
    workspaceId: effectiveWorkspaceId,
    projects: activeProjects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const effectiveProjectId = (activeProjectId || resolvedProjectId).trim();
  const resolvedCodingSessionId = resolveStartupCodingSessionId({
    projectId: effectiveProjectId,
    projects: activeProjects,
    recoverySnapshot: normalizedRecoverySnapshot,
  });
  const effectiveCodingSessionId = (activeCodingSessionId || resolvedCodingSessionId).trim();
  const recoveryAnnouncement = buildWorkbenchRecoveryAnnouncement({
    recoverySnapshot: normalizedRecoverySnapshot,
    activeWorkspaceId: effectiveWorkspaceId,
    activeProjectId: effectiveProjectId,
    activeCodingSessionId: effectiveCodingSessionId,
  });

  const activateImportedProject = useCallback(
    (workspaceId: string, projectId: string) => {
      pendingImportedWorkspaceIdRef.current = workspaceId;
      pendingImportedProjectIdRef.current = projectId;
      setActiveWorkspaceId(workspaceId);
      setMenuActiveWorkspaceId(workspaceId);
      setActiveProjectId(projectId);

      const immediateProjectCollection =
        workspaceId === effectiveWorkspaceId
          ? activeProjects
          : workspaceId === effectiveMenuWorkspaceId
            ? menuProjects
            : [];
      const latestCodingSessionId = resolveLatestCodingSessionIdForProject(
        immediateProjectCollection,
        projectId,
      );
      setActiveCodingSessionId(latestCodingSessionId ?? '');
    },
    [
      activeProjects,
      effectiveMenuWorkspaceId,
      effectiveWorkspaceId,
      menuProjects,
      resolveLatestCodingSessionIdForProject,
    ],
  );

  const hydrateImportedProjectSelectionInBackground = useCallback(
    (workspaceId: string, projectId: string) => {
      void (async () => {
        try {
          if (
            pendingImportedWorkspaceIdRef.current !== workspaceId ||
            pendingImportedProjectIdRef.current !== projectId
          ) {
            return;
          }

          const hydratedProject = await hydrateImportedProjectFromAuthority({
            knownProjects:
              workspaceId === effectiveWorkspaceId
                ? activeProjects
                : workspaceId === effectiveMenuWorkspaceId
                  ? menuProjects
                  : [],
            projectId,
            projectService,
            userScope: user?.id,
            workspaceId,
          });
          if (!hydratedProject) {
            return;
          }

          setActiveCodingSessionId(hydratedProject.latestCodingSessionId ?? '');
          pendingImportedProjectIdRef.current = '';
          pendingImportedWorkspaceIdRef.current = '';
        } catch (error) {
          console.error('Failed to hydrate imported project state from server authority', error);
        }
      })();
    },
    [
      activeProjects,
      effectiveMenuWorkspaceId,
      effectiveWorkspaceId,
      menuProjects,
      projectService,
    ],
  );

  useEffect(() => {
    if (!isRecoveryHydrated || hasAppliedRecoveredTabRef.current) {
      return;
    }

    hasAppliedRecoveredTabRef.current = true;
    setActiveTab(normalizedRecoverySnapshot.activeTab);
  }, [isRecoveryHydrated, normalizedRecoverySnapshot.activeTab]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!isRecoveryHydrated || hasAnnouncedRecoveryRef.current || !recoveryAnnouncement) {
      return;
    }

    hasAnnouncedRecoveryRef.current = true;
    addToast(recoveryAnnouncement, 'info');
  }, [addToast, isRecoveryHydrated, recoveryAnnouncement]);

  useEffect(() => {
    if (workspaces.length === 0) {
      if (activeWorkspaceId) {
        setActiveWorkspaceId('');
      }
      return;
    }

    if (!workspaces.find((workspace) => workspace.id === activeWorkspaceId) && resolvedWorkspaceId) {
      setActiveWorkspaceId(resolvedWorkspaceId);
    }
  }, [activeWorkspaceId, resolvedWorkspaceId, workspaces]);

  useEffect(() => {
    if (effectiveWorkspaceId.length > 0 && !activeProjectsHasFetched) {
      return;
    }

    if (activeProjects.length === 0) {
      if (pendingImportedProjectIdRef.current) {
        return;
      }
      if (activeProjectId) {
        setActiveProjectId('');
      }
      return;
    }

    if (
      pendingImportedProjectIdRef.current &&
      activeProjects.some((project) => project.id === pendingImportedProjectIdRef.current)
    ) {
      pendingImportedProjectIdRef.current = '';
      pendingImportedWorkspaceIdRef.current = '';
    }

    if (!activeProjects.find((project) => project.id === activeProjectId) && resolvedProjectId) {
      setActiveProjectId(resolvedProjectId);
    }
  }, [
    activeProjectId,
    activeProjects,
    activeProjectsHasFetched,
    effectiveWorkspaceId.length,
    resolvedProjectId,
  ]);

  useEffect(() => {
    if (effectiveWorkspaceId.length > 0 && !activeProjectsHasFetched) {
      return;
    }

    const activeProjectCodingSessions =
      activeProjects.find((project) => project.id === effectiveProjectId)?.codingSessions ?? [];

    if (activeProjectCodingSessions.length === 0) {
      if (activeCodingSessionId) {
        setActiveCodingSessionId('');
      }
      return;
    }

    if (
      !activeProjectCodingSessions.find(
        (codingSession) => codingSession.id === activeCodingSessionId,
      ) &&
      resolvedCodingSessionId
    ) {
      setActiveCodingSessionId(resolvedCodingSessionId);
      return;
    }

    if (
      activeCodingSessionId &&
      !activeProjectCodingSessions.find(
        (codingSession) => codingSession.id === activeCodingSessionId,
      )
    ) {
      setActiveCodingSessionId('');
    }
  }, [
    activeCodingSessionId,
    activeProjects,
    activeProjectsHasFetched,
    effectiveProjectId,
    effectiveWorkspaceId.length,
    resolvedCodingSessionId,
  ]);

  useEffect(() => {
    if (!isRecoveryHydrated) {
      return;
    }

    const nextRecoverySnapshot = buildWorkbenchRecoverySnapshot({
      sessionId: normalizedRecoverySnapshot.sessionId || createWorkbenchRecoverySessionId(),
      activeTab,
      activeWorkspaceId: effectiveWorkspaceId,
      activeProjectId: effectiveProjectId,
      activeCodingSessionId: effectiveCodingSessionId,
      cleanExit: false,
    });

    if (recoverySnapshotsEqual(normalizedRecoverySnapshot, nextRecoverySnapshot)) {
      return;
    }

    setRecoverySnapshot(nextRecoverySnapshot);
  }, [
    activeTab,
    effectiveCodingSessionId,
    effectiveProjectId,
    effectiveWorkspaceId,
    isRecoveryHydrated,
    normalizedRecoverySnapshot,
    setRecoverySnapshot,
  ]);

  useEffect(() => {
    if (!isRecoveryHydrated || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      void setStoredJson(
        'workbench',
        'recovery-context',
        buildWorkbenchRecoverySnapshot({
          sessionId: normalizedRecoverySnapshot.sessionId || createWorkbenchRecoverySessionId(),
          activeTab,
          activeWorkspaceId: effectiveWorkspaceId,
          activeProjectId: effectiveProjectId,
          activeCodingSessionId: effectiveCodingSessionId,
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
    effectiveCodingSessionId,
    effectiveProjectId,
    effectiveWorkspaceId,
    isRecoveryHydrated,
    normalizedRecoverySnapshot.sessionId,
  ]);

  useEffect(() => {
    const wasWorkspaceMenuOpen = previousShowWorkspaceMenuRef.current;
    previousShowWorkspaceMenuRef.current = showWorkspaceMenu;

    if (showWorkspaceMenu && !wasWorkspaceMenuOpen) {
      setMenuActiveWorkspaceId((currentWorkspaceId) =>
        currentWorkspaceId === effectiveWorkspaceId
          ? currentWorkspaceId
          : effectiveWorkspaceId,
      );
      return;
    }

    if (!showWorkspaceMenu && !menuActiveWorkspaceId && effectiveWorkspaceId) {
      setMenuActiveWorkspaceId(effectiveWorkspaceId);
    }
  }, [effectiveWorkspaceId, menuActiveWorkspaceId, showWorkspaceMenu]);

  useEffect(() => {
    const handleOpenTerminal = (path?: string, command?: string) => {
      setTerminalRequest({ path, command, timestamp: Date.now() });
      setActiveTab(prev => {
        if (prev !== 'terminal' && prev !== 'code' && prev !== 'studio') {
          return 'terminal';
        }
        return prev;
      });
    };
    const handleRevealInExplorer = async (path?: string) => {
      try {
        if (window.__TAURI__) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(path || '');
          addToast(t('app.revealedInExplorer', { path: path || 'project' }), 'info');
        } else {
          addToast(t('app.revealedInExplorerMock', { path: path || 'project' }), 'info');
        }
      } catch (e) {
        addToast(t('app.revealedInExplorerMock', { path: path || 'project' }), 'info');
      }
    };
    const handleOpenSettings = () => {
      setActiveTab('settings');
    };
    const handleTerminalRequest = (req: TerminalCommandRequest) => {
      setTerminalRequest(req);
      const currentActiveTab = activeTabRef.current;
      if (
        currentActiveTab !== 'terminal' &&
        currentActiveTab !== 'code' &&
        currentActiveTab !== 'studio'
      ) {
        setActiveTab('terminal');
      }
    };
    const handleNewTerminal = () => {
      setActiveTab(prev => {
        if (prev !== 'terminal' && prev !== 'code' && prev !== 'studio') {
          return 'terminal';
        }
        return prev;
      });
    };
    const unsubscribeTerminal = globalEventBus.on('openTerminal', handleOpenTerminal);
    const unsubscribeNewTerminal = globalEventBus.on('newTerminal', handleNewTerminal);
    const unsubscribeReveal = globalEventBus.on('revealInExplorer', handleRevealInExplorer);
    const unsubscribeSettings = globalEventBus.on('openSettings', handleOpenSettings);
    const unsubscribeTerminalReq = globalEventBus.on('terminalRequest', handleTerminalRequest);
    return () => {
      unsubscribeTerminal();
      unsubscribeNewTerminal();
      unsubscribeReveal();
      unsubscribeSettings();
      unsubscribeTerminalReq();
    };
  }, [addToast, t]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
        setIsCreatingWorkspace(false);
        setNewWorkspaceName('');
        setIsCreatingProject(false);
        setNewProjectName('');
        setProjectActionsMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const currentActiveTab = activeTabRef.current;
      
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        if (currentActiveTab !== 'code' && currentActiveTab !== 'studio') {
          setActiveTab('code');
          setTimeout(() => globalEventBus.emit('createNewThread'), 100);
        } else {
          globalEventBus.emit('createNewThread');
        }
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
        globalEventBus.emit('previousThread');
      } else if (cmdOrCtrl && e.shiftKey && e.key === ']') {
        e.preventDefault();
        globalEventBus.emit('nextThread');
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
        globalEventBus.emit('newTerminal');
      } else if (cmdOrCtrl && e.shiftKey && e.key === '5') {
        e.preventDefault();
        globalEventBus.emit('splitTerminal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectFolderAndImportProject = async (fallbackProjectName: string) => {
    const { openLocalFolder } = await import('@sdkwork/birdcoder-commons/platform/fileSystem');
    const folderInfo = await openLocalFolder();
    if (!folderInfo) {
      return null;
    }

    const resolveTargetWorkspaceId = async (): Promise<string> => {
      const immediateWorkspaceId =
        (
          effectiveMenuWorkspaceId ||
          effectiveWorkspaceId ||
          activeWorkspaceId ||
          workspaces[0]?.id ||
          ''
        ).trim();
      if (immediateWorkspaceId) {
        return immediateWorkspaceId;
      }

      const refreshedWorkspaces = await refreshWorkspaces();
      const refreshedWorkspaceId = (
        resolveStartupWorkspaceId({
          workspaces: refreshedWorkspaces,
          recoverySnapshot: normalizedRecoverySnapshot,
        }) ||
        refreshedWorkspaces[0]?.id ||
        ''
      ).trim();

      if (!refreshedWorkspaceId) {
        throw new Error('Default workspace is unavailable. Please wait for workspace initialization to complete.');
      }

      setActiveWorkspaceId((currentWorkspaceId) => currentWorkspaceId || refreshedWorkspaceId);
      setMenuActiveWorkspaceId(refreshedWorkspaceId);
      return refreshedWorkspaceId;
    };

    const targetWorkspaceId = await resolveTargetWorkspaceId();
    const normalizedTargetWorkspaceId = targetWorkspaceId.trim();
    const createProjectForTargetWorkspace = (name: string, options?: Parameters<typeof createMenuProject>[1]) => {
      if (normalizedTargetWorkspaceId === menuProjectsScopeWorkspaceId) {
        return createMenuProject(name, options);
      }
      if (normalizedTargetWorkspaceId === projectsWorkspaceId) {
        return createActiveProject(name, options);
      }
      return projectService.createProject(normalizedTargetWorkspaceId, name, options);
    };
    const updateProjectForTargetWorkspace = (
      projectId: string,
      updates: Parameters<typeof updateMenuProject>[1],
    ) => {
      if (normalizedTargetWorkspaceId === menuProjectsScopeWorkspaceId) {
        return updateMenuProject(projectId, updates);
      }
      if (normalizedTargetWorkspaceId === projectsWorkspaceId) {
        return updateActiveProject(projectId, updates);
      }
      return projectService.updateProject(projectId, updates);
    };

    const importedProject = await importLocalFolderProject({
      createProject: createProjectForTargetWorkspace,
      fallbackProjectName,
      folderInfo,
      getProjectByPath: (projectPath) =>
        projectService.getProjectByPath(normalizedTargetWorkspaceId, projectPath),
      mountFolder: (projectId, nextFolderInfo) =>
        fileSystemService.mountFolder(projectId, nextFolderInfo),
      updateProject: updateProjectForTargetWorkspace,
    });

    return {
      ...importedProject,
      workspaceId: targetWorkspaceId,
    };
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    
    try {
      const newWs = await createWorkspace(newWorkspaceName);
      commitWorkspaceSelection(newWs.id);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName('');
      setShowWorkspaceMenu(false);
    } catch (error) {
      console.error("Failed to create workspace", error);
    }
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
        const updateImportedProjectName =
          importedProject.workspaceId === menuProjectsScopeWorkspaceId
            ? updateMenuProject
            : importedProject.workspaceId === projectsWorkspaceId
              ? updateActiveProject
              : projectService.updateProject;
        await updateImportedProjectName(importedProject.projectId, {
          name: normalizedProjectName,
        });
      }

      activateImportedProject(importedProject.workspaceId, importedProject.projectId);
      hydrateImportedProjectSelectionInBackground(
        importedProject.workspaceId,
        importedProject.projectId,
      );
      setIsCreatingProject(false);
      setNewProjectName('');
      setShowWorkspaceMenu(false);
    } catch (error) {
      console.error("Failed to create project", error);
    }
  };

  const confirmDeleteWorkspace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (workspaces.length <= 1) {
      addToast(t('app.cannotDeleteLastWorkspace'), "error");
      return;
    }
    setWorkspaceToDelete(id);
    setShowWorkspaceMenu(false);
  };

  const confirmDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setProjectActionsMenuId(null);
    setShowWorkspaceMenu(false);
  };

  const executeDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      await deleteWorkspace(workspaceToDelete);
      if (activeWorkspaceId === workspaceToDelete) {
        const remaining = workspaces.filter(w => w.id !== workspaceToDelete);
        if (remaining.length > 0) {
          setActiveWorkspaceId(remaining[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to delete workspace", error);
    } finally {
      setWorkspaceToDelete(null);
    }
  };

  const handleRenameWorkspace = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateWorkspace(id, newName.trim());
    } catch (error) {
      console.error("Failed to rename workspace", error);
      addToast(t('app.failedToRenameWorkspace'), "error");
    }
  };

  const handleRenameProject = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateMenuProject(id, { name: newName.trim() });
    } catch (error) {
      console.error("Failed to rename project", error);
      addToast(t('app.failedToRenameProject'), "error");
    }
  };

  const executeDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      if (activeProjectId === projectToDelete) {
        setActiveProjectId('');
        setActiveCodingSessionId('');
      }
      addToast(t('app.projectRemoved'), "success");
    } catch (error) {
      console.error("Failed to delete project", error);
      addToast(t('app.failedToRemoveProject'), "error");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleOpenProjectInExplorer = useCallback(
    (projectPath?: string, projectName?: string) => {
      const normalizedProjectPath = projectPath?.trim() ?? '';
      if (!normalizedProjectPath) {
        addToast(t('app.projectPathUnavailable', { name: projectName ?? 'project' }), 'error');
        return;
      }

      globalEventBus.emit('revealInExplorer', normalizedProjectPath);
    },
    [addToast, t],
  );

  const handleCreateProjectSession = useCallback(
    async (projectId: string) => {
      const targetProject = menuProjects.find((project) => project.id === projectId);
      if (!targetProject) {
        addToast(t('app.noProjectsFound'), 'error');
        return;
      }

      try {
        const newSession = await createMenuCodingSession(projectId, t('app.menu.newThread'));
        setActiveWorkspaceId(effectiveMenuWorkspaceId);
        setMenuActiveWorkspaceId(effectiveMenuWorkspaceId);
        setActiveProjectId(projectId);
        setActiveCodingSessionId(newSession.id);
        setActiveTab('code');
        setProjectActionsMenuId(null);
        setShowWorkspaceMenu(false);
      } catch (error) {
        console.error('Failed to create project session', error);
        addToast(t('code.failedToCreateThread'), 'error');
      }
    },
    [
      addToast,
      createMenuCodingSession,
      effectiveMenuWorkspaceId,
      menuProjects,
      t,
    ],
  );

  const getDesktopWindow = async () => {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) {
      return null;
    }

    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  };

  const applyDesktopWindowFrameState = useCallback(
    (nextState: {
      isAvailable: boolean;
      isMaximized: boolean;
      isMinimized: boolean;
    }) => {
      isDesktopWindowAvailableRef.current = nextState.isAvailable;
      setIsDesktopWindowAvailable(nextState.isAvailable);
      setIsDesktopWindowMaximized(nextState.isMaximized);
      setIsDesktopWindowMinimized(nextState.isMinimized);
    },
    [],
  );

  const syncDesktopWindowFrameState = useCallback(
    async (
      desktopWindow: NonNullable<Awaited<ReturnType<typeof getDesktopWindow>>>,
    ) => {
      const syncToken = ++desktopWindowStateSyncTokenRef.current;
      const [nextIsMaximized, nextIsMinimized] = await Promise.all([
        desktopWindow.isMaximized(),
        desktopWindow.isMinimized(),
      ]);

      if (syncToken !== desktopWindowStateSyncTokenRef.current) {
        return;
      }

      applyDesktopWindowFrameState({
        isAvailable: true,
        isMaximized: nextIsMaximized,
        isMinimized: nextIsMinimized,
      });
    },
    [applyDesktopWindowFrameState],
  );

  useEffect(() => {
    let cancelled = false;
    let resizeAnimationFrame = 0;
    const unlistenCallbacks: Array<() => void> = [];

    const cancelPendingAnimationFrame = () => {
      if (resizeAnimationFrame === 0 || typeof window === 'undefined') {
        return;
      }

      window.cancelAnimationFrame(resizeAnimationFrame);
      resizeAnimationFrame = 0;
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

    const scheduleDesktopWindowFrameSync = (
      desktopWindow: NonNullable<Awaited<ReturnType<typeof getDesktopWindow>>>,
    ) => {
      if (typeof window === 'undefined') {
        void syncDesktopWindowFrameState(desktopWindow);
        return;
      }

      if (resizeAnimationFrame !== 0) {
        return;
      }

      resizeAnimationFrame = window.requestAnimationFrame(() => {
        resizeAnimationFrame = 0;
        void syncDesktopWindowFrameState(desktopWindow);
      });
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

        await syncDesktopWindowFrameState(desktopWindow);
        await registerWindowListener(
          desktopWindow.onResized(() => {
            scheduleDesktopWindowFrameSync(desktopWindow);
          }),
        );
        await registerWindowListener(
          desktopWindow.onScaleChanged(() => {
            scheduleDesktopWindowFrameSync(desktopWindow);
          }),
        );
        await registerWindowListener(
          desktopWindow.onFocusChanged(() => {
            scheduleDesktopWindowFrameSync(desktopWindow);
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
      cancelPendingAnimationFrame();
      for (const unlisten of unlistenCallbacks) {
        unlisten();
      }
    };
  }, [applyDesktopWindowFrameState, syncDesktopWindowFrameState]);

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

  if (titleBarWindowDragControllerRef.current === null) {
    titleBarWindowDragControllerRef.current = createAppHeaderWindowDragController({
      canStartDragging: () =>
        isDesktopWindowAvailableRef.current && !isDocumentFullscreenRef.current,
      startDragging: async () => {
        try {
          const desktopWindow = await getDesktopWindow();
          if (!desktopWindow) {
            return;
          }

          await desktopWindow.startDragging();
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

  const handleMinimize = async () => {
    try {
      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      await desktopWindow.minimize();
      await syncDesktopWindowFrameState(desktopWindow);
    } catch (error) {
      console.warn('Failed to minimize desktop window', error);
    }
  };

  const handleMaximize = async () => {
    try {
      const desktopWindow = await getDesktopWindow();
      if (!desktopWindow) {
        return;
      }

      await desktopWindow.toggleMaximize();
      await syncDesktopWindowFrameState(desktopWindow);
    } catch (error) {
      console.warn('Failed to toggle desktop window maximize state', error);
    }
  };

  const handleClose = async () => {
    try {
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
  };

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

    await handleMaximize();
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

  const handleOpenFolder = async () => {
    try {
      const importedProject = await selectFolderAndImportProject(t('app.localFolder'));
      if (importedProject) {
        activateImportedProject(importedProject.workspaceId, importedProject.projectId);
        hydrateImportedProjectSelectionInBackground(
          importedProject.workspaceId,
          importedProject.projectId,
        );
        addToast(t('app.openedFolder', { name: importedProject.projectName }), 'success');
      }
    } catch (e) {
      console.error("Failed to open folder", e);
      addToast(t('app.failedToOpenFolder'), 'error');
    }
  };

  const handleEditCommand = (command: string) => {
    const activeEl = document.activeElement;
    const isMonaco = activeEl && activeEl.classList.contains('inputarea');
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !isMonaco) {
      document.execCommand(command);
    } else {
      globalEventBus.emit('editorCommand', command);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    const currentZoom = parseFloat(document.body.style.zoom || '1');
    if (direction === 'in') document.body.style.zoom = (currentZoom + 0.1).toString();
    else if (direction === 'out') document.body.style.zoom = Math.max(0.5, currentZoom - 0.1).toString();
    else document.body.style.zoom = '1';
  };

  openFolderHandlerRef.current = () => {
    void handleOpenFolder();
  };
  zoomHandlerRef.current = handleZoom;
  toggleFullScreenHandlerRef.current = toggleFullScreen;

  const activeWorkspace = workspaces.find(w => w.id === effectiveWorkspaceId) || workspaces[0];
  const activeProject = activeProjects.find(p => p.id === effectiveProjectId);
  const titleBarDragEnabled = isDesktopWindowAvailable && !isDocumentFullscreen;
  const titleBarDragSurfaceClass = titleBarDragEnabled
    ? 'cursor-grab border-white/[0.10] text-gray-200 hover:border-white/[0.16] hover:bg-white/[0.04] active:cursor-grabbing active:bg-white/[0.06]'
    : 'cursor-default border-white/[0.06] text-gray-400';

  const getWorkspaceIcon = (iconName?: string) => {
    switch(iconName) {
      case 'Briefcase': return <Briefcase size={14} />;
      case 'Globe': return <Globe size={14} />;
      case 'User': return <User size={14} />;
      default: return <Folder size={14} />;
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex h-full w-full bg-[#0e0e11] text-white items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<SurfaceLoader fullScreen />}>
        <AuthPage />
      </Suspense>
    );
  }

  const handleToggleRecording = () => {
    const nextRecordingState = !isRecording;
    setIsRecording(nextRecordingState);
    addToast(
      nextRecordingState ? t('app.traceRecordingStarted') : t('app.traceRecordingStopped'),
      'success',
    );
  };

  return (
      <div
        className="flex flex-col h-full w-full bg-[#0e0e11] text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30"
        data-desktop-window-maximized={isDesktopWindowMaximized ? 'true' : 'false'}
        data-desktop-window-minimized={isDesktopWindowMinimized ? 'true' : 'false'}
      >
      {/* Top Header / Title Bar */}
      <div
        className="grid h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.08] bg-[#0e0e11] px-2 shrink-0 select-none z-50 touch-none"
        onPointerDown={handleTitleBarPointerDown}
        onContextMenu={handleTitleBarContextMenu}
        onDragStart={handleTitleBarDragStart}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        {/* Left: Logo/Title & Menus */}
        <div
          className="flex min-w-0 items-center gap-3 h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
          style={{ animationDelay: '0ms' }}
        >
          <div className={`flex h-8 min-w-[148px] items-center gap-2 rounded-lg border px-2.5 transition-colors ${titleBarDragSurfaceClass}`}>
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Code2 size={12} className="text-white" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
                BirdCoder
              </span>
              <span className="hidden truncate text-[10px] text-gray-500 xl:inline">
                {activeProject?.name || activeWorkspace?.name || t('app.workspace')}
              </span>
            </div>
          </div>

          <div
            data-no-drag="true"
            className="flex min-w-0 items-center gap-1"
          >
            <TopMenu label={t('app.menu.file')} items={[
              { label: t('app.menu.newThread'), shortcut: 'Ctrl+N', onClick: () => {
                if (activeTab !== 'code' && activeTab !== 'studio') {
                  setActiveTab('code');
                  setTimeout(() => globalEventBus.emit('createNewThread'), 100);
                } else {
                  globalEventBus.emit('createNewThread');
                }
              }},
              { label: t('app.menu.openFolder'), shortcut: 'Ctrl+O', onClick: handleOpenFolder },
              { label: '', divider: true },
              { label: t('app.menu.save'), shortcut: 'Ctrl+S', onClick: () => globalEventBus.emit('saveActiveFile') },
              { label: t('app.menu.saveAll'), shortcut: 'Ctrl+Shift+S', onClick: () => globalEventBus.emit('saveAllFiles') },
              { label: '', divider: true },
              { label: t('app.menu.logOut'), onClick: () => logout() },
              { label: t('app.menu.exit'), onClick: handleClose },
              { label: t('app.menu.settings'), shortcut: 'Ctrl+,', onClick: () => setActiveTab('settings') },
              { label: '', divider: true },
              { label: t('app.menu.aboutCodex'), onClick: () => setShowAboutModal(true) },
            ]} />
            <TopMenu label={t('app.menu.edit')} items={[
              { label: t('app.menu.undo'), shortcut: 'Ctrl+Z', onClick: () => handleEditCommand('undo') },
              { label: t('app.menu.redo'), shortcut: 'Ctrl+Y', onClick: () => handleEditCommand('redo') },
              { label: '', divider: true },
              { label: t('app.menu.cut'), shortcut: 'Ctrl+X', onClick: () => handleEditCommand('cut') },
              { label: t('app.menu.copy'), shortcut: 'Ctrl+C', onClick: () => handleEditCommand('copy') },
              { label: t('app.menu.paste'), shortcut: 'Ctrl+V', onClick: () => handleEditCommand('paste') },
              { label: t('app.menu.delete'), shortcut: 'Del', onClick: () => handleEditCommand('delete') },
              { label: '', divider: true },
              { label: t('app.menu.selectAll'), shortcut: 'Ctrl+A', onClick: () => handleEditCommand('selectAll') },
            ]} />
            <TopMenu label={t('app.menu.view')} items={[
              { label: t('app.menu.toggleSidebar'), shortcut: 'Ctrl+B', onClick: () => globalEventBus.emit('toggleSidebar') },
              { label: t('app.menu.toggleTerminal'), shortcut: 'Ctrl+J', onClick: () => {
                if (activeTab !== 'code') setActiveTab('code');
                setTimeout(() => globalEventBus.emit('toggleTerminal'), 100);
              }},
              { label: t('app.menu.toggleDiffPanel'), shortcut: 'Alt+Ctrl+B', onClick: () => globalEventBus.emit('toggleDiffPanel') },
              { label: t('app.menu.find'), shortcut: 'Ctrl+F', onClick: () => globalEventBus.emit('findInFiles') },
              { label: '', divider: true },
              { label: t('app.menu.zoomIn'), shortcut: 'Ctrl+=', onClick: () => handleZoom('in') },
              { label: t('app.menu.zoomOut'), shortcut: 'Ctrl+-', onClick: () => handleZoom('out') },
              { label: t('app.menu.actualSize'), shortcut: 'Ctrl+0', onClick: () => handleZoom('reset') },
              { label: '', divider: true },
              { label: t('app.menu.toggleFullScreen'), shortcut: 'F11', onClick: toggleFullScreen },
            ]} />
            <TopMenu label={t('app.menu.go')} items={[
              { label: t('app.menu.goToFile'), shortcut: 'Ctrl+P', onClick: () => globalEventBus.emit('openQuickOpen') },
              { label: '', divider: true },
              { label: t('app.menu.previousThread'), shortcut: 'Ctrl+Shift+[', onClick: () => globalEventBus.emit('previousThread') },
              { label: t('app.menu.nextThread'), shortcut: 'Ctrl+Shift+]', onClick: () => globalEventBus.emit('nextThread') },
              { label: t('app.menu.back'), shortcut: 'Ctrl+[', onClick: () => window.history.back() },
              { label: t('app.menu.forward'), shortcut: 'Ctrl+]', onClick: () => window.history.forward() },
            ]} />
            <TopMenu label={t('app.menu.run')} items={[
              { label: t('app.menu.startDebugging'), shortcut: 'F5', onClick: () => globalEventBus.emit('startDebugging') },
              { label: t('app.menu.runWithoutDebugging'), shortcut: 'Ctrl+F5', onClick: () => globalEventBus.emit('runWithoutDebugging') },
              { label: '', divider: true },
              { label: t('app.menu.addConfiguration'), onClick: () => globalEventBus.emit('addRunConfiguration') },
            ]} />
            <TopMenu label={t('app.menu.terminal')} items={[
              { label: t('app.menu.newTerminal'), shortcut: 'Ctrl+Shift+`', onClick: () => globalEventBus.emit('newTerminal') },
              { label: t('app.menu.splitTerminal'), shortcut: 'Ctrl+Shift+5', onClick: () => globalEventBus.emit('splitTerminal') },
              { label: '', divider: true },
              { label: t('app.menu.runTask'), onClick: () => globalEventBus.emit('runTask') },
            ]} />
            <TopMenu label={t('app.menu.window')} items={[
              { label: t('app.menu.minimize'), onClick: handleMinimize },
              { label: t('app.menu.maximize'), onClick: handleMaximize },
              { label: t('app.menu.close'), onClick: handleClose },
            ]} />
            <TopMenu label={t('app.menu.help')} items={[
              { label: t('app.menu.documentation'), onClick: () => window.open('https://github.com', '_blank') },
              { label: t('app.menu.whatsNew'), onClick: () => setShowWhatsNewModal(true) },
              { label: t('app.menu.skills'), onClick: () => setActiveTab('skills') },
              { label: '', divider: true },
              { label: t('app.menu.keyboardShortcuts'), shortcut: 'Ctrl+K Ctrl+R', onClick: () => setShowShortcutsModal(true) },
              { label: '', divider: true },
              { label: isRecording ? t('app.menu.stopTraceRecording') : t('app.menu.startTraceRecording'), onClick: handleToggleRecording },
              { label: '', divider: true },
              { label: t('app.menu.aboutCodex'), onClick: () => setShowAboutModal(true) },
            ]} />
          </div>
        </div>

        {/* Middle: Workspace Switcher */}
        <div
          className="flex min-w-0 items-center justify-center h-full relative animate-in fade-in slide-in-from-top-2 fill-mode-both"
          ref={workspaceMenuRef}
          style={{ animationDelay: '50ms' }}
        >
          <button
            type="button"
            data-no-drag="true"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            aria-expanded={showWorkspaceMenu}
            aria-haspopup="menu"
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg text-xs text-gray-300 transition-colors group"
          >
            <span className="text-gray-400 group-hover:text-gray-300 transition-colors">{getWorkspaceIcon(activeWorkspace?.icon)}</span>
            <div className="flex items-center gap-1.5">
              <span className="truncate max-w-[120px] font-medium text-gray-300 group-hover:text-white transition-colors">{activeWorkspace?.name || t('app.workspace')}</span>
              <span className="text-gray-600 text-[10px]">/</span>
              <span className="truncate max-w-[120px] font-medium text-gray-400 group-hover:text-gray-300 transition-colors">{activeProject?.name || '-'}</span>
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
          </button>

          {showWorkspaceMenu && (
            <div
              data-no-drag="true"
              className="absolute top-full mt-2 w-[500px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex h-[320px]">
                {/* Left Pane: Workspaces */}
                <div className="w-[45%] border-r border-white/10 overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/30 flex flex-col gap-1">
                  <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('app.workspaces')}</div>
                  {workspaces.map((ws, idx) => {
                    const isMenuSelected = effectiveMenuWorkspaceId === ws.id;
                    const isActualSelected = effectiveWorkspaceId === ws.id;
                    return (
                      <div key={ws.id} className="flex items-center group relative">
                        <button
                          onClick={() => {
                            previewWorkspaceSelection(ws.id);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all animate-in fade-in slide-in-from-left-2 fill-mode-both ${
                            isMenuSelected 
                              ? 'bg-white/5 text-gray-100 shadow-sm' 
                              : 'text-gray-400 hover:bg-white/5/60 hover:text-gray-200'
                          }`}
                          style={{ animationDelay: `${idx * 20}ms` }}
                        >
                          <div className="flex items-center gap-2.5 truncate flex-1">
                            <span className={isMenuSelected ? 'text-blue-400 shrink-0' : 'text-gray-500 group-hover:text-gray-400 shrink-0'}>
                              {getWorkspaceIcon(ws.icon)}
                            </span>
                            {renamingWorkspaceId === ws.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={renameWorkspaceValue}
                                onChange={(e) => setRenameWorkspaceValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (renameWorkspaceValue.trim() && renameWorkspaceValue !== ws.name) {
                                      handleRenameWorkspace(ws.id, renameWorkspaceValue);
                                    }
                                    setRenamingWorkspaceId(null);
                                  } else if (e.key === 'Escape') {
                                    setRenamingWorkspaceId(null);
                                  }
                                }}
                                onBlur={() => setRenamingWorkspaceId(null)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
                              />
                            ) : (
                              <span className="truncate font-medium">{ws.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isActualSelected && <Check size={14} className="text-gray-500" />}
                            {isMenuSelected && <ChevronRight size={14} className="text-gray-500" />}
                          </div>
                        </button>
                        {workspaces.length > 1 && renamingWorkspaceId !== ws.id && (
                          <div className="absolute right-6 flex items-center opacity-0 group-hover:opacity-100 transition-all z-10 bg-[#18181b]/80 backdrop-blur-sm rounded-md px-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingWorkspaceId(ws.id);
                                setRenameWorkspaceValue(ws.name);
                              }}
                              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                              title={t('app.renameWorkspace')}
                            >
                              <Edit size={12} />
                            </button>
                            <button 
                              onClick={(e) => confirmDeleteWorkspace(e, ws.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                              title={t('app.deleteWorkspace')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right Pane: Projects */}
                <div className="w-[55%] overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/10 flex flex-col gap-1 relative">
                  <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('app.projects')}</div>
                  {!menuProjectsHasFetched && shouldUseDistinctMenuProjectsStore ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white/70" />
                    </div>
                  ) : menuProjects.length > 0 ? (
                    menuProjects.map((project, idx) => {
                      const isSelected =
                        effectiveWorkspaceId === effectiveMenuWorkspaceId &&
                        effectiveProjectId === project.id;
                      return (
                        <div key={project.id} className="flex items-center group relative">
                          <button
                            onClick={() => {
                              const nextWorkspaceId = effectiveMenuWorkspaceId.trim();
                              const nextProjectId = project.id.trim();
                              const immediateProjectCollection =
                                nextWorkspaceId === effectiveWorkspaceId
                                  ? activeProjects
                                  : nextWorkspaceId === effectiveMenuWorkspaceId
                                    ? menuProjects
                                    : [];
                              const nextCodingSessionId =
                                resolveLatestCodingSessionIdForProject(
                                  immediateProjectCollection,
                                  nextProjectId,
                                ) ?? '';
                              const shouldResetCodingSession =
                                nextWorkspaceId !== effectiveWorkspaceId ||
                                nextProjectId !== effectiveProjectId;

                              if (nextWorkspaceId && nextWorkspaceId !== effectiveWorkspaceId) {
                                setActiveWorkspaceId(nextWorkspaceId);
                              }
                              setMenuActiveWorkspaceId(nextWorkspaceId || effectiveWorkspaceId);
                              setActiveProjectId(nextProjectId);
                              if (shouldResetCodingSession || nextCodingSessionId) {
                                setActiveCodingSessionId(nextCodingSessionId);
                              }
                              setProjectActionsMenuId(null);
                              setShowWorkspaceMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all animate-in fade-in slide-in-from-left-2 fill-mode-both ${
                              isSelected 
                                ? 'bg-blue-500/10 text-blue-400' 
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                            style={{ animationDelay: `${idx * 20}ms` }}
                          >
                            <div className="flex items-center gap-3 truncate flex-1">
                              <Folder size={14} className={isSelected ? 'text-blue-400 shrink-0' : 'text-gray-500 group-hover:text-gray-400 shrink-0'} />
                              {renamingProjectId === project.id ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={renameProjectValue}
                                  onChange={(e) => setRenameProjectValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (renameProjectValue.trim() && renameProjectValue !== project.name) {
                                        handleRenameProject(project.id, renameProjectValue);
                                      }
                                      setRenamingProjectId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingProjectId(null);
                                    }
                                  }}
                                  onBlur={() => setRenamingProjectId(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
                                />
                              ) : (
                                <span className="truncate font-medium">{project.name}</span>
                              )}
                            </div>
                            {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                          </button>
                          {renamingProjectId !== project.id && (
                            <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10 bg-[#18181b]/80 backdrop-blur-sm rounded-md px-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCreateProjectSession(project.id);
                                }}
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                                title={t('code.newThreadInProject')}
                              >
                                <Plus size={12} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectActionsMenuId((currentValue) =>
                                    currentValue === project.id ? null : project.id,
                                  );
                                }}
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                                title={t('app.moreActions')}
                              >
                                <MoreHorizontal size={12} />
                              </button>
                            </div>
                          )}
                          {projectActionsMenuId === project.id && renamingProjectId !== project.id && (
                            <div className="absolute right-2 top-11 z-20 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 shadow-2xl backdrop-blur-xl">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingProjectId(project.id);
                                  setRenameProjectValue(project.name);
                                  setProjectActionsMenuId(null);
                                }}
                                className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                {t('app.renameProject')}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProjectInExplorer(project.path, project.name);
                                  setProjectActionsMenuId(null);
                                  setShowWorkspaceMenu(false);
                                }}
                                className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                {t('code.openInFileExplorer')}
                              </button>
                              <div className="my-1 h-px bg-white/10" />
                              <button
                                type="button"
                                onClick={(e) => confirmDeleteProject(e, project.id)}
                                className="flex w-full items-center px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                              >
                                {t('app.removeProject')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-gray-500 text-xs">
                      {t('app.noProjectsFound')}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex border-t border-white/10 bg-[#0e0e11]/80 backdrop-blur-sm">
                <div className="w-[45%] p-2 border-r border-white/10">
                  {isCreatingWorkspace ? (
                    <form onSubmit={handleCreateWorkspace} className="px-1 py-0.5">
                      <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder={t('app.workspaceNamePlaceholder')}
                        className="w-full bg-black/50 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5 mt-2">
                        <button 
                          type="button" 
                          onClick={() => setIsCreatingWorkspace(false)}
                          className="px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                        >
                          {t('app.cancel')}
                        </button>
                        <button 
                          type="submit"
                          disabled={!newWorkspaceName.trim()}
                          className="px-2.5 py-1 text-[10px] font-medium bg-white text-black hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {t('app.create')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsCreatingWorkspace(true)}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                    >
                      <Plus size={12} />
                      {t('app.newWorkspace')}
                    </button>
                  )}
                </div>
                <div className="w-[55%] p-2">
                  {isCreatingProject ? (
                    <form onSubmit={handleCreateProject} className="px-1 py-0.5">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder={t('app.projectNamePlaceholder')}
                        className="w-full bg-black/50 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5 mt-2">
                        <button 
                          type="button" 
                          onClick={() => setIsCreatingProject(false)}
                          className="px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                        >
                          {t('app.cancel')}
                        </button>
                        <button 
                          type="submit"
                          disabled={!newProjectName.trim()}
                          className="px-2.5 py-1 text-[10px] font-medium bg-white text-black hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {t('app.create')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      onClick={() => setIsCreatingProject(true)}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-dashed border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all font-medium"
                    >
                      <Plus size={12} />
                      {t('app.newProject')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Window Controls & Actions */}
        <div 
          data-no-drag="true"
          className="flex items-center justify-end h-full animate-in fade-in slide-in-from-top-2 fill-mode-both"
          style={{ animationDelay: '100ms' }}
        >
          {isDesktopWindowAvailable ? (
            <div className="flex h-full items-center">
              <button
                type="button"
                onClick={handleMinimize}
                aria-label={t('app.menu.minimize')}
                title={t('app.menu.minimize')}
                className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                onClick={handleMaximize}
                aria-label={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
                title={isDesktopWindowMaximized ? t('common.restore') : t('app.menu.maximize')}
                className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
              >
                {isDesktopWindowMaximized ? <SquareSquare size={12} /> : <Square size={12} />}
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('app.menu.close')}
                title={t('app.menu.close')}
                className="h-full px-3 hover:bg-red-500 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-md"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Primary Sidebar */}
        <div className="w-14 flex flex-col items-center py-4 border-r border-white/[0.08] bg-[#0e0e11] justify-between shrink-0">
          <div className="flex flex-col gap-3 items-center w-full px-2">
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('code')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'code' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '0ms' }} title={t('app.code')}>
              <Code2 size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('studio')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'studio' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '50ms' }} title={t('app.studio')}>
              <Sparkles size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('terminal')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'terminal' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '100ms' }} title={t('app.terminal')}>
              <Terminal size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('skills')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'skills' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '150ms' }} title={t('app.skills')}>
              <Zap size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('templates')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'templates' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '200ms' }} title={t('app.templates')}>
              <LayoutTemplate size={22} strokeWidth={1.5} />
            </Button>
          </div>
          <div className="flex flex-col gap-3 items-center w-full px-2">
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('user')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'user' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '250ms' }} title={t('app.userProfile')}>
              <UserCircle size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('vip')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'vip' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '300ms' }} title="VIP Membership">
              <Shield size={22} strokeWidth={1.5} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')} className={`w-10 h-10 rounded-xl transition-all duration-200 animate-in fade-in slide-in-from-left-2 fill-mode-both ${activeTab === 'settings' ? 'text-white bg-white/10 shadow-sm' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`} style={{ animationDelay: '350ms' }} title={t('app.settings')}>
              <Settings size={22} strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#0e0e11]">
          <Suspense fallback={<SurfaceLoader />}>
            {activeTab === 'code' && (
              <CodePage
                workspaceId={effectiveWorkspaceId}
                projectId={effectiveProjectId}
                initialCodingSessionId={effectiveCodingSessionId}
                onProjectChange={setActiveProjectId}
                onCodingSessionChange={setActiveCodingSessionId}
              />
            )}
            {activeTab === 'studio' && (
              <StudioPage
                workspaceId={effectiveWorkspaceId}
                projectId={effectiveProjectId}
                initialCodingSessionId={effectiveCodingSessionId}
                onProjectChange={setActiveProjectId}
                onCodingSessionChange={setActiveCodingSessionId}
              />
            )}
            {activeTab === 'terminal' && (
              <TerminalPage
                terminalRequest={terminalRequest}
                workspaceId={effectiveWorkspaceId}
                projectId={effectiveProjectId || null}
              />
            )}
            {activeTab === 'skills' && <SkillsPage workspaceId={effectiveWorkspaceId} />}
            {activeTab === 'templates' && <TemplatesPage workspaceId={effectiveWorkspaceId} onProjectCreated={(id) => { setActiveProjectId(id); setActiveTab('code'); }} />}
            {activeTab === 'user' && <UserCenterPage onOpenVip={() => setActiveTab('vip')} />}
            {activeTab === 'vip' && <VipPage />}
            {activeTab === 'settings' && <SettingsPage onBack={() => setActiveTab('code')} />}
          </Suspense>
        </div>
      </div>

      {/* Delete Workspace Modal */}
      {workspaceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">{t('app.deleteWorkspaceTitle')}</h3>
            <p className="text-sm text-gray-400 mb-6">
              {t('app.deleteWorkspaceConfirm')}
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setWorkspaceToDelete(null)}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('app.cancel')}
              </Button>
              <Button 
                variant="default" 
                onClick={executeDeleteWorkspace}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('app.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">{t('app.removeProjectTitle')}</h3>
            <p className="text-sm text-gray-400 mb-6">
              {t('app.removeProjectConfirm')}
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setProjectToDelete(null)}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('app.cancel')}
              </Button>
              <Button 
                variant="default" 
                onClick={executeDeleteProject}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('common.remove')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Code2 size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-1">{t('app.aboutTitle')}</h3>
            <p className="text-sm text-gray-400 mb-4">{t('app.aboutVersion')}</p>
            <p className="text-xs text-gray-500 mb-6">
              {t('app.aboutDescription')}
            </p>
            <Button 
              variant="default" 
              onClick={() => setShowAboutModal(false)}
              className="w-full bg-white/10 hover:bg-white/20 text-white border-transparent"
            >
              {t('app.close')}
            </Button>
          </div>
        </div>
      )}

      {/* What's New Modal */}
      {showWhatsNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">{t('app.whatsNewTitle')}</h3>
            <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="border-l-2 border-blue-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature1Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature1Desc')}</p>
              </div>
              <div className="border-l-2 border-green-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature2Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature2Desc')}</p>
              </div>
              <div className="border-l-2 border-purple-500 pl-4">
                <h4 className="text-sm font-medium text-gray-200">{t('app.whatsNewFeature3Title')}</h4>
                <p className="text-xs text-gray-400 mt-1">{t('app.whatsNewFeature3Desc')}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="default" 
                onClick={() => setShowWhatsNewModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white border-transparent"
              >
                {t('app.gotIt')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-4">{t('app.keyboardShortcutsTitle')}</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsGeneral')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.newThread')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+N</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.openFolder')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+O</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.settings')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+,</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsEditor')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.save')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+S</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.saveAll')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+S</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.find')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+F</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsView')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleSidebar')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+B</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleTerminal')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+J</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleDiffPanel')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Alt+Ctrl+B</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.toggleFullScreen')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">F11</kbd></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">{t('app.shortcutsNavigation')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.goToFile')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+P</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.previousThread')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+[</kbd></div>
                  <div className="flex justify-between items-center"><span className="text-sm text-gray-200">{t('app.menu.nextThread')}</span><kbd className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300 font-mono">Ctrl+Shift+]</kbd></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="default" 
                onClick={() => setShowShortcutsModal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white border-transparent"
              >
                {t('app.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
