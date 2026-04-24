import React from 'react';
import { Archive, Pin, RefreshCw } from 'lucide-react';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import {
  formatBirdCoderSessionActivityDisplayTime,
  isBirdCoderCodingSessionExecuting,
} from '@sdkwork/birdcoder-types';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { buildProjectExplorerSurfaceStyle } from './ProjectExplorer.shared';

export interface ProjectExplorerSessionRowProps {
  relativeTimeNow: number;
  session: BirdCoderCodingSession;
  isSelected: boolean;
  isRenaming: boolean;
  renameValue: string;
  paddingClassName: string;
  onSelectCodingSession: (codingSessionId: string) => void;
  onCodingSessionContextMenu: (event: React.MouseEvent, codingSessionId: string) => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: (codingSessionId: string, nextValue: string, currentTitle: string) => void;
  onRenameCancel: () => void;
}

export const ProjectExplorerSessionRow = React.memo(function ProjectExplorerSessionRow({
  relativeTimeNow,
  session,
  isSelected,
  isRenaming,
  renameValue,
  paddingClassName,
  onSelectCodingSession,
  onCodingSessionContextMenu,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: ProjectExplorerSessionRowProps) {
  const isExecutingSession = isBirdCoderCodingSessionExecuting(session);

  return (
    <div
      className={`${paddingClassName} py-1.5 flex justify-between items-center cursor-pointer rounded-md transition-colors ${
        isSelected ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
      }`}
      style={buildProjectExplorerSurfaceStyle('36px')}
      onClick={() => onSelectCodingSession(session.id)}
      onContextMenu={(event) => onCodingSessionContextMenu(event, session.id)}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <WorkbenchCodeEngineIcon engineId={session.engineId} />
        {isExecutingSession && <RefreshCw size={12} className="text-emerald-400 shrink-0 animate-spin" />}
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
                onRenameSubmit(session.id, renameValue, session.title);
              } else if (event.key === 'Escape') {
                onRenameCancel();
              }
            }}
            onBlur={onRenameCancel}
            className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="truncate">{session.title}</span>
        )}
      </div>
      {!isRenaming && (
        <span className={`text-[10px] shrink-0 ml-2 ${isSelected ? 'text-gray-400' : 'opacity-50'}`}>
          {formatBirdCoderSessionActivityDisplayTime(session, relativeTimeNow)}
        </span>
      )}
    </div>
  );
});

ProjectExplorerSessionRow.displayName = 'ProjectExplorerSessionRow';
