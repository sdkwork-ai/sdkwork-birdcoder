import { describe, expect, it, vi } from 'vitest';

import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';

const completedAt = '2026-01-01T00:00:00.000Z';
const agentId = 'agent.codex';
const runtimeBindingId = 'runtime-binding.codex';
const sessionId = 'session.test';
const identity = { agentId, sessionId };

function createTurnCompletion(overrides: {
  agentId?: string;
  itemSessionId?: string;
  runtimeBindingId?: string;
  sessionId?: string;
  turnId?: string;
} = {}) {
  const resolvedAgentId = overrides.agentId ?? agentId;
  const resolvedSessionId = overrides.sessionId ?? sessionId;
  const session = {
    sessionId: resolvedSessionId,
    agentId: resolvedAgentId,
  };
  const turn = {
    turnId: overrides.turnId ?? 'turn.test',
    sessionId: resolvedSessionId,
    agentId: resolvedAgentId,
    runtimeBindingId: overrides.runtimeBindingId ?? runtimeBindingId,
    status: 'completed',
    updatedAt: completedAt,
    completedAt,
  };
  const items = [{
    sessionId: overrides.itemSessionId ?? resolvedSessionId,
    itemId: 'item.test',
    kind: 'user_input',
    status: 'completed',
    sequence: '1',
    content: 'hello',
    createdAt: completedAt,
  }];
  return { session, turn, items };
}

function completionEvent(completion = createTurnCompletion()) {
  return {
    eventType: 'completion',
    response: {
      code: 0,
      data: { item: completion },
      traceId: 'trace.test',
    },
  };
}

function runtimeEvent(overrides: {
  itemId?: string | null;
  payload?: Record<string, unknown>;
  providerSessionId?: string | null;
  sequence?: number;
  sessionId?: string;
  turnId?: string;
} = {}) {
  const itemId = overrides.itemId === undefined ? 'provider-item.test' : overrides.itemId;
  const providerSessionId = overrides.providerSessionId === undefined
    ? 'provider-session.test'
    : overrides.providerSessionId;
  return {
    eventType: 'event',
    event: {
      eventId: `event.test.${overrides.sequence ?? 0}`,
      type: 'agent.message.updated',
      version: '1.0.0',
      sequence: overrides.sequence ?? 0,
      occurredAt: completedAt,
      source: 'model',
      severity: 'info',
      sessionId: overrides.sessionId ?? sessionId,
      turnId: overrides.turnId ?? 'turn.test',
      providerSessionId,
      taskId: null,
      runId: 'model-request.test',
      itemId,
      traceContext: null,
      correlationId: 'model-request.test',
      causationId: null,
      redactionClassification: 'tenant_sensitive',
      payloadSchema: 'sdkwork.agent.provider_stream_event.v1',
      payload: overrides.payload ?? {
        item: itemId ? { id: itemId, text: 'hello', type: 'agent_message' } : null,
        providerEventType: 'item.updated',
        providerId: 'codex',
        sequence: overrides.sequence ?? 0,
      },
      replay: false,
    },
  };
}

async function* createEventStream(events: readonly unknown[]) {
  for (const event of events) {
    yield event;
  }
}

function createService(events: readonly unknown[]) {
  const stream = vi.fn(async () => createEventStream(events));
  return {
    stream,
    service: new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turns: { stream } } },
      } as never,
    }),
  };
}

function createRecoveredCompletion(status: 'completed' | 'failed' = 'completed') {
  const base = createTurnCompletion();
  const turn = {
    ...base.turn,
    requestItemId: 'item.user',
    responseItemId: status === 'completed' ? 'item.assistant' : null,
    status,
  };
  const items = [
    {
      ...base.items[0],
      itemId: 'item.user',
      turnId: turn.turnId,
    },
    ...(status === 'completed'
      ? [{
          ...base.items[0],
          content: 'hello back',
          itemId: 'item.assistant',
          kind: 'assistant_output',
          sequence: '2',
          turnId: turn.turnId,
        }]
      : []),
  ];
  return { session: base.session, turn, items };
}

