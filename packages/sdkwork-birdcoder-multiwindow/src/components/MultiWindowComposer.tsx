import { UniversalChatComposerChrome } from '@sdkwork/birdcoder-ui';
import { ArrowUp, Loader2, RotateCcw, Square } from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  MultiWindowDispatchBatchSummary,
} from '../runtime/multiWindowDispatch.ts';
import type {
  MultiWindowDispatchState,
} from '../types.ts';

interface MultiWindowComposerProps {
  canRetryFailed?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  dispatchSummary?: MultiWindowDispatchBatchSummary | null;
  dispatchState: MultiWindowDispatchState;
  isDispatching: boolean;
  value: string;
  onCancelDispatch?: () => void;
  onRetryFailed?: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
}

export const MultiWindowComposer = memo(function MultiWindowComposer({
  canRetryFailed = false,
  disabled = false,
  disabledReason,
  dispatchSummary,
  dispatchState,
  isDispatching,
  value,
  onCancelDispatch,
  onRetryFailed,
  onSubmit,
  onValueChange,
}: MultiWindowComposerProps) {
  const { t } = useTranslation();
  const canSubmit = value.trim().length > 0 && !disabled && !isDispatching;
  const canCancelDispatch = isDispatching && Boolean(onCancelDispatch);
  const canRetry = canRetryFailed && !disabled && !isDispatching && Boolean(onRetryFailed);
  const hasDispatchSummary = dispatchState !== 'idle' && Boolean(dispatchSummary);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (canSubmit) {
      onSubmit();
    }
  };

  return (
    <form
      data-testid="multiwindow-bottom-composer"
      className="shrink-0 border-t border-white/[0.08] bg-[#0e0e11]/95 px-4 pb-3 pt-2 backdrop-blur-sm"
      onSubmit={handleSubmit}
    >
      <div className="mx-auto max-w-3xl">
        <UniversalChatComposerChrome isFocused={value.trim().length > 0}>
          <textarea
            className="min-h-[24px] max-h-40 w-full resize-none overflow-y-auto bg-transparent px-1 text-[15px] leading-6 text-white outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || isDispatching}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('multiWindow.broadcastPlaceholder')}
            rows={1}
            value={value}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {disabledReason ? (
                <div className="truncate text-[11px] font-medium text-amber-200">
                  {disabledReason}
                </div>
              ) : hasDispatchSummary && dispatchSummary ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                  <span className="font-medium text-gray-400">{t('multiWindow.dispatchSummary')}</span>
                  <span className="text-emerald-300">{t('multiWindow.successCount', { count: dispatchSummary.successPaneCount })}</span>
                  <span className="text-red-300">{t('multiWindow.failedCount', { count: dispatchSummary.failedPaneCount })}</span>
                  <span className="text-gray-500">{t('multiWindow.skippedCount', { count: dispatchSummary.skippedPaneCount })}</span>
                  <span className="text-amber-300">{t('multiWindow.cancelledCount', { count: dispatchSummary.cancelledPaneCount })}</span>
                  <span className="text-gray-400">
                    {t('multiWindow.durationSummary', { durationMs: dispatchSummary.durationMs })}
                  </span>
                  <span className="text-gray-400">
                    {t('multiWindow.concurrencySummary', {
                      effectiveConcurrency: dispatchSummary.effectiveConcurrency,
                      maxObservedConcurrency: dispatchSummary.maxObservedConcurrency,
                    })}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canRetry ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-3 text-[11px] font-medium text-red-200 transition-colors hover:border-red-300/30 hover:bg-red-400/15"
                  onClick={onRetryFailed}
                  title={t('multiWindow.retryFailed')}
                >
                  <RotateCcw size={12} />
                  <span>{t('multiWindow.retryFailed')}</span>
                </button>
              ) : null}
              {canCancelDispatch ? (
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/20 transition-colors hover:bg-amber-500/25"
                  onClick={onCancelDispatch}
                  title={t('multiWindow.cancelDispatch')}
                >
                  <Square size={14} />
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500 disabled:shadow-none"
                title={isDispatching ? t('multiWindow.sending') : t('multiWindow.sendToAll')}
              >
                {isDispatching ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
              </button>
            </div>
          </div>
        </UniversalChatComposerChrome>
      </div>
    </form>
  );
});

MultiWindowComposer.displayName = 'MultiWindowComposer';
