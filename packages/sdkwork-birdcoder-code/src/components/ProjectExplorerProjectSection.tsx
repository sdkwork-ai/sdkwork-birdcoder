import React from 'react';
import { Archive, ChevronDown, ChevronRight, Folder, MoreHorizontal, Plus } from 'lucide-react';
import type { ProjectExplorerProjectEntry } from './ProjectExplorer.shared';
import { buildProjectExplorerSurfaceStyle } from './ProjectExplorer.shared';
import { ProjectExplorerSessionRow } from './ProjectExplorerSessionRow';

export interface ProjectExplorerProjectSectionProps {
  entry: ProjectExplorerProjectEntry;
  relativeTimeNow: number;
  expanded: boolean;
  isSelectedProject: boolean;
  selectedVisibleSessionId: string | null;
  renamingVisibleSessionId: string | null;
  sessionRenameValue: string;
  isRenamingProject: boolean;
  projectRenameValue: string;
  noSessionsLabel: string;
  toggleSessionExpansionLabel: string;
  defaultNewSessionEngineId: string;
  defaultNewSessionModelId: string;
  newSessionInProjectLabel: string;
  awaitingApprovalSessionLabel: string;
  awaitingToolSessionLabel: string;
  awaitingUserSessionLabel: string;
  executingSessionLabel: string;
  initializingSessionLabel: string;
  failedSessionLabel: string;
  moreActionsLabel: string;
  onSelectProject: (projectId: string) => void;
  onToggleProject: (projectId: string, event?: React.MouseEvent) => void;
  onProjectContextMenu: (event: React.MouseEvent, projectId: string) => void;
  onOpenProjectContextMenuFromButton: (
    event: React.MouseEvent<HTMLButtonElement>,
    projectId: string,
  ) => void;
  onNewCodingSessionInProject: (projectId: string, engineId?: string, modelId?: string) => void;
  onSelectCodingSession: (codingSessionId: string, projectId?: string | null) => void;
  onCodingSessionContextMenu: (
    event: React.MouseEvent,
    codingSessionId: string,
    projectId?: string | null,
  ) => void;
  onProjectRenameValueChange: (value: string) => void;
  onProjectRenameSubmit: (projectId: string, nextValue: string, currentName: string) => void;
  onProjectRenameCancel: () => void;
  onSessionRenameValueChange: (value: string) => void;
  onSessionRenameSubmit: (
    codingSessionId: string,
    projectId: string,
    nextValue: string,
    currentTitle: string,
  ) => void;
  onSessionRenameCancel: () => void;
  onToggleSessionExpansion: (
    projectId: string,
    filteredSessionCount: number,
    canShowMoreSessions: boolean,
  ) => void;
}

