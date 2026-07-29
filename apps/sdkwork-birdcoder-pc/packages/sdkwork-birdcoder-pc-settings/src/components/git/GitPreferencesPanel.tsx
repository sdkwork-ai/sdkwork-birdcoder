import type { WorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench';
import { useTranslation } from 'react-i18next';
import {
  GitSegmentedControl,
  GitSettingsCard,
  GitSettingsRow,
  GitSettingsSwitch,
} from './GitSettingsPrimitives';

interface GitPreferencesPanelProps {
  onUpdate: (value: Partial<WorkbenchPreferences>) => void;
  preferences: WorkbenchPreferences;
}

export function GitPreferencesPanel({
  onUpdate,
  preferences,
}: GitPreferencesPanelProps) {
  const { t } = useTranslation();

  return (
    <section aria-label={t('settings.git.preferencesLabel')}>
      <GitSettingsCard>
      <GitSettingsRow
        description={t('settings.git.branchPrefixDesc')}
        title={t('settings.git.branchPrefix')}
      >
        <input
          aria-label={t('settings.git.branchPrefix')}
          className="h-7 w-[180px] rounded-md border border-white/[0.08] bg-[#2b2b2e] px-2.5 text-[12px] text-[#e3e3e5] outline-none placeholder:text-[#727378] focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/20"
          maxLength={120}
          onChange={(event) => onUpdate({ gitBranchPrefix: event.target.value })}
          spellCheck={false}
          value={preferences.gitBranchPrefix}
        />
      </GitSettingsRow>

      <GitSettingsRow
        description={t('settings.git.pullRequestMergeMethodDesc')}
        title={t('settings.git.pullRequestMergeMethod')}
      >
        <GitSegmentedControl
          ariaLabel={t('settings.git.pullRequestMergeMethod')}
          onChange={(gitPullRequestMergeMethod) => onUpdate({ gitPullRequestMergeMethod })}
          options={[
            { label: t('settings.git.mergeMethodMerge'), value: 'merge' },
            { label: t('settings.git.mergeMethodSquash'), value: 'squash' },
          ]}
          value={preferences.gitPullRequestMergeMethod}
        />
      </GitSettingsRow>

      <GitSettingsRow
        description={(
          <>
            {t('settings.git.forceWithLeaseDesc')}{' '}
            <code className="font-mono text-[#a6a7aa]">--force-with-lease</code>
          </>
        )}
        title={t('settings.git.forceWithLease')}
      >
        <GitSettingsSwitch
          checked={preferences.gitForceWithLease}
          label={t('settings.git.forceWithLease')}
          onCheckedChange={(gitForceWithLease) => onUpdate({ gitForceWithLease })}
        />
      </GitSettingsRow>

      <GitSettingsRow
        description={t('settings.git.createDraftPullRequestDesc')}
        title={t('settings.git.createDraftPullRequest')}
      >
        <GitSettingsSwitch
          checked={preferences.gitCreateDraftPullRequest}
          label={t('settings.git.createDraftPullRequest')}
          onCheckedChange={(gitCreateDraftPullRequest) => onUpdate({ gitCreateDraftPullRequest })}
        />
      </GitSettingsRow>

      <GitSettingsRow
        description={t('settings.git.reviewDeliveryModeDesc')}
        title={t('settings.git.reviewDeliveryMode')}
      >
        <GitSegmentedControl
          ariaLabel={t('settings.git.reviewDeliveryMode')}
          onChange={(gitReviewDeliveryMode) => onUpdate({ gitReviewDeliveryMode })}
          options={[
            { label: t('settings.git.reviewDeliveryInline'), value: 'inline' },
            { label: t('settings.git.reviewDeliverySeparate'), value: 'separate' },
          ]}
          value={preferences.gitReviewDeliveryMode}
        />
      </GitSettingsRow>
      </GitSettingsCard>
    </section>
  );
}
