import type { RefObject } from 'react';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { useTranslation } from 'react-i18next';
import type {
  ProjectExplorerEngineOption,
  ProjectExplorerMenuPosition,
} from './ProjectExplorer.shared';

interface ProjectExplorerProjectContextMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: ProjectExplorerMenuPosition;
  zIndex: number;
  projectId: string;
  project?: BirdCoderProject;
  newSessionEngineOptions: readonly ProjectExplorerEngineOption[];
  terminalEngineOptions: readonly ProjectExplorerEngineOption[];
  isRefreshing: boolean;
  onClose: () => void;
  onRefresh?: (id: string) => Promise<void> | void;
  onCreateEngineSession: (projectId: string, engineId: string) => void;
  onStartRename: (projectId: string, name: string) => void;
  onArchive?: (projectId: string) => void;
  onCopyWorkingDirectory?: (projectId: string) => void;
  onCopyProjectPath?: (projectId: string) => void;
  onOpenInTerminal?: (projectId: string, profileId?: string) => void;
  onOpenInFileExplorer?: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectExplorerProjectContextMenu({
  menuRef,
  position,
  zIndex,
  projectId,
  project,
  newSessionEngineOptions,
  terminalEngineOptions,
  isRefreshing,
  onClose,
  onRefresh,
  onCreateEngineSession,
  onStartRename,
  onArchive,
  onCopyWorkingDirectory,
  onCopyProjectPath,
  onOpenInTerminal,
  onOpenInFileExplorer,
  onDelete,
}: ProjectExplorerProjectContextMenuProps) {
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
          void onRefresh?.(projectId);
          onClose();
        }}
      >
        {isRefreshing ? t('code.refreshingSessions') : t('code.refreshSessions')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      {newSessionEngineOptions.map((engine) => (
        <button
          key={`new-session-${engine.id}`}
          type="button"
          className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
          onClick={() => {
            onCreateEngineSession(projectId, engine.id);
            onClose();
          }}
        >
          <div className="flex items-center gap-2">
            <WorkbenchCodeEngineIcon engineId={engine.id} />
            <span>{t('code.newEngineSessionInProject', { engine: engine.label })}</span>
          </div>
        </button>
      ))}
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onStartRename(projectId, project?.name ?? '');
          onClose();
        }}
      >
        {t('app.renameProject')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onArchive?.(projectId);
          onClose();
        }}
      >
        {project?.archived ? t('code.unarchiveProject') : t('code.archiveProject')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopyWorkingDirectory?.(projectId);
          onClose();
        }}
      >
        {t('code.copyWorkingDirectory')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCopyProjectPath?.(projectId);
          onClose();
        }}
      >
        {t('code.copyPath')}
      </button>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onOpenInTerminal?.(projectId);
          onClose();
        }}
      >
        {t('code.openInTerminal')}
      </button>
      {terminalEngineOptions.map((engine) => (
        <button
          key={engine.id}
          type="button"
          className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
          onClick={() => {
            onOpenInTerminal?.(projectId, engine.terminalProfileId ?? undefined);
            onClose();
          }}
        >
          {t('code.developInEngineTerminal', { engine: engine.label })}
        </button>
      ))}
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onOpenInFileExplorer?.(projectId);
          onClose();
        }}
      >
        {t('code.openInFileExplorer')}
      </button>
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-red-500/10 hover:text-red-400 text-red-500 transition-colors"
        onClick={() => {
          onDelete(projectId);
          onClose();
        }}
      >
        {t('app.removeProject')}
      </button>
    </div>
  );
}