export const ProjectExplorerProjectSection = React.memo(function ProjectExplorerProjectSection({
  entry,
  relativeTimeNow,
  expanded,
  isSelectedProject,
  selectedVisibleSessionId,
  renamingVisibleSessionId,
  sessionRenameValue,
  isRenamingProject,
  projectRenameValue,
  noSessionsLabel,
  toggleSessionExpansionLabel,
  defaultNewSessionEngineId,
  defaultNewSessionModelId,
  newSessionInProjectLabel,
  awaitingApprovalSessionLabel,
  awaitingToolSessionLabel,
  awaitingUserSessionLabel,
  executingSessionLabel,
  initializingSessionLabel,
  failedSessionLabel,
  moreActionsLabel,
  onSelectProject,
  onToggleProject,
  onProjectContextMenu,
  onOpenProjectContextMenuFromButton,
  onNewCodingSessionInProject,
  onSelectCodingSession,
  onCodingSessionContextMenu,
  onProjectRenameValueChange,
  onProjectRenameSubmit,
  onProjectRenameCancel,
  onSessionRenameValueChange,
  onSessionRenameSubmit,
  onSessionRenameCancel,
  onToggleSessionExpansion,
}: ProjectExplorerProjectSectionProps) {
  const { project, filteredSessions, visibleSessions } = entry;

  return (
    <div
      className="mb-1"
      style={buildProjectExplorerSurfaceStyle(expanded ? '260px' : '44px')}
    >
      <div
        className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
          isSelectedProject ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10'
        }`}
        onClick={() => onSelectProject(project.id)}
        onContextMenu={(event) => onProjectContextMenu(event, project.id)}
      >
        <div
          className={`transition-colors p-0.5 rounded-sm hover:bg-white/20 ${
            isSelectedProject ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'
          }`}
          onClick={(event) => onToggleProject(project.id, event)}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <Folder
          size={14}
          className={`transition-colors ${
            isSelectedProject ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-300'
          }`}
        />
        {project.archived && <Archive size={14} className="text-gray-500 shrink-0" />}
        {isRenamingProject ? (
          <input
            type="text"
            autoFocus
            value={projectRenameValue}
            onChange={(event) => onProjectRenameValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onProjectRenameSubmit(project.id, projectRenameValue, project.name);
              } else if (event.key === 'Escape') {
                onProjectRenameCancel();
              }
            }}
            onBlur={onProjectRenameCancel}
            className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
        )}
        {!isRenamingProject && (
          <div className="absolute right-2 pointer-events-none flex items-center gap-1 rounded-md bg-[#18181b]/80 px-1 opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              className="rounded-md p-1 text-gray-500 transition-all hover:bg-white/10 hover:text-white"
              title={newSessionInProjectLabel}
              onClick={(event) => {
                event.stopPropagation();
                onNewCodingSessionInProject(
                  project.id,
                  defaultNewSessionEngineId,
                  defaultNewSessionModelId,
                );
              }}
            >
              <Plus size={12} />
            </button>
            <button
              type="button"
              className="rounded-md p-1 text-gray-500 transition-all hover:bg-white/10 hover:text-white"
              title={moreActionsLabel}
              onClick={(event) => onOpenProjectContextMenuFromButton(event, project.id)}
            >
              <MoreHorizontal size={12} />
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col mt-0.5">
          {filteredSessions.length > 0 ? (
            <>
              {visibleSessions.map((session) => (
                <ProjectExplorerSessionRow
                  key={session.id}
                  relativeTimeNow={relativeTimeNow}
                  session={session}
                  sessionProjectId={project.id}
                  isSelected={selectedVisibleSessionId === session.id}
                  isRenaming={renamingVisibleSessionId === session.id}
                  renameValue={renamingVisibleSessionId === session.id ? sessionRenameValue : ''}
                  paddingClassName="pl-8 pr-2"
                  awaitingApprovalSessionLabel={awaitingApprovalSessionLabel}
                  awaitingToolSessionLabel={awaitingToolSessionLabel}
                  awaitingUserSessionLabel={awaitingUserSessionLabel}
                  executingSessionLabel={executingSessionLabel}
                  initializingSessionLabel={initializingSessionLabel}
                  failedSessionLabel={failedSessionLabel}
                  moreActionsLabel={moreActionsLabel}
                  onSelectCodingSession={onSelectCodingSession}
                  onCodingSessionContextMenu={onCodingSessionContextMenu}
                  onRenameValueChange={onSessionRenameValueChange}
                  onRenameSubmit={onSessionRenameSubmit}
                  onRenameCancel={onSessionRenameCancel}
                />
              ))}
              {entry.canToggleSessionExpansion && (
                <button
                  type="button"
                  className="ml-8 mt-1 inline-flex items-center justify-start rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200"
                  onClick={() =>
                    onToggleSessionExpansion(
                      project.id,
                      filteredSessions.length,
                      entry.canShowMoreSessions,
                    )
                  }
                >
                  {toggleSessionExpansionLabel}
                </button>
              )}
            </>
          ) : (
            <div
              className="pl-8 py-1 text-gray-500 text-xs italic"
              style={buildProjectExplorerSurfaceStyle('28px')}
            >
              {noSessionsLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ProjectExplorerProjectSection.displayName = 'ProjectExplorerProjectSection';
