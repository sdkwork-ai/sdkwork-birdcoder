import React from 'react';
import {
  Archive,
  Folder,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
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
  expandProjectLabel: string;
  collapseProjectLabel: string;
  loadMoreSessionsLabel: string;
  loadingMoreSessionsLabel: string;
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
  onNewAgentSessionInProject: (projectId: string, engineId?: string, modelId?: string) => void;
  onSelectAgentSession: (agentSessionId: string, projectId?: string | null) => void;
  onAgentSessionContextMenu: (
    event: React.MouseEvent,
    agentSessionId: string,
    projectId?: string | null,
  ) => void;
  onProjectRenameValueChange: (value: string) => void;
  onProjectRenameSubmit: (projectId: string, nextValue: string, currentName: string) => void;
  onProjectRenameCancel: () => void;
  onSessionRenameValueChange: (value: string) => void;
  onSessionRenameSubmit: (
    agentSessionId: string,
    projectId: string,
    nextValue: string,
    currentTitle: string,
  ) => void;
  onSessionRenameCancel: () => void;
  onLoadMoreProjectSessions: (
    projectId: string,
    requestedCount: number,
  ) => Promise<void> | void;
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
  expandProjectLabel,
  collapseProjectLabel,
  loadMoreSessionsLabel,
  loadingMoreSessionsLabel,
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
  onNewAgentSessionInProject,
  onSelectAgentSession,
  onAgentSessionContextMenu,
  onProjectRenameValueChange,
  onProjectRenameSubmit,
  onProjectRenameCancel,
  onSessionRenameValueChange,
  onSessionRenameSubmit,
  onSessionRenameCancel,
  onLoadMoreProjectSessions,
}: ProjectExplorerProjectSectionProps) {
  const { project, filteredSessions, visibleSessions } = entry;
  const sessionsRegionId = React.useId();

  const handleProjectRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onSelectProject(project.id);
    onToggleProject(project.id, event);
  };

  return (
    <div
      className="mb-1"
      style={buildProjectExplorerSurfaceStyle(expanded ? '260px' : '44px')}
    >
      <div
        className={`birdcoder-session-row ${isSelectedProject ? 'birdcoder-session-selected' : ''} relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
          isSelectedProject ? 'text-white' : 'text-gray-300'
        }`}
        onClick={handleProjectRowClick}
        onContextMenu={(event) => onProjectContextMenu(event, project.id)}
      >
        <button
          type="button"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:bg-white/10 focus-visible:outline-none ${
            isSelectedProject
              ? 'text-gray-100 hover:bg-white/10'
              : 'text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 group-hover:text-gray-300'
          }`}
          onClick={(event) => onToggleProject(project.id, event)}
          aria-expanded={expanded}
          aria-controls={sessionsRegionId}
          aria-label={expanded ? collapseProjectLabel : expandProjectLabel}
          title={expanded ? collapseProjectLabel : expandProjectLabel}
        >
          {expanded ? <FolderOpen size={15} aria-hidden="true" /> : <Folder size={15} aria-hidden="true" />}
        </button>
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
          <div className="birdcoder-session-action absolute right-2 pointer-events-none flex items-center gap-1 rounded-md px-1 opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
            <button
              type="button"
              className="rounded-md p-1 text-gray-500 transition-all hover:bg-white/10 hover:text-white"
              title={newSessionInProjectLabel}
              onClick={(event) => {
                event.stopPropagation();
                onNewAgentSessionInProject(
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

      <div
        id={sessionsRegionId}
        className="grid min-h-0 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          opacity: expanded ? 1 : 0,
        }}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col mt-0.5">
          {filteredSessions.length > 0 ? (
            visibleSessions.map((session) => (
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
                onSelectAgentSession={onSelectAgentSession}
                onAgentSessionContextMenu={onAgentSessionContextMenu}
                onRenameValueChange={onSessionRenameValueChange}
                onRenameSubmit={onSessionRenameSubmit}
                onRenameCancel={onSessionRenameCancel}
              />
            ))
          ) : !entry.canShowMoreSessions ? (
            <div
              className="pl-8 py-1 text-gray-500 text-xs italic"
              style={buildProjectExplorerSurfaceStyle('28px')}
            >
              {noSessionsLabel}
            </div>
          ) : null}
          {entry.canShowMoreSessions && (
            <button
              type="button"
              className="ml-8 mt-1 inline-flex items-center justify-start gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
                  disabled={entry.isLoadingMoreSessions === true}
                  aria-busy={entry.isLoadingMoreSessions === true}
              onClick={() =>
                onLoadMoreProjectSessions(project.id, entry.nextVisibleSessionCount)
              }
            >
              {entry.isLoadingMoreSessions ? (
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
              ) : null}
              {entry.isLoadingMoreSessions
                ? loadingMoreSessionsLabel
                : loadMoreSessionsLabel}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
});

ProjectExplorerProjectSection.displayName = 'ProjectExplorerProjectSection';
