import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';

export interface StudioPageProps {
  isVisible?: boolean;
  workspaceId?: string;
  projectId?: string;
  initialCodingSessionId?: string;
  onProjectChange?: (projectId: string) => void;
  onCodingSessionChange?: (codingSessionId: string) => void;
}

export const EMPTY_STUDIO_CHAT_MESSAGES: BirdCoderChatMessage[] = [];

export function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}
