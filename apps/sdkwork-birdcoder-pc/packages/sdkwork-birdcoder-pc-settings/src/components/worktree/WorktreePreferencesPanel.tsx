import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_WORKTREE_LIST_LIMIT,
  MIN_WORKTREE_LIST_LIMIT,
  normalizeWorkbenchWorktreeListLimit,
} from '@sdkwork/birdcoder-pc-workbench';

interface WorktreePreferencesPanelProps {
  autoPrune: boolean;
  listLimit: number;
  onAutoPruneChange?: (enabled: boolean) => void;
  onListLimitChange?: (limit: number) => void;
}

export function WorktreePreferencesPanel({
  autoPrune,
  listLimit,
  onAutoPruneChange,
  onListLimitChange,
}: WorktreePreferencesPanelProps) {
  const { t } = useTranslation();
  const [listLimitDraft, setListLimitDraft] = useState(String(listLimit));

  useEffect(() => {
    setListLimitDraft(String(listLimit));
  }, [listLimit]);

  const commitListLimit = () => {
    const nextLimit = normalizeWorkbenchWorktreeListLimit(Number(listLimitDraft));
    setListLimitDraft(String(nextLimit));
    onListLimitChange?.(nextLimit);
  };

  return (
    <section
      aria-label={t('settings.worktree.preferencesLabel')}
      className="mt-7 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1c1c1f]"
    >
      <div className="flex min-h-[54px] items-center justify-between gap-5 border-b border-white/[0.07] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#e6e6e8]">
            {t('settings.worktree.managedLocation')}
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-[#88898e]">
            {t('settings.worktree.managedLocationDesc')}
          </div>
        </div>
        <div
          className="flex h-8 w-[180px] shrink-0 items-center rounded-md border border-white/[0.08] bg-[#252528] px-2.5 text-xs text-[#9b9ca1]"
          title={t('settings.worktree.managedLocationPath')}
        >
          <span className="truncate">{t('settings.worktree.defaultLocationValue')}</span>
        </div>
      </div>

      <div className="flex min-h-[54px] items-center justify-between gap-5 border-b border-white/[0.07] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#e6e6e8]">
            {t('settings.worktree.autoPrune')}
          </div>
          <div className="mt-0.5 text-[11px] leading-4 text-[#88898e]">
            {t('settings.worktree.autoPruneDesc')}
          </div>
        </div>
        <button
          aria-checked={autoPrune}
          aria-label={t('settings.worktree.autoPrune')}
          className={`relative h-4 w-7 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-50 ${
            autoPrune ? 'bg-[#1689f5]' : 'bg-[#3b3c40]'
          }`}
          disabled={!onAutoPruneChange}
          onClick={() => onAutoPruneChange?.(!autoPrune)}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`absolute left-0 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
              autoPrune ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex min-h-[62px] items-center justify-between gap-5 px-3.5 py-2.5">
        <div className="min-w-0">
          <label
            className="text-xs font-medium text-[#e6e6e8]"
            htmlFor="worktree-list-limit"
          >
            {t('settings.worktree.listLimit')}
          </label>
          <div className="mt-0.5 text-[11px] leading-4 text-[#88898e]">
            {t('settings.worktree.listLimitDesc')}
          </div>
        </div>
        <input
          aria-label={t('settings.worktree.listLimit')}
          className="h-8 w-[78px] shrink-0 rounded-md border border-white/[0.08] bg-[#252528] px-2.5 text-xs text-[#dedee0] outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/25"
          id="worktree-list-limit"
          inputMode="numeric"
          max={MAX_WORKTREE_LIST_LIMIT}
          min={MIN_WORKTREE_LIST_LIMIT}
          onBlur={commitListLimit}
          onChange={(event) => setListLimitDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          type="number"
          value={listLimitDraft}
        />
      </div>
    </section>
  );
}
