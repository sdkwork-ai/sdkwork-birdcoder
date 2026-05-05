import React from 'react';
import { Archive, Loader2, MoreHorizontal, Pin } from 'lucide-react';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import {
  formatBirdCoderSessionActivityDisplayTime,
  isBirdCoderCodingSessionEngineBusy,
} from '@sdkwork/birdcoder-types';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { buildProjectExplorerSurfaceStyle } from './ProjectExplorer.shared';

export interface ProjectExplorerSessionRowProps {
  relativeTimeNow: number;
  session: BirdCoderCodingSession;
  sessionProjectId?: string | null;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  paddingClassName: string;
  awaitingApprovalSessionLabel: string;
  awaitingToolSessionLabel: string;
  awaitingUserSessionLabel: string;
  executingSessionLabel: string;
  initializingSessionLabel: string;
  failedSessionLabel: string;
  moreActionsLabel: string;
  onSelectCodingSession: (codingSessionId: string, projectId?: string | null) => void;
  onCodingSessionContextMenu: (
    event: React.MouseEvent,
    codingSessionId: string,
    projectId?: string | null,
  ) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: (
    codingSessionId: string,
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
  isSelected,
  isRenaming,
  renameValue,
  paddingClassName,
  awaitingApprovalSessionLabel,
  awaitingToolSessionLabel,
  awaitingUserSessionLabel,
  executingSessionLabel,
  initializingSessionLabel,
  failedSessionLabel,
  moreActionsLabel,
  onSelectCodingSession,
  onCodingSessionContextMenu,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: ProjectExplorerSessionRowProps) {
  const resolvedSessionProjectId = sessionProjectId?.trim() || session.projectId;
  const isEngineBusySession = isBirdCoderCodingSessionEngineBusy(session);
  const runtimeStatusLabel =
    session.runtimeStatus === 'initializing'
      ? initializingSessionLabel
      : session.runtimeStatus === 'awaiting_approval'
        ? awaitingApprovalSessionLabel
        : session.runtimeStatus === 'awaiting_user'
          ? awaitingUserSessionLabel
          : session.runtimeStatus === 'awaiting_tool'
            ? awaitingToolSessionLabel
            : session.runtimeStatus === 'streaming'
              ? executingSessionLabel
              : session.runtimeStatus === 'failed'
                ? failedSessionLabel
                : null;

  return (
    <div
      className={`${paddingClassName} py-1.5 relative group flex w-full min-w-0 max-w-full items-center justify-between overflow-hidden cursor-pointer rounded-md transition-colors ${
        isSelected ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
      }`}
      style={buildProjectExplorerSurfaceStyle('36px')}
      onClick={() => onSelectCodingSession(session.id, resolvedSessionProjectId)}
      onContextMenu={(event) => onCodingSessionContextMenu(event, session.id, resolvedSessionProjectId)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <WorkbenchCodeEngineIcon engineId={session.engineId} />
        {isEngineBusySession && <Loader2 size={12} className="text-emerald-400 shrink-0 animate-spin" />}
        {session.pinned && <Pin size={12} className="text-blue-400 shrink-0" />}
        {session.unread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
        {session.archived && <Archive size={12} className="text-gray-500 shrink-0" />}
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
            className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{session.title}</span>
        )}
      </div>
      {!isRenaming && (
        <span
          className={`text-[10px] shrink-0 ml-2 ${
            runtimeStatusLabel
              ? session.runtimeStatus === 'failed'
                ? 'text-red-300'
                : session.runtimeStatus === 'awaiting_approval' ||
                    session.runtimeStatus === 'awaiting_user'
                  ? 'text-amber-300'
                : 'text-emerald-300'
              : isSelected
                ? 'text-gray-400'
                : 'opacity-50'
          }`}
        >
          {runtimeStatusLabel ?? formatBirdCoderSessionActivityDisplayTime(session, relativeTimeNow)}
        </span>
      )}
      {!isRenaming && (
        <button
          type="button"
          className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md bg-[#18181b]/95 p-1 text-gray-500 opacity-0 shadow-lg ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          title={moreActionsLabel}
          onClick={(event) => onCodingSessionContextMenu(event, session.id, resolvedSessionProjectId)}
        >
          <MoreHorizontal size={12} />
        </button>
      )}
    </div>
  );
});

ProjectExplorerSessionRow.displayName = 'ProjectExplorerSessionRow';
