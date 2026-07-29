import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AgentSessionView, AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { sortAgentSessionInboxEntries } from '@sdkwork/birdcoder-pc-workbench/workbench/sessionInbox';
import {
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import {
  deduplicateAgentProjectsForRender,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectInventoryRender';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import {
  useFixedSizeWindowedRange,
  useRelativeMinuteNow,
} from '@sdkwork/birdcoder-pc-ui-shell';
import {
  SessionProviderBadge,
  resolveSessionProviderPresentation,
  resolveSessionRuntimeStatusPresentation,
  type SessionRuntimeStatusLabels,
} from '@sdkwork/birdcoder-pc-ui';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectExplorerHeader } from './ProjectExplorerHeader';
import { ProjectExplorerProjectContextMenu } from './ProjectExplorerProjectContextMenu';
import { ProjectExplorerProjectSection } from './ProjectExplorerProjectSection';
import { ProjectExplorerRootContextMenu } from './ProjectExplorerRootContextMenu';
import { ProjectExplorerSessionContextMenu } from './ProjectExplorerSessionContextMenu';
import { canLoadMoreProjectSessions } from './ProjectExplorer.shared';
import type {
  ProjectExplorerEngineOption,
  ProjectExplorerOrganizeBy,
  ProjectExplorerProjectEntry,
  ProjectExplorerSessionFilter,
  ProjectExplorerSortBy,
} from './ProjectExplorer.shared';
import type { ProjectExplorerProps } from './ProjectExplorer.types';
import { ProjectExplorerSessionRow } from './ProjectExplorerSessionRow';
import { TaskSearchDialog } from './TaskSearchDialog';
import {
  buildSidebarGlobalSessions,
  canRequestMoreSidebarProjectSessions,
  groupSortedSidebarSessionsByProvider,
} from './sessionSidebarPresentation';

const SIDEBAR_CONTEXT_MENU_Z_INDEX = 2147483647;
const SIDEBAR_CONTEXT_MENU_MARGIN = 10;
const INITIAL_VISIBLE_SESSIONS_PER_PROJECT = 5;
const SESSION_EXPANSION_BATCH_SIZE = 10;
const CHRONOLOGICAL_SESSION_ROW_HEIGHT = 36;
const CHRONOLOGICAL_WINDOWED_LIST_THRESHOLD = 60;
const EMPTY_SIDEBAR_AGENT_SESSIONS: AgentSessionView[] = [];

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface SidebarProviderEntry {
  agentId: string;
  engineId: string;
  label: string;
  providerId: string;
  sessions: AgentSessionView[];
}

function renderSidebarContextMenuPortal(content: React.ReactNode) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(content, document.body);
}

function clampSidebarContextMenuCoordinates(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
) {
  const maxX = Math.max(
    SIDEBAR_CONTEXT_MENU_MARGIN,
    window.innerWidth - menuWidth - SIDEBAR_CONTEXT_MENU_MARGIN,
  );
  const maxY = Math.max(
    SIDEBAR_CONTEXT_MENU_MARGIN,
    window.innerHeight - menuHeight - SIDEBAR_CONTEXT_MENU_MARGIN,
  );

  return {
    x: Math.min(Math.max(x, SIDEBAR_CONTEXT_MENU_MARGIN), maxX),
    y: Math.min(Math.max(y, SIDEBAR_CONTEXT_MENU_MARGIN), maxY),
  };
}

function buildSidebarSessionRenderKey(session: AgentSessionView): string {
  return `${session.projectId}\u0001${session.id}`;
}

function buildSidebarSessionScopedKey(projectId: string, sessionId: string): string {
  return `${projectId}\u0001${sessionId}`;
}

function resolveSidebarSessionProjectId(
  session: AgentSessionView,
  containingProjectId: string,
): string {
  const projectId = containingProjectId.trim();
  if (!projectId || session.projectId !== projectId) {
    throw new Error(
      `Agent session ${session.id} does not belong to BirdCoder project ${projectId || '<empty>'}.`,
    );
  }
  return projectId;
}

interface SidebarAgentSessionLookup {
  byProjectIdAndId: Map<string, AgentSessionView>;
  uniqueById: Map<string, AgentSessionView>;
}

function buildSidebarAgentSessionLookup(
  projects: readonly AgentProjectView[],
): SidebarAgentSessionLookup {
  const byProjectIdAndId = new Map<string, AgentSessionView>();
  const uniqueById = new Map<string, AgentSessionView>();
  const ambiguousSessionIds = new Set<string>();
  for (const project of projects) {
    for (const agentSession of project.agentSessions) {
      const scopedProjectId = resolveSidebarSessionProjectId(agentSession, project.projectId);
      const scopedAgentSession = agentSession;
      byProjectIdAndId.set(
        buildSidebarSessionScopedKey(scopedProjectId, agentSession.id),
        scopedAgentSession,
      );
      if (uniqueById.has(agentSession.id)) {
        ambiguousSessionIds.add(agentSession.id);
        uniqueById.delete(agentSession.id);
      } else if (!ambiguousSessionIds.has(agentSession.id)) {
        uniqueById.set(agentSession.id, scopedAgentSession);
      }
    }
  }
  return {
    byProjectIdAndId,
    uniqueById,
  };
}

function doesSidebarSessionMatchFilters(
  session: AgentSessionView,
  projectName: string,
  normalizedSearchQuery: string,
  providerFilterId: string,
  sessionFilter: ProjectExplorerSessionFilter,
): boolean {
  const runtimeStatusPresentation = resolveSessionRuntimeStatusPresentation(session.runtimeStatus);
  if (providerFilterId !== 'all' && session.providerId !== providerFilterId) {
    return false;
  }
  if (sessionFilter === 'attention' && runtimeStatusPresentation !== 'attention') {
    return false;
  }
  if (sessionFilter === 'executing' && runtimeStatusPresentation !== 'busy') {
    return false;
  }
  if (sessionFilter === 'failed' && session.runtimeStatus !== 'failed') {
    return false;
  }
  if (sessionFilter === 'pinned' && !session.pinned) {
    return false;
  }
  if (sessionFilter === 'unread' && !session.unread) {
    return false;
  }
  if (!normalizedSearchQuery) {
    return true;
  }
  return [
    session.title,
    projectName,
    session.agentId,
    session.engineId,
    session.providerId,
    session.providerBindingId,
    session.modelId,
    session.providerSessionId,
  ].some((value) => value?.toLowerCase().includes(normalizedSearchQuery));
}

function filterSidebarProjectSessions(
  agentSessions: readonly AgentSessionView[],
  projectName: string,
  showArchived: boolean,
  normalizedSearchQuery: string,
  providerFilterId: string,
  sessionFilter: ProjectExplorerSessionFilter,
): AgentSessionView[] {
  if (
    showArchived &&
    !normalizedSearchQuery &&
    providerFilterId === 'all' &&
    sessionFilter === 'all'
  ) {
    return agentSessions as AgentSessionView[];
  }

  const filteredSessions: AgentSessionView[] = [];
  for (const agentSession of agentSessions) {
    if (!showArchived && agentSession.archived) {
      continue;
    }
    if (!doesSidebarSessionMatchFilters(
      agentSession,
      projectName,
      normalizedSearchQuery,
      providerFilterId,
      sessionFilter,
    )) {
      continue;
    }
    filteredSessions.push(agentSession);
  }

  return filteredSessions;
}

