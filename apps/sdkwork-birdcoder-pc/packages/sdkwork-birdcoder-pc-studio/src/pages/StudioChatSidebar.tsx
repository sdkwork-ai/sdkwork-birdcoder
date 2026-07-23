import {
  type AgentApprovalDecisionInput,
  type AgentQuestionAnswerInput,
  type AgentSessionPendingApproval,
  type AgentSessionPendingQuestion,
  deduplicateAgentProjectsForRender,
  useToast,
} from '@sdkwork/birdcoder-pc-workbench';
import { getWorkbenchCodeEngineSessionSummary } from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import {
  DeferredUniversalChat,
  WorkbenchNewSessionButton,
  type UniversalChatComposerSelection,
} from '@sdkwork/birdcoder-pc-ui';
import {
  ResizeHandle,
  WorkbenchCodeEngineIcon,
  useFixedSizeWindowedRange,
  useRelativeMinuteNow,
} from '@sdkwork/birdcoder-pc-ui-shell';
import {
  formatAgentSessionActivityDisplayTime,
  isAgentSessionViewEngineBusy,
  type AgentSessionItemView,
  type AgentSessionView,
  type AgentProjectView,
  type FileChange,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
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
const EMPTY_STUDIO_PROJECTS: AgentProjectView[] = [];
const EMPTY_STUDIO_AGENT_SESSIONS: AgentProjectView['agentSessions'] = [];

function areStudioProjectInventoriesEqual(
  leftProjects: readonly AgentProjectView[],
  rightProjects: readonly AgentProjectView[],
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
  leftMessages: readonly AgentSessionItemView[],
  rightMessages: readonly AgentSessionItemView[],
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
  hasMoreProjects: boolean;
  isVisible: boolean;
  isLoadingMoreProjects: boolean;
  width: number;
  projects: AgentProjectView[];
  currentProjectId: string;
  selectedAgentSessionId: string;
  menuActiveProjectId: string;
  projectSearchQuery: string;
  messages: AgentSessionItemView[];
  pendingApprovals?: AgentSessionPendingApproval[];
  pendingUserQuestions?: AgentSessionPendingQuestion[];
  emptyState?: ReactNode;
  isBusy: boolean;
  isEngineBusy: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  disabled: boolean;
  onResize: (delta: number) => void;
  onProjectSearchQueryChange: (value: string) => void;
  onMenuActiveProjectIdChange: (projectId: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void | Promise<void>;
  onSelectedModelIdChange: (modelId: string, engineId?: string) => void | Promise<void>;
  onSendMessage: (
    text?: string,
    composerSelection?: UniversalChatComposerSelection,
  ) => void | Promise<void>;
  onSubmitApprovalDecision: (
    interactionId: string,
    request: AgentApprovalDecisionInput,
  ) => void | Promise<void>;
  onSubmitUserQuestionAnswer: (
    interactionId: string,
    request: AgentQuestionAnswerInput,
  ) => void | Promise<void>;
  onSelectAgentSession: (projectId: string, agentSessionId: string) => void;
  onCreateProject: () => Promise<void>;
  onLoadMoreProjects: () => Promise<unknown> | void;
  onLoadMoreProjectSessions?: (
    projectId: string,
    requestedCount: number,
  ) => Promise<{ hasMore?: boolean; loadedCount?: number }> | {
    hasMore?: boolean;
    loadedCount?: number;
  } | void;
  onOpenFolder: () => Promise<void>;
  onCreateAgentSession: (
    projectId: string,
    engineId?: string,
    modelId?: string,
  ) => Promise<AgentSessionView | null | void>;
  onRefreshProjectSessions: (projectId: string) => Promise<void>;
  onRefreshAgentSessionItems: (agentSessionId: string) => Promise<void>;
  refreshingProjectId: string | null;
  refreshingAgentSessionId: string | null;
  onOpenFile: (path: string) => void;
  onViewChanges: (file: FileChange) => void;
  onEditMessage: (messageId: string, content: string) => void | Promise<void>;
  onDeleteMessage: (messageIds: string[]) => void;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
}

interface StudioProjectMenuRowProps {
  project: AgentProjectView;
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
      onClick={() => onSelectProject(project.projectId)}
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
  session: AgentProjectView['agentSessions'][number];
  isSelected: boolean;
  onSelectAgentSession: (projectId: string, agentSessionId: string) => void;
}

const StudioSessionMenuRow = memo(function StudioSessionMenuRow({
  projectId,
  relativeTimeNow,
  session,
  isSelected,
  onSelectAgentSession,
}: StudioSessionMenuRowProps) {
  const isEngineBusySession = isAgentSessionViewEngineBusy(session);

  return (
    <button
      onClick={() => onSelectAgentSession(projectId, session.id)}
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
            {formatAgentSessionActivityDisplayTime(session, relativeTimeNow)}
          </span>
        </div>
      </div>
      {isEngineBusySession ? (
        <Loader2 size={14} className="animate-spin text-emerald-400 shrink-0" />
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
    left.hasMoreProjects === right.hasMoreProjects &&
    left.isLoadingMoreProjects === right.isLoadingMoreProjects &&
    left.width === right.width &&
    areStudioProjectInventoriesEqual(left.projects, right.projects) &&
    left.currentProjectId === right.currentProjectId &&
    left.selectedAgentSessionId === right.selectedAgentSessionId &&
    left.menuActiveProjectId === right.menuActiveProjectId &&
    left.projectSearchQuery === right.projectSearchQuery &&
    areStudioChatMessagesEqual(left.messages, right.messages) &&
    left.pendingApprovals === right.pendingApprovals &&
    left.pendingUserQuestions === right.pendingUserQuestions &&
    left.emptyState === right.emptyState &&
    left.isBusy === right.isBusy &&
    left.isEngineBusy === right.isEngineBusy &&
    left.selectedEngineId === right.selectedEngineId &&
    left.selectedModelId === right.selectedModelId &&
    left.disabled === right.disabled &&
    left.onResize === right.onResize &&
    left.onProjectSearchQueryChange === right.onProjectSearchQueryChange &&
    left.onMenuActiveProjectIdChange === right.onMenuActiveProjectIdChange &&
    left.onSelectedEngineIdChange === right.onSelectedEngineIdChange &&
    left.onSelectedModelIdChange === right.onSelectedModelIdChange &&
    left.onSendMessage === right.onSendMessage &&
    left.onSubmitApprovalDecision === right.onSubmitApprovalDecision &&
    left.onSubmitUserQuestionAnswer === right.onSubmitUserQuestionAnswer &&
    left.onSelectAgentSession === right.onSelectAgentSession &&
    left.onCreateProject === right.onCreateProject &&
    left.onLoadMoreProjects === right.onLoadMoreProjects &&
    left.onLoadMoreProjectSessions === right.onLoadMoreProjectSessions &&
    left.onOpenFolder === right.onOpenFolder &&
    left.onCreateAgentSession === right.onCreateAgentSession &&
    left.onRefreshProjectSessions === right.onRefreshProjectSessions &&
    left.onRefreshAgentSessionItems === right.onRefreshAgentSessionItems &&
    left.refreshingProjectId === right.refreshingProjectId &&
    left.refreshingAgentSessionId === right.refreshingAgentSessionId &&
    left.onOpenFile === right.onOpenFile &&
    left.onViewChanges === right.onViewChanges &&
    left.onEditMessage === right.onEditMessage &&
    left.onDeleteMessage === right.onDeleteMessage &&
    left.onRegenerateMessage === right.onRegenerateMessage &&
    left.onRestoreMessage === right.onRestoreMessage
  );
}

export const StudioChatSidebar = memo(function StudioChatSidebar({
  hasMoreProjects,
  isVisible,
  isLoadingMoreProjects,
  width,
  projects,
  currentProjectId,
  selectedAgentSessionId,
  menuActiveProjectId,
  projectSearchQuery,
  messages,
  pendingApprovals,
  pendingUserQuestions,
  emptyState,
  isBusy,
  isEngineBusy,
  selectedEngineId,
  selectedModelId,
  disabled,
  onResize,
  onProjectSearchQueryChange,
  onMenuActiveProjectIdChange,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onSubmitApprovalDecision,
  onSubmitUserQuestionAnswer,
  onSelectAgentSession,
  onCreateProject,
  onLoadMoreProjects,
  onLoadMoreProjectSessions,
  onOpenFolder,
  onCreateAgentSession,
  onRefreshProjectSessions,
  onRefreshAgentSessionItems,
  refreshingProjectId,
  refreshingAgentSessionId,
  onOpenFile,
  onViewChanges,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onRestoreMessage,
}: StudioChatSidebarProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [visibleSessionCountByProjectId, setVisibleSessionCountByProjectId] = useState<
    Record<string, number>
  >({});
  const [loadingMoreSessionProjectIds, setLoadingMoreSessionProjectIds] = useState<
    Record<string, boolean>
  >({});
  const loadingMoreSessionProjectIdsRef = useRef(new Set<string>());
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuProjectsRef = useRef<HTMLDivElement>(null);
  const projectMenuSessionsRef = useRef<HTMLDivElement>(null);
  const renderProjects = useMemo(
    () => deduplicateAgentProjectsForRender(projects),
    [projects],
  );
  const handleLoadMoreProjects = useCallback(async () => {
    if (isLoadingMoreProjects) {
      return;
    }

    try {
      await onLoadMoreProjects();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t('studio.failedToLoadMoreProjects');
      addToast(message, 'error');
    }
  }, [addToast, isLoadingMoreProjects, onLoadMoreProjects, t]);

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

      for (const project of renderProjects) {
        const existingCount = previousState[project.projectId];
        const shouldRestoreInitialWindow =
          typeof existingCount === 'number' &&
          existingCount > INITIAL_VISIBLE_SESSIONS_PER_PROJECT &&
          existingCount > project.agentSessions.length;
        nextState[project.projectId] = shouldRestoreInitialWindow
          ? INITIAL_VISIBLE_SESSIONS_PER_PROJECT
          : typeof existingCount === 'number'
            ? existingCount
            : INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
        if (nextState[project.projectId] !== existingCount) {
          changed = true;
        }
      }

      if (Object.keys(previousState).length !== Object.keys(nextState).length) {
        changed = true;
      }

      return changed ? nextState : previousState;
    });
  }, [renderProjects]);

  useEffect(() => {
    setLoadingMoreSessionProjectIds((previousState) => {
      const projectIds = new Set(renderProjects.map((project) => project.projectId));
      const nextState: Record<string, boolean> = {};
      for (const [projectId, isLoading] of Object.entries(previousState)) {
        if (isLoading && projectIds.has(projectId)) {
          nextState[projectId] = true;
        }
      }
      const previousKeys = Object.keys(previousState);
      const nextKeys = Object.keys(nextState);
      if (previousKeys.length !== nextKeys.length) {
        return nextState;
      }
      return previousKeys.every((projectId) => nextState[projectId] === true)
        ? previousState
        : nextState;
    });
  }, [renderProjects]);

  const deferredProjectSearchQuery = useDeferredValue(projectSearchQuery);
  const relativeTimeNow = useRelativeMinuteNow({
    isEnabled: isVisible && showProjectMenu,
  });
  const normalizedProjectSearchQuery = deferredProjectSearchQuery.trim().toLowerCase();
  const projectsById = useMemo(
    () => new Map(renderProjects.map((project) => [project.projectId, project] as const)),
    [renderProjects],
  );
  const currentProject = projectsById.get(currentProjectId);
  const currentAgentSession = useMemo(
    () =>
      currentProject?.agentSessions.find(
        (agentSession) => agentSession.id === selectedAgentSessionId,
      ) ?? null,
    [currentProject, selectedAgentSessionId],
  );
  const transcriptSessionScopeKey =
    currentProjectId && selectedAgentSessionId
      ? `${currentProjectId}\u0001${selectedAgentSessionId}`
      : selectedAgentSessionId || undefined;
  const currentAgentSessionTitle = currentAgentSession?.title;
  const currentChatEngineId =
    currentAgentSession?.engineId?.trim() || selectedEngineId;
  const currentChatModelId = currentAgentSession
    ? (currentAgentSession.modelId?.trim() ?? '')
    : selectedModelId;
  const headerEngineSummary = currentAgentSession?.engineId?.trim()
    ? getWorkbenchCodeEngineSessionSummary(
        currentAgentSession.engineId,
        currentAgentSession.modelId,
      )
    : getWorkbenchCodeEngineSessionSummary(selectedEngineId, selectedModelId);
  const isEngineBusyCurrentSession = isAgentSessionViewEngineBusy(currentAgentSession);
  const visibleMenuProjects = useMemo(() => {
    if (!showProjectMenu) {
      return EMPTY_STUDIO_PROJECTS;
    }

    if (!normalizedProjectSearchQuery) {
      return renderProjects;
    }

    return renderProjects.filter((project) => {
      if (project.name.toLowerCase().includes(normalizedProjectSearchQuery)) {
        return true;
      }

      return project.agentSessions.some((agentSession) =>
        agentSession.title.toLowerCase().includes(normalizedProjectSearchQuery),
      ) || project.agentSessions.length > INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
    });
  }, [normalizedProjectSearchQuery, renderProjects, showProjectMenu]);
  const effectiveMenuProjectId = useMemo(() => {
    if (!showProjectMenu) {
      return menuActiveProjectId;
    }

    if (visibleMenuProjects.some((project) => project.projectId === menuActiveProjectId)) {
      return menuActiveProjectId;
    }

    return visibleMenuProjects[0]?.projectId ?? menuActiveProjectId;
  }, [menuActiveProjectId, showProjectMenu, visibleMenuProjects]);
  const menuSelectedSessionId =
    currentProjectId === effectiveMenuProjectId ? selectedAgentSessionId : '';
  const menuProject = showProjectMenu ? projectsById.get(effectiveMenuProjectId) ?? null : null;
  const menuProjectSessions = useMemo(() => {
    if (!showProjectMenu || !menuProject) {
      return EMPTY_STUDIO_AGENT_SESSIONS;
    }

    if (!normalizedProjectSearchQuery) {
      return menuProject.agentSessions;
    }

    return menuProject.agentSessions.filter((agentSession) =>
      agentSession.title.toLowerCase().includes(normalizedProjectSearchQuery),
    );
  }, [menuProject, normalizedProjectSearchQuery, showProjectMenu]);
  const visibleSessionCount =
    visibleSessionCountByProjectId[effectiveMenuProjectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
  const isLoadingMoreSessions = loadingMoreSessionProjectIds[effectiveMenuProjectId] === true;
  const visibleSessions = useMemo(
    () =>
      showProjectMenu
        ? menuProjectSessions.slice(0, visibleSessionCount)
        : EMPTY_STUDIO_AGENT_SESSIONS,
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
  const canShowMoreSessions =
    visibleSessionCount < menuProjectSessions.length ||
    visibleSessionCount < (menuProject?.agentSessions.length ?? 0);
  const hasEffectiveMenuProject = effectiveMenuProjectId.trim().length > 0;
  const showEngineBusyCurrentSessionIndicator =
    isEngineBusyCurrentSession && Boolean(selectedAgentSessionId);
  const canRefreshCurrentContext = Boolean(
    (selectedAgentSessionId || currentProjectId) &&
      !showEngineBusyCurrentSessionIndicator,
  );
  const isRefreshingCurrentContext = selectedAgentSessionId
    ? refreshingAgentSessionId === selectedAgentSessionId
    : refreshingProjectId === currentProjectId;
  const refreshActionKey = showEngineBusyCurrentSessionIndicator
    ? 'studio.executingSession'
    : selectedAgentSessionId
      ? isRefreshingCurrentContext
        ? 'studio.refreshingMessages'
        : 'studio.refreshMessages'
      : isRefreshingCurrentContext
        ? 'studio.refreshingSessions'
        : 'studio.refreshSessions';
  const headerActivityIconClassName = showEngineBusyCurrentSessionIndicator
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

  const handleSelectMenuAgentSession = useCallback((
    projectId: string,
    agentSessionId: string,
  ) => {
    onSelectAgentSession(projectId, agentSessionId);
    setShowProjectMenu(false);
  }, [onSelectAgentSession]);

  const handleLoadMoreMenuProjectSessions = useCallback(
    async (projectId: string, requestedCount: number): Promise<void> => {
      const normalizedProjectId = projectId.trim();
      if (
        !normalizedProjectId ||
        !onLoadMoreProjectSessions ||
        loadingMoreSessionProjectIdsRef.current.has(normalizedProjectId)
      ) {
        return;
      }

      const nextCount = Math.max(INITIAL_VISIBLE_SESSIONS_PER_PROJECT, Math.floor(requestedCount));
      loadingMoreSessionProjectIdsRef.current.add(normalizedProjectId);
      setLoadingMoreSessionProjectIds((previousState) => ({
        ...previousState,
        [normalizedProjectId]: true,
      }));

      try {
        const result = await onLoadMoreProjectSessions(normalizedProjectId, nextCount);
        const loadedCount =
          result && typeof result.loadedCount === 'number' && Number.isFinite(result.loadedCount)
            ? Math.max(INITIAL_VISIBLE_SESSIONS_PER_PROJECT, Math.floor(result.loadedCount))
            : nextCount;
        setVisibleSessionCountByProjectId((previousState) => {
          const previousCount =
            previousState[normalizedProjectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
          const resolvedCount = Math.max(previousCount, Math.min(nextCount, loadedCount));
          if (resolvedCount <= previousCount) {
            return previousState;
          }
          return {
            ...previousState,
            [normalizedProjectId]: resolvedCount,
          };
        });
      } catch (error) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : t('studio.failedToLoadMoreSessions');
        addToast(message, 'error');
      } finally {
        loadingMoreSessionProjectIdsRef.current.delete(normalizedProjectId);
        setLoadingMoreSessionProjectIds((previousState) => {
          if (!previousState[normalizedProjectId]) {
            return previousState;
          }
          const nextState = { ...previousState };
          delete nextState[normalizedProjectId];
          return nextState;
        });
      }
    },
    [addToast, onLoadMoreProjectSessions, t],
  );

  const handleRefreshCurrentContext = () => {
    if (selectedAgentSessionId) {
      void onRefreshAgentSessionItems(selectedAgentSessionId);
      return;
    }
    if (currentProjectId) {
      void onRefreshProjectSessions(currentProjectId);
    }
  };

  const handleCreateProjectAgentSession = useCallback(
    async (engineId?: string, modelId?: string) => {
      if (!hasEffectiveMenuProject) {
        return;
      }

      await onCreateAgentSession(effectiveMenuProjectId, engineId, modelId);
      setShowProjectMenu(false);
    },
    [effectiveMenuProjectId, hasEffectiveMenuProject, onCreateAgentSession],
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
                    {currentAgentSessionTitle || '-'}
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
                            key={project.projectId}
                            className={
                              projectIndex === renderedMenuProjects.length - 1 ? '' : 'pb-1'
                            }
                          >
                            <StudioProjectMenuRow
                              project={project}
                              isMenuSelected={effectiveMenuProjectId === project.projectId}
                              isActualSelected={currentProjectId === project.projectId}
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
                    {hasMoreProjects ? (
                      <button
                        type="button"
                        className="mx-1 mt-1 inline-flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoadingMoreProjects}
                        onClick={() => {
                          void handleLoadMoreProjects();
                        }}
                      >
                        {isLoadingMoreProjects ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <ChevronDown size={13} />
                        )}
                        <span>
                          {isLoadingMoreProjects
                            ? t('studio.loadingMoreProjects')
                            : t('studio.loadMoreProjects')}
                        </span>
                      </button>
                    ) : null}
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
                            selectedAgentSessionId === session.id
                          }
                          onSelectAgentSession={handleSelectMenuAgentSession}
                        />
                      </div>
                    ))}
                    {shouldWindowMenuSessions ? (
                      <div style={{ height: menuSessionsWindowedRange.paddingBottom }} />
                    ) : null}
                    {canShowMoreSessions && (
                      <button
                        type="button"
                        className="mx-3 mt-1 inline-flex items-center justify-start gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-all hover:bg-white/5 hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
                        disabled={isLoadingMoreSessions}
                        aria-busy={isLoadingMoreSessions}
                        onClick={() => {
                          void handleLoadMoreMenuProjectSessions(
                            effectiveMenuProjectId,
                            visibleSessionCount + SESSION_EXPANSION_BATCH_SIZE,
                          );
                        }}
                      >
                        {isLoadingMoreSessions ? (
                          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        ) : null}
                        {isLoadingMoreSessions
                          ? t('studio.loadingMoreSessions')
                          : t('studio.showMoreSessions')}
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
                      currentSessionEngineId={currentAgentSession?.engineId}
                      currentSessionModelId={currentAgentSession?.modelId}
                      disabled={!hasEffectiveMenuProject}
                      disabledTitle={t('studio.pleaseSelectProject')}
                      selectedEngineId={selectedEngineId}
                      selectedModelId={selectedModelId}
                      variant="studio"
                      onCreateSession={(engineId, modelId) => {
                        void handleCreateProjectAgentSession(engineId, modelId);
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!menuSelectedSessionId) {
                          return;
                        }
                        void onRefreshAgentSessionItems(menuSelectedSessionId);
                      }}
                      disabled={
                        !menuSelectedSessionId ||
                        refreshingAgentSessionId === menuSelectedSessionId
                      }
                      className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={12}
                        className={
                          refreshingAgentSessionId === menuSelectedSessionId
                            ? 'animate-spin'
                            : ''
                        }
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
                <span className="max-w-[160px] truncate">{headerEngineSummary}</span>
              </div>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  showEngineBusyCurrentSessionIndicator
                    ? 'text-emerald-400'
                    : 'text-gray-500 hover:text-white'
                }`}
                disabled={!canRefreshCurrentContext || isRefreshingCurrentContext}
                title={t(refreshActionKey)}
                onClick={handleRefreshCurrentContext}
              >
                {showEngineBusyCurrentSessionIndicator ? (
                  <Loader2
                    size={14}
                    className={headerActivityIconClassName}
                  />
                ) : (
                  <RefreshCw
                    size={14}
                    className={headerActivityIconClassName}
                  />
                )}
                {showEngineBusyCurrentSessionIndicator ? (
                  <span className="hidden text-xs xl:inline">
                    {t('studio.executingSession')}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DeferredUniversalChat
            sessionId={selectedAgentSessionId || undefined}
            sessionScopeKey={transcriptSessionScopeKey}
            messages={messages}
            pendingApprovals={pendingApprovals}
            pendingUserQuestions={pendingUserQuestions}
            onSendMessage={onSendMessage}
            onSubmitApprovalDecision={onSubmitApprovalDecision}
            onSubmitUserQuestionAnswer={onSubmitUserQuestionAnswer}
            isBusy={isBusy}
            isEngineBusy={isEngineBusy}
            selectedEngineId={currentChatEngineId}
            selectedModelId={currentChatModelId}
            setSelectedEngineId={onSelectedEngineIdChange}
            setSelectedModelId={onSelectedModelIdChange}
            showEngineHeader={false}
            showComposerEngineSelector
            layout="sidebar"
            onOpenFile={onOpenFile}
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

