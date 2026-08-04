// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { AgentTurnInputQueueEntry } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

import { clearWorkbenchAgentTurnInputQueueMemory } from '../src/chat/agentTurnInputQueueStore.ts';
import {
  useAgentTurnInputQueue,
  type WorkbenchQueuedTurnDispatchOutcome,
} from '../src/hooks/useAgentTurnInputQueue.ts';

const mocks = vi.hoisted(() => ({
  ideServices: {
    agentSessionService: {} as Record<string, unknown>,
  },
}));

vi.mock('../src/context/ideServices.ts', () => ({
  useIDEServices: () => mocks.ideServices,
}));

const agentId = 'agent.codex';
const sessionId = 'session.queue.hook';
const requestedAt = '2026-07-31T00:00:00.000Z';
type QueueDispatch = (
  entry: AgentTurnInputQueueEntry,
) => Promise<WorkbenchQueuedTurnDispatchOutcome>;

function createQueueEntry(
  queueEntryId: string,
  overrides: Partial<AgentTurnInputQueueEntry> = {},
): AgentTurnInputQueueEntry {
  return {
    accessModeId: 'full_access',
    agentId,
    attachmentNames: [],
    claimExpiresAt: null,
    claimOwner: null,
    claimedAt: null,
    clientRequestId: `${queueEntryId}.v0`,
    content: `content:${queueEntryId}`,
    contentType: 'text/plain',
    createdAt: requestedAt,
    displayText: `display:${queueEntryId}`,
    driveRefs: [],
    errorCode: null,
    errorDetail: null,
    failedAt: null,
    fencingToken: '0',
    idempotencyKey: `${queueEntryId}.v0`,
    payloadHash: `sha256:${queueEntryId}`,
    position: '1',
    queueEntryId,
    requestedModelId: 'gpt-5',
    runtimeBindingId: 'runtime-binding.queue',
    sessionId,
    status: 'queued',
    turnMode: 'interactive',
    updatedAt: requestedAt,
    version: '0',
    ...overrides,
  };
}

function createPage(items: readonly AgentTurnInputQueueEntry[]) {
  return {
    items,
    pageInfo: {
      hasMore: false,
      mode: 'offset' as const,
      page: 1,
      pageSize: 32,
      total: String(items.length),
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, reject, resolve };
}

class QueueBroadcastChannelMock {
  static instances: QueueBroadcastChannelMock[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(readonly name: string) {
    QueueBroadcastChannelMock.instances.push(this);
  }

  close() {}

  postMessage(_message: unknown) {}

  emit(message: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: message }));
  }
}

function renderQueueHook(options: {
  onDispatch?: Mock<QueueDispatch>;
  scopeKey?: string;
  selectedSessionId?: string;
}) {
  const onDispatch = options.onDispatch ?? vi.fn<QueueDispatch>(async () => 'completed');
  const selectedSessionId = options.selectedSessionId ?? sessionId;
  return {
    onDispatch,
    ...renderHook(
      ({ currentSessionId }) => useAgentTurnInputQueue({
        agentId,
        disabled: false,
        isActive: true,
        isTurnBusy: false,
        onDispatch,
        scopeKey: options.scopeKey ?? currentSessionId,
        sessionId: currentSessionId,
      }),
      { initialProps: { currentSessionId: selectedSessionId } },
    ),
  };
}

beforeEach(() => {
  QueueBroadcastChannelMock.instances = [];
  vi.stubGlobal('BroadcastChannel', QueueBroadcastChannelMock);
});

