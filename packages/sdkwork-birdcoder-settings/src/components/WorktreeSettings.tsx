import { useTranslation } from 'react-i18next';
import { ProjectGitWorktreeManagementPanel } from '@sdkwork/birdcoder-ui';
import type { SettingsProps } from './types';
import { ProjectGitSettingsPanel } from './ProjectGitSettingsPanel';

export function WorktreeSettings({
  currentProjectId,
  currentProjectName,
}: Pick<SettingsProps, 'currentProjectId' | 'currentProjectName'>) {
  const { t } = useTranslation();

  return (
    <ProjectGitSettingsPanel
      currentProjectId={currentProjectId}
      currentProjectName={currentProjectName}
      supplementaryContent={(
        <ProjectGitWorktreeManagementPanel currentProjectId={currentProjectId} />
      )}
      title={t('settings.worktree.title')}
      visibleSections={['summary', 'worktrees']}
    />
  );
}
