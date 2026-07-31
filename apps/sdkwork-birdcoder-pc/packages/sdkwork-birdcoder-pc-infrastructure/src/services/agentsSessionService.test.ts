import { describe, expect, it, vi } from 'vitest';

import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

import { BirdCoderAgentSessionService } from './agentsSessionService.ts';

const identity = {
  agentId: 'agent.code-engine.codex',
  sessionId: 'session.queue-hydration',
};

function createService(list: ReturnType<typeof vi.fn>): BirdCoderAgentSessionService {
  return new BirdCoderAgentSessionService({
    client: {
      ai: { agents: { turnInputQueueEntries: { list } } },
    } as unknown as AgentsAppSdkClient,
  });
}

describe('BirdCoderAgentSessionService Turn input queue hydration', () => {
  it.each([
    ['undefined data', undefined],
    ['null data', null],
    ['empty data', {}],
    ['generic empty success data', { ok: true }],
  ])('rejects %s instead of inventing an empty Session queue page', async (_label, response) => {
    const list = vi.fn().mockResolvedValue(response);
    const service = createService(list);

    await expect(service.listTurnInputQueueEntries(identity)).rejects.toThrow(
      'Agents Turn input queue returned an invalid page payload.',
    );
  });

  it('preserves a canonical generated SDK queue page', async () => {
    const page = {
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 32,
        totalItems: '0',
        totalPages: 0,
      },
    };
    const list = vi.fn().mockResolvedValue(page);
    const service = createService(list);

    await expect(service.listTurnInputQueueEntries(identity)).resolves.toBe(page);
    expect(list).toHaveBeenCalledWith(
      identity.agentId,
      identity.sessionId,
      { page: 1, pageSize: 32 },
      { signal: undefined, timeout: undefined },
    );
  });

  it.each([
    ['cursor mode', { hasMore: false, mode: 'cursor', page: 1, pageSize: 32 }],
    ['non-initial page', { hasMore: false, mode: 'offset', page: 2, pageSize: 32 }],
    ['unexpected page size', { hasMore: false, mode: 'offset', page: 1, pageSize: 31 }],
    ['missing continuation state', { mode: 'offset', page: 1, pageSize: 32 }],
  ])('rejects %s queue metadata as an incomplete Session snapshot', async (_label, pageInfo) => {
    const service = createService(vi.fn().mockResolvedValue({ items: [], pageInfo }));

    await expect(service.listTurnInputQueueEntries(identity)).rejects.toThrow(
      'Agents Turn input queue returned an invalid page payload.',
    );
  });

  it('rejects a non-empty queue result without canonical page metadata', async () => {
    const service = createService(vi.fn().mockResolvedValue({
      items: [{
        agentId: identity.agentId,
        queueEntryId: 'queue-entry.malformed-page',
        sessionId: identity.sessionId,
      }],
    }));

    await expect(service.listTurnInputQueueEntries(identity)).rejects.toThrow(
      'Agents Turn input queue returned an invalid page payload.',
    );
  });
});
