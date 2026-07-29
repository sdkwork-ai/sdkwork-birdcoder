import {
  SessionTranscriptErrorState,
  SessionTranscriptLoadingState,
} from '@sdkwork/birdcoder-pc-ui-shell';

export function StudioSessionTranscriptLoadingState() {
  return (
    <SessionTranscriptLoadingState
      title="Loading conversation"
      description="Fetching the selected session transcript."
    />
  );
}

interface StudioSessionTranscriptErrorStateProps {
  description: string;
  onRetry: () => void;
  retryLabel: string;
  title: string;
}

export function StudioSessionTranscriptErrorState({
  description,
  onRetry,
  retryLabel,
  title,
}: StudioSessionTranscriptErrorStateProps) {
  return (
    <SessionTranscriptErrorState
      description={description}
      onRetry={onRetry}
      retryLabel={retryLabel}
      title={title}
    />
  );
}

