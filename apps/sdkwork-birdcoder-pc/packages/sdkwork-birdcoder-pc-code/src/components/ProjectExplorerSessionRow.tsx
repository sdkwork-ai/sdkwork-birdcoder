import React from 'react';
import { Archive, MoreHorizontal, Pin } from 'lucide-react';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { formatAgentSessionActivityDisplayTime } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  SessionProviderBadge,
  SessionRuntimeStatusSlot,
  resolveSessionRuntimeStatusLabel,
  resolveSessionRuntimeStatusPresentation,
  type SessionRuntimeStatusLabels,
} from '@sdkwork/birdcoder-pc-ui';
import { buildProjectExplorerSurfaceStyle } from './ProjectExplorer.shared';

export interface ProjectExplorerSessionRowProps {
  relativeTimeNow: number;
  session: AgentSessionView;
  sessionProjectId?: string | null;
  projectName?: string;
  showProjectName?: boolean;
  variant?: 'default' | 'pinned';
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  paddingClassName: string;
  runtimeStatusLabels: SessionRuntimeStatusLabels;
  moreActionsLabel: string;
  onSelectAgentSession: (agentSessionId: string, projectId?: string | null) => void;
  onAgentSessionContextMenu: (
    event: React.MouseEvent,
    agentSessionId: string,
    projectId?: string | null,
  ) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: (
    agentSessionId: string,
    projectId: string,
    nextValue: string,
    currentTitle: string,
  ) => void;
  onRenameCancel: () => void;
}

export const ProjectExplorerSessionRow = React.memo(function ProjectExplorerSessionRow({
  relativeTimeNow,
  session,
  sessionProjectId,
  projectName,
  showProjectName = false,
  variant = 'default',
  isSelected,
  isRenaming,
  renameValue,
  paddingClassName,
  runtimeStatusLabels,
  moreActionsLabel,
  onSelectAgentSession,
  onAgentSessionContextMenu,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: ProjectExplorerSessionRowProps) {
  const isPinnedVariant = variant === 'pinned';
  const resolvedSessionProjectId = sessionProjectId?.trim() || session.projectId;
  const runtimeStatusLabel = resolveSessionRuntimeStatusLabel(
    session.runtimeStatus,
    runtimeStatusLabels,
  );
  const runtimeStatusPresentation = resolveSessionRuntimeStatusPresentation(session.runtimeStatus);
  const sessionDetails = [
    session.title,
    projectName,
    session.engineId,
    session.providerId,
    session.modelId,
    session.hostMode,
    session.runtimeStatus,
  ].filter(Boolean).join(' | ');

  return (
    <div
      className={`${paddingClassName} group birdcoder-session-row relative flex w-full min-w-0 max-w-full items-center justify-between overflow-hidden rounded-md py-1.5 text-[length:var(--birdcoder-ui-font-size,12px)] transition-colors ${isSelected ? 'birdcoder-session-selected' : ''} ${
        isSelected ? 'text-white' : 'text-gray-400'
      }`}
      data-agent-session-id={session.id}
      data-session-row-variant={variant}
      data-session-project-id={resolvedSessionProjectId}
      data-session-selected={isSelected ? 'true' : undefined}
      style={buildProjectExplorerSurfaceStyle('36px')}
      onContextMenu={(event) => onAgentSessionContextMenu(event, session.id, resolvedSessionProjectId)}
    >
      <div className="pointer-events-none relative z-[1] flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {!isPinnedVariant ? (
          <>
            <SessionProviderBadge
              agentId={session.agentId}
              engineId={session.engineId}
              providerId={session.providerId}
            />
            {session.pinned && <Pin size={12} className="text-blue-400 shrink-0" />}
            {session.unread && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
            {session.archived && <Archive size={12} className="shrink-0 text-gray-500" />}
          </>
        ) : null}
        {isRenaming ? (
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(event) => onRenameValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onRenameSubmit(session.id, resolvedSessionProjectId, renameValue, session.title);
              } else if (event.key === 'Escape') {
                onRenameCancel();
              }
            }}
            onBlur={onRenameCancel}
            className="pointer-events-auto min-w-0 flex-1 rounded border-none bg-transparent px-1 text-[length:var(--birdcoder-ui-font-size,12px)] text-white outline-none focus:ring-1 focus:ring-blue-500"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
            <span className="min-w-0 truncate">{session.title}</span>
            {showProjectName && projectName ? (
              <span className="min-w-0 truncate text-[10px] text-gray-500">{projectName}</span>
            ) : null}
          </span>
        )}
      </div>
      {!isRenaming && !isPinnedVariant && (
        <span
          className="ml-auto inline-flex shrink-0 items-center justify-end gap-1 pl-2 text-right transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
          data-session-trailing-metadata="true"
        >
          <span
            className={`text-[10px] ${
              runtimeStatusLabel
                ? runtimeStatusPresentation === 'failed'
                  ? 'text-red-300'
                  : runtimeStatusPresentation === 'attention'
                    ? 'text-amber-300'
                    : runtimeStatusPresentation === 'busy'
                      ? 'text-emerald-300'
                      : 'text-gray-500'
                : isSelected
                  ? 'text-gray-400'
                  : 'opacity-50'
            }`}
          >
            {runtimeStatusLabel ?? formatAgentSessionActivityDisplayTime(session, relativeTimeNow)}
          </span>
          <SessionRuntimeStatusSlot
            label={runtimeStatusLabel}
            runtimeStatus={session.runtimeStatus}
          />
        </span>
      )}
      {!isRenaming ? (
        <button
          type="button"
          aria-label={sessionDetails}
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          title={sessionDetails}
          onClick={() => onSelectAgentSession(session.id, resolvedSessionProjectId)}
        />
      ) : null}
      {!isRenaming && (
        <button
          type="button"
          className="birdcoder-session-action pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-500 opacity-0 transition-colors hover:bg-white/10 hover:text-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          title={moreActionsLabel}
          onClick={(event) => onAgentSessionContextMenu(event, session.id, resolvedSessionProjectId)}
        >
          <MoreHorizontal size={12} />
        </button>
      )}
    </div>
  );
});

ProjectExplorerSessionRow.displayName = 'ProjectExplorerSessionRow';

