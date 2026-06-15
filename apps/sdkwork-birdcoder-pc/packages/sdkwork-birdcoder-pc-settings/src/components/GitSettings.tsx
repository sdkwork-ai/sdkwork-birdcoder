import { useTranslation } from 'react-i18next';
import type { SettingsProps } from './types';
import { ProjectGitSettingsPanel } from './ProjectGitSettingsPanel';

export function GitSettings({
  currentProjectId,
  currentProjectName,
}: Pick<SettingsProps, 'currentProjectId' | 'currentProjectName'>) {
  const { t } = useTranslation();

  return (
    <ProjectGitSettingsPanel
      currentProjectId={currentProjectId}
      currentProjectName={currentProjectName}
      title={t('settings.git.title')}
      visibleSections={['summary', 'status', 'branches']}
    />
  );
}
