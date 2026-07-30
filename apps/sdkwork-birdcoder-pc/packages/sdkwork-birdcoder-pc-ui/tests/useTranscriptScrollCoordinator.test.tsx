// @vitest-environment jsdom

import { act } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTranscriptScrollCoordinator } from '../src/components/useTranscriptScrollCoordinator.ts';

afterEach(() => {
  cleanup();
});

describe('useTranscriptScrollCoordinator', () => {
  it('does not publish a redundant hidden state during a session scope switch', () => {
    const scrollContainer = document.createElement('div');
    Object.defineProperties(scrollContainer, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const scrollContainerRef = { current: scrollContainer };
    let renderCount = 0;

    const { rerender, result } = renderHook(
      ({ scopeKey }: { scopeKey: string }) => {
        renderCount += 1;
        return useTranscriptScrollCoordinator({
          isActive: true,
          latestMessageContentLength: 7,
          latestMessageIdentity: `message:${scopeKey}`,
          messageCount: 1,
          scopeKey,
          scrollContainerRef,
        });
      },
      { initialProps: { scopeKey: 'session.one' } },
    );

    scrollContainer.scrollTop = 0;
    act(() => {
      result.current.pauseFollowing();
    });
    expect(result.current.jumpToLatestVisible).toBe(true);

    const renderCountBeforeScopeSwitch = renderCount;
    rerender({ scopeKey: 'session.two' });

    expect(result.current.jumpToLatestVisible).toBe(false);
    expect(renderCount).toBe(renderCountBeforeScopeSwitch + 1);
  });
});
