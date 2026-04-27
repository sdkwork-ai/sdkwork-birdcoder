import { useWorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import {
  getWorkbenchCodeEngineSessionSummary,
} from '@sdkwork/birdcoder-codeengine';
import {
  UniversalChat,
  WorkbenchNewSessionButton,
} from '@sdkwork/birdcoder-ui';
import {
  ResizeHandle,
  WorkbenchCodeEngineIcon,
  useFixedSizeWindowedRange,
  useRelativeMinuteNow,
} from '@sdkwork/birdcoder-ui-shell';
import {
  formatBirdCoderSessionActivityDisplayTime,
  isBirdCoderCodingSessionExecuting,
  type BirdCoderChatMessage,
  type BirdCoderCodingSession,
  type BirdCoderProject,
  type FileChange,
} from '@sdkwork/birdcoder-types';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const INITIAL_VISIBLE_SESSIONS_PER_PROJECT = 5;
const SESSION_EXPANSION_BATCH_SIZE = 10;
const STUDIO_MENU_PROJECT_ROW_HEIGHT = 46;
const STUDIO_MENU_SESSION_ROW_HEIGHT = 52;
const STUDIO_MENU_WINDOWED_LIST_THRESHOLD = 20;
const EMPTY_STUDIO_PROJECTS: BirdCoderProject[] = [];
const EMPTY_STUDIO_CODING_SESSIONS: BirdCoderProject['codingSessions'] = [];

function areStudioProjectInventoriesEqual(
  leftProjects: readonly BirdCoderProject[],
  rightProjects: readonly BirdCoderProject[],
): boolean {
  if (leftProjects === rightProjects) {
    return true;
  }

  if (leftProjects.length !== rightProjects.length) {
    return false;
  }

  for (let projectIndex = 0; projectIndex < leftProjects.length; projectIndex += 1) {
    if (leftProjects[projectIndex] !== rightProjects[projectIndex]) {
      return false;
    }
  }

  return true;
}

function areStudioChatMessagesEqual(
  leftMessages: readonly BirdCoderChatMessage[],
  rightMessages: readonly BirdCoderChatMessage[],
): boolean {
  if (leftMessages === rightMessages) {
    return true;
  }

  if (leftMessages.length !== rightMessages.length) {
    return false;
  }

  for (let messageIndex = 0; messageIndex < leftMessages.length; messageIndex += 1) {
    if (leftMessages[messageIndex] !== rightMessages[messageIndex]) {
      return false;
    }
  }

  return true;
}

function buildStudioSidebarSurfaceStyle(containIntrinsicSize: string): CSSProperties {
  return {
    contain: 'layout paint style',
    containIntrinsicSize,
  };
}

interface StudioChatSidebarProps {
  isVisible: boolean;
  width: number;
  projects: BirdCoderProject[];
  currentProjectId: string;
  selectedCodingSessionId: string;
  menuActiveProjectId: string;
  projectSearchQuery: string;
  messages: BirdCoderChatMessage[];
  emptyState?: ReactNode;
  isBusy: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  disabled: boolean;
  onResize: (delta: number) => void;
  onProjectSearchQueryChange: (value: string) => void;
  onMenuActiveProjectIdChange: (projectId: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void | Promise<void>;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void | Promise<void>;
  onSendMessage: (text?: string) => void | Promise<void>;
  onSelectCodingSession: (projectId: string, codingSessionId: string) => void;
  onCreateProject: () => Promise<void>;
  onOpenFolder: () => Promise<void>;
  onCreateCodingSession: (
    projectId: string,
    engineId?: string,
  ) => Promise<BirdCoderCodingSession | null | void>;
  onRefreshProjectSessions: (projectId: string) => Promise<void>;
  onRefreshCodingSessionMessages: (codingSessionId: string) => Promise<void>;
  refreshingProjectId: string | null;
  refreshingCodingSessionId: string | null;
  onViewChanges: (file: FileChange) => void;
  onEditMessage: (messageId: string) => void;
  onDeleteMessage: (messageIds: string[]) => void;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
}

interface StudioProjectMenuRowProps {
  project: BirdCoderProject;
  isMenuSelected: boolean;
  isActualSelected: boolean;
  onSelectProject: (projectId: string) => void;
}

const StudioProjectMenuRow = memo(function StudioProjectMenuRow({
  project,
  isMenuSelected,
  isActualSelected,
  onSelectProject,
}: StudioProjectMenuRowProps) {
  return (
    <button
      onClick={() => onSelectProject(project.id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
        isMenuSelected
          ? 'bg-white/5 text-gray-100 shadow-sm'
          : 'text-gray-400 hover:bg-white/5/60 hover:text-gray-200'
      }`}
      style={buildStudioSidebarSurfaceStyle('42px')}
    >
      <div className="flex items-center gap-2.5 truncate">
        {isMenuSelected ? (
          <FolderOpen size={14} className="text-blue-400 shrink-0" />
        ) : (
          <Folder size={14} className="text-gray-500 group-hover:text-gray-400 shrink-0" />
        )}
        <span className="truncate font-medium">{project.name}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isActualSelected && <Check size={14} className="text-gray-500" />}
        {isMenuSelected && <ChevronRight size={14} className="text-gray-500" />}
      </div>
    </button>
  );
});

interface StudioSessionMenuRowProps {
  projectId: string;
  relativeTimeNow: number;
  session: BirdCoderProject['codingSessions'][number];
  isSelected: boolean;
  onSelectCodingSession: (projectId: string, codingSessionId: string) => void;
}

const StudioSessionMenuRow = memo(function StudioSessionMenuRow({
  projectId,
  relativeTimeNow,
  session,
  isSelected,
  onSelectCodingSession,
}: StudioSessionMenuRowProps) {
  const isExecutingSession = isBirdCoderCodingSessionExecuting(session);

  return (
    <button
      onClick={() => onSelectCodingSession(projectId, session.id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
        isSelected
          ? 'bg-blue-500/10 text-blue-400'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
      style={buildStudioSidebarSurfaceStyle('48px')}
    >
      <div className="flex items-center gap-3 truncate">
        <WorkbenchCodeEngineIcon engineId={session.engineId} />
        <div className="flex flex-col items-start truncate">
          <span className="truncate font-medium">{session.title}</span>
          <span
            className={`text-[10px] ${
              isSelected ? 'text-blue-400/70' : 'text-gray-600 group-hover:text-gray-500'
            }`}
          >
            {formatBirdCoderSessionActivityDisplayTime(session, relativeTimeNow)}
          </span>
        </div>
      </div>
      {isExecutingSession ? (
        <RefreshCw size={14} className="animate-spin text-emerald-400 shrink-0" />
      ) : isSelected ? (
        <Check size={14} className="text-blue-400 shrink-0" />
      ) : null}
    </button>
  );
});

function areStudioChatSidebarPropsEqual(
  left: StudioChatSidebarProps,
  right: StudioChatSidebarProps,
): boolean {
  return (
    left.isVisible === right.isVisible &&
    left.width === right.width &&
    areStudioProjectInventoriesEqual(left.projects, right.projects) &&
    left.currentProjectId === right.currentProjectId &&
    left.selectedCodingSessionId === right.selectedCodingSessionId &&
    left.menuActiveProjectId === right.menuActiveProjectId &&
    left.projectSearchQuery === right.projectSearchQuery &&
    areStudioChatMessagesEqual(left.messages, right.messages) &&
    left.emptyState === right.emptyState &&
    left.isBusy === right.isBusy &&
    left.selectedEngineId === right.selectedEngineId &&
    left.selectedModelId === right.selectedModelId &&
    left.disabled === right.disabled &&
    left.onResize === right.onResize &&
    left.onProjectSearchQueryChange === right.onProjectSearchQueryChange &&
    left.onMenuActiveProjectIdChange === right.onMenuActiveProjectIdChange &&
    left.onSelectedEngineIdChange === right.onSelectedEngineIdChange &&
    left.onSelectedModelIdChange === right.onSelectedModelIdChange &&
    left.onSendMessage === right.onSendMessage &&
    left.onSelectCodingSession === right.onSelectCodingSession &&
    left.onCreateProject === right.onCreateProject &&
    left.onOpenFolder === right.onOpenFolder &&
    left.onCreateCodingSession === right.onCreateCodingSession &&
    left.onRefreshProjectSessions === right.onRefreshProjectSessions &&
    left.onRefreshCodingSessionMessages === right.onRefreshCodingSessionMessages &&
    left.refreshingProjectId === right.refreshingProjectId &&
    left.refreshingCodingSessionId === right.refreshingCodingSessionId &&
    left.onViewChanges === right.onViewChanges &&
    left.onEditMessage === right.onEditMessage &&
    left.onDeleteMessage === right.onDeleteMessage &&
    left.onRegenerateMessage === right.onRegenerateMessage &&
    left.onRestoreMessage === right.onRestoreMessage
  );
}

export const StudioChatSidebar = memo(function StudioChatSidebar({
  isVisible,
  width,
  projects,
  currentProjectId,
  selectedCodingSessionId,
  menuActiveProjectId,
  projectSearchQuery,
  messages,
  emptyState,
  isBusy,
  selectedEngineId,
  selectedModelId,
  disabled,
  onResize,
  onProjectSearchQueryChange,
  onMenuActiveProjectIdChange,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onSelectCodingSession,
  onCreateProject,
  onOpenFolder,
  onCreateCodingSession,
  onRefreshProjectSessions,
  onRefreshCodingSessionMessages,
  refreshingProjectId,
  refreshingCodingSessionId,
  onViewChanges,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onRestoreMessage,
}: StudioChatSidebarProps) {
  const { t } = useTranslation();
  const { preferences } = useWorkbenchPreferences();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [visibleSessionCountByProjectId, setVisibleSessionCountByProjectId] = useState<
    Record<string, number>
  >({});
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuProjectsRef = useRef<HTMLDivElement>(null);
  const projectMenuSessionsRef = useRef<HTMLDivElement>(null);

  const handleProjectMenuClickOutside = useCallback((event: MouseEvent) => {
      if (!showProjectMenu) {
        return;
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
    }, [showProjectMenu]);

  useEffect(() => {
    if (!showProjectMenu) {
      return;
    }

    document.addEventListener('mousedown', handleProjectMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleProjectMenuClickOutside);
  }, [handleProjectMenuClickOutside, showProjectMenu]);

  useEffect(() => {
    setVisibleSessionCountByProjectId((previousState) => {
      let changed = false;
      const nextState: Record<string, number> = {};

      for (const project of projects) {
        const existingCount = previousState[project.id];
        nextState[project.id] =
          typeof existingCount === 'number' ? existingCount : INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
        if (nextState[project.id] !== existingCount) {
          changed = true;
        }
      }

      if (Object.keys(previousState).length !== Object.keys(nextState).length) {
        changed = true;
      }

      return changed ? nextState : previousState;
    });
  }, [projects]);

  const deferredProjectSearchQuery = useDeferredValue(projectSearchQuery);
  const relativeTimeNow = useRelativeMinuteNow({
    isEnabled: isVisible && showProjectMenu,
  });
  const normalizedProjectSearchQuery = deferredProjectSearchQuery.trim().toLowerCase();
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project] as const)),
    [projects],
  );
  const currentProject = projectsById.get(currentProjectId);
  const currentCodingSession = useMemo(
    () =>
      currentProject?.codingSessions.find(
        (codingSession) => codingSession.id === selectedCodingSessionId,
      ) ?? null,
    [currentProject, selectedCodingSessionId],
  );
  const currentProjectWorkspaceId = currentProject?.workspaceId?.trim() ?? '';
  const transcriptSessionScopeKey =
    currentProjectWorkspaceId && currentProjectId && selectedCodingSessionId
      ? `${currentProjectWorkspaceId}\u0001${currentProjectId}\u0001${selectedCodingSessionId}`
      : currentProjectId && selectedCodingSessionId
        ? `${currentProjectId}\u0001${selectedCodingSessionId}`
      : selectedCodingSessionId || undefined;
  const currentCodingSessionTitle = currentCodingSession?.title;
  const headerEngineSummary = currentCodingSession?.engineId?.trim()
    ? getWorkbenchCodeEngineSessionSummary(
        currentCodingSession.engineId,
        currentCodingSession.modelId,
        preferences,
      )
    : getWorkbenchCodeEngineSessionSummary(selectedEngineId, selectedModelId, preferences);
  const currentChatEngineId =
    currentCodingSession?.engineId?.trim() || selectedEngineId;
  const currentChatModelId = currentCodingSession
    ? (currentCodingSession.modelId?.trim() ?? '')
    : selectedModelId;
  const isExecutingCurrentSession = isBirdCoderCodingSessionExecuting(currentCodingSession);
  const visibleMenuProjects = useMemo(() => {
    if (!showProjectMenu) {
      return EMPTY_STUDIO_PROJECTS;
    }

    if (!normalizedProjectSearchQuery) {
      return projects;
    }

    return projects.filter((project) => {
      if (project.name.toLowerCase().includes(normalizedProjectSearchQuery)) {
        return true;
      }

      return project.codingSessions.some((codingSession) =>
        codingSession.title.toLowerCase().includes(normalizedProjectSearchQuery),
      );
    });
  }, [normalizedProjectSearchQuery, projects, showProjectMenu]);
  const effectiveMenuProjectId = useMemo(() => {
    if (!showProjectMenu) {
      return menuActiveProjectId;
    }

    if (visibleMenuProjects.some((project) => project.id === menuActiveProjectId)) {
      return menuActiveProjectId;
    }

    return visibleMenuProjects[0]?.id ?? menuActiveProjectId;
  }, [menuActiveProjectId, showProjectMenu, visibleMenuProjects]);
  const menuSelectedSessionId =
    currentProjectId === effectiveMenuProjectId ? selectedCodingSessionId : '';
  const menuProject = showProjectMenu ? projectsById.get(effectiveMenuProjectId) ?? null : null;
  const menuProjectSessions = useMemo(() => {
    if (!showProjectMenu || !menuProject) {
      return EMPTY_STUDIO_CODING_SESSIONS;
    }

    if (!normalizedProjectSearchQuery) {
      return menuProject.codingSessions;
    }

    return menuProject.codingSessions.filter((codingSession) =>
      codingSession.title.toLowerCase().includes(normalizedProjectSearchQuery),
    );
  }, [menuProject, normalizedProjectSearchQuery, showProjectMenu]);
  const visibleSessionCount =
    visibleSessionCountByProjectId[effectiveMenuProjectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
  const visibleSessions = useMemo(
    () =>
      showProjectMenu
        ? menuProjectSessions.slice(0, visibleSessionCount)
        : EMPTY_STUDIO_CODING_SESSIONS,
    [menuProjectSessions, showProjectMenu, visibleSessionCount],
  );
  const shouldWindowMenuProjects =
    showProjectMenu && visibleMenuProjects.length >= STUDIO_MENU_WINDOWED_LIST_THRESHOLD;
  const shouldWindowMenuSessions =
    showProjectMenu && visibleSessions.length >= STUDIO_MENU_WINDOWED_LIST_THRESHOLD;
  const menuProjectsWindowedRange = useFixedSizeWindowedRange({
    containerRef: projectMenuProjectsRef,
    isEnabled: shouldWindowMenuProjects,
    itemCount: visibleMenuProjects.length,
    itemHeight: STUDIO_MENU_PROJECT_ROW_HEIGHT,
    overscan: 6,
  });
  const menuSessionsWindowedRange = useFixedSizeWindowedRange({
    containerRef: projectMenuSessionsRef,
    isEnabled: shouldWindowMenuSessions,
    itemCount: visibleSessions.length,
    itemHeight: STUDIO_MENU_SESSION_ROW_HEIGHT,
    overscan: 6,
  });
  const renderedMenuProjects = useMemo(
    () =>
      shouldWindowMenuProjects
        ? visibleMenuProjects.slice(
            menuProjectsWindowedRange.startIndex,
            menuProjectsWindowedRange.endIndex,
          )
        : visibleMenuProjects,
    [
      menuProjectsWindowedRange.endIndex,
      menuProjectsWindowedRange.startIndex,
      shouldWindowMenuProjects,
      visibleMenuProjects,
    ],
  );
  const renderedMenuSessions = useMemo(
    () =>
      shouldWindowMenuSessions
        ? visibleSessions.slice(
            menuSessionsWindowedRange.startIndex,
            menuSessionsWindowedRange.endIndex,
          )
        : visibleSessions,
    [
      menuSessionsWindowedRange.endIndex,
      menuSessionsWindowedRange.startIndex,
      shouldWindowMenuSessions,
      visibleSessions,
    ],
  );
  const canToggleSessionExpansion = menuProjectSessions.length > INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
  const canShowMoreSessions = visibleSessionCount < menuProjectSessions.length;
  const nextExpansionCount = Math.min(
    SESSION_EXPANSION_BATCH_SIZE,
    Math.max(0, menuProjectSessions.length - visibleSessionCount),
  );
  const hasEffectiveMenuProject = effectiveMenuProjectId.trim().length > 0;
  const showExecutingCurrentSessionIndicator =
    isExecutingCurrentSession && Boolean(selectedCodingSessionId);
  const canRefreshCurrentContext = Boolean(
    (selectedCodingSessionId || currentProjectId) &&
      !showExecutingCurrentSessionIndicator,
  );
  const isRefreshingCurrentContext = selectedCodingSessionId
    ? refreshingCodingSessionId === selectedCodingSessionId
    : refreshingProjectId === currentProjectId;
  const refreshActionKey = selectedCodingSessionId
    ? isRefreshingCurrentContext
      ? 'studio.refreshingMessages'
      : 'studio.refreshMessages'
    : isRefreshingCurrentContext
      ? 'studio.refreshingSessions'
      : 'studio.refreshSessions';
  const headerRefreshIconClassName = showExecutingCurrentSessionIndicator
    ? 'animate-spin text-emerald-400'
    : isRefreshingCurrentContext
      ? 'animate-spin text-gray-300'
      : 'text-gray-500';

  const handleToggleProjectMenu = () => {
    if (!showProjectMenu) {
      if (currentProjectId && currentProjectId !== menuActiveProjectId) {
        onMenuActiveProjectIdChange(currentProjectId);
      }
      if (projectSearchQuery) {
        onProjectSearchQueryChange('');
      }
    }
    setShowProjectMenu((previousState) => !previousState);
  };

  const handleSelectMenuProject = useCallback((projectId: string) => {
    onMenuActiveProjectIdChange(projectId);
  }, [onMenuActiveProjectIdChange]);

  const handleSelectMenuCodingSession = useCallback((
    projectId: string,
    codingSessionId: string,
  ) => {
    onSelectCodingSession(projectId, codingSessionId);
    setShowProjectMenu(false);
  }, [onSelectCodingSession]);

  const handleToggleMenuProjectSessionExpansion = useCallback(
    (projectId: string, sessionCount: number, canShowMoreSessionsForProject: boolean) => {
      setVisibleSessionCountByProjectId((previousState) => {
        const currentCount =
          previousState[projectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
        const nextCount = canShowMoreSessionsForProject
          ? Math.min(currentCount + SESSION_EXPANSION_BATCH_SIZE, sessionCount)
          : INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
        if (nextCount === currentCount) {
          return previousState;
        }
        return {
          ...previousState,
          [projectId]: nextCount,
        };
      });
    },
    [],
  );

  const handleRefreshCurrentContext = () => {
    if (selectedCodingSessionId) {
      void onRefreshCodingSessionMessages(selectedCodingSessionId);
      return;
    }
    if (currentProjectId) {
      void onRefreshProjectSessions(currentProjectId);
    }
  };

  const handleCreateProjectCodingSession = useCallback(
    async (engineId?: string) => {
      if (!hasEffectiveMenuProject) {
        return;
      }

      await onCreateCodingSession(effectiveMenuProjectId, engineId);
      setShowProjectMenu(false);
    },
    [effectiveMenuProjectId, hasEffectiveMenuProject, onCreateCodingSession],
  );

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div
        className="flex min-h-0 flex-col border-r border-white/10 bg-[#0e0e11] text-sm shrink-0 relative"
        style={{ width }}
      >
        <div className="border-b border-white/10 px-4 py-2.5 shrink-0 bg-[#0e0e11]">
          <div className="flex items-center justify-between gap-3">
            <div className="relative min-w-0 flex-1" ref={projectMenuRef}>
              <button
                onClick={handleToggleProjectMenu}
                className="flex max-w-full items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-white/5 transition-all text-gray-200 font-medium group whitespace-nowrap overflow-hidden"
              >
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <span className="truncate text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                    {currentProject?.name || '-'}
                  </span>
                  <span className="text-gray-600 text-xs">/</span>
                  <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors truncate max-w-[240px]">
                    {currentCodingSessionTitle || '-'}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-gray-500 transition-transform duration-200 ${showProjectMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showProjectMenu && (
                <div className="absolute top-full left-0 mt-2 w-[600px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-white/10 bg-[#0e0e11]/50 backdrop-blur-sm">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                      <input
                        type="text"
                        value={projectSearchQuery}
                        onChange={(event) => onProjectSearchQueryChange(event.target.value)}
                        placeholder={t('studio.searchProjects')}
                        className="w-full bg-[#0e0e11] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                      />
                    </div>
                  </div>

                  <div className="flex h-[360px]">
                  <div
                    ref={projectMenuProjectsRef}
                    className="w-[40%] border-r border-white/10 overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/30"
                  >
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {t('studio.projects')}
                    </div>
                    {visibleMenuProjects.length > 0 ? (
                      <>
                        {shouldWindowMenuProjects ? (
                          <div style={{ height: menuProjectsWindowedRange.paddingTop }} />
                        ) : null}
                        {renderedMenuProjects.map((project, projectIndex) => (
                          <div
                            key={project.id}
                            className={
                              projectIndex === renderedMenuProjects.length - 1 ? '' : 'pb-1'
                            }
                          >
                            <StudioProjectMenuRow
                              project={project}
                              isMenuSelected={effectiveMenuProjectId === project.id}
                              isActualSelected={currentProjectId === project.id}
                              onSelectProject={handleSelectMenuProject}
                            />
                          </div>
                        ))}
                        {shouldWindowMenuProjects ? (
                          <div style={{ height: menuProjectsWindowedRange.paddingBottom }} />
                        ) : null}
                      </>
                    ) : (
                      <div className="py-8 text-center text-gray-500 text-xs">
                        {t('studio.noProjectsFound')}
                      </div>
                    )}
                  </div>

                  <div
                    ref={projectMenuSessionsRef}
                    className="w-[60%] overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/10"
                  >
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {t('studio.sessions')}
                    </div>
                    {shouldWindowMenuSessions ? (
                      <div style={{ height: menuSessionsWindowedRange.paddingTop }} />
                    ) : null}
                    {renderedMenuSessions.map((session, sessionIndex) => (
                      <div
                        key={session.id}
                        className={
                          sessionIndex === renderedMenuSessions.length - 1 ? '' : 'pb-1'
                        }
                      >
                        <StudioSessionMenuRow
                          projectId={effectiveMenuProjectId}
                          relativeTimeNow={relativeTimeNow}
                          session={session}
                          isSelected={
                            currentProjectId === effectiveMenuProjectId &&
                            selectedCodingSessionId === session.id
                          }
                          onSelectCodingSession={handleSelectMenuCodingSession}
                        />
                      </div>
                    ))}
                    {shouldWindowMenuSessions ? (
                      <div style={{ height: menuSessionsWindowedRange.paddingBottom }} />
                    ) : null}
                    {canToggleSessionExpansion && (
                      <button
                        type="button"
                        className="mx-3 mt-1 inline-flex items-center justify-start rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-all hover:bg-white/5 hover:text-gray-200"
                        onClick={() =>
                          handleToggleMenuProjectSessionExpansion(
                            effectiveMenuProjectId,
                            menuProjectSessions.length,
                            canShowMoreSessions,
                          )
                        }
                      >
                        {canShowMoreSessions
                          ? t('studio.showMoreSessions', {
                              count: nextExpansionCount,
                            })
                          : t('studio.collapseSessions')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex border-t border-white/10 bg-[#0e0e11]/80 backdrop-blur-sm">
                  <div className="w-[40%] p-2 border-r border-white/10 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        void onCreateProject();
                      }}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                      title={t('studio.newProject')}
                    >
                      <Plus size={12} />
                      {t('studio.new')}
                    </button>
                    <button
                      onClick={() => {
                        void onOpenFolder();
                      }}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                      title={t('studio.openFolder')}
                    >
                      <Folder size={12} />
                      {t('studio.open')}
                    </button>
                    <button
                      onClick={() => {
                        if (!hasEffectiveMenuProject) {
                          return;
                        }
                        void onRefreshProjectSessions(effectiveMenuProjectId);
                      }}
                      disabled={!hasEffectiveMenuProject || refreshingProjectId === effectiveMenuProjectId}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      title={t('studio.refreshSessions')}
                    >
                      <RefreshCw
                        size={12}
                        className={refreshingProjectId === effectiveMenuProjectId ? 'animate-spin' : ''}
                      />
                      {t('studio.refreshSessions')}
                    </button>
                  </div>
                  <div className="w-[60%] p-2 flex gap-1">
                    <WorkbenchNewSessionButton
                      buttonLabel={t('studio.newSession')}
                      currentSessionEngineId={currentCodingSession?.engineId}
                      currentSessionModelId={currentCodingSession?.modelId}
                      disabled={!hasEffectiveMenuProject}
                      disabledTitle={t('studio.pleaseSelectProject')}
                      selectedEngineId={selectedEngineId}
                      selectedModelId={selectedModelId}
                      variant="studio"
                      onCreateSession={(engineId) => {
                        void handleCreateProjectCodingSession(engineId);
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!menuSelectedSessionId) {
                          return;
                        }
                        void onRefreshCodingSessionMessages(menuSelectedSessionId);
                      }}
                      disabled={!menuSelectedSessionId || refreshingCodingSessionId === menuSelectedSessionId}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={12}
                        className={refreshingCodingSessionId === menuSelectedSessionId ? 'animate-spin' : ''}
                      />
                      {t('studio.refreshMessages')}
                    </button>
                  </div>
                </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-1.5 py-1 text-xs text-gray-300">
                <span
                  className={`max-w-[220px] truncate whitespace-nowrap font-medium ${
                    disabled ? 'text-gray-500' : 'text-gray-300'
                  }`}
                >
                  {headerEngineSummary}
                </span>
              </div>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  showExecutingCurrentSessionIndicator
                    ? 'text-emerald-400'
                    : 'text-gray-500 hover:text-white'
                }`}
                disabled={!canRefreshCurrentContext || isRefreshingCurrentContext}
                title={t(refreshActionKey)}
                onClick={handleRefreshCurrentContext}
              >
                <RefreshCw
                  size={14}
                  className={headerRefreshIconClassName}
                />
                {showExecutingCurrentSessionIndicator ? (
                  <span className="hidden text-xs xl:inline">
                    {t('studio.executingSession')}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <UniversalChat
            sessionId={selectedCodingSessionId || undefined}
            sessionScopeKey={transcriptSessionScopeKey}
            messages={messages}
            onSendMessage={onSendMessage}
            isBusy={isBusy}
            selectedEngineId={currentChatEngineId}
            selectedModelId={currentChatModelId}
            setSelectedEngineId={onSelectedEngineIdChange}
            setSelectedModelId={onSelectedModelIdChange}
            showEngineHeader={false}
            showComposerEngineSelector={!selectedCodingSessionId}
            layout="sidebar"
            onViewChanges={onViewChanges}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onRegenerateMessage={onRegenerateMessage}
            onRestore={onRestoreMessage}
            disabled={disabled}
            emptyState={
              emptyState ?? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                    <Zap size={32} className="text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                    {currentProjectId ? t('studio.whatToBuild') : t('studio.selectProjectToStart')}
                  </h2>
                  <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                    {currentProjectId
                      ? t('studio.buildDescription')
                      : t('studio.selectProjectDescription')}
                  </p>
                </div>
              )
            }
          />
        </div>
      </div>

      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => onResize(delta)}
      />
    </>
  );
}, areStudioChatSidebarPropsEqual);

StudioChatSidebar.displayName = 'StudioChatSidebar';
