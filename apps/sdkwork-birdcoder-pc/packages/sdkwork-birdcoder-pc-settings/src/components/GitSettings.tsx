import { useTranslation } from 'react-i18next';
import { DEFAULT_WORKBENCH_PREFERENCES } from '@sdkwork/birdcoder-pc-workbench';
import type { SettingsProps } from './types';
import { GitInstructionsEditor } from './git/GitInstructionsEditor';
import { GitPreferencesPanel } from './git/GitPreferencesPanel';

export function GitSettings({
  updateWorkbenchPreferences,
  workbenchPreferences,
}: Pick<SettingsProps, 'updateWorkbenchPreferences' | 'workbenchPreferences'>) {
  const { t } = useTranslation();
  const preferences = workbenchPreferences ?? DEFAULT_WORKBENCH_PREFERENCES;
  const updatePreferences = updateWorkbenchPreferences ?? (() => undefined);

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#141416] px-6 pb-16 pt-[54px] sm:px-10">
      <div className="mx-auto w-full max-w-[616px] animate-in fade-in fill-mode-both">
        <h1 className="mb-6 text-xl font-semibold leading-7 text-[#ededee]">
          {t('settings.git.title')}
        </h1>

        <GitPreferencesPanel
          onUpdate={updatePreferences}
          preferences={preferences}
        />

        <GitInstructionsEditor
          description={t('settings.git.commitInstructionsDesc')}
          onSave={(gitCommitInstructions) => updatePreferences({ gitCommitInstructions })}
          placeholder={t('settings.git.commitInstructionsPlaceholder')}
          title={t('settings.git.commitInstructions')}
          value={preferences.gitCommitInstructions}
        />

        <GitInstructionsEditor
          description={t('settings.git.pullRequestInstructionsDesc')}
          onSave={(gitPullRequestInstructions) => updatePreferences({ gitPullRequestInstructions })}
          placeholder={t('settings.git.pullRequestInstructionsPlaceholder')}
          title={t('settings.git.pullRequestInstructions')}
          value={preferences.gitPullRequestInstructions}
        />
      </div>
    </main>
  );
}