afterEach(() => {
  cleanup();
  clearWorkbenchAgentTurnInputQueueMemory();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Agent Turn input queue lifecycle', () => {
  it('hydrates after a restart and serially advances completed entries', async () => {
    const first = createQueueEntry('queue-entry.first');
    const second = createQueueEntry('queue-entry.second', { position: '2' });
    const claimNext = vi.fn()
      .mockResolvedValueOnce({
        claimToken: 'claim.first',
        entry: { ...first, status: 'executing', version: '1' },
        outcome: 'claimed',
      })
      .mockResolvedValueOnce({
        claimToken: 'claim.second',
        entry: { ...second, status: 'executing', version: '1' },
        outcome: 'claimed',
      })
      .mockResolvedValueOnce({ claimToken: null, entry: null, outcome: 'empty' });
    mocks.ideServices.agentSessionService = {
      claimNextTurnInputQueueEntry: claimNext,
      listTurnInputQueueEntries: vi.fn(async () => createPage([first, second])),
    };
    const onDispatch = vi.fn<QueueDispatch>(async () => 'completed');

    clearWorkbenchAgentTurnInputQueueMemory();
    const { result } = renderQueueHook({ onDispatch });

    await waitFor(() => expect(claimNext).toHaveBeenCalledTimes(3));
    expect(onDispatch.mock.calls.map(([entry]) => entry.queueEntryId)).toEqual([
      first.queueEntryId,
      second.queueEntryId,
    ]);
    expect(result.current.isHydrated).toBe(true);
    expect(result.current.queuedTurnInputs).toEqual([]);
  });

  it('keeps an accepted but uncertain delivery executing for reconciliation', async () => {
    const entry = createQueueEntry('queue-entry.uncertain');
    const fail = vi.fn();
    const claimNext = vi.fn(async () => ({
      claimToken: 'claim.uncertain',
      entry: { ...entry, status: 'executing', version: '1' },
      outcome: 'claimed',
    }));
    mocks.ideServices.agentSessionService = {
      claimNextTurnInputQueueEntry: claimNext,
      failTurnInputQueueEntry: fail,
      listTurnInputQueueEntries: vi.fn(async () => createPage([entry])),
    };
    const onDispatch = vi.fn<QueueDispatch>(async () => 'accepted_uncertain');

    const { result } = renderQueueHook({ onDispatch });

    await waitFor(() => expect(onDispatch).toHaveBeenCalledTimes(1));
    expect(claimNext).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
    expect(result.current.queuedTurnInputs[0]).toMatchObject({
      queueEntryId: entry.queueEntryId,
      status: 'executing',
    });
  });

  it('marks a rejected dispatch failed exactly once and pauses at the failed head', async () => {
    const entry = createQueueEntry('queue-entry.rejected');
    const executing = { ...entry, status: 'executing' as const, version: '1' };
    const failed = {
      ...executing,
      errorCode: 'turn_dispatch_rejected',
      errorDetail: 'Turn delivery was rejected before authoritative acceptance.',
      failedAt: requestedAt,
      status: 'failed' as const,
      version: '2',
    };
    const claimNext = vi.fn()
      .mockResolvedValueOnce({
        claimToken: 'claim.rejected',
        entry: executing,
        outcome: 'claimed',
      })
      .mockResolvedValue({ claimToken: null, entry: failed, outcome: 'blocked' });
    const fail = vi.fn(async () => failed);
    mocks.ideServices.agentSessionService = {
      claimNextTurnInputQueueEntry: claimNext,
      failTurnInputQueueEntry: fail,
      listTurnInputQueueEntries: vi.fn(async () => createPage([entry])),
    };
    const onDispatch = vi.fn<QueueDispatch>(async () => 'rejected');

    const { result } = renderQueueHook({ onDispatch });

    await waitFor(() => expect(result.current.queuedTurnInputs[0]?.status).toBe('failed'));
    await waitFor(() => expect(claimNext).toHaveBeenCalledTimes(2));
    expect(fail).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when the authoritative queue reports a blocked head', async () => {
    const entry = createQueueEntry('queue-entry.blocked', {
      errorCode: 'turn_failed',
      status: 'failed',
      version: '1',
    });
    const claimNext = vi.fn(async () => ({
      claimToken: null,
      entry,
      outcome: 'blocked',
    }));
    mocks.ideServices.agentSessionService = {
      claimNextTurnInputQueueEntry: claimNext,
      listTurnInputQueueEntries: vi.fn(async () => createPage([entry])),
    };
    const onDispatch = vi.fn<QueueDispatch>(async () => 'completed');

    renderQueueHook({ onDispatch });

    await waitFor(() => expect(claimNext).toHaveBeenCalledTimes(1));
    expect(onDispatch).not.toHaveBeenCalled();
  });

  it('refreshes the disposable projection after another window broadcasts a mutation', async () => {
    const entry = createQueueEntry('queue-entry.broadcast');
    const list = vi.fn()
      .mockResolvedValueOnce(createPage([]))
      .mockResolvedValueOnce(createPage([entry]));
    mocks.ideServices.agentSessionService = {
      listTurnInputQueueEntries: list,
    };

    const { result } = renderHook(() => useAgentTurnInputQueue({
      agentId,
      disabled: true,
      isActive: true,
      isTurnBusy: false,
      onDispatch: vi.fn(),
      sessionId,
    }));

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(QueueBroadcastChannelMock.instances).toHaveLength(1));
    act(() => QueueBroadcastChannelMock.instances[0]?.emit({
      agentId,
      sessionId,
      sourceId: 'birdcoder-other-window',
    }));

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.queuedTurnInputs[0]?.queueEntryId)
      .toBe(entry.queueEntryId));
  });

  it('ignores an old Session refresh that resolves after identity changes', async () => {
    const oldSessionId = 'session.queue.old';
    const newSessionId = 'session.queue.new';
    const oldEntry = createQueueEntry('queue-entry.old', { sessionId: oldSessionId });
    const newEntry = createQueueEntry('queue-entry.new', { sessionId: newSessionId });
    const staleRefresh = createDeferred<ReturnType<typeof createPage>>();
    const list = vi.fn()
      .mockResolvedValueOnce(createPage([]))
      .mockImplementationOnce(() => staleRefresh.promise)
      .mockResolvedValueOnce(createPage([newEntry]));
    mocks.ideServices.agentSessionService = {
      listTurnInputQueueEntries: list,
    };

    const { rerender, result } = renderHook(
      ({ currentSessionId }) => useAgentTurnInputQueue({
        agentId,
        disabled: true,
        isActive: true,
        isTurnBusy: false,
        onDispatch: vi.fn(),
        scopeKey: 'shared-session-projection',
        sessionId: currentSessionId,
      }),
      { initialProps: { currentSessionId: oldSessionId } },
    );

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    rerender({ currentSessionId: newSessionId });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.queuedTurnInputs[0]?.queueEntryId)
      .toBe(newEntry.queueEntryId));

    await act(async () => {
      staleRefresh.resolve(createPage([oldEntry]));
      await staleRefresh.promise;
    });
    expect(result.current.queuedTurnInputs[0]?.queueEntryId).toBe(newEntry.queueEntryId);
  });

  it('keeps the latest same-Session hydration when responses resolve out of order', async () => {
    const staleEntry = createQueueEntry('queue-entry.stale-hydration');
    const latestEntry = createQueueEntry('queue-entry.latest-hydration');
    const staleRefresh = createDeferred<ReturnType<typeof createPage>>();
    const latestRefresh = createDeferred<ReturnType<typeof createPage>>();
    const list = vi.fn()
      .mockResolvedValueOnce(createPage([]))
      .mockImplementationOnce(() => staleRefresh.promise)
      .mockImplementationOnce(() => latestRefresh.promise);
    mocks.ideServices.agentSessionService = {
      listTurnInputQueueEntries: list,
    };

    const { result } = renderHook(() => useAgentTurnInputQueue({
      agentId,
      disabled: true,
      isActive: true,
      isTurnBusy: false,
      onDispatch: vi.fn(),
      sessionId,
    }));

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));

    await act(async () => {
      latestRefresh.resolve(createPage([latestEntry]));
      await latestRefresh.promise;
    });
    expect(result.current.queuedTurnInputs[0]?.queueEntryId).toBe(latestEntry.queueEntryId);

    await act(async () => {
      staleRefresh.resolve(createPage([staleEntry]));
      await staleRefresh.promise;
    });
    expect(result.current.queuedTurnInputs[0]?.queueEntryId).toBe(latestEntry.queueEntryId);
  });

  it('does not let a hydration started before a mutation overwrite its result', async () => {
    const original = createQueueEntry('queue-entry.hydrate-mutation');
    const updated = {
      ...original,
      content: 'updated authoritative content',
      displayText: 'updated display text',
      updatedAt: '2026-07-31T00:00:01.000Z',
      version: '1',
    };
    const staleRefresh = createDeferred<ReturnType<typeof createPage>>();
    const list = vi.fn()
      .mockResolvedValueOnce(createPage([original]))
      .mockImplementationOnce(() => staleRefresh.promise);
    const update = vi.fn(async () => updated);
    mocks.ideServices.agentSessionService = {
      listTurnInputQueueEntries: list,
      updateTurnInputQueueEntry: update,
    };

    const { result } = renderHook(() => useAgentTurnInputQueue({
      agentId,
      disabled: true,
      isActive: true,
      isTurnBusy: false,
      onDispatch: vi.fn(),
      sessionId,
    }));

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await act(async () => {
      await result.current.update(original, updated.content, updated.displayText);
    });
    expect(result.current.queuedTurnInputs[0]).toMatchObject({
      content: updated.content,
      version: updated.version,
    });

    await act(async () => {
      staleRefresh.resolve(createPage([original]));
      await staleRefresh.promise;
    });
    expect(result.current.queuedTurnInputs[0]).toMatchObject({
      content: updated.content,
      version: updated.version,
    });
  });

  it('suppresses a stale hydration error after the Session identity changes', async () => {
    const oldSessionId = 'session.queue.error-old';
    const newSessionId = 'session.queue.error-new';
    const staleRefresh = createDeferred<ReturnType<typeof createPage>>();
    const list = vi.fn()
      .mockResolvedValueOnce(createPage([]))
      .mockImplementationOnce(() => staleRefresh.promise)
      .mockResolvedValueOnce(createPage([]));
    const onError = vi.fn();
    mocks.ideServices.agentSessionService = {
      listTurnInputQueueEntries: list,
    };

    const { rerender, result } = renderHook(
      ({ currentSessionId }) => useAgentTurnInputQueue({
        agentId,
        disabled: true,
        isActive: true,
        isTurnBusy: false,
        onDispatch: vi.fn(),
        onError,
        scopeKey: 'shared-error-projection',
        sessionId: currentSessionId,
      }),
      { initialProps: { currentSessionId: oldSessionId } },
    );

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    rerender({ currentSessionId: newSessionId });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));

    await act(async () => {
      staleRefresh.reject(new Error('stale Session refresh failed'));
      await staleRefresh.promise.catch(() => undefined);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('pauses all claims while any queued entry is being edited and resumes afterward', async () => {
    const first = createQueueEntry('queue-entry.edit-first');
    const second = createQueueEntry('queue-entry.edit-second', { position: '2' });
    const claimNext = vi.fn(async () => ({
      claimToken: null,
      entry: null,
      outcome: 'empty' as const,
    }));
    mocks.ideServices.agentSessionService = {
      claimNextTurnInputQueueEntry: claimNext,
      listTurnInputQueueEntries: vi.fn(async () => createPage([first, second])),
    };

    const { rerender, result } = renderHook(
      ({ pausedQueueEntryId }) => useAgentTurnInputQueue({
        agentId,
        disabled: false,
        isActive: true,
        isTurnBusy: false,
        onDispatch: vi.fn(),
        pausedQueueEntryId,
        sessionId,
      }),
      { initialProps: { pausedQueueEntryId: second.queueEntryId as string | null } },
    );

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(claimNext).not.toHaveBeenCalled();
    rerender({ pausedQueueEntryId: null });
    await waitFor(() => expect(claimNext).toHaveBeenCalledTimes(1));
  });

  it('reuses a stable queue entry ID only for retries of the same create action', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error('first create response was lost'))
      .mockRejectedValueOnce(new Error('second create response was lost'))
      .mockImplementation(async (
        _identity: unknown,
        request: { content: string; queueEntryId: string },
      ) => createQueueEntry(request.queueEntryId, {
        content: request.content,
        displayText: request.content,
      }));
    mocks.ideServices.agentSessionService = {
      createTurnInputQueueEntry: create,
      listTurnInputQueueEntries: vi.fn(async () => createPage([])),
    };
    const { result } = renderHook(() => useAgentTurnInputQueue({
      agentId,
      disabled: true,
      isActive: true,
      isTurnBusy: false,
      onDispatch: vi.fn(),
      sessionId,
    }));
    const firstRequest = { content: 'first action', turnMode: 'interactive' as const };
    const secondRequest = { content: 'second action', turnMode: 'interactive' as const };

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await act(async () => {
      await expect(result.current.enqueue(firstRequest)).rejects.toThrow('response was lost');
    });
    await act(async () => {
      await expect(result.current.enqueue(secondRequest)).rejects.toThrow('response was lost');
    });
    await act(async () => {
      await result.current.enqueue(secondRequest);
    });
    await act(async () => {
      await result.current.enqueue(secondRequest);
    });

    const queueEntryIds = create.mock.calls.map(([, request]) => request.queueEntryId as string);
    expect(queueEntryIds[0]).toMatch(/^queue-entry\./);
    expect(queueEntryIds[1]).not.toBe(queueEntryIds[0]);
    expect(queueEntryIds[2]).toBe(queueEntryIds[1]);
    expect(queueEntryIds[3]).not.toBe(queueEntryIds[2]);
  });
});
