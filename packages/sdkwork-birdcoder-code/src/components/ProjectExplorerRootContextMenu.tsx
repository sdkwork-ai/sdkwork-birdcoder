import type { RefObject } from 'react';
import { WorkbenchCodeEngineIcon } from '@sdkwork/birdcoder-ui-shell';
import { useTranslation } from 'react-i18next';
import type {
  ProjectExplorerEngineOption,
  ProjectExplorerMenuPosition,
} from './ProjectExplorer.shared';

interface ProjectExplorerRootContextMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: ProjectExplorerMenuPosition;
  zIndex: number;
  selectedProjectId?: string | null;
  engineOptions: readonly ProjectExplorerEngineOption[];
  onClose: () => void;
  onCreateProject: () => Promise<void> | void;
  onOpenFolder?: () => void;
  onCreateDefaultSession: () => void;
  onCreateEngineSession: (engineId: string, modelId: string) => void;
}

export function ProjectExplorerRootContextMenu({
  menuRef,
  position,
  zIndex,
  selectedProjectId,
  engineOptions,
  onClose,
  onCreateProject,
  onOpenFolder,
  onCreateDefaultSession,
  onCreateEngineSession,
}: ProjectExplorerRootContextMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 text-[13px] text-gray-300 w-56 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
      style={{ top: position.y, left: position.x, zIndex }}
    >
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          void Promise.resolve(onCreateProject()).finally(onClose);
        }}
      >
        {t('app.newProject')}
      </button>
      {onOpenFolder && (
        <button
          type="button"
          className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
          onClick={() => {
            onOpenFolder();
            onClose();
          }}
        >
          {t('app.menu.openFolder').replace('...', '')}
        </button>
      )}
      <div className="h-px bg-white/10 my-1.5"></div>
      <button
        type="button"
        className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
        onClick={() => {
          onCreateDefaultSession();
          onClose();
        }}
      >
        {t('app.menu.newSession')}
      </button>
      {selectedProjectId && (
        <>
          <div className="h-px bg-white/10 my-1.5"></div>
          {engineOptions.map((engine) => (
            <button
              key={`root-new-session-${engine.id}`}
              type="button"
              className="w-full px-4 py-1.5 text-left hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => {
                onCreateEngineSession(engine.id, engine.modelId ?? engine.id);
                onClose();
              }}
            >
              <div className="flex items-center gap-2">
                <WorkbenchCodeEngineIcon engineId={engine.id} />
                <span>{t('code.newEngineSessionInProject', { engine: engine.label })}</span>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
