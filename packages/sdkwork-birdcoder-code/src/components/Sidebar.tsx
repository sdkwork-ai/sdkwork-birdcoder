import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-types';
import {
  compareBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import {
  listWorkbenchCliEngines,
  resolveWorkbenchCodeEngineSelectedModelId,
  resolveWorkbenchNewSessionEngineCatalog,
} from '@sdkwork/birdcoder-codeengine';
import {
  deduplicateBirdCoderCodingSessionsForRender,
  deduplicateBirdCoderProjectsForRender,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import { useFixedSizeWindowedRange, useRelativeMinuteNow } from '@sdkwork/birdcoder-ui-shell';
import { useTranslation } from 'react-i18next';
import { ProjectExplorerHeader } from './ProjectExplorerHeader';
import { ProjectExplorerProjectContextMenu } from './ProjectExplorerProjectContextMenu';
import { ProjectExplorerProjectSection } from './ProjectExplorerProjectSection';
import { ProjectExplorerRootContextMenu } from './ProjectExplorerRootContextMenu';
import { ProjectExplorerSessionContextMenu } from './ProjectExplorerSessionContextMenu';
import type {
  ProjectExplorerEngineOption,
  ProjectExplorerOrganizeBy,
  ProjectExplorerProjectEntry,
  ProjectExplorerSortBy,
} from './ProjectExplorer.shared';
import type { ProjectExplorerProps } from './ProjectExplorer.types';
import { ProjectExplorerSessionRow } from './ProjectExplorerSessionRow';

const SIDEBAR_CONTEXT_MENU_Z_INDEX = 2147483647;
const SIDEBAR_CONTEXT_MENU_MARGIN = 10;
const INITIAL_VISIBLE_SESSIONS_PER_PROJECT = 5;
const SESSION_EXPANSION_BATCH_SIZE = 10;
const CHRONOLOGICAL_SESSION_ROW_HEIGHT = 36;
const CHRONOLOGICAL_WINDOWED_LIST_THRESHOLD = 60;
const EMPTY_SIDEBAR_CODING_SESSIONS: BirdCoderCodingSession[] = [];

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

function buildSidebarSessionRenderKey(session: BirdCoderCodingSession): string {
  return `${session.projectId}\u0001${session.id}`;
}

function buildSidebarSessionScopedKey(projectId: string, sessionId: string): string {
  return `${projectId}\u0001${sessionId}`;
}

function resolveSidebarSessionProjectId(
  session: BirdCoderCodingSession,
  containingProjectId: string,
): string {
  return containingProjectId.trim() || session.projectId;
}

interface SidebarCodingSessionLookup {
  byProjectIdAndId: Map<string, BirdCoderCodingSession>;
  uniqueById: Map<string, BirdCoderCodingSession>;
}

function buildSidebarCodingSessionLookup(
  projects: readonly BirdCoderProject[],
): SidebarCodingSessionLookup {
  const byProjectIdAndId = new Map<string, BirdCoderCodingSession>();
  const uniqueById = new Map<string, BirdCoderCodingSession>();
  const ambiguousSessionIds = new Set<string>();
  for (const project of projects) {
    for (const codingSession of project.codingSessions) {
      const scopedProjectId = resolveSidebarSessionProjectId(codingSession, project.id);
      const scopedCodingSession =
        scopedProjectId === codingSession.projectId
          ? codingSession
          : {
              ...codingSession,
              projectId: scopedProjectId,
            };
      byProjectIdAndId.set(
        buildSidebarSessionScopedKey(scopedProjectId, codingSession.id),
        scopedCodingSession,
      );
      if (uniqueById.has(codingSession.id)) {
        ambiguousSessionIds.add(codingSession.id);
        uniqueById.delete(codingSession.id);
      } else if (!ambiguousSessionIds.has(codingSession.id)) {
        uniqueById.set(codingSession.id, scopedCodingSession);
      }
    }
  }
  return {
    byProjectIdAndId,
    uniqueById,
  };
}

function collectSidebarChronologicalSessions(
  projects: readonly BirdCoderProject[],
  showArchived: boolean,
  normalizedSearchQuery: string,
): BirdCoderCodingSession[] {
  const sessions: BirdCoderCodingSession[] = [];
  for (const project of projects) {
    for (const codingSession of project.codingSessions) {
      const scopedProjectId = resolveSidebarSessionProjectId(codingSession, project.id);
      const scopedCodingSession =
        scopedProjectId === codingSession.projectId
          ? codingSession
          : {
              ...codingSession,
              projectId: scopedProjectId,
            };
      if (!showArchived && codingSession.archived) {
        continue;
      }
      if (
        normalizedSearchQuery &&
        !codingSession.title.toLowerCase().includes(normalizedSearchQuery)
      ) {
        continue;
      }
      sessions.push(scopedCodingSession);
    }
  }
  return deduplicateBirdCoderCodingSessionsForRender(sessions);
}

function filterSidebarProjectSessions(
  codingSessions: readonly BirdCoderCodingSession[],
  showArchived: boolean,
  normalizedSearchQuery: string,
): BirdCoderCodingSession[] {
  if (showArchived && !normalizedSearchQuery) {
    return codingSessions as BirdCoderCodingSession[];
  }

  const filteredSessions: BirdCoderCodingSession[] = [];
  for (const codingSession of codingSessions) {
    if (!showArchived && codingSession.archived) {
      continue;
    }
    if (
      normalizedSearchQuery &&
      !codingSession.title.toLowerCase().includes(normalizedSearchQuery)
    ) {
      continue;
    }
    filteredSessions.push(codingSession);
  }

  return filteredSessions;
}

function sortSidebarSessionsByCreated(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  return [...codingSessions].sort(
    (left, right) =>
      Math.max(0, Date.parse(right.createdAt)) -
        Math.max(0, Date.parse(left.createdAt)) ||
      left.id.localeCompare(right.id),
  );
}

function sortSidebarSessionsByUpdated(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  return [...codingSessions].sort((left, right) =>
    compareBirdCoderSessionSortTimestamp(right, left) ||
    left.id.localeCompare(right.id),
  );
}

function resolveSidebarProjectViewSessions(
  codingSessions: readonly BirdCoderCodingSession[],
  sortBy: ProjectExplorerSortBy,
): BirdCoderCodingSession[] {
  if (sortBy === 'updated') {
    return codingSessions as BirdCoderCodingSession[];
  }

  return sortSidebarSessionsByCreated(codingSessions);
}

function areSidebarProjectInventoriesEqual(
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

function areSidebarPropsEqual(left: ProjectExplorerProps, right: ProjectExplorerProps): boolean {
  return (
    areSidebarProjectInventoriesEqual(left.projects, right.projects) &&
    left.isVisible === right.isVisible &&
    left.selectedProjectId === right.selectedProjectId &&
    left.selectedCodingSessionId === right.selectedCodingSessionId &&
    left.onSelectProject === right.onSelectProject &&
    left.onSelectCodingSession === right.onSelectCodingSession &&
    left.onRenameCodingSession === right.onRenameCodingSession &&
    left.onDeleteCodingSession === right.onDeleteCodingSession &&
    left.onRenameProject === right.onRenameProject &&
    left.onDeleteProject === right.onDeleteProject &&
    left.onNewProject === right.onNewProject &&
    left.onOpenFolder === right.onOpenFolder &&
    left.onNewCodingSessionInProject === right.onNewCodingSessionInProject &&
    left.onRefreshProjectSessions === right.onRefreshProjectSessions &&
    left.onRefreshCodingSessionMessages === right.onRefreshCodingSessionMessages &&
    left.onArchiveProject === right.onArchiveProject &&
    left.onCopyWorkingDirectory === right.onCopyWorkingDirectory &&
    left.onCopyProjectPath === right.onCopyProjectPath &&
    left.onOpenInTerminal === right.onOpenInTerminal &&
    left.onOpenInFileExplorer === right.onOpenInFileExplorer &&
    left.onPinCodingSession === right.onPinCodingSession &&
    left.onArchiveCodingSession === right.onArchiveCodingSession &&
    left.onMarkCodingSessionUnread === right.onMarkCodingSessionUnread &&
    left.onOpenCodingSessionInTerminal === right.onOpenCodingSessionInTerminal &&
    left.onCopyCodingSessionWorkingDirectory === right.onCopyCodingSessionWorkingDirectory &&
    left.onCopyCodingSessionSessionId === right.onCopyCodingSessionSessionId &&
    left.onCopyCodingSessionResumeCommand === right.onCopyCodingSessionResumeCommand &&
    left.onCopyCodingSessionDeeplink === right.onCopyCodingSessionDeeplink &&
    left.onForkCodingSessionLocal === right.onForkCodingSessionLocal &&
    left.onForkCodingSessionNewTree === right.onForkCodingSessionNewTree &&
    left.refreshingProjectId === right.refreshingProjectId &&
    left.refreshingCodingSessionId === right.refreshingCodingSessionId &&
    left.searchQuery === right.searchQuery &&
    left.setSearchQuery === right.setSearchQuery &&
    left.width === right.width
  );
}

type SidebarProjectEntry = ProjectExplorerProjectEntry;

type SidebarFilteredProjectSessionsEntry = {
  filteredSessions: BirdCoderCodingSession[];
  project: BirdCoderProject;
};

const EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS: SidebarFilteredProjectSessionsEntry[] = [];
const EMPTY_SIDEBAR_PROJECT_ENTRIES: SidebarProjectEntry[] = [];

export const Sidebar = React.memo(function Sidebar({
  isVisible = true,
  projects,
  selectedProjectId,
  selectedCodingSessionId,
  onSelectProject,
  onSelectCodingSession,
  onRenameCodingSession,
  onDeleteCodingSession,
  onRenameProject,
  onDeleteProject,
  onNewProject,
  onOpenFolder,
  onNewCodingSessionInProject,
  onRefreshProjectSessions,
  onRefreshCodingSessionMessages,
  onArchiveProject,
  onCopyWorkingDirectory,
  onCopyProjectPath,
  onOpenInTerminal,
  onOpenInFileExplorer,
  onPinCodingSession,
  onArchiveCodingSession,
  onMarkCodingSessionUnread,
  onOpenCodingSessionInTerminal,
  onCopyCodingSessionWorkingDirectory,
  onCopyCodingSessionSessionId,
  onCopyCodingSessionResumeCommand,
  onCopyCodingSessionDeeplink,
  onForkCodingSessionLocal,
  onForkCodingSessionNewTree,
  refreshingProjectId,
  refreshingCodingSessionId,
  searchQuery = '',
  setSearchQuery,
  width = 256
}: ProjectExplorerProps) {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [visibleSessionCountByProjectId, setVisibleSessionCountByProjectId] = useState<
    Record<string, number>
  >({});
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [organizeBy, setOrganizeBy] = useState<ProjectExplorerOrganizeBy>('project');
  const [sortBy, setSortBy] = useState<ProjectExplorerSortBy>('updated');
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const { preferences } = useWorkbenchPreferences();
  const { t } = useTranslation();
  const refreshSessionsLabel = t('code.refreshSessions');
  const refreshingSessionsLabel = t('code.refreshingSessions');

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    codingSessionId: string;
    projectId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [projectContextMenu, setProjectContextMenu] = useState<{ x: number, y: number, projectId: string } | null>(null);
  const projectContextMenuRef = useRef<HTMLDivElement>(null);

  const [rootContextMenu, setRootContextMenu] = useState<{ x: number, y: number } | null>(null);
  const rootContextMenuRef = useRef<HTMLDivElement>(null);

  const [renamingCodingSession, setRenamingCodingSession] = useState<{
    id: string;
    projectId: string;
  } | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const relativeTimeNow = useRelativeMinuteNow({ isEnabled: isVisible });
  const renderProjects = useMemo(
    () => deduplicateBirdCoderProjectsForRender(projects),
    [projects],
  );

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

  // Expand projects by default when they are loaded
  useEffect(() => {
    if (!deferredSearchQuery) {
      setExpandedProjects(prev => {
        const newExpanded = { ...prev };
        let changed = false;
        renderProjects.forEach(p => {
          if (newExpanded[p.id] === undefined) {
            newExpanded[p.id] = true;
            changed = true;
          }
        });
        return changed ? newExpanded : prev;
      });
    }
  }, [deferredSearchQuery, renderProjects]);

  // When the search query changes, expand all projects that have matching sessions.
  useEffect(() => {
    if (deferredSearchQuery) {
      setExpandedProjects((previousExpandedProjects) => {
        let changed = false;
        const nextExpandedProjects = { ...previousExpandedProjects };
        renderProjects.forEach((project) => {
          if (project.codingSessions.length > 0 && nextExpandedProjects[project.id] !== true) {
            nextExpandedProjects[project.id] = true;
            changed = true;
          }
        });
        return changed ? nextExpandedProjects : previousExpandedProjects;
      });
    }
  }, [deferredSearchQuery, renderProjects]);

  useEffect(() => {
    setVisibleSessionCountByProjectId((previousState) => {
      let changed = false;
      const nextState: Record<string, number> = {};

      for (const project of renderProjects) {
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
  }, [renderProjects]);

  const toggleProject = useCallback((projectId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setExpandedProjects((previousExpandedProjects) => ({
      ...previousExpandedProjects,
      [projectId]: !previousExpandedProjects[projectId],
    }));
  }, []);

  const selectProject = useCallback((projectId: string) => {
    onSelectProject?.(projectId);
    setExpandedProjects((previousExpandedProjects) =>
      previousExpandedProjects[projectId] === true
        ? previousExpandedProjects
        : { ...previousExpandedProjects, [projectId]: true },
    );
  }, [onSelectProject]);

  const handleSelectCodingSession = useCallback((
    codingSessionId: string,
    projectId?: string | null,
  ) => {
    onSelectCodingSession(codingSessionId, projectId);
  }, [onSelectCodingSession]);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    codingSessionId: string,
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
    setContextMenu({ ...position, codingSessionId, projectId: normalizedProjectId });
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
  const codingSessionLookup = useMemo(
    () => buildSidebarCodingSessionLookup(renderProjects),
    [renderProjects],
  );
  const projectLookup = useMemo(
    () =>
      new Map(
        renderProjects.map(
          (project) => [project.id, project] satisfies [string, BirdCoderProject],
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
      return codingSessionLookup.byProjectIdAndId.get(
        buildSidebarSessionScopedKey(contextMenu.projectId, contextMenu.codingSessionId),
      ) ?? scopedProject?.codingSessions.find(
          (codingSession) => codingSession.id === contextMenu.codingSessionId,
        );
    },
    [codingSessionLookup, contextMenu, projectLookup],
  );
  const selectedProjectContextMenuProject = useMemo(
    () =>
      projectContextMenu ? projectLookup.get(projectContextMenu.projectId) : undefined,
    [projectContextMenu, projectLookup],
  );
  const selectedSidebarCodingSession = useMemo(
    () => {
      if (!selectedCodingSessionId) {
        return null;
      }

      const scopedProject = selectedProjectId
        ? projectLookup.get(selectedProjectId)
        : undefined;
      if (selectedProjectId) {
        return codingSessionLookup.byProjectIdAndId.get(
          buildSidebarSessionScopedKey(selectedProjectId, selectedCodingSessionId),
        ) ?? scopedProject?.codingSessions.find(
            (codingSession) => codingSession.id === selectedCodingSessionId,
          ) ?? null;
      }

      return codingSessionLookup.uniqueById.get(selectedCodingSessionId) ?? null;
    },
    [codingSessionLookup, projectLookup, selectedCodingSessionId, selectedProjectId],
  );
  const newSessionEngineCatalog = useMemo(
    () =>
      resolveWorkbenchNewSessionEngineCatalog(
        {
          currentSessionEngineId: selectedSidebarCodingSession?.engineId,
          currentSessionModelId: selectedSidebarCodingSession?.modelId,
          preferredEngineId: preferences.codeEngineId,
          preferredModelId: preferences.codeModelId,
        },
        preferences,
      ),
    [
      preferences,
      selectedSidebarCodingSession?.engineId,
      selectedSidebarCodingSession?.modelId,
    ],
  );
  const newSessionEngineOptions = useMemo<readonly ProjectExplorerEngineOption[]>(
    () =>
      newSessionEngineCatalog.availableEngines.map((engine) => ({
        id: engine.id,
        label: engine.label,
        modelId: resolveWorkbenchCodeEngineSelectedModelId(engine.id, preferences),
        terminalProfileId: engine.terminalProfileId ?? null,
      })),
    [newSessionEngineCatalog.availableEngines, preferences],
  );
  const terminalEngineOptions = useMemo<readonly ProjectExplorerEngineOption[]>(
    () =>
      listWorkbenchCliEngines().map((engine) => ({
        id: engine.id,
        label: engine.label,
        terminalProfileId: engine.terminalProfileId ?? null,
      })),
    [],
  );
  const handleToggleProjectSessionExpansion = useCallback(
    (projectId: string, filteredSessionCount: number, canShowMoreSessions: boolean) => {
      setVisibleSessionCountByProjectId((previousState) => {
        const currentCount =
          previousState[projectId] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;
        const nextCount = canShowMoreSessions
          ? Math.min(currentCount + SESSION_EXPANSION_BATCH_SIZE, filteredSessionCount)
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
  const handleCodingSessionRenameSubmit = useCallback(
    (
      codingSessionId: string,
      projectId: string,
      nextValue: string,
      currentTitle: string,
    ) => {
      const normalizedValue = nextValue.trim();
      if (normalizedValue && normalizedValue !== currentTitle) {
        onRenameCodingSession(codingSessionId, projectId, normalizedValue);
      }
      setRenamingCodingSession(null);
    },
    [onRenameCodingSession],
  );
  const handleCodingSessionRenameCancel = useCallback(() => {
    setRenamingCodingSession(null);
  }, []);
  const handleCreateEngineSession = useCallback((engineId: string, modelId: string) => {
    if (!selectedProjectId) {
      return;
    }
    onNewCodingSessionInProject(selectedProjectId, engineId, modelId);
  }, [onNewCodingSessionInProject, selectedProjectId]);
  const handleToggleSearch = useCallback(() => {
    setShowSearch((previousState) => {
      const nextState = !previousState;
      if (!nextState && setSearchQuery) {
        setSearchQuery('');
      }
      return nextState;
    });
  }, [setSearchQuery]);
  const handleClearSearch = useCallback(() => {
    setSearchQuery?.('');
  }, [setSearchQuery]);
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
  const handleCreateDefaultSessionFromRootContextMenu = useCallback(() => {
    if (selectedProjectId) {
      onNewCodingSessionInProject(
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
    onNewCodingSessionInProject,
    selectedProjectId,
    t,
  ]);
  const handleStartRenamingCurrentSession = useCallback(
    (codingSessionId: string, projectId: string, title: string) => {
      setRenamingCodingSession({ id: codingSessionId, projectId });
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
    setOrganizeBy('project');
    setShowFilterMenu(false);
    addToast(t('code.organizedByProject'), 'success');
  }, [addToast, t]);
  const handleOrganizeChronologically = useCallback(() => {
    setOrganizeBy('chronological');
    setShowFilterMenu(false);
    addToast(t('code.organizedChronologically'), 'success');
  }, [addToast, t]);
  const handleSortByCreated = useCallback(() => {
    setSortBy('created');
    setShowFilterMenu(false);
    addToast(t('code.sortedByCreatedDate'), 'success');
  }, [addToast, t]);
  const handleSortByUpdated = useCallback(() => {
    setSortBy('updated');
    setShowFilterMenu(false);
    addToast(t('code.sortedByUpdatedDate'), 'success');
  }, [addToast, t]);
  const handleShowAllSessions = useCallback(() => {
    setShowArchived(true);
    setShowFilterMenu(false);
    addToast(t('code.showingAllSessions'), 'success');
  }, [addToast, t]);
  const handleShowRelevantSessions = useCallback(() => {
    setShowArchived(false);
    setShowFilterMenu(false);
    addToast(t('code.showingRelevantSessions'), 'success');
  }, [addToast, t]);
  const resolveProjectViewSessions = useCallback(
    (codingSessions: readonly BirdCoderCodingSession[]) =>
      resolveSidebarProjectViewSessions(codingSessions, sortBy),
    [sortBy],
  );
  const sortChronologicalSessions = useCallback(
    (codingSessions: readonly BirdCoderCodingSession[]) =>
      sortBy === 'created'
        ? sortSidebarSessionsByCreated(codingSessions)
        : sortSidebarSessionsByUpdated(codingSessions),
    [sortBy],
  );
  const filteredProjectSessions = useMemo<SidebarFilteredProjectSessionsEntry[]>(
    () => {
      if (organizeBy !== 'project') {
        return EMPTY_SIDEBAR_FILTERED_PROJECT_SESSIONS;
      }

      return renderProjects
        .filter((project) => showArchived || !project.archived)
        .map((project) => ({
          project,
          filteredSessions: resolveProjectViewSessions(
            filterSidebarProjectSessions(
              project.codingSessions,
              showArchived,
              normalizedSearchQuery,
            ),
          ),
        }))
        .filter(
          (entry) => !normalizedSearchQuery || entry.filteredSessions.length > 0,
        );
    },
    [
      normalizedSearchQuery,
      organizeBy,
      renderProjects,
      resolveProjectViewSessions,
      showArchived,
    ],
  );
  const chronologicalSessions = useMemo(
    () => {
      if (organizeBy !== 'chronological') {
        return EMPTY_SIDEBAR_CODING_SESSIONS;
      }

      return sortChronologicalSessions(
        collectSidebarChronologicalSessions(
          renderProjects,
          showArchived,
          normalizedSearchQuery,
        ),
      );
    },
    [
      normalizedSearchQuery,
      organizeBy,
      renderProjects,
      showArchived,
      sortChronologicalSessions,
    ],
  );
  const projectEntries = useMemo<SidebarProjectEntry[]>(
    () => {
      if (organizeBy !== 'project') {
        return EMPTY_SIDEBAR_PROJECT_ENTRIES;
      }

      return filteredProjectSessions
        .map(({ project, filteredSessions }) => {
          const visibleSessionCount =
            visibleSessionCountByProjectId[project.id] ?? INITIAL_VISIBLE_SESSIONS_PER_PROJECT;

          return {
            canShowMoreSessions: visibleSessionCount < filteredSessions.length,
            canToggleSessionExpansion:
              !normalizedSearchQuery &&
              filteredSessions.length > INITIAL_VISIBLE_SESSIONS_PER_PROJECT,
            filteredSessions,
            nextExpansionCount: Math.min(
              SESSION_EXPANSION_BATCH_SIZE,
              Math.max(0, filteredSessions.length - visibleSessionCount),
            ),
            project,
            visibleSessions: normalizedSearchQuery
              ? filteredSessions
              : filteredSessions.slice(0, visibleSessionCount),
          };
        });
    },
    [
      filteredProjectSessions,
      normalizedSearchQuery,
      organizeBy,
      visibleSessionCountByProjectId,
    ],
  );
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
  return (
    <div 
      className="flex flex-col border-r border-white/5 bg-[#0e0e11]/95 backdrop-blur-xl text-sm relative shrink-0" 
      style={{ width }}
      onContextMenu={handleRootContextMenu}
    >
      <ProjectExplorerHeader
        selectedProjectId={selectedProjectId}
        showFilterMenu={showFilterMenu}
        showSearch={showSearch}
        searchQuery={searchQuery}
        organizeBy={organizeBy}
        sortBy={sortBy}
        showArchived={showArchived}
        isRefreshingSelectedProject={refreshingProjectId === selectedProjectId}
        refreshSessionsLabel={refreshSessionsLabel}
        refreshingSessionsLabel={refreshingSessionsLabel}
        newSessionLabel={t('app.menu.newSession')}
        newSessionInCurrentProjectLabel={t('app.newSessionInCurrentProject')}
        selectProjectFirstLabel={t('code.selectProjectFirst')}
        currentSessionEngineId={selectedSidebarCodingSession?.engineId ?? null}
        currentSessionModelId={selectedSidebarCodingSession?.modelId ?? null}
        selectedEngineId={preferences.codeEngineId}
        selectedModelId={preferences.codeModelId}
        sessionsLabel={t('app.sessions')}
        searchSessionsTitleLabel={t('app.searchSessionsTitle')}
        searchSessionsPlaceholder={t('app.searchSessions')}
        newProjectLabel={t('app.newProject')}
        openFolderLabel={t('app.menu.openFolder').replace('...', '')}
        organizeLabel={t('app.organize')}
        byProjectLabel={t('app.byProject')}
        chronologicalLabel={t('app.chronological')}
        sortByLabel={t('app.sortBy')}
        createdLabel={t('app.created')}
        updatedLabel={t('app.updated')}
        showLabel={t('app.show')}
        allSessionsLabel={t('app.allSessions')}
        relevantLabel={t('app.relevant')}
        filterMenuRef={filterMenuRef}
        scrollRegionRef={scrollRegionRef}
        onCreateSession={handleCreateEngineSession}
        onRefreshSelectedProject={onRefreshProjectSessions ? handleRefreshSelectedProject : undefined}
        onToggleSearch={handleToggleSearch}
        onSearchQueryChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        onCreateProject={handleCreateProjectFromHeader}
        onOpenFolder={onOpenFolder}
        onToggleFilterMenu={() => setShowFilterMenu((previousState) => !previousState)}
        onOrganizeByProject={handleOrganizeByProject}
        onOrganizeChronologically={handleOrganizeChronologically}
        onSortByCreated={handleSortByCreated}
        onSortByUpdated={handleSortByUpdated}
        onShowAllSessions={handleShowAllSessions}
        onShowRelevantSessions={handleShowRelevantSessions}
      >
        <div className="flex flex-col gap-1">
          {organizeBy === 'project' ? (
            projectEntries.map((entry) => {
              const selectedVisibleSessionId = entry.visibleSessions.some(
                (session) =>
                  entry.project.id === selectedProjectId &&
                  session.id === selectedCodingSessionId,
              )
                ? selectedCodingSessionId
                : null;
              const renamingVisibleSessionId = entry.visibleSessions.some(
                (session) =>
                  entry.project.id === renamingCodingSession?.projectId &&
                  session.id === renamingCodingSession.id,
              )
                ? renamingCodingSession.id
                : null;

              return (
                <ProjectExplorerProjectSection
                  key={entry.project.id}
                  entry={entry}
                  relativeTimeNow={relativeTimeNow}
                  expanded={expandedProjects[entry.project.id] === true}
                  isSelectedProject={selectedProjectId === entry.project.id}
                  selectedVisibleSessionId={selectedVisibleSessionId}
                  renamingVisibleSessionId={renamingVisibleSessionId}
                  sessionRenameValue={renamingVisibleSessionId ? renameValue : ''}
                  isRenamingProject={renamingProjectId === entry.project.id}
                  projectRenameValue={renamingProjectId === entry.project.id ? renameValue : ''}
                  noSessionsLabel={t('app.noSessions')}
                  toggleSessionExpansionLabel={
                    entry.canShowMoreSessions
                      ? t('code.showMoreSessions', { count: entry.nextExpansionCount })
                      : t('code.collapseSessions')
                  }
                  defaultNewSessionEngineId={newSessionEngineCatalog.preferredSelection.engineId}
                  defaultNewSessionModelId={newSessionEngineCatalog.preferredSelection.modelId}
                  newSessionInProjectLabel={t('code.newSessionInProject')}
                  awaitingApprovalSessionLabel={t('code.awaitingApprovalSession')}
                  awaitingToolSessionLabel={t('code.awaitingToolSession')}
                  awaitingUserSessionLabel={t('code.awaitingUserSession')}
                  executingSessionLabel={t('code.executingSession')}
                  initializingSessionLabel={t('code.initializingSession')}
                  failedSessionLabel={t('code.failedSession')}
                  moreActionsLabel={t('app.moreActions')}
                  onSelectProject={selectProject}
                  onToggleProject={toggleProject}
                  onProjectContextMenu={handleProjectContextMenu}
                  onOpenProjectContextMenuFromButton={openProjectContextMenuFromButton}
                  onNewCodingSessionInProject={onNewCodingSessionInProject}
                  onSelectCodingSession={handleSelectCodingSession}
                  onCodingSessionContextMenu={handleContextMenu}
                  onProjectRenameValueChange={handleRenameValueChange}
                  onProjectRenameSubmit={handleProjectRenameSubmit}
                  onProjectRenameCancel={handleProjectRenameCancel}
                  onSessionRenameValueChange={handleRenameValueChange}
                  onSessionRenameSubmit={handleCodingSessionRenameSubmit}
                  onSessionRenameCancel={handleCodingSessionRenameCancel}
                  onToggleSessionExpansion={handleToggleProjectSessionExpansion}
                />
              );
            })
          ) : (
            <>
              {shouldWindowChronologicalSessions ? (
                <div style={{ height: chronologicalWindowedRange.paddingTop }} />
              ) : null}
              {visibleChronologicalSessions.map((session) => {
                return (
                  <ProjectExplorerSessionRow
                    key={buildSidebarSessionRenderKey(session)}
                    relativeTimeNow={relativeTimeNow}
                    session={session}
                    sessionProjectId={session.projectId}
                    isSelected={
                      selectedProjectId
                        ? selectedCodingSessionId === session.id &&
                          selectedProjectId === session.projectId
                        : selectedSidebarCodingSession?.id === session.id &&
                          selectedSidebarCodingSession.projectId === session.projectId
                    }
                    isRenaming={
                      renamingCodingSession?.projectId === session.projectId &&
                      renamingCodingSession.id === session.id
                    }
                    renameValue={
                      renamingCodingSession?.projectId === session.projectId &&
                      renamingCodingSession.id === session.id
                        ? renameValue
                        : ''
                    }
                    paddingClassName="px-2"
                    awaitingApprovalSessionLabel={t('code.awaitingApprovalSession')}
                    awaitingToolSessionLabel={t('code.awaitingToolSession')}
                    awaitingUserSessionLabel={t('code.awaitingUserSession')}
                    executingSessionLabel={t('code.executingSession')}
                    initializingSessionLabel={t('code.initializingSession')}
                    failedSessionLabel={t('code.failedSession')}
                    moreActionsLabel={t('app.moreActions')}
                    onSelectCodingSession={handleSelectCodingSession}
                    onCodingSessionContextMenu={handleContextMenu}
                    onRenameValueChange={handleRenameValueChange}
                    onRenameSubmit={handleCodingSessionRenameSubmit}
                    onRenameCancel={handleCodingSessionRenameCancel}
                  />
                );
              })}
              {shouldWindowChronologicalSessions ? (
                <div style={{ height: chronologicalWindowedRange.paddingBottom }} />
              ) : null}
            </>
          )}
          
        </div>
      </ProjectExplorerHeader>

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
            sessionId={contextMenu.codingSessionId}
            projectId={contextMenu.projectId}
            session={selectedContextMenuSession}
            isRefreshing={refreshingCodingSessionId === contextMenu.codingSessionId}
            onClose={() => setContextMenu(null)}
            onRefresh={onRefreshCodingSessionMessages}
            onPin={onPinCodingSession}
            onStartRename={handleStartRenamingCurrentSession}
            onArchive={onArchiveCodingSession}
            onMarkUnread={onMarkCodingSessionUnread}
            onCopyWorkingDirectory={onCopyCodingSessionWorkingDirectory}
            onOpenInTerminal={onOpenCodingSessionInTerminal}
            onCopySessionId={onCopyCodingSessionSessionId}
            onCopyResumeCommand={onCopyCodingSessionResumeCommand}
            onCopyDeeplink={onCopyCodingSessionDeeplink}
            onForkLocal={onForkCodingSessionLocal}
            onForkNewTree={onForkCodingSessionNewTree}
            onDelete={onDeleteCodingSession}
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
            onCreateEngineSession={onNewCodingSessionInProject}
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