type RecoveryTurn = Omit<
  ReturnType<typeof createRecoveredCompletion>['turn'],
  'status'
> & {
  status: 'requested' | 'running' | 'completed' | 'failed' | 'cancelled';
};

function createRecoveryService({
  completion,
  retrieveTurns,
  stream,
}: {
  completion: ReturnType<typeof createRecoveredCompletion>;
  retrieveTurns: readonly RecoveryTurn[];
  stream: () => Promise<AsyncIterable<unknown>>;
}) {
  let retrieveIndex = 0;
  const retrieveTurn = vi.fn(async () => {
    const turn = retrieveTurns[Math.min(retrieveIndex, retrieveTurns.length - 1)];
    retrieveIndex += 1;
    return turn;
  });
  const retrieveSession = vi.fn(async () => completion.session);
  const listItems = vi.fn(async () => ({
    items: completion.items,
    pageInfo: {
      hasMore: false,
      mode: 'cursor' as const,
      nextCursor: null,
      pageSize: 200,
    },
  }));
  const retrieveItem = vi.fn(async (
    _agentId: string,
    _sessionId: string,
    itemId: string,
  ) => {
    const item = completion.items.find((candidate) => candidate.itemId === itemId);
    if (!item) {
      throw Object.assign(new Error('Agent Session Item not found'), { status: 404 });
    }
    return item;
  });
  const post = vi.fn(async () => {
    throw new Error('Non-streaming response was unavailable.');
  });
  return {
    listItems,
    post,
    retrieveSession,
    retrieveTurn,
    service: new BirdCoderAgentSessionService({
      client: {
        http: { post },
        ai: {
          agents: {
            sessions: { retrieve: retrieveSession },
            sessionItems: { list: listItems, retrieve: retrieveItem },
            turns: { retrieve: retrieveTurn, stream },
          },
        },
      } as never,
      turnRecoveryMaxAttempts: Math.max(1, retrieveTurns.length),
      turnRecoveryPollIntervalMs: 0,
    }),
  };
}

