import { describe, expect, it } from 'vitest';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { updateAgentSessionUserState } from '../src/services/agentSessionUserStateUpdate.ts';

type AgentSessionUserStateRecord = Awaited<
  ReturnType<IAgentSessionService['updateSessionUserState']>
>;

function userState(
  overrides: Partial<AgentSessionUserStateRecord> = {},
): AgentSessionUserStateRecord {
  return {
    id: '1',
    tenantId: '100001',
    organizationId: '0',
    userId: '100001',
    resourceType: 'session',
    resourceId: 'session.alpha',
    version: '0',
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('Agent Session user-state updates', () => {
  it('sends the current user-state version when unpinning an existing session', async () => {
    const requests: unknown[] = [];
    const existingState = userState({
      pinnedAt: '2026-07-27T00:00:00.000Z',
    });
    const service = {
      async getSessionUserStates(identities: readonly unknown[]) {
        expect(identities).toEqual([{
          agentId: 'agent.provider.codex',
          sessionId: 'session.alpha',
        }]);
        return new Map([['session.alpha', existingState]]);
      },
      async updateSessionUserState(identity: unknown, request: unknown) {
        requests.push({ identity, request });
        return userState({
          version: '1',
          updatedAt: '2026-07-27T00:01:00.000Z',
        });
      },
    } as unknown as IAgentSessionService;

    const updated = await updateAgentSessionUserState(
      service,
      { agentId: 'agent.provider.codex', sessionId: 'session.alpha' },
      { lastItemSequence: '3' },
      { pinned: false },
    );

    expect(requests).toEqual([{
      identity: {
        agentId: 'agent.provider.codex',
        sessionId: 'session.alpha',
      },
      request: {
        expectedVersion: '0',
        pinned: false,
      },
    }]);
    expect(updated).toMatchObject({
      resourceId: 'session.alpha',
      version: '1',
    });
    expect(updated.pinnedAt).toBeUndefined();
  });

  it('omits expectedVersion when the first pin creates user state', async () => {
    const requests: unknown[] = [];
    const service = {
      async getSessionUserStates() {
        return new Map<string, AgentSessionUserStateRecord>();
      },
      async updateSessionUserState(identity: unknown, request: unknown) {
        requests.push({ identity, request });
        return userState({ pinnedAt: '2026-07-27T00:00:00.000Z' });
      },
    } as unknown as IAgentSessionService;

    await updateAgentSessionUserState(
      service,
      { agentId: 'agent.provider.opencode', sessionId: 'session.alpha' },
      { lastItemSequence: '0' },
      { pinned: true },
    );

    expect(requests).toEqual([{
      identity: {
        agentId: 'agent.provider.opencode',
        sessionId: 'session.alpha',
      },
      request: { pinned: true },
    }]);
  });
});
