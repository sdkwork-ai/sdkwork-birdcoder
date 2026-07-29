import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';

const MAX_TURN_PREVIEW_LENGTH = 220;

export interface ChatTranscriptTurnAnchor {
  filePaths: string[];
  id: string;
  inputContent: string;
  messageIndex: number;
  outputContent: string;
  responsePreview: string;
  title: string;
  turnNumber: number;
}

function isReplySegmentRole(role: AgentSessionItemView['role']): boolean {
  return role === 'assistant' || role === 'planner' || role === 'reviewer' || role === 'tool';
}

function normalizePreview(value: string, fallback: string): string {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();
  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.length > MAX_TURN_PREVIEW_LENGTH
    ? `${normalizedValue.slice(0, MAX_TURN_PREVIEW_LENGTH).trimEnd()}...`
    : normalizedValue;
}

function resolveFileLabel(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return '';
  }

  const pathSegments = normalizedPath.split(/[\\/]/);
  return pathSegments[pathSegments.length - 1] ?? normalizedPath;
}

export function buildChatTranscriptTurnAnchors(
  messages: readonly AgentSessionItemView[],
): ChatTranscriptTurnAnchor[] {
  const turns: ChatTranscriptTurnAnchor[] = [];
  let currentTurn: ChatTranscriptTurnAnchor | null = null;

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (!message) {
      continue;
    }

    if (message.role === 'user') {
      currentTurn = {
        filePaths: [],
        id: message.id.trim() || `turn-${messageIndex}`,
        inputContent: message.content,
        messageIndex,
        outputContent: '',
        responsePreview: '',
        title: normalizePreview(message.content, `Conversation turn ${turns.length + 1}`),
        turnNumber: turns.length + 1,
      };
      turns.push(currentTurn);
      continue;
    }

    if (!currentTurn) {
      continue;
    }

    if (isReplySegmentRole(message.role) && message.content.trim()) {
      currentTurn.outputContent = currentTurn.outputContent
        ? `${currentTurn.outputContent}\n\n${message.content}`
        : message.content;
      currentTurn.responsePreview = normalizePreview(currentTurn.outputContent, '');
    }

    for (const fileChange of message.fileChanges ?? []) {
      const fileLabel = resolveFileLabel(fileChange.path);
      if (fileLabel && !currentTurn.filePaths.includes(fileLabel)) {
        currentTurn.filePaths.push(fileLabel);
      }
    }
  }

  return turns;
}