describe('Agent turn streaming completion contract', () => {
  it('streams ordered deltas and returns the authoritative completion', async () => {
    const completion = createTurnCompletion();
    const { service, stream } = createService([
      { eventType: 'delta', index: 0, delta: 'hel' },
      { eventType: 'delta', index: 1, delta: 'lo' },
      completionEvent(completion),
    ]);
    const onAccepted = vi.fn();
    const onDelta = vi.fn();
    const controller = new AbortController();

    await expect(service.submitTurn(identity, {
      accessModeId: ' full_access ',
      content: ' hello ',
      driveRefs: [{
        driveNodeId: ' node-design ',
        driveSpaceId: ' space-project ',
        resourceRole: 'image',
      }] as never,
      runtimeBindingId: ` ${runtimeBindingId} `,
      requestedModelId: ' codex-default ',
      turnMode: 'interactive',
    }, {
      onAccepted,
      onDelta,
      signal: controller.signal,
      timeoutMs: 45_000,
    })).resolves.toBe(completion);

    expect(stream).toHaveBeenCalledWith(
      agentId,
      sessionId,
      expect.objectContaining({
        clientRequestId: expect.any(String),
        accessModeId: 'full_access',
        content: 'hello',
        driveRefs: [{
          driveNodeId: 'node-design',
          driveSpaceId: 'space-project',
          resourceRole: 'image',
        }],
        idempotencyKey: expect.any(String),
        payloadHash: expect.stringMatching(/^sha256:/u),
        requestedAt: expect.any(String),
        requestedModelId: 'codex-default',
        runtimeBindingId,
        turnMode: 'interactive',
      }),
      { eventProtocol: 'kernel-v1', stream: true },
      { signal: controller.signal, timeout: 45_000 },
    );
    expect(onDelta).toHaveBeenNthCalledWith(1, {
      content: 'hel',
      delta: 'hel',
      index: 0,
    });
    expect(onDelta).toHaveBeenNthCalledWith(2, {
      content: 'hello',
      delta: 'lo',
      index: 1,
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('delivers deltas before the completion gate releases and submit settles', async () => {
    const completion = createTurnCompletion();
    let releaseCompletion!: () => void;
    const completionGate = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    const stream = vi.fn(async () => (async function* gatedStream() {
      yield { eventType: 'delta', index: 0, delta: 'hello' };
      await completionGate;
      yield completionEvent(completion);
    })());
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turns: { stream } } },
      } as never,
    });
    const onAccepted = vi.fn();
    const onDelta = vi.fn();
    let settled = false;

    const submission = service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, { onAccepted, onDelta }).finally(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(onDelta).toHaveBeenCalledWith({
        content: 'hello',
        delta: 'hello',
        index: 0,
      });
    });
    expect(settled).toBe(false);
    expect(onAccepted).toHaveBeenCalledTimes(1);

    releaseCompletion();

    await expect(submission).resolves.toBe(completion);
    expect(settled).toBe(true);
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('accepts ordered runtime events after validating Session, Turn, and provider item identity', async () => {
    const completion = createTurnCompletion();
    const firstEvent = runtimeEvent();
    const secondEvent = runtimeEvent({
      itemId: 'provider-command.test',
      payload: {
        item: {
          aggregated_output: 'passed',
          command: 'pnpm test',
          id: 'provider-command.test',
          status: 'completed',
          type: 'command_execution',
        },
        providerEventType: 'item.completed',
        providerId: 'codex',
        sequence: 1,
      },
      sequence: 1,
    });
    const { service } = createService([
      firstEvent,
      secondEvent,
      completionEvent(completion),
    ]);
    const onRuntimeEvent = vi.fn();
    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, { onRuntimeEvent })).resolves.toBe(completion);
    expect(onRuntimeEvent).toHaveBeenNthCalledWith(1, firstEvent.event);
    expect(onRuntimeEvent).toHaveBeenNthCalledWith(2, secondEvent.event);
  });

  it('rejects a runtime event whose provider item identity conflicts with its envelope', async () => {
    const { service } = createService([
      runtimeEvent({
        payload: {
          item: { id: 'provider-item.other', type: 'agent_message' },
        },
      }),
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, {})).rejects.toThrow(
      'Agents turn runtime event item identity does not match its envelope.',
    );
  });

  it('rejects non-JSON runtime payloads without recursively serializing them', async () => {
    const payload: Record<string, unknown> = {};
    payload.self = payload;
    const { service } = createService([
      runtimeEvent({ payload }),
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, {})).rejects.toThrow('Agents turn runtime event payload is malformed.');
  });

  it('rejects a runtime payload before retaining content beyond the per-event budget', async () => {
    const { service } = createService([
      runtimeEvent({
        payload: {
          text: 'x'.repeat(4 * 1_048_576),
        },
      }),
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, {})).rejects.toThrow(
      'Agents turn runtime event payload exceeds the presentation limit.',
    );
  });

  it.each([
    ['source', 'future-source', 'Runtime event source is malformed.'],
    ['severity', 'verbose', 'Runtime event severity is malformed.'],
    [
      'redactionClassification',
      'unclassified',
      'Runtime event redaction classification is malformed.',
    ],
    ['replay', 'false', 'Runtime event replay marker is malformed.'],
    ['occurredAt', 'not-a-timestamp', 'Runtime event timestamp is malformed.'],
    ['traceContext', {}, 'Runtime event trace context is malformed.'],
    ['providerSessionId', undefined, 'Provider Session ID is malformed.'],
  ])('rejects a malformed runtime event %s field', async (field, value, message) => {
    const malformedEvent = runtimeEvent();
    Object.assign(malformedEvent.event, { [field]: value });
    const { service } = createService([malformedEvent]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, {})).rejects.toThrow(message);
  });

  it.each([
    ['codex', 'codex-default'],
    ['claude-code', 'claude-default'],
    ['opencode', 'opencode-default'],
    ['gemini-cli', 'gemini-default'],
  ])('submits %s turns through the Session-bound Agent and Runtime Binding', async (
    engineId,
    modelId,
  ) => {
    const providerAgentId = `agent.${engineId}`;
    const providerHostBindingId = `runtime-binding.${engineId}`;
    const completion = createTurnCompletion({
      agentId: providerAgentId,
      runtimeBindingId: providerHostBindingId,
    });
    const { service, stream } = createService([completionEvent(completion)]);

    await expect(service.submitTurn({ agentId: providerAgentId, sessionId }, {
      content: `use ${engineId}`,
      requestedModelId: modelId,
      runtimeBindingId: providerHostBindingId,
    }, {})).resolves.toBe(completion);
    expect(stream).toHaveBeenCalledWith(
      providerAgentId,
      sessionId,
      expect.objectContaining({
        requestedModelId: modelId,
        runtimeBindingId: providerHostBindingId,
      }),
      { eventProtocol: 'kernel-v1', stream: true },
      { signal: undefined, timeout: undefined },
    );
  });

  it('isolates presentation observer failures from the accepted command', async () => {
    const completion = createTurnCompletion();
    const { service } = createService([
      { eventType: 'delta', index: 0, delta: 'hello' },
      runtimeEvent(),
      completionEvent(completion),
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.test',
    }, {
      onAccepted: () => {
        throw new Error('acceptance observer failed');
      },
      onDelta: () => {
        throw new Error('presentation failed');
      },
      onRuntimeEvent: () => {
        throw new Error('runtime event presentation failed');
      },
    })).resolves.toBe(completion);
  });

  it('retrieves and cancels the exact canonical Turn with optimistic fencing', async () => {
    const activeTurn = {
      ...createTurnCompletion().turn,
      status: 'running',
      version: '7',
    } as const;
    const cancelledTurn = {
      ...activeTurn,
      status: 'cancelled',
      version: '8',
    } as const;
    const retrieve = vi.fn(async () => activeTurn);
    const cancel = vi.fn(async () => cancelledTurn);
    const service = new BirdCoderAgentSessionService({
      client: {
        ai: { agents: { turns: { cancel, retrieve } } },
      } as never,
    });
    const controller = new AbortController();

    await expect(service.getTurn(identity, ' turn.test ', {
      signal: controller.signal,
      timeoutMs: 5_000,
    })).resolves.toBe(activeTurn);
    await expect(service.cancelTurn(identity, ' turn.test ', {
      expectedVersion: '7',
      requestedAt: completedAt,
    })).resolves.toBe(cancelledTurn);
    expect(retrieve).toHaveBeenCalledWith(
      agentId,
      sessionId,
      'turn.test',
      { signal: controller.signal, timeout: 5_000 },
    );
    expect(cancel).toHaveBeenCalledWith(
      agentId,
      sessionId,
      'turn.test',
      { expectedVersion: '7', requestedAt: completedAt },
    );
  });

  it('does not report authority acceptance for malformed stream events', async () => {
    const { service } = createService([{ eventType: 'unexpected' }]);
    const onAccepted = vi.fn();

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, { onAccepted })).rejects.toThrow('unsupported event type');
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('rejects missing command identity before opening the stream', async () => {
    const { service, stream } = createService([completionEvent()]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
    }, {})).rejects.toThrow(
      'Agent runtime binding ID is required for turn submission.',
    );
    await expect(service.submitTurn({ agentId: ' ', sessionId }, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(
      'require both Agent and Session identities',
    );
    expect(stream).not.toHaveBeenCalled();
  });

  it('rejects oversized turn input before opening the stream', async () => {
    const { service, stream } = createService([completionEvent()]);

    await expect(service.submitTurn(identity, {
      content: 'x'.repeat(1_048_577),
      runtimeBindingId,
    }, {})).rejects.toThrow('1048576 characters or fewer');
    expect(stream).not.toHaveBeenCalled();
  });

  it('rejects too many Drive references before opening the stream', async () => {
    const { service, stream } = createService([completionEvent()]);

    await expect(service.submitTurn(identity, {
      content: 'review the attachments',
      driveRefs: Array.from({ length: 65 }, (_, index) => ({
        driveNodeId: `node-${index}`,
        driveSpaceId: 'space-test',
      })) as never,
      runtimeBindingId,
    }, {})).rejects.toThrow('at most 64 Drive references');
    expect(stream).not.toHaveBeenCalled();
  });

  it('bounds cumulative stream content before retaining another oversized delta', async () => {
    const { service } = createService([
      { eventType: 'delta', index: 0, delta: 'a'.repeat(700_000) },
      { eventType: 'delta', index: 1, delta: 'b'.repeat(400_000) },
    ]);
    const onDelta = vi.fn();

    await expect(service.submitTurn(identity, {
      content: 'stream a bounded answer',
      runtimeBindingId,
    }, { onDelta })).rejects.toThrow(
      'stream exceeded the maximum Session Item size',
    );
    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta.mock.calls[0]?.[0].content).toHaveLength(700_000);
  });

  it('routes the same Session ID through each explicitly selected provider Agent', async () => {
    const providerAgentIds = [
      agentId,
      'agent.claude-code',
      'agent.opencode',
    ] as const;
    const retrieve = vi.fn(async (
      requestedAgentId: string,
      requestedSessionId: string,
    ) => ({ agentId: requestedAgentId, sessionId: requestedSessionId }));
    const stream = vi.fn(async (
      requestedAgentId: string,
      requestedSessionId: string,
    ) => createEventStream([completionEvent(createTurnCompletion({
      agentId: requestedAgentId,
      sessionId: requestedSessionId,
    }))]));
    const service = new BirdCoderAgentSessionService({
      agentId,
      client: {
        ai: { agents: { sessions: { retrieve }, turns: { stream } } },
      } as never,
    });

    for (const providerAgentId of providerAgentIds) {
      const providerIdentity = { agentId: providerAgentId, sessionId };
      await expect(service.getSession(providerIdentity)).resolves.toMatchObject(
        providerIdentity,
      );
      await expect(service.submitTurn(providerIdentity, {
        content: 'hello',
        runtimeBindingId,
      }, {})).resolves.toMatchObject({ session: providerIdentity });
    }

    expect(retrieve.mock.calls.map(([requestedAgentId]) => requestedAgentId)).toEqual(
      providerAgentIds,
    );
    expect(stream.mock.calls.map(([requestedAgentId]) => requestedAgentId)).toEqual(
      providerAgentIds,
    );
  });

  it('rejects a stream that ends without completion', async () => {
    const { service } = createService([
      { eventType: 'delta', index: 0, delta: 'hello' },
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(
      'Agents turn stream ended without a completion event.',
    );
  });

  it.each([
    { events: [{ eventType: 'delta', index: 1, delta: 'late' }] },
    { events: [{ eventType: 'delta', index: 0, delta: '' }] },
    { events: [
      { eventType: 'delta', index: 0, delta: 'first' },
      { eventType: 'delta', index: 0, delta: 'duplicate' },
    ] },
    { events: [{ eventType: 'delta', index: 0 }] },
  ])('rejects missing, duplicate, or out-of-order deltas %#', async ({ events }) => {
    const { service } = createService(events);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(/missing or out of order/u);
  });

  it.each([
    { eventType: 'completion' },
    { eventType: 'completion', response: { code: 1, data: {} } },
    { eventType: 'completion', response: { code: 0, data: {} } },
    {
      eventType: 'completion',
      response: { code: 0, data: { item: { session: {}, turn: {} } } },
    },
  ])('rejects a malformed completion event %#', async (event) => {
    const { service } = createService([event]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(/completion/u);
  });

  it('rejects events emitted after completion', async () => {
    const { service } = createService([
      completionEvent(),
      { eventType: 'delta', index: 0, delta: 'late' },
    ]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(
      'Agents turn stream emitted an event after completion.',
    );
  });

  it('falls back to the SDK non-streaming completion with the same command identity', async () => {
    const completion = createTurnCompletion({ turnId: 'turn.non-stream' });
    const stream = vi.fn(async (
      _agentId: string,
      _sessionId: string,
      _command: unknown,
    ) => {
      throw new Error('SSE transport is unavailable.');
    });
    const request = vi.fn(async (
      _path: string,
      _options: unknown,
    ) => completion);
    const service = new BirdCoderAgentSessionService({
      client: {
        http: { request },
        ai: { agents: { turns: { stream } } },
      } as never,
    });
    const onAccepted = vi.fn();

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.non-stream',
    }, { onAccepted })).resolves.toBe(completion);

    const streamedCommand = stream.mock.calls[0]?.[2];
    const requestOptions = request.mock.calls[0]?.[1] as {
      body?: unknown;
      contentType?: string;
      method?: string;
      sdkworkUnwrapKind?: string;
    } | undefined;
    const replayedCommand = requestOptions?.body;
    expect(replayedCommand).toEqual(streamedCommand);
    expect(request.mock.calls[0]?.[0]).toBe(
      `/app/v3/api/ai/agents/${encodeURIComponent(identity.agentId)}/sessions/${encodeURIComponent(identity.sessionId)}/turns?stream=false`,
    );
    expect(requestOptions).toMatchObject({
      contentType: 'application/json',
      method: 'POST',
      sdkworkUnwrapKind: 'item',
    });
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('recovers an interrupted stream by polling the turn and replaying Session Items', async () => {
    const completion = createRecoveredCompletion();
    const runningTurn = { ...completion.turn, status: 'running' as const };
    const stream = vi.fn(async () => (async function* interruptedStream() {
      yield { eventType: 'delta', index: 0, delta: 'hello' };
      throw new Error('SSE connection reset.');
    })());
    const recovery = createRecoveryService({
      completion,
      retrieveTurns: [runningTurn, completion.turn],
      stream,
    });
    const onAccepted = vi.fn();
    const onDelta = vi.fn();

    await expect(recovery.service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: completion.turn.turnId,
    }, { onAccepted, onDelta })).resolves.toEqual(completion);

    expect(recovery.retrieveTurn).toHaveBeenCalledTimes(2);
    expect(recovery.listItems).toHaveBeenCalledWith(
      agentId,
      sessionId,
      { cursor: undefined, pageSize: 200, sort: '-sequence' },
      { signal: undefined, timeout: undefined },
    );
    expect(onDelta).toHaveBeenCalledWith({ content: 'hello', delta: 'hello', index: 0 });
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('returns failed terminal turns with their authoritative user Session Item', async () => {
    const completion = createRecoveredCompletion('failed');
    const stream = vi.fn(async () => {
      throw new Error('SSE response was lost.');
    });
    const recovery = createRecoveryService({
      completion,
      retrieveTurns: [completion.turn],
      stream,
    });

    await expect(recovery.service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: completion.turn.turnId,
    }, {})).resolves.toEqual(completion);
  });

  it('preserves the original transport error when neither delivery path accepted the turn', async () => {
    const stream = vi.fn(async () => {
      throw new Error('Initial turn request failed.');
    });
    const post = vi.fn(async () => {
      throw new Error('Non-streaming turn request failed.');
    });
    const retrieve = vi.fn(async () => {
      throw Object.assign(new Error('Agent turn not found'), { status: 404 });
    });
    const service = new BirdCoderAgentSessionService({
      client: {
        http: { post },
        ai: { agents: { turns: { retrieve, stream } } },
      } as never,
      turnRecoveryMaxAttempts: 10,
      turnRecoveryPollIntervalMs: 0,
    });
    const onAccepted = vi.fn();

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.not-accepted',
    }, { onAccepted })).rejects.toThrow('Initial turn request failed.');
    expect(retrieve).toHaveBeenCalledTimes(5);
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('reports uncertain delivery when authority recovery is unavailable', async () => {
    const stream = vi.fn(async () => {
      throw new Error('SSE network failure.');
    });
    const post = vi.fn(async () => {
      throw new Error('JSON completion network failure.');
    });
    const retrieve = vi.fn(async () => {
      throw new Error('Turn recovery network failure.');
    });
    const service = new BirdCoderAgentSessionService({
      client: {
        http: { post },
        ai: { agents: { turns: { retrieve, stream } } },
      } as never,
      turnRecoveryMaxAttempts: 2,
      turnRecoveryPollIntervalMs: 0,
    });
    const onAccepted = vi.fn();
    const onDeliveryUncertain = vi.fn();

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
      turnId: 'turn.uncertain',
    }, {
      onAccepted,
      onDeliveryUncertain,
    })).rejects.toThrow('delivery could not be confirmed');
    expect(onAccepted).not.toHaveBeenCalled();
    expect(onDeliveryUncertain).toHaveBeenCalledTimes(1);
  });

  it.each([
    createTurnCompletion({ agentId: 'agent.claude-code' }),
    createTurnCompletion({ sessionId: 'session.other' }),
    createTurnCompletion({ itemSessionId: 'session.other' }),
    createTurnCompletion({ runtimeBindingId: 'runtime-binding.other' }),
  ])('rejects completion identity drift %#', async (completion) => {
    const { service } = createService([completionEvent(completion)]);

    await expect(service.submitTurn(identity, {
      content: 'hello',
      runtimeBindingId,
    }, {})).rejects.toThrow(/identity|another session|runtime binding/u);
  });
});

