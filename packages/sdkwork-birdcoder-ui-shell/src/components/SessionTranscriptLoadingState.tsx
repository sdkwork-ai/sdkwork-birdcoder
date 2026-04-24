interface SessionTranscriptLoadingStateProps {
  description?: string;
  title?: string;
}

export function SessionTranscriptLoadingState({
  description = 'Fetching the selected session transcript.',
  title = 'Loading conversation',
}: SessionTranscriptLoadingStateProps) {
  return (
    <div className="animate-in fade-in zoom-in-95 flex flex-1 flex-col items-center justify-center px-4 text-center duration-300">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-blue-400" />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  );
}
