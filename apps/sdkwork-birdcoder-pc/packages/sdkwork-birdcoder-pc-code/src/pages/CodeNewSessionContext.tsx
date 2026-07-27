import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-pc-workbench';
import { ProjectGitHeaderControls } from '@sdkwork/birdcoder-pc-ui/components/ProjectGitHeaderControls';
import { FolderClosed, Monitor } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface CodeNewSessionContextProps {
  projectGitOverviewState?: ProjectGitOverviewViewState;
  projectId?: string;
  projectName?: string;
}

export const CodeNewSessionContext = memo(function CodeNewSessionContext({
  projectGitOverviewState,
  projectId,
  projectName,
}: CodeNewSessionContextProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-x-1 gap-y-1 px-2 text-sm text-gray-300">
      <div
        className="flex h-8 min-w-0 max-w-[min(20rem,100%)] items-center gap-2 rounded-md px-2.5"
        title={projectName}
      >
        <FolderClosed size={16} className="shrink-0 text-gray-300" />
        <span className="truncate font-medium text-gray-100">{projectName || '-'}</span>
      </div>

      <div className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-gray-300">
        <Monitor size={15} className="text-gray-300" />
        <span>{t('app.localFolder')}</span>
      </div>

      <ProjectGitHeaderControls
        compactControls={false}
        projectGitOverviewState={projectGitOverviewState}
        projectId={projectId}
        showBranchControl
        showOverviewDrawerToggle={false}
        showWorktreeControl
        variant="topbar"
      />
    </div>
  );
});

CodeNewSessionContext.displayName = 'CodeNewSessionContext';
