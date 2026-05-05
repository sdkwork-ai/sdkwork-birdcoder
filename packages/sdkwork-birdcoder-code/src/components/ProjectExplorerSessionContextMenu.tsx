import type { RefObject } from 'react';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import type { ProjectExplorerMenuPosition } from './ProjectExplorer.shared';

interface ProjectExplorerSessionContextMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: ProjectExplorerMenuPosition;
  zIndex: number;
  sessionId: string;
  projectId: string;
  session?: BirdCoderCodingSession;
  isRefreshing: boolean;
  onClose: () => void;
  onRefresh?: (id: string) => Promise<void> | void;
  onPin?: (id: string, projectId: string) => void;
  onStartRename: (id: string, projectId: string, title: string) => void;
  onArchive?: (id: string, projectId: string) => void;
  onMarkUnread?: (id: string, projectId: string) => void;
  onCopyWorkingDirectory?: (id: string, projectId: string) => void;
  onOpenInTerminal?: (id: string, nativeSessionId?: string) => void;
  onCopySessionId?: (id: string, nativeSessionId?: string) => void;
  onCopyResumeCommand?: (id: string, projectId: string, nativeSessionId?: string) => void;
  onCopyDeeplink?: (id: string, projectId: string) => void;
  onForkLocal?: (id: string, projectId: string) => void;
  onForkNewTree?: (id: string, projectId: string) => void;
  onDelete: (id: string, projectId: string) => void;
}

export function ProjectExplorerSessionContextMenu({
  menuRef,
  position,
  zIndex,
  sessionId,
  projectId,
  session,
  isRefreshing,
  onClose,
  onRefresh,
  onPin,
  onStartRename,
  onArchive,
  onMarkUnread,
  onCopyWorkingDirectory,
  onOpenInTerminal,
  onCopySessionId,
  onCopyResumeCommand,
  onCopyDeeplink,
  onForkLocal,
  onForkNewTree,
  onDelete,
}: ProjectExplorerSessionContextMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
      style={{ top: position.y, left: position.x, zIndex }}
    >
      <button
        type="button"
        className={`w-full px-4 py-1.5 text-left transition-colors ${
          isRefreshing
            ? 'cursor-not-allowed text-gray-500'
            : 'cursor-pointer hover:bg-white/10 hover:text-white'
        }`}
        onClick={() => {
          if (isRefreshing) {
            return;
          }
          void onRefresh?.(sessionId);
          onClose();
        }}
      >
        {isRefreshing ? t('code.refreshingMessages') : t('code.refreshMessages')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onPin?.(sessionId, projectId);
          onClose();
        }}
      >
        {session?.pinned ? t('code.unpinSession') : t('code.pinSession')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onStartRename(sessionId, projectId, session?.title ?? '');
          onClose();
        }}
      >
        {t('code.renameSession')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onArchive?.(sessionId, projectId);
          onClose();
        }}
      >
        {session?.archived ? t('code.unarchiveSession') : t('code.archiveSession')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onMarkUnread?.(sessionId, projectId);
          onClose();
        }}
      >
        {session?.unread ? t('code.markAsRead') : t('code.markAsUnread')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopyWorkingDirectory?.(sessionId, projectId);
          onClose();
        }}
      >
        {t('code.copyWorkingDirectory')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onOpenInTerminal?.(sessionId, session?.nativeSessionId?.trim());
          onClose();
        }}
      >
        {t('code.openInTerminal')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopySessionId?.(sessionId, session?.nativeSessionId?.trim());
          onClose();
        }}
      >
        {t('code.copySessionId')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopyResumeCommand?.(sessionId, projectId, session?.nativeSessionId?.trim());
          onClose();
        }}
      >
        {t('code.copySessionResumeCommand')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopyDeeplink?.(sessionId, projectId);
          onClose();
        }}
      >
        {t('code.copyDeeplink')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onForkLocal?.(sessionId, projectId);
          onClose();
        }}
      >
        {t('code.forkToLocal')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onForkNewTree?.(sessionId, projectId);
          onClose();
        }}
      >
        {t('code.forkToNewTree')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-red-500/10 hover:text-red-400 text-red-500 transition-colors"
        onClick={() => {
          onDelete(sessionId, projectId);
          onClose();
        }}
      >
        {t('code.deleteSession')}
      </button>
    </div>
  );
}
