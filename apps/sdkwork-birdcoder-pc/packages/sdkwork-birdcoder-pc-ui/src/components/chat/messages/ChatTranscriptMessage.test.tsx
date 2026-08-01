// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from './types.ts';
import { ChatTranscriptMessage } from './ChatTranscriptMessage.tsx';

afterEach(cleanup);

function createMessage(
  id: string,
  content: string,
  phase: 'commentary' | 'final_answer',
): AgentSessionItemView {
  return {
    id,
    sessionId: 'session-1',
    turnId: 'turn-1',
    role: 'assistant',
    content,
    metadata: {
      providerMessageCompleted: true,
      providerMessagePhase: phase,
    },
    createdAt: '2026-08-01T00:00:00.000Z',
    completedAt: '2026-08-01T00:00:01.000Z',
  };
}

function createContext(
  message: AgentSessionItemView,
  suppressProcessBlocks: boolean,
): ChatMessageRenderContext {
  return {
    actionTarget: null,
    allMessages: [message],
    copyMessageToClipboard: () => undefined,
    engineId: 'codex',
    environment: null,
    expandedDisclosureKeys: new Set(),
    index: 0,
    layout: 'main',
    renderMarkdownContent: (content) => <span>{content}</span>,
    sessionId: 'session-1',
    showMessageActions: false,
    suppressProcessBlocks,
    toggleDisclosure: () => undefined,
    turn: {
      isActiveTail: false,
      isEnd: true,
      isStart: true,
      key: 'turn-1',
      position: 'only',
    },
  };
}

describe('ChatTranscriptMessage', () => {
  it('removes Codex commentary Markdown from the primary transcript after process grouping', () => {
    const message = createMessage('commentary-1', 'Provider commentary', 'commentary');
    const { container } = render(
      <ChatTranscriptMessage
        activitySummary={null}
        context={createContext(message, true)}
        engineId="codex"
        index={0}
        layout="main"
        message={message}
        sessionId="session-1"
      />,
    );

    expect(screen.queryByText('Provider commentary')).toBeNull();
    expect(container.querySelector('[data-chat-process-source-hidden="true"]')).toBeTruthy();
  });

  it('keeps Codex final_answer Markdown in the primary transcript', () => {
    const message = createMessage('final-answer-1', 'Provider final answer', 'final_answer');
    render(
      <ChatTranscriptMessage
        activitySummary={null}
        context={createContext(message, true)}
        engineId="codex"
        index={0}
        layout="main"
        message={message}
        sessionId="session-1"
      />,
    );

    expect(screen.getByText('Provider final answer')).toBeTruthy();
  });
});
