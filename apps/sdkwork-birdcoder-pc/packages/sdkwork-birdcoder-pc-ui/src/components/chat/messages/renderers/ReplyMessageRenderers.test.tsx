// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveAgentSessionItemPresentation,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageRenderContext } from '../types.ts';
import {
  AssistantReplyMessageRenderer,
  UserTextMessageRenderer,
} from './ReplyMessageRenderers.tsx';

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

function createContext(
  message: AgentSessionItemView,
  onRateMessage?: (
    messageId: string,
    rating: 'thumbs_up' | 'thumbs_down' | null,
  ) => void,
  onForkMessage?: (messageId: string) => void,
  beginEditingMessage?: (messageId: string, content: string) => void,
): ChatMessageRenderContext {
  return {
    actionTarget: null,
    allMessages: [message],
    copyMessageToClipboard: async () => true,
    engineId: 'codex',
    environment: {
      addToast: () => undefined,
      onRateMessage,
      onForkMessage,
      beginEditingMessage,
      onRegenerateMessage: () => undefined,
      skills: [],
      t: (key) => ({
        'chat.assistantLabel': 'Assistant',
        'chat.conversationRoleHeadingAssistant': 'ChatGPT said:',
        'chat.conversationRoleHeadingUser': 'You said:',
        'common.copy': 'Copy',
        'chat.messageCopyLabel': 'Copy message',
        'chat.messageCopiedLabel': 'Copied',
        'chat.messageGoodResponse': 'Good response',
        'chat.messageBadResponse': 'Bad response',
        'chat.messageFork': 'Continue in new chat from here',
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
        context={createContext(message, () => undefined)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    expect(screen.getByText('Provider response')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
  });

  it('exposes the Codex copy action after the provider message completes', async () => {
    const message = createMessage(true);
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message, () => undefined)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ChatGPT said:' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy());
  });

  it('exposes assistant rating actions and forwards the selected rating', () => {
    const message = createMessage(true);
    const ratings: Array<string | null> = [];
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message, (_messageId, rating) => ratings.push(rating))}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    // Codex desktop opens the feedback reason dialog after the thumbs
    // selection; the rating is committed when the dialog is submitted.
    fireEvent.click(screen.getByRole('button', { name: 'Good response' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'chat.turnRatingSolvedMyTask' }));
    fireEvent.click(screen.getByRole('button', { name: 'chat.turnRatingSubmit' }));
    expect(ratings).toEqual(['thumbs_up']);

    fireEvent.click(screen.getByRole('button', { name: 'Bad response' }));
    fireEvent.click(screen.getByRole('radio', { name: 'chat.turnRatingIncorrectOrIncomplete' }));
    fireEvent.click(screen.getByRole('button', { name: 'chat.turnRatingSubmit' }));
    expect(ratings).toEqual(['thumbs_up', 'thumbs_down']);

    // Re-selecting the active rating clears it without opening the dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Bad response' }));
    expect(ratings).toEqual(['thumbs_up', 'thumbs_down', null]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bad response' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('hydrates a persisted assistant rating as an accessible pressed action', () => {
    const message = createMessage(true);
    message.metadata = { ...message.metadata, assistantRating: 'up' };
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message, () => undefined)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Good response' }).getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('exposes the Codex continue-in-new-chat action for a completed response', () => {
    const message = createMessage(true);
    const forked: string[] = [];
    render(
      <AssistantReplyMessageRenderer
        context={createContext(message, undefined, (messageId) => forked.push(messageId))}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue in new chat from here' }));
    expect(forked).toEqual(['assistant-message-1']);
  });
});

describe('UserTextMessageRenderer', () => {
  it('uses the Codex user bubble marker and keeps compact actions in the bubble row', () => {
    const message: AgentSessionItemView = {
      id: 'user-message-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      role: 'user',
      content: 'User request',
      createdAt: '2026-08-01T00:00:00.000Z',
      completedAt: '2026-08-01T00:00:00.000Z',
    };
    const { container } = render(
      <UserTextMessageRenderer
        context={createContext(message)}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    const bubble = container.querySelector('[data-user-message-bubble="true"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.parentElement?.className).toContain('items-center');
    expect(bubble?.parentElement?.querySelector('[aria-label="Copy message"]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'You said:' })).toBeTruthy();
  });

  it('matches Codex compact user actions and opens editing by double-clicking the focusable bubble', () => {
    const message: AgentSessionItemView = {
      id: 'user-message-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      role: 'user',
      content: 'User request',
      createdAt: '2026-08-01T00:00:00.000Z',
      completedAt: '2026-08-01T00:00:00.000Z',
    };
    const editRequests: Array<[string, string]> = [];
    const { container } = render(
      <UserTextMessageRenderer
        context={createContext(
          message,
          undefined,
          undefined,
          (messageId, content) => editRequests.push([messageId, content]),
        )}
        view={resolveAgentSessionItemPresentation(message, { engineId: 'codex' })}
      />,
    );

    const bubble = container.querySelector<HTMLElement>('[data-user-message-bubble="true"]');
    expect(bubble?.tabIndex).toBe(0);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();

    fireEvent.doubleClick(bubble!);
    expect(editRequests).toEqual([['user-message-1', 'User request']]);
  });
});
