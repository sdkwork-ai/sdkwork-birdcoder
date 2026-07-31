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

const agentId = 'agent.code-engine.codex';
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
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
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
});
