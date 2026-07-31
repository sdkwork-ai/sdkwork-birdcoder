// @vitest-environment jsdom

import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { describe, expect, it } from 'vitest';

import { useProgressiveTranscriptWindow } from '../src/components/useProgressiveTranscriptWindow.ts';

function createMessages(count: number, sessionId = 'session.one'): AgentSessionItemView[] {
  return Array.from({ length: count }, (_value, index) => ({
    content: `Message ${index + 1}`,
    createdAt: new Date(index * 1_000).toISOString(),
    id: `${sessionId}.item.${index + 1}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    sessionId,
  }));
}

describe('useProgressiveTranscriptWindow', () => {
  it('preserves the expanded window when a session scope arrives before remote prepend', () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const allMessages = createMessages(97);
    const latestMessages = allMessages.slice(-47);
    const props: {
      messages: readonly AgentSessionItemView[];
      scopeKey: string;
    } = {
      messages: latestMessages,
      scopeKey: '',
    };
    const { rerender, result } = renderHook(() => useProgressiveTranscriptWindow(
      props.messages,
      scrollContainerRef,
      true,
      props.scopeKey,
    ));

    expect(result.current.renderedMessages).toHaveLength(47);

    props.scopeKey = 'project.one\u0001session.one';
    rerender();
    expect(result.current.renderedMessages).toHaveLength(47);

    props.messages = allMessages;
    rerender();
    expect(result.current.visibleTranscriptStartIndex).toBe(0);
    expect(result.current.renderedMessages).toHaveLength(97);
  });

  it('starts a newly selected large transcript at its latest bounded window', () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    const props = {
      messages: createMessages(47),
      scopeKey: 'project.one\u0001session.one',
    };
    const { rerender, result } = renderHook(() => useProgressiveTranscriptWindow(
      props.messages,
      scrollContainerRef,
      true,
      props.scopeKey,
    ));

    props.messages = createMessages(97, 'session.two');
    props.scopeKey = 'project.one\u0001session.two';
    rerender();

    expect(result.current.visibleTranscriptStartIndex).toBe(49);
    expect(result.current.renderedMessages).toHaveLength(48);
  });
});
