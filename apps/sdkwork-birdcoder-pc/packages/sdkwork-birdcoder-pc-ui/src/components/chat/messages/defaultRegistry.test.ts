import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { resolveAgentSessionItemPresentation } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { describe, expect, it } from 'vitest';
import { defaultChatMessageRendererRegistry } from './defaultRegistry.ts';

function createRuntimeMessage(overrides: Partial<AgentSessionItemView>): AgentSessionItemView {
  return {
    content: 'Provider-specific content',
    createdAt: '2026-07-30T00:00:00.000Z',
    id: 'item-1',
    role: 'assistant',
    sessionId: 'session-1',
    ...overrides,
  };
}

describe('defaultChatMessageRendererRegistry', () => {
  it('renders an unrecognized provider item kind as unsupported content', () => {
    const view = resolveAgentSessionItemPresentation(createRuntimeMessage({
      metadata: { agentItemKind: 'provider_future_event' },
    }));

    expect(view.kind).toBe('unsupported');
    expect(defaultChatMessageRendererRegistry.resolve(view).id).toBe('unsupported');
  });

  it('renders an unrecognized runtime role as unsupported content', () => {
    const view = resolveAgentSessionItemPresentation(createRuntimeMessage({
      role: 'future-role' as AgentSessionItemView['role'],
    }));

    expect(view.kind).toBe('unsupported');
    expect(defaultChatMessageRendererRegistry.resolve(view).id).toBe('unsupported');
  });
});
