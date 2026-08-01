import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AgentTurnInputQueueEntry } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';
import {
  clearWorkbenchAgentTurnInputQueueMemory,
  MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_PER_SCOPE,
  removeWorkbenchQueuedAgentTurnInputProjection,
  setWorkbenchQueuedAgentTurnInputs,
  upsertWorkbenchQueuedAgentTurnInput,
} from '../src/chat/agentTurnInputQueueStore';

const agentId = 'agent.code-engine.codex';
const sessionId = 'session.queue';
const identity = { agentId, sessionId };
const requestedAt = '2026-07-31T00:00:00.000Z';

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
    runtimeBindingId: 'runtime_binding.queue',
    sessionId,
    status: 'queued',
    turnMode: 'interactive',
    updatedAt: requestedAt,
    version: '0',
    ...overrides,
  };
}

afterEach(() => {
  clearWorkbenchAgentTurnInputQueueMemory();
});

describe('Agent Turn input queue SDK adapter', () => {
  it('uses generated queue methods and validates nested response identity', async () => {
    const entry = createQueueEntry('queue-entry.sdk');
    const list = vi.fn(async () => ({
      items: [entry],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 32,
        totalItems: '1',
        totalPages: 1,
      },
    }));
    const create = vi.fn(async () => entry);
    const claimNext = vi.fn(async () => ({
      claimToken: 'claim-token',
      entry: { ...entry, status: 'executing' },
      outcome: 'claimed',
    }));
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turnInputQueueEntries: { claimNext, create, list } } },
      } as never,
    });

    await expect(service.listTurnInputQueueEntries(identity)).resolves.toMatchObject({
      items: [{ queueEntryId: entry.queueEntryId }],
    });
    await expect(service.createTurnInputQueueEntry(identity, {
      content: entry.content,
      queueEntryId: entry.queueEntryId,
      requestedAt,
      turnMode: 'interactive',
    })).resolves.toMatchObject({ queueEntryId: entry.queueEntryId });
    await expect(service.claimNextTurnInputQueueEntry(identity, {
      claimOwner: 'birdcoder-window',
      requestedAt,
    })).resolves.toMatchObject({ outcome: 'claimed' });

    expect(list).toHaveBeenCalledWith(agentId, sessionId, { page: 1, pageSize: 32 }, {});
    expect(create).toHaveBeenCalledWith(
      agentId,
      sessionId,
      expect.objectContaining({
        content: entry.content,
        queueEntryId: entry.queueEntryId,
      }),
      {},
    );
    expect(claimNext).toHaveBeenCalledWith(
      agentId,
      sessionId,
      expect.objectContaining({ claimOwner: 'birdcoder-window' }),
      {},
    );
  });

  it('rejects a queue response from another Session', async () => {
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: {
          agents: {
            turnInputQueueEntries: {
              list: vi.fn(async () => ({
                items: [createQueueEntry('queue-entry.other', { sessionId: 'session.other' })],
                pageInfo: {
                  hasMore: false,
                  mode: 'offset',
                  page: 1,
                  pageSize: 32,
                  totalItems: '1',
                  totalPages: 1,
                },
              })),
            },
          },
        },
      } as never,
    });

    await expect(service.listTurnInputQueueEntries(identity)).rejects.toThrow(
      'does not match the requested nested resource',
    );
  });

  it('propagates the authoritative queue idempotency pair into Turn submission', async () => {
    const stream = vi.fn(async (
      _agentId: string,
      _sessionId: string,
      command: Record<string, unknown>,
    ) => (async function* events() {
      yield {
        eventType: 'completion',
        response: {
          code: 0,
          data: {
            item: {
              items: [{
                content: 'queued content',
                createdAt: requestedAt,
                itemId: 'item.queue',
                kind: 'user_input',
                sequence: '1',
                sessionId,
                status: 'completed',
              }],
              session: { agentId, sessionId },
              turn: {
                agentId,
                completedAt: requestedAt,
                runtimeBindingId: 'runtime_binding.queue',
                sessionId,
                status: 'completed',
                turnId: command.turnId,
                updatedAt: requestedAt,
              },
            },
          },
          traceId: 'trace.queue',
        },
      };
    })());
    const service = new BirdCoderAgentSessionService({
      client: { ai: { agents: { turns: { stream } } } } as never,
    });

    await service.submitTurn(identity, {
      clientRequestId: 'queue-entry.submit.v1',
      content: 'queued content',
      idempotencyKey: 'queue-entry.submit.v1',
      payloadHash: 'sha256:authoritative-queue-payload',
      runtimeBindingId: 'runtime_binding.queue',
      turnMode: 'interactive',
    }, {});

    expect(stream).toHaveBeenCalledWith(
      agentId,
      sessionId,
      expect.objectContaining({
        idempotencyKey: 'queue-entry.submit.v1',
        payloadHash: 'sha256:authoritative-queue-payload',
      }),
      { eventProtocol: 'kernel-v1', stream: true },
      {},
    );
    await expect(service.submitTurn(identity, {
      content: 'invalid pair',
      idempotencyKey: 'queue-entry.submit.v2',
      runtimeBindingId: 'runtime_binding.queue',
    }, {})).rejects.toThrow('must be supplied together');
  });
});

