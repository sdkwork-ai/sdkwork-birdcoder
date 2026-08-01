// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveAgentSessionItemPresentation,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import { AssistantReplyMessageRenderer } from './ReplyMessageRenderers.tsx';

afterEach(cleanup);

function createMessage(providerMessageCompleted: boolean): AgentSessionItemView {
  return {
    id: 'assistant-message-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    role: 'assistant',
    content: 'Provider response',
    metadata: {
      providerMessageCompleted,
      providerMessagePhase: 'final_answer',
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    ...(providerMessageCompleted
      ? { completedAt: '2026-08-01T00:00:01.000Z' }
      : {}),
  };
}

function createContext(message: AgentSessionItemView): ChatMessageRenderContext {
  return {
    actionTarget: null,
    allMessages: [message],
    copyMessageToClipboard: () => undefined,
    engineId: 'codex',
    environment: {
      addToast: () => undefined,
      onRegenerateMessage: () => undefined,
      skills: [],
      t: (key) => ({
        'chat.assistantLabel': 'Assistant',
        'chat.messageRegenerate': 'Regenerate response',
        'common.copy': 'Copy',
      })[key] ?? key,
    },
    expandedDisclosureKeys: new Set(),
    index: 0,
    layout: 'main',
    renderMarkdownContent: (content) => <span>{content}</span>,
    sessionId: 'session-1',
    showMessageActions: true,
    toggleDisclosure: () => undefined,
    turn: {
      isActiveTail: !message.completedAt,
      isEnd: true,
      isStart: true,
      key: 'turn-1',
      position: 'only',
    },
  };
}

describe('AssistantReplyMessageRenderer', () => {
  it('keeps Codex response actions hidden while the provider message is streaming', () => {
    const message = createMessage(false);
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    expect(screen.getByText('Provider response')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Regenerate response' })).toBeNull();
  });

  it('exposes Codex response actions after the provider message completes', () => {
    const message = createMessage(true);
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Regenerate response' })).toBeTruthy();
  });
});
