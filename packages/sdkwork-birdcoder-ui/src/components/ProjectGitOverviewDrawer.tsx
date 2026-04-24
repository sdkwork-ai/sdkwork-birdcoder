import { memo, useEffect, useId } from 'react';
import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-commons';
import { Button } from '@sdkwork/birdcoder-ui-shell';
import { FolderGit2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectGitOverviewPanel } from './ProjectGitOverviewPanel';

interface ProjectGitOverviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectGitOverviewState?: ProjectGitOverviewViewState;
}

export const ProjectGitOverviewDrawer = memo(function ProjectGitOverviewDrawer({
  isOpen,
  onClose,
  projectId,
  projectGitOverviewState,
}: ProjectGitOverviewDrawerProps) {
  const { t } = useTranslation();
  const dialogTitleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      <button
        type="button"
        aria-label={t('code.closeGitOverview')}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-white/10 bg-[#121318]/98 shadow-[-24px_0_64px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        role="dialog"
        aria-labelledby={dialogTitleId}
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-gray-300">
              <FolderGit2 size={14} />
            </div>
            <div className="min-w-0">
              <div
                id={dialogTitleId}
                className="truncate text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-200"
              >
                {t('code.gitOverview')}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {projectId?.trim() ? projectId : t('code.selectProjectFirst')}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label={t('code.closeGitOverview')}
            title={t('code.closeGitOverview')}
          >
            <X size={14} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ProjectGitOverviewPanel
            bodyMaxHeight={null}
            projectId={projectId}
            projectGitOverviewState={projectGitOverviewState}
            showHeader={false}
          />
        </div>
      </aside>
    </div>
  );
});

ProjectGitOverviewDrawer.displayName = 'ProjectGitOverviewDrawer';
