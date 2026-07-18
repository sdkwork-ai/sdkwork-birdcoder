import {
  buildCodingSessionProjectScopedKey,
} from '@sdkwork/birdcoder-pc-workbench';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface StudioPageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string, projectId?: string) => void;
}

export const EMPTY_STUDIO_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

interface RestoreStudioSelectionAfterRefreshOptions {
  currentProjectId: string;
  notifyProjectChange: (projectId: string) => void;
  pendingLocalCodingSessionSelectionKeyRef: MutableRefObject<string | null>;
  selectCodingSession: (codingSessionId: string, options?: { projectId?: string }) => void;
  sessionId: string;
  setMenuActiveProjectId: Dispatch<SetStateAction<string>>;
  setSelectedSessionProjectId: Dispatch<SetStateAction<string | null>>;
  setSessionId: Dispatch<SetStateAction<string>>;
  targetCodingSessionId: string | null;
  targetProjectId: string;
}

export function restoreStudioSelectionAfterRefresh({
  currentProjectId,
  notifyProjectChange,
  pendingLocalCodingSessionSelectionKeyRef,
  selectCodingSession,
  sessionId,
  setMenuActiveProjectId,
  setSelectedSessionProjectId,
  setSessionId,
  targetCodingSessionId,
  targetProjectId,
}: RestoreStudioSelectionAfterRefreshOptions): void {
  const normalizedTargetProjectId = targetProjectId.trim();
  const normalizedTargetCodingSessionId = targetCodingSessionId?.trim() ?? '';
  if (
    normalizedTargetCodingSessionId &&
    normalizedTargetCodingSessionId === sessionId.trim() &&
    normalizedTargetProjectId === currentProjectId
  ) {
    return;
  }

  if (targetCodingSessionId) {
    selectCodingSession(targetCodingSessionId, { projectId: targetProjectId });
    return;
  }

  if (!targetProjectId) {
    return;
  }

  notifyProjectChange(targetProjectId);
  setMenuActiveProjectId(targetProjectId);
  setSessionId('');
  setSelectedSessionProjectId(targetProjectId);
  pendingLocalCodingSessionSelectionKeyRef.current =
    buildCodingSessionProjectScopedKey(targetProjectId, '');
}

export function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}