describe('Agent Turn input queue remote projection', () => {
  it('replaces, version-upserts, orders, and removes entries by stable ID', () => {
    const second = createQueueEntry('queue-entry.second', { position: '2' });
    const first = createQueueEntry('queue-entry.first', { position: '1' });
    expect(setWorkbenchQueuedAgentTurnInputs(sessionId, [second])).toEqual([second]);

    expect(upsertWorkbenchQueuedAgentTurnInput(sessionId, first).map(
      (entry) => entry.queueEntryId,
    )).toEqual(['queue-entry.first', 'queue-entry.second']);

    const executing = { ...first, fencingToken: '1', status: 'executing' as const, version: '1' };
    expect(upsertWorkbenchQueuedAgentTurnInput(sessionId, executing)[0]).toMatchObject({
      fencingToken: '1',
      queueEntryId: first.queueEntryId,
      status: 'executing',
      version: '1',
    });
    expect(removeWorkbenchQueuedAgentTurnInputProjection(
      sessionId,
      first.queueEntryId,
    ).map((entry) => entry.queueEntryId)).toEqual(['queue-entry.second']);
  });

  it('preserves snapshot identity only when the complete authoritative entry is unchanged', () => {
    const original = createQueueEntry('queue-entry.snapshot');
    const firstSnapshot = setWorkbenchQueuedAgentTurnInputs(sessionId, [original]);
    const equivalentSnapshot = setWorkbenchQueuedAgentTurnInputs(sessionId, [{
      ...original,
      attachmentNames: [...original.attachmentNames],
      driveRefs: [...original.driveRefs],
    }]);
    expect(equivalentSnapshot).toBe(firstSnapshot);

    const changedSnapshot = setWorkbenchQueuedAgentTurnInputs(sessionId, [{
      ...original,
      content: 'changed without a version bump',
    }]);
    expect(changedSnapshot).not.toBe(firstSnapshot);
    expect(changedSnapshot[0]?.content).toBe('changed without a version bump');
  });

  it('enforces the Session projection budget using UTF-8 bytes', () => {
    const multibyteContent = '\u754c'.repeat(
      Math.floor(MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_PER_SCOPE / 3),
    );
    expect(() => setWorkbenchQueuedAgentTurnInputs(sessionId, [createQueueEntry(
      'queue-entry.multibyte-budget',
      { content: multibyteContent },
    )])).toThrow('UTF-8 byte budget');
  });

  it('releases incremental global budget on scope removal and full memory clear', () => {
    const largeContent = 'x'.repeat(3 * 1_048_576);
    for (let index = 0; index < 5; index += 1) {
      setWorkbenchQueuedAgentTurnInputs(`session.queue.budget.${index}`, [createQueueEntry(
        `queue-entry.budget.${index}`,
        { content: largeContent, sessionId: `session.queue.budget.${index}` },
      )]);
    }
    expect(() => setWorkbenchQueuedAgentTurnInputs('session.queue.budget.5', [createQueueEntry(
      'queue-entry.budget.5',
      { content: largeContent, sessionId: 'session.queue.budget.5' },
    )])).toThrow('global UTF-8 byte budget');

    setWorkbenchQueuedAgentTurnInputs('session.queue.budget.0', []);
    expect(() => setWorkbenchQueuedAgentTurnInputs('session.queue.budget.5', [createQueueEntry(
      'queue-entry.budget.5',
      { content: largeContent, sessionId: 'session.queue.budget.5' },
    )])).not.toThrow();

    clearWorkbenchAgentTurnInputQueueMemory();
    expect(() => setWorkbenchQueuedAgentTurnInputs('session.queue.budget.after-clear', [
      createQueueEntry('queue-entry.budget.after-clear', {
        content: largeContent,
        sessionId: 'session.queue.budget.after-clear',
      }),
    ])).not.toThrow();
  });
});
