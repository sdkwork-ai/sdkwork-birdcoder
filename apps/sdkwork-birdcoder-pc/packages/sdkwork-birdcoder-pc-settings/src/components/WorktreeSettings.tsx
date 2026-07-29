import { useTranslation } from 'react-i18next';
import { ProjectGitWorktreeManagementPanel } from '@sdkwork/birdcoder-pc-ui';
import {
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchWorktreeListLimit,
} from '@sdkwork/birdcoder-pc-workbench';

import type { SettingsProps } from './types';
import { WorktreePreferencesPanel } from './worktree/WorktreePreferencesPanel';

export function WorktreeSettings({
  currentProjectId,
  updateWorkbenchPreferences,
  workbenchPreferences,
}: Pick<
  SettingsProps,
  'currentProjectId' | 'updateWorkbenchPreferences' | 'workbenchPreferences'
>) {
  const { t } = useTranslation();
  const autoPrune = workbenchPreferences?.worktreeAutoPrune
    ?? DEFAULT_WORKBENCH_PREFERENCES.worktreeAutoPrune;
  const listLimit = normalizeWorkbenchWorktreeListLimit(
    workbenchPreferences?.worktreeListLimit,
  );

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#0e0e11] px-6 py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[616px] animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
        <h1 className="text-2xl font-semibold text-white">{t('settings.worktree.title')}</h1>

        <WorktreePreferencesPanel
          autoPrune={autoPrune}
          listLimit={listLimit}
          onAutoPruneChange={updateWorkbenchPreferences
            ? (enabled) => updateWorkbenchPreferences({ worktreeAutoPrune: enabled })
            : undefined}
          onListLimitChange={updateWorkbenchPreferences
            ? (limit) => updateWorkbenchPreferences({ worktreeListLimit: limit })
            : undefined}
        />

        <ProjectGitWorktreeManagementPanel
          autoPrune={autoPrune}
          currentProjectId={currentProjectId}
          listLimit={listLimit}
        />
      </div>
    </main>
  );
}

