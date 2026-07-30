import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { memo, useCallback } from 'react';

export interface ProjectInventoryStatusProps {
  errorLabel: string;
  loadingLabel: string;
  retryLabel: string;
  state: 'error' | 'loading';
  onRetry?: () => unknown | Promise<unknown>;
}

export const ProjectInventoryStatus = memo(function ProjectInventoryStatus({
  errorLabel,
  loadingLabel,
  retryLabel,
  state,
  onRetry,
}: ProjectInventoryStatusProps) {
  const handleRetry = useCallback(() => {
    if (!onRetry) {
      return;
    }
    try {
      void Promise.resolve(onRetry()).catch(() => undefined);
    } catch {
      // The owning project store retains the safe error state for another retry.
    }
  }, [onRetry]);

  if (state === 'loading') {
    return (
      <div
        aria-live="polite"
        className="flex min-h-28 items-center justify-center gap-2 px-4 text-center text-xs text-gray-500"
        role="status"
      >
        <Loader2 aria-hidden="true" className="shrink-0 animate-spin" size={14} />
        <span>{loadingLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
      <div className="flex items-center gap-2 text-xs text-red-300">
        <AlertCircle aria-hidden="true" className="shrink-0" size={14} />
        <span>{errorLabel}</span>
      </div>
      {onRetry ? (
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-white/10 px-3 text-xs font-medium text-gray-300 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          onClick={handleRetry}
        >
          <RefreshCw aria-hidden="true" size={13} />
          <span>{retryLabel}</span>
        </button>
      ) : null}
    </div>
  );
});
