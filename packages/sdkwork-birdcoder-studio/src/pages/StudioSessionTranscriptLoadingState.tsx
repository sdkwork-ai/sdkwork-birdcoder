import { SessionTranscriptLoadingState } from '@sdkwork/birdcoder-ui-shell';

export function StudioSessionTranscriptLoadingState() {
  return (
    <SessionTranscriptLoadingState
      title="Loading conversation"
      description="Fetching the selected session transcript."
    />
  );
}
