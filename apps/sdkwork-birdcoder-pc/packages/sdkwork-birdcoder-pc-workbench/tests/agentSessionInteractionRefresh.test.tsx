// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAgentSessionPendingInteractions } from '../src/hooks/useAgentSessionInteractions.ts';

const mocks = vi.hoisted(() => {
  const getSession = vi.fn();
  const listInteractions = vi.fn();
  return {
    getSession,
    ideServices: {
      agentSessionService: { getSession, listInteractions },
      authService: {},
    },
    listInteractions,
  };
});

vi.mock('../src/context/ideServices.ts', () => ({
  useIDEServices: () => mocks.ideServices,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Agent Session Interaction refresh', () => {
  it('keeps the last authoritative pending snapshot when a refresh fails', async () => {
    const refreshFailure = new Error('Interaction authority is unavailable.');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getSession.mockResolvedValue({ projectId: 'project.interactions' });
    mocks.listInteractions
      .mockResolvedValueOnce({
        items: [{
          createdAt: '2026-07-31T00:00:00.000Z',
          interactionId: 'interaction.approval',
          kind: 'approval',
          options: [],
          prompt: 'Allow this command?',
          sessionId: 'session.interactions',
          status: 'pending',
          version: '1',
        }],
        pageInfo: {
          hasMore: false,
          mode: 'offset',
          page: 1,
          pageSize: 200,
        },
      })
      .mockRejectedValueOnce(refreshFailure);

    const { rerender, result } = renderHook(
      ({ refreshToken }) => useAgentSessionPendingInteractions(
        { agentId: 'agent.codex', sessionId: 'session.interactions' },
        refreshToken,
        'project.interactions\u0001session.interactions',
        'project.interactions',
      ),
      { initialProps: { refreshToken: 0 } },
    );

    await waitFor(() => {
      expect(result.current.approvals).toHaveLength(1);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ refreshToken: 1 });

    await waitFor(() => {
      expect(result.current.error).toBe(refreshFailure);
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.approvals.map(({ interactionId }) => interactionId))
      .toEqual(['interaction.approval']);

    let resolveRetry!: (value: unknown) => void;
    mocks.listInteractions.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRetry = resolve;
    }));
    rerender({ refreshToken: 2 });

    await waitFor(() => {
      expect(result.current.error).toBe(refreshFailure);
      expect(result.current.isLoading).toBe(true);
    });

    resolveRetry({
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 200,
      },
    });
    await waitFor(() => {
      expect(result.current.approvals).toHaveLength(0);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