function sortSidebarSessionsByMode(
  agentSessions: readonly AgentSessionView[],
  sortBy: ProjectExplorerSortBy,
): AgentSessionView[] {
  return sortAgentSessionInboxEntries(agentSessions, sortBy);
}

function resolveSidebarProjectViewSessions(
  agentSessions: readonly AgentSessionView[],
  sortBy: ProjectExplorerSortBy,
): AgentSessionView[] {
  return sortSidebarSessionsByMode(agentSessions, sortBy);
}

function areSidebarProjectInventoriesEqual(
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

function areSidebarPropsEqual(left: ProjectExplorerProps, right: ProjectExplorerProps): boolean {
  return (
    areSidebarProjectInventoriesEqual(left.projects, right.projects) &&
    areSidebarProjectInventoriesEqual(
      left.taskSearchProjects ?? left.projects,
      right.taskSearchProjects ?? right.projects,
    ) &&
    left.hasMoreProjects === right.hasMoreProjects &&
    left.isLoadingMoreProjects === right.isLoadingMoreProjects &&
    left.isVisible === right.isVisible &&
    left.selectedProjectId === right.selectedProjectId &&
    left.selectedAgentSessionId === right.selectedAgentSessionId &&
    left.onSelectProject === right.onSelectProject &&
    left.onSelectAgentSession === right.onSelectAgentSession &&
    left.onRenameAgentSession === right.onRenameAgentSession &&
    left.onDeleteAgentSession === right.onDeleteAgentSession &&
    left.onRenameProject === right.onRenameProject &&
    left.onDeleteProject === right.onDeleteProject &&
    left.onNewProject === right.onNewProject &&
    left.onLoadMoreProjects === right.onLoadMoreProjects &&
    left.onLoadMoreProjectSessions === right.onLoadMoreProjectSessions &&
    left.onOpenFolder === right.onOpenFolder &&
    left.onNewAgentSessionInProject === right.onNewAgentSessionInProject &&
    left.onRefreshProjectSessions === right.onRefreshProjectSessions &&
    left.onRefreshAgentSessionItems === right.onRefreshAgentSessionItems &&
    left.onArchiveProject === right.onArchiveProject &&
    left.onCopyWorkingDirectory === right.onCopyWorkingDirectory &&
    left.onCopyProjectPath === right.onCopyProjectPath &&
    left.onOpenInTerminal === right.onOpenInTerminal &&
    left.onOpenInFileExplorer === right.onOpenInFileExplorer &&
    left.onPinAgentSession === right.onPinAgentSession &&
    left.onArchiveAgentSession === right.onArchiveAgentSession &&
    left.onMarkAgentSessionUnread === right.onMarkAgentSessionUnread &&
    left.onCopyAgentSessionWorkingDirectory === right.onCopyAgentSessionWorkingDirectory &&
    left.onCopyAgentSessionProviderSessionId === right.onCopyAgentSessionProviderSessionId &&
    left.onCopyAgentSessionDeeplink === right.onCopyAgentSessionDeeplink &&
    left.onOpenAgentSessionInTerminal === right.onOpenAgentSessionInTerminal &&
    left.onForkAgentSessionLocal === right.onForkAgentSessionLocal &&
    left.onForkAgentSessionNewTree === right.onForkAgentSessionNewTree &&
    left.refreshingProjectId === right.refreshingProjectId &&
    left.refreshingAgentSessionId === right.refreshingAgentSessionId &&
    left.searchQuery === right.searchQuery &&
    left.setSearchQuery === right.setSearchQuery &&
    left.width === right.width
  );
}

type SidebarProjectEntry = ProjectExplorerProjectEntry;

type SidebarFilteredProjectSessionsEntry = {
  filteredSessions: AgentSessionView[];
  project: AgentProjectView;
};

type SidebarChronologicalContinuationEntry = {
  isLoading: boolean;
  nextVisibleSessionCount: number;
  project: AgentProjectView;
};

const EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS: SidebarFilteredProjectSessionsEntry[] = [];
const EMPTY_SIDEBAR_PROJECT_ENTRIES: SidebarProjectEntry[] = [];
const EMPTY_SIDEBAR_CHRONOLOGICAL_CONTINUATIONS: SidebarChronologicalContinuationEntry[] = [];

export const Sidebar = React.memo(function Sidebar({
  hasMoreProjects = false,
  isLoadingMoreProjects = false,
  isVisible = true,
  projects,
  taskSearchProjects = projects,
  selectedProjectId,
  selectedAgentSessionId,
  onSelectProject,
  onSelectAgentSession,
  onRenameAgentSession,
  onDeleteAgentSession,
  onRenameProject,
  onDeleteProject,
  onNewProject,
  onLoadMoreProjects,
  onLoadMoreProjectSessions,
  onOpenFolder,
  onNewAgentSessionInProject,
  onRefreshProjectSessions,
  onRefreshAgentSessionItems,
  onArchiveProject,
  onCopyWorkingDirectory,
  onCopyProjectPath,
  onOpenInTerminal,
  onOpenInFileExplorer,
  onPinAgentSession,
  onArchiveAgentSession,
  onMarkAgentSessionUnread,
  onCopyAgentSessionWorkingDirectory,
  onCopyAgentSessionProviderSessionId,
  onCopyAgentSessionDeeplink,
  onOpenAgentSessionInTerminal,
  onForkAgentSessionLocal,
  onForkAgentSessionNewTree,
  refreshingProjectId,
  refreshingAgentSessionId,
  searchQuery = '',
  setSearchQuery,
  width = 256
}: ProjectExplorerProps) {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [visibleSessionCountByProjectId, setVisibleSessionCountByProjectId] = useState<
    Record<string, number>
  >({});
  const [loadingMoreSessionProjectIds, setLoadingMoreSessionProjectIds] = useState<
    Record<string, boolean>
  >({});
  const loadingMoreSessionProjectIdsRef = useRef(new Set<string>());
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const taskSearchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const showArchived = preferences.sessionInboxShowArchived;
  const organizeBy: ProjectExplorerOrganizeBy = preferences.sessionInboxGroupMode;
  const providerFilterId = preferences.sessionInboxProviderId;
  const sessionFilter: ProjectExplorerSessionFilter = preferences.sessionInboxFilter;
  const sortBy: ProjectExplorerSortBy = preferences.sessionInboxSortMode;
  const { t } = useTranslation();
  const refreshSessionsLabel = t('code.refreshSessions');
  const refreshingSessionsLabel = t('code.refreshingSessions');
  const sessionRuntimeStatusLabels = useMemo<SessionRuntimeStatusLabels>(() => ({
    awaitingApproval: t('code.awaitingApprovalSession'),
    awaitingTool: t('code.awaitingToolSession'),
    awaitingUser: t('code.awaitingUserSession'),
    executing: t('code.executingSession'),
    failed: t('code.failedSession'),
    initializing: t('code.initializingSession'),
    stale: t('code.staleSession'),
    unknown: t('code.unknownSession'),
  }), [t]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    agentSessionId: string;
    projectId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number, y: number, projectId: string } | null>(null);
  const projectContextMenuRef = useRef<HTMLDivElement>(null);

  const [rootContextMenu, setRootContextMenu] = useState<{ x: number, y: number } | null>(null);
  const rootContextMenuRef = useRef<HTMLDivElement>(null);

  const [renamingAgentSession, setRenamingAgentSession] = useState<{
    projectId: string;
    id: string;
  } | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const lastAutoLocatedSelectionKeyRef = useRef('');
  const relativeTimeNow = useRelativeMinuteNow({ isEnabled: isVisible });
  const renderProjects = useMemo(
    () => deduplicateAgentProjectsForRender(projects),
    [projects],
  );
  const renderTaskSearchProjects = useMemo(
    () => deduplicateAgentProjectsForRender(taskSearchProjects),
    [taskSearchProjects],
  );
  const projectNamesById = useMemo(
    () => new Map(renderProjects.map((project) => [project.projectId, project.name])),
    [renderProjects],
  );
  const providerOptions = useMemo(() => {
    const providers = new Map<string, { id: string; label: string }>();
    for (const project of renderProjects) {
      for (const session of project.agentSessions) {
        const providerId = session.providerId.trim();
        if (providerId && providerId !== 'unknown' && !providers.has(providerId)) {
          providers.set(providerId, {
            id: providerId,
            label: resolveSessionProviderPresentation(session).label,
          });
        }
      }
    }
    return [...providers.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [renderProjects]);

  const closeFloatingMenus = useCallback(() => {
    setShowFilterMenu(false);
    setContextMenu(null);
    setProjectContextMenu(null);
    setRootContextMenu(null);
  }, []);

  const hasOpenViewportMenu =
    showFilterMenu ||
    contextMenu !== null ||
    projectContextMenu !== null ||
    rootContextMenu !== null;

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!hasOpenViewportMenu) {
        return;
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      if (projectContextMenuRef.current && !projectContextMenuRef.current.contains(event.target as Node)) {
        setProjectContextMenu(null);
      }
      if (rootContextMenuRef.current && !rootContextMenuRef.current.contains(event.target as Node)) {
        setRootContextMenu(null);
      }
    },
    [hasOpenViewportMenu],
  );

  useEffect(() => {
    if (!hasOpenViewportMenu) {
      return;
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, hasOpenViewportMenu]);

  useEffect(() => {
    if (!hasOpenViewportMenu) {
      return;
    }

    const handleViewportChange = () => {
      closeFloatingMenus();
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    return () => {
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [closeFloatingMenus, hasOpenViewportMenu]);

  // When the search query changes, expand all projects that have matching sessions.
  useEffect(() => {
    if (deferredSearchQuery) {
      setExpandedProjects((previousExpandedProjects) => {
        let changed = false;
        const nextExpandedProjects = { ...previousExpandedProjects };
        renderProjects.forEach((project) => {
          if (project.agentSessions.length > 0 && nextExpandedProjects[project.projectId] !== true) {
            nextExpandedProjects[project.projectId] = true;
            changed = true;
          }
        });
        return changed ? nextExpandedProjects : previousExpandedProjects;
      });
    }
  }, [deferredSearchQuery, renderProjects]);

  useEffect(() => {
    if (
      !isVisible ||
      organizeBy !== 'project' ||
      !selectedProjectId ||
      !projectNamesById.has(selectedProjectId)
    ) {
      return;
    }

    setExpandedProjects((previousExpandedProjects) =>
      previousExpandedProjects[selectedProjectId] === true
        ? previousExpandedProjects
        : {
            ...previousExpandedProjects,
            [selectedProjectId]: true,
          },
    );
  }, [isVisible, organizeBy, projectNamesById, selectedProjectId]);

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
      let changed = false;
      const nextState: Record<string, boolean> = {};
      for (const project of renderProjects) {
        if (previousState[project.projectId] === true) {
          nextState[project.projectId] = true;
        }
      }
      if (Object.keys(previousState).length !== Object.keys(nextState).length) {
        changed = true;
      }
      for (const projectId of Object.keys(nextState)) {
        if (previousState[projectId] !== nextState[projectId]) {
          changed = true;
          break;
        }
      }
      return changed ? nextState : previousState;
    });
  }, [renderProjects]);

  const selectProject = useCallback((projectId: string) => {
    onSelectProject?.(projectId);
  }, [onSelectProject]);

  const handleSelectAgentSession = useCallback((
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    onSelectAgentSession(agentSessionId, projectId);
  }, [onSelectAgentSession]);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    agentSessionId: string,
    projectId?: string | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectContextMenu(null);
    setRootContextMenu(null);

    const normalizedProjectId = projectId?.trim() ?? '';
    if (!normalizedProjectId) {
      return;
    }

    const position = clampSidebarContextMenuCoordinates(e.clientX, e.clientY, 224, 350);
    setContextMenu({ ...position, agentSessionId, projectId: normalizedProjectId });
  }, []);

  const handleProjectContextMenu = useCallback((e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setRootContextMenu(null);

    const position = clampSidebarContextMenuCoordinates(e.clientX, e.clientY, 224, 250);
    setProjectContextMenu({ ...position, projectId });
  }, []);

  const openProjectContextMenuFromButton = useCallback((
    event: React.MouseEvent<HTMLButtonElement>,
    projectId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    setRootContextMenu(null);

    const bounds = event.currentTarget.getBoundingClientRect();
    let nextY = Math.round(bounds.bottom + 6);

    if (nextY + 250 > window.innerHeight) {
      nextY = Math.round(bounds.top - 250 - 6);
    }

    const position = clampSidebarContextMenuCoordinates(
      Math.round(bounds.right - 224),
      nextY,
      224,
      250,
    );

    setProjectContextMenu({ ...position, projectId });
  }, []);

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setProjectContextMenu(null);

    const position = clampSidebarContextMenuCoordinates(e.clientX, e.clientY, 224, 150);
    setRootContextMenu(position);
  };

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const agentSessionLookup = useMemo(
    () => buildSidebarAgentSessionLookup(renderProjects),
    [renderProjects],
  );
  const projectLookup = useMemo(
    () =>
      new Map(
        renderProjects.map(
          (project) => [project.projectId, project] satisfies [string, AgentProjectView],
        ),
      ),
    [renderProjects],
  );
  const selectedContextMenuSession = useMemo(
    () => {
      if (!contextMenu) {
        return undefined;
      }

      const scopedProject = projectLookup.get(contextMenu.projectId);
      return agentSessionLookup.byProjectIdAndId.get(
        buildSidebarSessionScopedKey(contextMenu.projectId, contextMenu.agentSessionId),
      ) ?? scopedProject?.agentSessions.find(
          (agentSession) => agentSession.id === contextMenu.agentSessionId,
        );
    },
    [agentSessionLookup, contextMenu, projectLookup],
  );
  const selectedProjectContextMenuProject = useMemo(
    () =>
      projectContextMenu ? projectLookup.get(projectContextMenu.projectId) : undefined,
    [projectContextMenu, projectLookup],
  );
  const selectedSidebarAgentSession = useMemo(
    () => {
      if (!selectedAgentSessionId) {
        return null;
      }

      const scopedProject = selectedProjectId
        ? projectLookup.get(selectedProjectId)
        : undefined;
      if (selectedProjectId) {
        return agentSessionLookup.byProjectIdAndId.get(
          buildSidebarSessionScopedKey(selectedProjectId, selectedAgentSessionId),
        ) ?? scopedProject?.agentSessions.find(
            (agentSession) => agentSession.id === selectedAgentSessionId,
          ) ?? null;
      }

      return agentSessionLookup.uniqueById.get(selectedAgentSessionId) ?? null;
    },
    [agentSessionLookup, projectLookup, selectedAgentSessionId, selectedProjectId],
  );
  const newSessionEngineCatalog = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId: selectedSidebarAgentSession?.engineId,
          currentSessionModelId: selectedSidebarAgentSession?.modelId,
          preferredEngineId: preferences.codeEngineId,
          preferredModelId: preferences.codeModelId,
        },
        preferences,
      ),
    [
      preferences,
      selectedSidebarAgentSession?.engineId,
      selectedSidebarAgentSession?.modelId,
    ],
  );
  const newSessionEngineOptions = useMemo<readonly ProjectExplorerEngineOption[]>(
    () =>
      newSessionEngineCatalog.availableEngines.map((engine) => ({
        id: engine.id,
        label: engine.label,
        modelId: resolveWorkbenchCodeEngineSelectedModelId(engine.id, preferences),
        terminalProfileId: null,
      })),
    [newSessionEngineCatalog.availableEngines, preferences],
  );
  const terminalEngineOptions: readonly ProjectExplorerEngineOption[] = [];
  const handleLoadMoreProjectSessions = useCallback(
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
        if (isAbortError(error)) {
          return;
        }
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : t('code.failedToLoadMoreSessions');
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
  useEffect(() => {
    if (!isVisible || organizeBy === 'project') {
      return;
    }

    for (const project of renderProjects) {
      if (project.agentSessionPageInfo === undefined) {
        void handleLoadMoreProjectSessions(
          project.projectId,
          INITIAL_VISIBLE_SESSIONS_PER_PROJECT,
        );
      }
    }
  }, [handleLoadMoreProjectSessions, isVisible, organizeBy, renderProjects]);
  const toggleProject = useCallback((projectId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const isExpanding = expandedProjects[projectId] !== true;
    setExpandedProjects((previousExpandedProjects) => ({
      ...previousExpandedProjects,
      [projectId]: !previousExpandedProjects[projectId],
    }));

    const project = renderProjects.find((candidate) => candidate.projectId === projectId);
    if (isExpanding && project?.agentSessionPageInfo === undefined) {
      void handleLoadMoreProjectSessions(projectId, INITIAL_VISIBLE_SESSIONS_PER_PROJECT);
    }
  }, [expandedProjects, handleLoadMoreProjectSessions, renderProjects]);
  const handleRenameValueChange = useCallback((value: string) => {
    setRenameValue(value);
  }, []);
  const handleProjectRenameSubmit = useCallback(
    (projectId: string, nextValue: string, currentName: string) => {
      const normalizedValue = nextValue.trim();
      if (normalizedValue && normalizedValue !== currentName) {
        onRenameProject(projectId, normalizedValue);
      }
      setRenamingProjectId(null);
    },
    [onRenameProject],
  );
  const handleProjectRenameCancel = useCallback(() => {
    setRenamingProjectId(null);
  }, []);
  const handleAgentSessionRenameSubmit = useCallback(
    (
      agentSessionId: string,
      projectId: string,
      nextValue: string,
      currentTitle: string,
    ) => {
      const normalizedValue = nextValue.trim();
      if (normalizedValue && normalizedValue !== currentTitle) {
        onRenameAgentSession(agentSessionId, projectId, normalizedValue);
      }
      setRenamingAgentSession(null);
    },
    [onRenameAgentSession],
  );
  const handleAgentSessionRenameCancel = useCallback(() => {
    setRenamingAgentSession(null);
  }, []);
  const handleCreateEngineSession = useCallback((engineId: string, modelId: string) => {
    if (!selectedProjectId) {
      return;
    }
    onNewAgentSessionInProject(selectedProjectId, engineId, modelId);
  }, [onNewAgentSessionInProject, selectedProjectId]);
  const handleOpenTaskSearch = useCallback((trigger: HTMLButtonElement) => {
    taskSearchTriggerRef.current = trigger;
    setShowFilterMenu(false);
    setContextMenu(null);
    setProjectContextMenu(null);
    setRootContextMenu(null);
    setTaskSearchQuery('');
    setShowSearch(true);
  }, []);
  const handleCloseTaskSearch = useCallback(() => {
    setShowSearch(false);
    setTaskSearchQuery('');
    setSearchQuery?.('');
  }, [setSearchQuery]);
  const handleSelectTaskSearchEntry = useCallback((entry: {
    projectId: string;
    session: AgentSessionView;
  }) => {
    handleSelectAgentSession(entry.session.id, entry.projectId);
    handleCloseTaskSearch();
  }, [handleCloseTaskSearch, handleSelectAgentSession]);
  const handleCreateTaskFromSearch = useCallback(() => {
    if (!selectedProjectId) {
      return;
    }
    handleCloseTaskSearch();
    onNewAgentSessionInProject(
      selectedProjectId,
      newSessionEngineCatalog.preferredSelection.engineId,
      newSessionEngineCatalog.preferredSelection.modelId,
    );
  }, [
    handleCloseTaskSearch,
    newSessionEngineCatalog.preferredSelection.engineId,
    newSessionEngineCatalog.preferredSelection.modelId,
    onNewAgentSessionInProject,
    selectedProjectId,
  ]);
  const handleOpenFolderFromTaskSearch = useCallback(() => {
    if (!onOpenFolder) {
      return;
    }
    handleCloseTaskSearch();
    onOpenFolder();
  }, [handleCloseTaskSearch, onOpenFolder]);
  const handleSearchFilesFromTaskSearch = useCallback(() => {
    if (!selectedProjectId) {
      return;
    }
    handleCloseTaskSearch();
    globalEventBus.emit('openQuickOpen');
  }, [handleCloseTaskSearch, selectedProjectId]);
  const handleCreateProjectFromHeader = useCallback(async () => {
    const newId = await onNewProject();
    if (newId) {
      setExpandedProjects((previousExpandedProjects) =>
        previousExpandedProjects[newId] === true
          ? previousExpandedProjects
          : { ...previousExpandedProjects, [newId]: true },
      );
    }
  }, [onNewProject]);
  const handleCreateProjectFromRootContextMenu = useCallback(async () => {
    await handleCreateProjectFromHeader();
  }, [handleCreateProjectFromHeader]);
  const handleLoadMoreProjects = useCallback(async () => {
    if (!onLoadMoreProjects || isLoadingMoreProjects) {
      return;
    }

    try {
      await onLoadMoreProjects();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t('code.failedToLoadMoreProjects');
      addToast(message, 'error');
    }
  }, [addToast, isLoadingMoreProjects, onLoadMoreProjects, t]);
  const handleCreateDefaultSessionFromRootContextMenu = useCallback(() => {
    if (selectedProjectId) {
      onNewAgentSessionInProject(
        selectedProjectId,
        newSessionEngineCatalog.preferredSelection.engineId,
        newSessionEngineCatalog.preferredSelection.modelId,
      );
      return;
    }

    addToast(t('code.selectProjectFirst'), 'error');
  }, [
    addToast,
    newSessionEngineCatalog.preferredSelection.engineId,
    newSessionEngineCatalog.preferredSelection.modelId,
    onNewAgentSessionInProject,
    selectedProjectId,
    t,
  ]);
  const handleStartRenamingCurrentSession = useCallback(
    (agentSessionId: string, projectId: string, title: string) => {
      setRenamingAgentSession({ projectId, id: agentSessionId });
      setRenameValue(title);
    },
    [],
  );
  const handleStartRenamingCurrentProject = useCallback((projectId: string, name: string) => {
    setRenamingProjectId(projectId);
    setRenameValue(name);
  }, []);
  const handleRefreshSelectedProject = useCallback(() => {
    if (!selectedProjectId || !onRefreshProjectSessions) {
      return;
    }
    void onRefreshProjectSessions(selectedProjectId);
  }, [onRefreshProjectSessions, selectedProjectId]);
  const handleOrganizeByProject = useCallback(() => {
    updatePreferences({ sessionInboxGroupMode: 'project' });
    setShowFilterMenu(false);
    addToast(t('code.organizedByProject'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleOrganizeByProvider = useCallback(() => {
    updatePreferences({ sessionInboxGroupMode: 'provider' });
    setShowFilterMenu(false);
    addToast(t('code.organizedByProvider'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleOrganizeChronologically = useCallback(() => {
    updatePreferences({ sessionInboxGroupMode: 'chronological' });
    setShowFilterMenu(false);
    addToast(t('code.organizedChronologically'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleSortByCreated = useCallback(() => {
    updatePreferences({ sessionInboxSortMode: 'created' });
    setShowFilterMenu(false);
    addToast(t('code.sortedByCreatedDate'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleSortBySmart = useCallback(() => {
    updatePreferences({ sessionInboxSortMode: 'smart' });
    setShowFilterMenu(false);
    addToast(t('code.sortedBySmartPriority'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleSortByRecent = useCallback(() => {
    updatePreferences({ sessionInboxSortMode: 'recent' });
    setShowFilterMenu(false);
    addToast(t('code.sortedByRecentActivity'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleShowAllSessions = useCallback(() => {
    updatePreferences({ sessionInboxShowArchived: true });
    setShowFilterMenu(false);
    addToast(t('code.showingAllSessions'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleShowRelevantSessions = useCallback(() => {
    updatePreferences({ sessionInboxShowArchived: false });
    setShowFilterMenu(false);
    addToast(t('code.showingRelevantSessions'), 'success');
  }, [addToast, t, updatePreferences]);
  const handleProviderFilterChange = useCallback((providerId: string) => {
    updatePreferences({ sessionInboxProviderId: providerId });
    setShowFilterMenu(false);
  }, [updatePreferences]);
  const handleSessionFilterChange = useCallback((filter: ProjectExplorerSessionFilter) => {
    updatePreferences({ sessionInboxFilter: filter });
    setShowFilterMenu(false);
  }, [updatePreferences]);
  const resolveProjectViewSessions = useCallback(
    (agentSessions: readonly AgentSessionView[]) =>
      resolveSidebarProjectViewSessions(agentSessions, sortBy),
    [sortBy],
  );
  const filteredProjectSessions = useMemo<SidebarFilteredProjectSessionsEntry[]>(
    () => {
      if (organizeBy !== 'project') {
        return EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS;
      }

      return renderProjects
        .filter((project) => showArchived || project.status !== 'archived')
        .map((project) => ({
          project,
          filteredSessions: resolveProjectViewSessions(
            filterSidebarProjectSessions(
              project.agentSessions,
              project.name,
              showArchived,
              normalizedSearchQuery,
              providerFilterId,
              sessionFilter,
            ),
          ),
        }))
        .filter(
          (entry) =>
            !normalizedSearchQuery ||
            entry.filteredSessions.length > 0 ||
            canLoadMoreProjectSessions(
              entry.project,
              INITIAL_VISIBLE_SESSIONS_PER_PROJECT,
            ),
        );
    },
    [
      normalizedSearchQuery,
      organizeBy,
      providerFilterId,
      renderProjects,
      resolveProjectViewSessions,
      sessionFilter,
      showArchived,
    ],
  );
  const chronologicalSessions = useMemo(
    () => {
      if (organizeBy === 'project') {
        return EMPTY_SIDEBAR_AGENT_SESSIONS;
      }

      return buildSidebarGlobalSessions({
        matches: (session, project) => doesSidebarSessionMatchFilters(
          session,
          project.name,
          normalizedSearchQuery,
          providerFilterId,
          sessionFilter,
        ),
        projects: renderProjects,
        showArchived,
        sortBy,
      });
    },
    [
      normalizedSearchQuery,
      organizeBy,
      providerFilterId,
      renderProjects,
      sessionFilter,
      showArchived,
      sortBy,
    ],
  );
  const chronologicalContinuationEntries = useMemo<SidebarChronologicalContinuationEntry[]>(
    () => {
      if (organizeBy === 'project') {
        return EMPTY_SIDEBAR_CHRONOLOGICAL_CONTINUATIONS;
      }

      return renderProjects
        .filter((project) => showArchived || project.status !== 'archived')
        .filter(canRequestMoreSidebarProjectSessions)
        .map((project) => ({
          isLoading: loadingMoreSessionProjectIds[project.projectId] === true,
          nextVisibleSessionCount: project.agentSessions.length + SESSION_EXPANSION_BATCH_SIZE,
          project,
        }));
    },
    [
      loadingMoreSessionProjectIds,
      organizeBy,
      renderProjects,
      showArchived,
    ],
  );
  const providerEntries = useMemo<SidebarProviderEntry[]>(() => {
    if (organizeBy !== 'provider') {
      return [];
    }
    return groupSortedSidebarSessionsByProvider(chronologicalSessions).map((group) => {
      const representative = group.sessions[0]!;
      return {
        agentId: representative.agentId,
        engineId: representative.engineId,
        label: resolveSessionProviderPresentation(representative).label,
        providerId: group.providerId,
        sessions: group.sessions,
      };
    });
  }, [chronologicalSessions, organizeBy]);
  const projectEntries = useMemo<SidebarProjectEntry[]>(
    () => {
      if (organizeBy !== 'project') {
        return EMPTY_SIDEBAR_PROJECT_ENTRIES;
      }

      return filteredProjectSessions
        .map(({ project, filteredSessions }) => {
          const visibleSessionCount =
            visibleSessionCountByProjectId[project.projectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;

          return {
            canShowMoreSessions: canLoadMoreProjectSessions(project, visibleSessionCount),
            filteredSessions,
            isLoadingMoreSessions: loadingMoreSessionProjectIds[project.projectId] === true,
            nextVisibleSessionCount: visibleSessionCount + SESSION_EXPANSION_BATCH_SIZE,
            project,
            visibleSessions: filteredSessions.slice(0, visibleSessionCount),
          };
        });
    },
    [
      filteredProjectSessions,
      loadingMoreSessionProjectIds,
      normalizedSearchQuery,
      organizeBy,
      visibleSessionCountByProjectId,
    ],
  );
  useEffect(() => {
    if (organizeBy !== 'project' || !selectedProjectId || !selectedAgentSessionId) {
      return;
    }

    const selectedProjectEntry = projectEntries.find(
      (entry) => entry.project.projectId === selectedProjectId,
    );
    const selectedSessionIndex = selectedProjectEntry?.filteredSessions.findIndex(
      (session) => session.id === selectedAgentSessionId,
    ) ?? -1;
    if (selectedSessionIndex < 0) {
      return;
    }

    const requiredVisibleSessionCount = selectedSessionIndex + 1;
    setVisibleSessionCountByProjectId((previousState) => {
      const currentVisibleSessionCount =
        previousState[selectedProjectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
      if (currentVisibleSessionCount >= requiredVisibleSessionCount) {
        return previousState;
      }
      return {
        ...previousState,
        [selectedProjectId]: requiredVisibleSessionCount,
      };
    });
  }, [organizeBy, projectEntries, selectedAgentSessionId, selectedProjectId]);
  const shouldWindowChronologicalSessions =
    organizeBy === 'chronological' &&
    chronologicalSessions.length >= CHRONOLOGICAL_WINDOWED_LIST_THRESHOLD;
  const chronologicalWindowedRange = useFixedSizeWindowedRange({
    containerRef: scrollRegionRef,
    isEnabled: shouldWindowChronologicalSessions,
    itemCount: chronologicalSessions.length,
    itemHeight: CHRONOLOGICAL_SESSION_ROW_HEIGHT,
    overscan: 10,
  });
  const visibleChronologicalSessions = useMemo(
    () =>
      shouldWindowChronologicalSessions
        ? chronologicalSessions.slice(
            chronologicalWindowedRange.startIndex,
            chronologicalWindowedRange.endIndex,
          )
        : chronologicalSessions,
    [
      chronologicalSessions,
      chronologicalWindowedRange.endIndex,
      chronologicalWindowedRange.startIndex,
      shouldWindowChronologicalSessions,
    ],
  );
  useEffect(() => {
    if (!isVisible || !selectedProjectId) {
      return undefined;
    }

    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) {
      return undefined;
    }

    const selectionKey = selectedAgentSessionId
      ? `${organizeBy}\u0001${selectedProjectId}\u0001${selectedAgentSessionId}`
      : `${organizeBy}\u0001${selectedProjectId}`;
    if (lastAutoLocatedSelectionKeyRef.current === selectionKey) {
      return undefined;
    }

    if (selectedAgentSessionId && shouldWindowChronologicalSessions) {
      const selectedSessionIndex = chronologicalSessions.findIndex(
        (session) =>
          session.projectId === selectedProjectId &&
          session.id === selectedAgentSessionId,
      );
      const isOutsideRenderedWindow =
        selectedSessionIndex >= 0 &&
        (
          selectedSessionIndex < chronologicalWindowedRange.startIndex ||
          selectedSessionIndex >= chronologicalWindowedRange.endIndex
        );
      if (isOutsideRenderedWindow) {
        scrollRegion.scrollTo({
          behavior: 'auto',
          top: selectedSessionIndex * CHRONOLOGICAL_SESSION_ROW_HEIGHT,
        });
        return undefined;
      }
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const selectedSessionElement = selectedAgentSessionId
        ? scrollRegion.querySelector<HTMLElement>('[data-session-selected="true"]')
        : null;
      if (selectedSessionElement) {
        selectedSessionElement.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
          inline: 'nearest',
        });
        lastAutoLocatedSelectionKeyRef.current = selectionKey;
        return;
      }

      if (!selectedAgentSessionId && organizeBy === 'project') {
        const selectedProjectElement = scrollRegion.querySelector<HTMLElement>(
          '[data-project-selected="true"]',
        );
        if (selectedProjectElement) {
          selectedProjectElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
            inline: 'nearest',
          });
          lastAutoLocatedSelectionKeyRef.current = selectionKey;
        }
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    chronologicalSessions,
    chronologicalWindowedRange.endIndex,
    chronologicalWindowedRange.startIndex,
    isVisible,
    organizeBy,
    projectEntries,
    selectedAgentSessionId,
    selectedProjectId,
    shouldWindowChronologicalSessions,
    visibleChronologicalSessions,
  ]);
  const renderFlatSessionRow = (
    session: AgentSessionView,
    showProjectName: boolean,
  ) => (
    <ProjectExplorerSessionRow
      key={buildSidebarSessionRenderKey(session)}
      relativeTimeNow={relativeTimeNow}
      session={session}
      sessionProjectId={session.projectId}
      projectName={projectNamesById.get(session.projectId)}
      showProjectName={showProjectName}
      isSelected={
        selectedProjectId
          ? selectedAgentSessionId === session.id && selectedProjectId === session.projectId
          : selectedSidebarAgentSession?.id === session.id &&
            selectedSidebarAgentSession.projectId === session.projectId
      }
      isRenaming={
        renamingAgentSession?.projectId === session.projectId &&
        renamingAgentSession.id === session.id
      }
      renameValue={
        renamingAgentSession?.projectId === session.projectId &&
        renamingAgentSession.id === session.id
          ? renameValue
          : ''
      }
      paddingClassName="px-2"
      runtimeStatusLabels={sessionRuntimeStatusLabels}
      moreActionsLabel={t('app.moreActions')}
      onSelectAgentSession={handleSelectAgentSession}
      onAgentSessionContextMenu={handleContextMenu}
      onRenameValueChange={handleRenameValueChange}
      onRenameSubmit={handleAgentSessionRenameSubmit}
      onRenameCancel={handleAgentSessionRenameCancel}
    />
  );
  return (
    <div 
      className="birdcoder-workbench-sidebar relative flex shrink-0 flex-col border-r text-[length:var(--birdcoder-ui-font-size,12px)] backdrop-blur-xl"
      style={{ width }}
      onContextMenu={handleRootContextMenu}
    >
      <div className="birdcoder-session-list flex min-h-0 flex-1 flex-col">
        <ProjectExplorerHeader
        selectedProjectId={selectedProjectId}
        showFilterMenu={showFilterMenu}
        showSearch={showSearch}
        organizeBy={organizeBy}
        sortBy={sortBy}
        showArchived={showArchived}
        providerFilterId={providerFilterId}
        providerOptions={providerOptions}
        sessionFilter={sessionFilter}
        isRefreshingSelectedProject={refreshingProjectId === selectedProjectId}
        refreshSessionsLabel={refreshSessionsLabel}
        refreshingSessionsLabel={refreshingSessionsLabel}
        newSessionLabel={t('app.menu.newSession')}
        newSessionInCurrentProjectLabel={t('app.newSessionInCurrentProject')}
        selectProjectFirstLabel={t('code.selectProjectFirst')}
        currentSessionEngineId={selectedSidebarAgentSession?.engineId ?? null}
        currentSessionModelId={selectedSidebarAgentSession?.modelId ?? null}
        selectedEngineId={preferences.codeEngineId}
        selectedModelId={preferences.codeModelId}
        sessionsLabel={t('app.sessions')}
        searchSessionsTitleLabel={t('app.searchTasks')}
        newProjectLabel={t('app.newProject')}
        openFolderLabel={t('app.menu.openFolder').replace('...', '')}
        organizeLabel={t('app.organize')}
        byProjectLabel={t('app.byProject')}
        byProviderLabel={t('app.byProvider')}
        chronologicalLabel={t('app.chronological')}
        sortByLabel={t('app.sortBy')}
        smartLabel={t('app.smart')}
        recentLabel={t('app.recent')}
        createdLabel={t('app.created')}
        showLabel={t('app.show')}
        allSessionsLabel={t('app.allSessions')}
        relevantLabel={t('app.relevant')}
        providerLabel={t('app.provider')}
        anyProviderLabel={t('app.anyProvider')}
        statusLabel={t('app.status')}
        attentionLabel={t('app.attention')}
        executingLabel={t('app.executing')}
        failedLabel={t('app.failed')}
        pinnedLabel={t('app.pinned')}
        unreadLabel={t('app.unread')}
        filterMenuRef={filterMenuRef}
        scrollRegionRef={scrollRegionRef}
        onCreateSession={handleCreateEngineSession}
        onRefreshSelectedProject={onRefreshProjectSessions ? handleRefreshSelectedProject : undefined}
        onToggleSearch={handleOpenTaskSearch}
        onCreateProject={handleCreateProjectFromHeader}
        onOpenFolder={onOpenFolder}
        onToggleFilterMenu={() => setShowFilterMenu((previousState) => !previousState)}
        onOrganizeByProject={handleOrganizeByProject}
        onOrganizeByProvider={handleOrganizeByProvider}
        onOrganizeChronologically={handleOrganizeChronologically}
        onSortByCreated={handleSortByCreated}
        onSortBySmart={handleSortBySmart}
        onSortByRecent={handleSortByRecent}
        onShowAllSessions={handleShowAllSessions}
        onShowRelevantSessions={handleShowRelevantSessions}
        onProviderFilterChange={handleProviderFilterChange}
        onSessionFilterChange={handleSessionFilterChange}
      >
        <div className="flex flex-col gap-1">
          {organizeBy === 'project' ? (
            projectEntries.map((entry) => {
              const selectedVisibleSessionId = entry.visibleSessions.some(
                (session) =>
                  entry.project.projectId === selectedProjectId &&
                  session.id === selectedAgentSessionId,
              )
                ? selectedAgentSessionId
                : null;
              const renamingVisibleSessionId = entry.visibleSessions.some(
                (session) =>
                  entry.project.projectId === renamingAgentSession?.projectId &&
                  session.id === renamingAgentSession?.id,
              )
                ? renamingAgentSession?.id ?? null
                : null;

              return (
                <ProjectExplorerProjectSection
                  key={entry.project.projectId}
                  entry={entry}
                  relativeTimeNow={relativeTimeNow}
                  expanded={expandedProjects[entry.project.projectId] === true}
                  isSelectedProject={selectedProjectId === entry.project.projectId}
                  selectedVisibleSessionId={selectedVisibleSessionId}
                  renamingVisibleSessionId={renamingVisibleSessionId}
                  sessionRenameValue={renamingVisibleSessionId ? renameValue : ''}
                  isRenamingProject={renamingProjectId === entry.project.projectId}
                  projectRenameValue={renamingProjectId === entry.project.projectId ? renameValue : ''}
                  noSessionsLabel={t('app.noSessions')}
                  expandProjectLabel={t('code.expandProject', { name: entry.project.name })}
                  collapseProjectLabel={t('code.collapseProject', { name: entry.project.name })}
                  loadMoreSessionsLabel={t('code.showMoreSessions')}
                  loadingMoreSessionsLabel={t('code.loadingMoreSessions')}
                  defaultNewSessionEngineId={newSessionEngineCatalog.preferredSelection.engineId}
                  defaultNewSessionModelId={newSessionEngineCatalog.preferredSelection.modelId}
                  newSessionInProjectLabel={t('code.newSessionInProject')}
                  runtimeStatusLabels={sessionRuntimeStatusLabels}
                  moreActionsLabel={t('app.moreActions')}
                  onSelectProject={selectProject}
                  onToggleProject={toggleProject}
                  onProjectContextMenu={handleProjectContextMenu}
                  onOpenProjectContextMenuFromButton={openProjectContextMenuFromButton}
                  onNewAgentSessionInProject={onNewAgentSessionInProject}
                  onSelectAgentSession={handleSelectAgentSession}
                  onAgentSessionContextMenu={handleContextMenu}
                  onProjectRenameValueChange={handleRenameValueChange}
                  onProjectRenameSubmit={handleProjectRenameSubmit}
                  onProjectRenameCancel={handleProjectRenameCancel}
                  onSessionRenameValueChange={handleRenameValueChange}
                  onSessionRenameSubmit={handleAgentSessionRenameSubmit}
                  onSessionRenameCancel={handleAgentSessionRenameCancel}
                  onLoadMoreProjectSessions={handleLoadMoreProjectSessions}
                />
              );
            })
          ) : organizeBy === 'provider' ? (
            <>
              {providerEntries.map((entry) => (
                <section key={entry.providerId} className="min-w-0">
                  <div className="sticky top-0 z-10 flex h-7 items-center gap-2 bg-[var(--birdcoder-sidebar-background,#171717)] px-2 text-[10px] font-semibold uppercase text-gray-500">
                    <SessionProviderBadge
                      agentId={entry.agentId}
                      engineId={entry.engineId}
                      providerId={entry.providerId}
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="tabular-nums text-gray-600">{entry.sessions.length}</span>
                  </div>
                  {entry.sessions.map((session) => renderFlatSessionRow(session, true))}
                </section>
              ))}
              {providerEntries.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">{t('app.noSessions')}</div>
              ) : null}
              {chronologicalContinuationEntries.map((entry) => (
                <button
                  key={`provider-continuation:${entry.project.projectId}`}
                  type="button"
                  className="mx-2 mt-1 inline-flex min-h-8 items-center justify-start gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
                  disabled={entry.isLoading}
                  onClick={() => handleLoadMoreProjectSessions(entry.project.projectId, entry.nextVisibleSessionCount)}
                >
                  {entry.isLoading ? <Loader2 size={11} className="animate-spin" /> : <ChevronDown size={11} />}
                  <span className="min-w-0 truncate">{entry.project.name}</span>
                  <span>{entry.isLoading ? t('code.loadingMoreSessions') : t('code.showMoreSessions')}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {shouldWindowChronologicalSessions ? (
                <div style={{ height: chronologicalWindowedRange.paddingTop }} />
              ) : null}
              {visibleChronologicalSessions.map((session) => renderFlatSessionRow(session, true))}
              {chronologicalSessions.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">{t('app.noSessions')}</div>
              ) : null}
              {shouldWindowChronologicalSessions ? (
                <div style={{ height: chronologicalWindowedRange.paddingBottom }} />
              ) : null}
              {chronologicalContinuationEntries.map((entry) => (
                <button
                  key={`chronological-continuation:${entry.project.projectId}`}
                  type="button"
                  className="mx-2 mt-1 inline-flex min-h-8 items-center justify-start gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
                  disabled={entry.isLoading}
                  aria-busy={entry.isLoading}
                  onClick={() =>
                    handleLoadMoreProjectSessions(
                      entry.project.projectId,
                      entry.nextVisibleSessionCount,
                    )
                  }
                >
                  {entry.isLoading ? (
                    <Loader2 size={11} className="shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 truncate">{entry.project.name}</span>
                  <span className="shrink-0">
                    {entry.isLoading
                      ? t('code.loadingMoreSessions')
                      : t('code.showMoreSessions')}
                  </span>
                </button>
              ))}
            </>
          )}

          {hasMoreProjects && onLoadMoreProjects ? (
            <button
              type="button"
              className="mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-gray-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoadingMoreProjects}
              onClick={() => {
                void handleLoadMoreProjects();
              }}
            >
              {isLoadingMoreProjects ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ChevronDown size={14} />
              )}
              <span>
                {isLoadingMoreProjects
                  ? t('code.loadingMoreProjects')
                  : t('code.loadMoreProjects')}
              </span>
            </button>
          ) : null}
        </div>
        </ProjectExplorerHeader>
      </div>

      {showSearch &&
        renderSidebarContextMenuPortal(
          <TaskSearchDialog
            canCreateTask={Boolean(selectedProjectId)}
            canSearchFiles={Boolean(selectedProjectId)}
            labels={{
              clearSearch: t('app.clearTaskSearch'),
              newTask: t('app.newTask'),
              noTasksFound: t('app.noTasksFound'),
              openFolder: t('app.openFolderAction'),
              recommendations: t('app.taskSearchRecommendations'),
              searchFiles: t('app.searchFilesAction'),
              searchPlaceholder: t('app.searchTasks'),
              selectProjectFirst: t('code.selectProjectFirst'),
              tasks: t('app.tasks'),
            }}
            projects={renderTaskSearchProjects}
            query={taskSearchQuery}
            returnFocusElement={taskSearchTriggerRef.current}
            runtimeStatusLabels={sessionRuntimeStatusLabels}
            selectedProjectId={selectedProjectId}
            selectedSessionId={selectedAgentSessionId}
            onClose={handleCloseTaskSearch}
            onCreateTask={handleCreateTaskFromSearch}
            onOpenFolder={onOpenFolder ? handleOpenFolderFromTaskSearch : undefined}
            onQueryChange={setTaskSearchQuery}
            onSearchFiles={handleSearchFilesFromTaskSearch}
            onSelectTask={handleSelectTaskSearchEntry}
          />,
        )}

      {rootContextMenu &&
        renderSidebarContextMenuPortal(
          <ProjectExplorerRootContextMenu
            menuRef={rootContextMenuRef}
            position={rootContextMenu}
            zIndex={SIDEBAR_CONTEXT_MENU_Z_INDEX}
            selectedProjectId={selectedProjectId}
            engineOptions={newSessionEngineOptions}
            onClose={() => setRootContextMenu(null)}
            onCreateProject={handleCreateProjectFromRootContextMenu}
            onOpenFolder={onOpenFolder}
            onCreateDefaultSession={handleCreateDefaultSessionFromRootContextMenu}
            onCreateEngineSession={handleCreateEngineSession}
          />,
        )}

      {contextMenu &&
        renderSidebarContextMenuPortal(
          <ProjectExplorerSessionContextMenu
            menuRef={contextMenuRef}
            position={contextMenu}
            zIndex={SIDEBAR_CONTEXT_MENU_Z_INDEX}
            sessionId={contextMenu.agentSessionId}
            projectId={contextMenu.projectId}
            session={selectedContextMenuSession}
            isRefreshing={refreshingAgentSessionId === contextMenu.agentSessionId}
            onClose={() => setContextMenu(null)}
            onRefresh={onRefreshAgentSessionItems}
            onPin={onPinAgentSession}
            onStartRename={handleStartRenamingCurrentSession}
            onArchive={onArchiveAgentSession}
            onMarkUnread={onMarkAgentSessionUnread}
            onCopyWorkingDirectory={onCopyAgentSessionWorkingDirectory}
            onCopyProviderSessionId={onCopyAgentSessionProviderSessionId}
            onCopyDeeplink={onCopyAgentSessionDeeplink}
            onOpenInTerminal={onOpenAgentSessionInTerminal}
            onForkLocal={onForkAgentSessionLocal}
            onForkNewTree={onForkAgentSessionNewTree}
            onDelete={onDeleteAgentSession}
          />,
        )}

      {projectContextMenu &&
        renderSidebarContextMenuPortal(
          <ProjectExplorerProjectContextMenu
            menuRef={projectContextMenuRef}
            position={projectContextMenu}
            zIndex={SIDEBAR_CONTEXT_MENU_Z_INDEX}
            projectId={projectContextMenu.projectId}
            project={selectedProjectContextMenuProject}
            newSessionEngineOptions={newSessionEngineOptions}
            terminalEngineOptions={terminalEngineOptions}
            isRefreshing={refreshingProjectId === projectContextMenu.projectId}
            onClose={() => setProjectContextMenu(null)}
            onRefresh={onRefreshProjectSessions}
            onCreateEngineSession={onNewAgentSessionInProject}
            onStartRename={handleStartRenamingCurrentProject}
            onArchive={onArchiveProject}
            onCopyWorkingDirectory={onCopyWorkingDirectory}
            onCopyProjectPath={onCopyProjectPath}
            onOpenInTerminal={onOpenInTerminal}
            onOpenInFileExplorer={onOpenInFileExplorer}
            onDelete={onDeleteProject}
          />,
        )}
    </div>
  );
}, areSidebarPropsEqual);

Sidebar.displayName = 'Sidebar';

