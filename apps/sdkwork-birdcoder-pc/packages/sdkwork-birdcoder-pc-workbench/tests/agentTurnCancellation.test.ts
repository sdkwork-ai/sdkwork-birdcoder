import { describe, expect, it, vi } from 'vitest';

import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';

const agentId = 'agent.codex';
const sessionId = 'session.cancel';
const turnId = 'turn.cancel';
const requestedAt = '2026-07-31T00:00:00.000Z';

function createCancelledTurn(overrides: {
  agentId?: string;
  sessionId?: string;
  turnId?: string;
} = {}) {
  return {
    agentId: overrides.agentId ?? agentId,
    sessionId: overrides.sessionId ?? sessionId,
    turnId: overrides.turnId ?? turnId,
    status: 'cancelled',
    version: '2',
    updatedAt: requestedAt,
    cancelledAt: requestedAt,
  };
}

describe('BirdCoderAgentSessionService turn cancellation', () => {
  it('uses the generated Agents App SDK and preserves the canonical Session identity', async () => {
    const cancel = vi.fn(async () => createCancelledTurn());
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turns: { cancel } } },
      } as never,
    });
    const request = {
      expectedVersion: '1',
      requestedAt,
    };

    await expect(service.cancelTurn({ agentId, sessionId }, turnId, request))
      .resolves.toMatchObject({ status: 'cancelled', turnId });
    expect(cancel).toHaveBeenCalledWith(agentId, sessionId, turnId, request);
  });

  it('rejects a cancellation response for another Session', async () => {
    const cancel = vi.fn(async () => createCancelledTurn({
      sessionId: 'session.other',
    }));
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turns: { cancel } } },
      } as never,
    });

    await expect(service.cancelTurn({ agentId, sessionId }, turnId, {
      expectedVersion: '1',
      requestedAt,
    })).rejects.toThrow('does not match the requested nested resource');
  });
});