describe('Agent session user-state resource bounds', () => {
  it('rejects unbounded input and limits concurrent SDK batches', async () => {
    let activeRequests = 0;
    let maximumConcurrentRequests = 0;
    const list = vi.fn(async (
      _agentId: string,
      request: { pageSize: number },
    ) => {
      activeRequests += 1;
      maximumConcurrentRequests = Math.max(maximumConcurrentRequests, activeRequests);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      activeRequests -= 1;
      return {
        items: [],
        pageInfo: {
          hasMore: false,
          mode: 'offset',
          page: 1,
          pageSize: request.pageSize,
        },
      };
    });
    const service = new BirdCoderAgentSessionService({
      agentId,
      client: {
        ai: { agents: { sessionUserStates: { list } } },
      } as never,
    });

    await expect(service.getSessionUserStates(
      Array.from({ length: 1_001 }, (_, index) => ({
        agentId,
        sessionId: `session-${index}`,
      })),
    )).rejects.toThrow('at most 1000 Session ids');
    expect(list).not.toHaveBeenCalled();

    await expect(service.getSessionUserStates(
      Array.from({ length: 500 }, (_, index) => ({
        agentId,
        sessionId: `session-${index}`,
      })),
    )).resolves.toEqual(new Map());
    expect(list).toHaveBeenCalledTimes(5);
    expect(maximumConcurrentRequests).toBe(4);
  });

  it('batches user-state reads by each explicit provider Agent', async () => {
    const list = vi.fn(async (_requestedAgentId: string) => ({
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 1,
      },
    }));
    const service = new BirdCoderAgentSessionService({
      agentId: 'agent.default',
      client: {
        ai: { agents: { sessionUserStates: { list } } },
      } as never,
    });
    const identities = [
      { agentId, sessionId: 'session.codex' },
      { agentId: 'agent.claude-code', sessionId: 'session.claude' },
      { agentId: 'agent.opencode', sessionId: 'session.opencode' },
    ];

    await expect(service.getSessionUserStates(identities)).resolves.toEqual(new Map());

    expect(list).toHaveBeenCalledTimes(3);
    for (const providerIdentity of identities) {
      expect(list).toHaveBeenCalledWith(
        providerIdentity.agentId,
        expect.objectContaining({ sessionIds: providerIdentity.sessionId }),
        { signal: undefined, timeout: undefined },
      );
    }
    expect(list.mock.calls.map(([requestedAgentId]) => requestedAgentId)).not.toContain(
      'agent.default',
    );
  });
});
