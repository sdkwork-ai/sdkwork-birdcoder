import { type ReactNode } from 'react';
import { SessionTranscriptLoadingState } from '@sdkwork/birdcoder-ui-shell';
import { CodeChatEmptyState } from './CodeChatEmptyState';

export interface CodePageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string) => void;
}

export function CodeSessionTranscriptLoadingState() {
  return (
    <SessionTranscriptLoadingState
      title="Loading conversation"
      description="Fetching the selected session transcript."
    />
  );
}

export function createCodeChatEmptyStates(isHydrating: boolean): {
  mainChatEmptyState: ReactNode;
  editorChatEmptyState?: ReactNode;
} {
  return isHydrating
    ? {
      mainChatEmptyState: <CodeSessionTranscriptLoadingState />,
      editorChatEmptyState: <CodeSessionTranscriptLoadingState />,
    }
    : {
      mainChatEmptyState: <CodeChatEmptyState />,
    };
}

export function getLanguageFromPath(path: string) {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}
