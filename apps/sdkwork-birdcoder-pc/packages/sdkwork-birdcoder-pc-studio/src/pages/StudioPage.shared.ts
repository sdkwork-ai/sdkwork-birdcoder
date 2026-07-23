import {
  buildAgentSessionProjectScopedKey,
} from '@sdkwork/birdcoder-pc-workbench';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface StudioPageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialAgentSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onAgentSessionChange?: (agentSessionId: string, projectId?: string) => void;
}

export const EMPTY_STUDIO_CHAT_MESSAGES: AgentSessionItemView[] = [];

interface RestoreStudioSelectionAfterRefreshOptions {
  currentProjectId: string;
  notifyProjectChange: (projectId: string) => void;
  pendingLocalAgentSessionSelectionKeyRef: MutableRefObject<string | null>;
  selectAgentSession: (agentSessionId: string, options?: { projectId?: string }) => void;
  sessionId: string;
  setMenuActiveProjectId: Dispatch<SetStateAction<string>>;
  setSelectedSessionProjectId: Dispatch<SetStateAction<string | null>>;
  setSessionId: Dispatch<SetStateAction<string>>;
  targetAgentSessionId: string | null;
  targetProjectId: string;
}

export function restoreStudioSelectionAfterRefresh({
  currentProjectId,
  notifyProjectChange,
  pendingLocalAgentSessionSelectionKeyRef,
  selectAgentSession,
  sessionId,
  setMenuActiveProjectId,
  setSelectedSessionProjectId,
  setSessionId,
  targetAgentSessionId,
  targetProjectId,
}: RestoreStudioSelectionAfterRefreshOptions): void {
  const normalizedTargetProjectId = targetProjectId.trim();
  const normalizedTargetAgentSessionId = targetAgentSessionId?.trim() ?? '';
  if (
    normalizedTargetAgentSessionId &&
    normalizedTargetAgentSessionId === sessionId.trim() &&
    normalizedTargetProjectId === currentProjectId
  ) {
    return;
  }

  if (targetAgentSessionId) {
    selectAgentSession(targetAgentSessionId, { projectId: targetProjectId });
    return;
  }

  if (!targetProjectId) {
    return;
  }

  notifyProjectChange(targetProjectId);
  setMenuActiveProjectId(targetProjectId);
  setSessionId('');
  setSelectedSessionProjectId(targetProjectId);
  pendingLocalAgentSessionSelectionKeyRef.current =
    buildAgentSessionProjectScopedKey(targetProjectId, '');
}

export function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}
