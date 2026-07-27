import { describe, expect, it, vi } from 'vitest';

import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';

const completedAt = '2026-01-01T00:00:00.000Z';

function createTurnCompletion() {
  const session = {
    sessionId: 'session.test',
    agentId: 'agent.birdcoder',
  };
  const turn = {
    turnId: 'turn.test',
    status: 'completed',
    updatedAt: completedAt,
    completedAt,
  };
  const items = [{
    sessionId: session.sessionId,
    itemId: 'item.test',
    kind: 'user_input',
    status: 'completed',
    sequence: '1',
    content: 'hello',
    createdAt: completedAt,
  }];
  return { session, turn, items };
}

function createService(response: unknown) {
  const post = vi.fn(async () => response);
  return {
    post,
    service: new BirdCoderAgentSessionService({
      client: { http: { post } } as never,
    }),
  };
}

describe('Agent turn completion contract', () => {
  it('returns a complete SDK turn response', async () => {
    const completion = createTurnCompletion();
    const { post, service } = createService(completion);

    await expect(service.submitTurn('session.test', {
      content: ' hello ',
      turnMode: 'interactive',
    })).resolves.toBe(completion);
    expect(post).toHaveBeenCalledWith(
      '/app/v3/api/ai/agents/agent.birdcoder/sessions/session.test/turns',
      expect.objectContaining({ content: 'hello', turnMode: 'interactive' }),
      { stream: false },
      undefined,
      'application/json',
    );
  });

  it.each([
    undefined,
    { ok: true },
    { session: {}, turn: {} },
    { session: {}, items: [] },
    { turn: {}, items: [] },
  ])('rejects an incomplete SDK turn response %#', async (response) => {
    const { service } = createService(response);

    await expect(service.submitTurn('session.test', {
      content: 'hello',
      turnMode: 'interactive',
    })).rejects.toThrow(
      'Agents turn completion response is missing its session, turn, or session items.',
    );
  });
});
