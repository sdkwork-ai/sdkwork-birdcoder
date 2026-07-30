import { AlertCircle, ChevronUp, Loader2, RotateCcw } from 'lucide-react';
import { memo } from 'react';

export interface RemoteTranscriptPaginationStatusProps {
  error?: string | null;
  isLoading: boolean;
  loadLabel: string;
  loadingLabel: string;
  retryLabel: string;
  onLoad: () => void | Promise<void>;
}

export const RemoteTranscriptPaginationStatus = memo(
  function RemoteTranscriptPaginationStatus({
    error,
    isLoading,
    loadLabel,
    loadingLabel,
    retryLabel,
    onLoad,
  }: RemoteTranscriptPaginationStatusProps) {
    if (error) {
      return (
        <div className="px-4 py-2">
          <div
            className="flex min-w-0 items-center gap-2 rounded border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-200"
            role="alert"
          >
            <AlertCircle aria-hidden="true" className="shrink-0 text-red-300" size={14} />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button
              type="button"
              className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded border border-red-300/20 px-2.5 text-red-100 transition-colors hover:border-red-200/40 hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-60"
              disabled={isLoading}
              onClick={onLoad}
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="animate-spin" size={12} />
              ) : (
                <RotateCcw aria-hidden="true" size={12} />
              )}
              <span>{isLoading ? loadingLabel : retryLabel}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex shrink-0 items-center justify-center px-4 py-2">
        <button
          type="button"
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-white/10 bg-white/[0.03] px-2.5 text-xs text-gray-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
          disabled={isLoading}
          onClick={onLoad}
        >
          {isLoading ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={12} />
          ) : (
            <ChevronUp aria-hidden="true" size={12} />
          )}
          <span>{isLoading ? loadingLabel : loadLabel}</span>
        </button>
      </div>
    );
  },
);
