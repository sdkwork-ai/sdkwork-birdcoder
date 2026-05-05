import { type ReactNode } from 'react';
import { SessionTranscriptLoadingState } from '@sdkwork/birdcoder-ui-shell';
import { CodeChatEmptyState } from './CodeChatEmptyState';

export interface CodePageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string, projectId?: string) => void;
}

export function resolveCodeProjectPath(projectPath?: string): string | null {
  const normalizedProjectPath = projectPath?.trim() ?? '';
  return normalizedProjectPath.length > 0 ? normalizedProjectPath : null;
}

export function resolveCodeProjectActionTarget<TProject extends { name: string; path?: string }>(
  project: TProject | null | undefined,
  addToast: (message: string, type: 'error') => void,
): { project: TProject; projectPath: string } | null {
  if (!project) {
    addToast('Project not found', 'error');
    return null;
  }

  const projectPath = resolveCodeProjectPath(project.path);
  if (!projectPath) {
    addToast(`Project folder path is unavailable: ${project.name}`, 'error');
    return null;
  }

  return {
    project,
    projectPath,
  };
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
