import { SessionTranscriptLoadingState } from '@sdkwork/birdcoder-ui/chat';

export function CodeSessionTranscriptLoadingState() {
  return (
    <SessionTranscriptLoadingState
      title="Loading conversation"
      description="Fetching the selected session transcript."
    />
  );
}

export function getLanguageFromPath(path: string) {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}
