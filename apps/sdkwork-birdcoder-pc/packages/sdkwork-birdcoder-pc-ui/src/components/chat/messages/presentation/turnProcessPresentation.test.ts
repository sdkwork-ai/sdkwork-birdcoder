import { describe, expect, it } from 'vitest';
import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { resolveChatTurnProcessPresentations } from './turnProcessPresentation.ts';

function createMessage(
  id: string,
  role: AgentSessionItemView['role'],
  content: string,
  metadata: Record<string, unknown> = {},
): AgentSessionItemView {
  return {
    id,
    sessionId: 'session-1',
    turnId: 'turn-1',
    role,
    content,
    metadata,
    createdAt: `2026-08-01T00:00:0${id.length}.000Z`,
    completedAt: `2026-08-01T00:00:1${id.length}.000Z`,
  };
}

describe('resolveChatTurnProcessPresentations', () => {
  it('folds Codex commentary into the process disclosure anchored on final_answer', () => {
    const messages = [
      createMessage('user', 'user', 'Inspect the Session.'),
      createMessage('commentary', 'assistant', 'I am checking the provider response.', {
        providerMessageCompleted: true,
        providerMessagePhase: 'commentary',
      }),
      createMessage('final', 'assistant', 'The Session is aligned.', {
        providerMessageCompleted: true,
        providerMessagePhase: 'final_answer',
      }),
    ];

    const presentations = resolveChatTurnProcessPresentations(messages, {
      engineId: 'codex',
    });

    expect(presentations[1]).toEqual({ suppressProcessBlocks: true });
    expect(presentations[2]?.process?.targetIndex).toBe(2);
    expect(presentations[2]?.process?.items).toEqual([
      expect.objectContaining({
        sourceIndex: 1,
        view: expect.objectContaining({
          blocks: [expect.objectContaining({
            type: 'markdown',
            content: 'I am checking the provider response.',
          })],
        }),
      }),
    ]);
  });

  it('uses a commentary-only active turn as the process anchor without a primary reply', () => {
    const messages = [
      createMessage('user', 'user', 'Inspect the Session.'),
      {
        ...createMessage('commentary', 'assistant', 'Still checking.', {
          providerMessageCompleted: false,
          providerMessagePhase: 'commentary',
        }),
        completedAt: undefined,
      },
    ];

    const presentations = resolveChatTurnProcessPresentations(messages, {
      engineId: 'codex',
      isLive: true,
    });

    expect(presentations[1]?.process).toEqual(expect.objectContaining({
      isActive: true,
      targetIndex: 1,
    }));
    expect(presentations[1]?.suppressProcessBlocks).toBe(true);
  });
});
