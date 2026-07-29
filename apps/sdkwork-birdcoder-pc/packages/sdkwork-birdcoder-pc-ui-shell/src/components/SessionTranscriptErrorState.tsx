import { RefreshCw, TriangleAlert } from 'lucide-react';

export interface SessionTranscriptErrorStateProps {
  description: string;
  onRetry: () => void;
  retryLabel: string;
  title: string;
}

export function SessionTranscriptErrorState({
  description,
  onRetry,
  retryLabel,
  title,
}: SessionTranscriptErrorStateProps) {
  return (
    <div
      className="animate-in fade-in flex flex-1 flex-col items-center justify-center px-4 text-center duration-200"
      role="alert"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 text-amber-300" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-gray-400">{description}</p>
      <button
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-gray-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        <span>{retryLabel}</span>
      </button>
    </div>
  );
}
