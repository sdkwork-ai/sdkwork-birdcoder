import { describe, expect, it, vi } from 'vitest';

import {
  BirdCoderAgentSessionService,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService';

const completedAt = '2026-01-01T00:00:00.000Z';
const agentId = 'agent.code-engine.codex';
const runtimeBindingId = 'runtime-binding.codex';
const sessionId = 'session.test';

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

    await expect(service.submitTurn(sessionId, {
      content: ' hello ',
      runtimeBindingId: ` ${runtimeBindingId} `,
      requestedModelId: ' codex-default ',
      turnMode: 'interactive',
    }, {
      agentId,
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
        content: 'hello',
        idempotencyKey: expect.any(String),
        payloadHash: expect.stringMatching(/^sha256:/u),
        requestedAt: expect.any(String),
        requestedModelId: 'codex-default',
        runtimeBindingId,
        turnMode: 'interactive',
      }),
      { stream: true },
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

  it.each([
    ['codex', 'codex-default'],
    ['claude-code', 'claude-default'],
    ['opencode', 'opencode-default'],
    ['gemini-cli', 'gemini-default'],
  ])('submits %s turns through the Session-bound Agent and Runtime Binding', async (
    engineId,
    modelId,
  ) => {
    const providerAgentId = `agent.code-engine.${engineId}`;
    const providerRuntimeBindingId = `runtime-binding.${engineId}`;
    const completion = createTurnCompletion({
      agentId: providerAgentId,
      runtimeBindingId: providerRuntimeBindingId,
    });
    const { service, stream } = createService([completionEvent(completion)]);

    await expect(service.submitTurn(sessionId, {
      content: `use ${engineId}`,
      requestedModelId: modelId,
      runtimeBindingId: providerRuntimeBindingId,
    }, { agentId: providerAgentId })).resolves.toBe(completion);
    expect(stream).toHaveBeenCalledWith(
      providerAgentId,
      sessionId,
      expect.objectContaining({
        requestedModelId: modelId,
        runtimeBindingId: providerRuntimeBindingId,
      }),
      { stream: true },
      { signal: undefined, timeout: undefined },
    );
  });

  it('isolates presentation observer failures from the accepted command', async () => {
    const completion = createTurnCompletion();
    const { service } = createService([
      { eventType: 'delta', index: 0, delta: 'hello' },
      completionEvent(completion),
    ]);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, {
      agentId,
      onAccepted: () => {
        throw new Error('acceptance observer failed');
      },
      onDelta: () => {
        throw new Error('presentation failed');
      },
    })).resolves.toBe(completion);
  });

  it('does not report authority acceptance for malformed stream events', async () => {
    const { service } = createService([{ eventType: 'unexpected' }]);
    const onAccepted = vi.fn();

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId, onAccepted })).rejects.toThrow('unsupported event type');
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('rejects missing command identity before opening the stream', async () => {
    const { service, stream } = createService([completionEvent()]);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
    }, { agentId })).rejects.toThrow(
      'Agent runtime binding ID is required for turn submission.',
    );
    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId: ' ' })).rejects.toThrow(
      'Agent ID is required for turn submission.',
    );
    expect(stream).not.toHaveBeenCalled();
  });

  it('rejects an Agent mismatch remembered from the canonical Session', async () => {
    const retrieve = vi.fn(async () => ({ agentId, sessionId }));
    const stream = vi.fn(async () => createEventStream([completionEvent()]));
    const service = new BirdCoderAgentSessionService({
      agentId,
      client: {
        ai: { agents: { sessions: { retrieve }, turns: { stream } } },
      } as never,
    });
    await service.getSession(sessionId);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId: 'agent.code-engine.claude-code' })).rejects.toThrow(
      `Agent session ${sessionId} belongs to Agent "${agentId}"`,
    );
    expect(stream).not.toHaveBeenCalled();
  });

  it('rejects a stream that ends without completion', async () => {
    const { service } = createService([
      { eventType: 'delta', index: 0, delta: 'hello' },
    ]);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId })).rejects.toThrow(
      'Agents turn stream ended without a completion event.',
    );
  });

  it.each([
    { events: [{ eventType: 'delta', index: 1, delta: 'late' }] },
    { events: [
      { eventType: 'delta', index: 0, delta: 'first' },
      { eventType: 'delta', index: 0, delta: 'duplicate' },
    ] },
    { events: [{ eventType: 'delta', index: 0 }] },
  ])('rejects missing, duplicate, or out-of-order deltas %#', async ({ events }) => {
    const { service } = createService(events);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId })).rejects.toThrow(/missing or out of order/u);
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

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId })).rejects.toThrow(/completion/u);
  });

  it('rejects events emitted after completion', async () => {
    const { service } = createService([
      completionEvent(),
      { eventType: 'delta', index: 0, delta: 'late' },
    ]);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId })).rejects.toThrow(
      'Agents turn stream emitted an event after completion.',
    );
  });

  it.each([
    createTurnCompletion({ agentId: 'agent.code-engine.claude-code' }),
    createTurnCompletion({ sessionId: 'session.other' }),
    createTurnCompletion({ itemSessionId: 'session.other' }),
    createTurnCompletion({ runtimeBindingId: 'runtime-binding.other' }),
  ])('rejects completion identity drift %#', async (completion) => {
    const { service } = createService([completionEvent(completion)]);

    await expect(service.submitTurn(sessionId, {
      content: 'hello',
      runtimeBindingId,
    }, { agentId })).rejects.toThrow(/identity|another session|runtime binding/u);
  });
});
