import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { describe, expect, it } from 'vitest';

import {
  MAX_NON_VIRTUALIZED_MESSAGE_COUNT,
  MIN_VIRTUALIZED_MESSAGE_COUNT,
  resolveVirtualizedTranscriptWindow,
  type VirtualizedTranscriptWindowState,
} from '../src/components/transcriptVirtualization.ts';

function createMessages(
  count: number,
  highVariance = false,
): AgentSessionItemView[] {
  return Array.from({ length: count }, (_value, index) => ({
    content: `Message ${index + 1}`,
    createdAt: new Date(index * 1_000).toISOString(),
    id: `session.one.item.${index + 1}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    sessionId: 'session.one',
    ...(highVariance && index % 2 === 1
      ? { tool_calls: [{ id: `tool.${index}`, name: 'run' }] }
      : {}),
  }));
}

function resolveWindow(
  messages: readonly AgentSessionItemView[],
  scrollTop = 0,
): VirtualizedTranscriptWindowState {
  const prefixHeights = Array.from({ length: messages.length + 1 }, (_v, i) => i * 64);
  return resolveVirtualizedTranscriptWindow({
    isActive: true,
    messages,
    prefixHeights,
    viewport: { clientHeight: 600, scrollTop },
  });
}

describe('resolveVirtualizedTranscriptWindow (H3 hard render budget)', () => {
  it('renders short lists fully', () => {
    const state = resolveWindow(createMessages(MIN_VIRTUALIZED_MESSAGE_COUNT));
    expect(state.visibleMessages).toHaveLength(MIN_VIRTUALIZED_MESSAGE_COUNT);
    expect(state.paddingTop).toBe(0);
    expect(state.paddingBottom).toBe(0);
  });

  it('renders high-variance lists fully within the hard budget', () => {
    const messages = createMessages(MAX_NON_VIRTUALIZED_MESSAGE_COUNT, true);
    const state = resolveWindow(messages);
    expect(state.visibleMessages).toHaveLength(MAX_NON_VIRTUALIZED_MESSAGE_COUNT);
    expect(state.paddingTop).toBe(0);
    expect(state.paddingBottom).toBe(0);
  });

  it('virtualizes high-variance lists once the hard budget is exceeded', () => {
    const messages = createMessages(MAX_NON_VIRTUALIZED_MESSAGE_COUNT + 1, true);
    const totalHeight = messages.length * 64;
    const state = resolveWindow(messages, Math.floor(totalHeight / 2));
    expect(state.visibleMessages.length).toBeLessThan(messages.length);
    expect(state.paddingTop).toBeGreaterThan(0);
    expect(state.paddingBottom).toBeGreaterThan(0);
  });

  it('virtualizes plain long lists regardless of row shape', () => {
    const messages = createMessages(MAX_NON_VIRTUALIZED_MESSAGE_COUNT + 1);
    const totalHeight = messages.length * 64;
    const state = resolveWindow(messages, Math.floor(totalHeight / 2));
    expect(state.visibleMessages.length).toBeLessThan(messages.length);
    expect(state.paddingTop).toBeGreaterThan(0);
    expect(state.paddingBottom).toBeGreaterThan(0);
  });
});
