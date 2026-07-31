import { describe, expect, it } from 'vitest';

import {
  projectAgentTurnRuntimeEvent,
  projectAgentTurnRuntimeToolCall,
  type AgentTurnRuntimeEvent,
} from '../src/workbench/agentTurnRuntimePresentation.ts';

const observedAt = '2026-07-31T00:00:01.000Z';

function runtimeEvent(
  type: string,
  overrides: Partial<AgentTurnRuntimeEvent> = {},
): AgentTurnRuntimeEvent {
  return {
    eventId: 'event.test',
    type,
    version: '1.0.0',
    sequence: 0,
    occurredAt: '2026-07-31T00:00:00.000Z',
    source: 'provider',
    severity: 'info',
    sessionId: 'session.test',
    turnId: 'turn.test',
    providerSessionId: 'provider-session.test',
    taskId: null,
    runId: null,
    itemId: null,
    traceContext: null,
    correlationId: null,
    causationId: null,
    redactionClassification: 'tenant_sensitive',
    payloadSchema: null,
    payload: {},
    replay: false,
    ...overrides,
  };
}

describe('Agent Turn runtime presentation', () => {
  it.each([
    ['agent.turn.started', 'streaming'],
    ['approval.required', 'awaiting_approval'],
    ['user.question.required', 'awaiting_user'],
    ['agent.turn.failed', 'failed'],
    ['agent.runtime.failed', 'failed'],
  ] as const)('projects %s without provider-specific protocol fields', (type, runtimeStatus) => {
    expect(projectAgentTurnRuntimeEvent(runtimeEvent(type), observedAt)).toEqual({
      activityAt: '2026-07-31T00:00:00.000Z',
      providerSessionId: 'provider-session.test',
      runtimeStatus,
    });
  });

  it('keeps unknown events activity-only and uses the observation time when needed', () => {
    expect(projectAgentTurnRuntimeEvent(runtimeEvent('agent.tool.updated', {
      occurredAt: null,
      providerSessionId: null,
      payload: { threadId: 'provider-native-value-must-not-be-consumed' },
    }), observedAt)).toEqual({ activityAt: observedAt });
  });

  it.each([
    ['agent.tool.call.requested', 'pending'],
    ['agent.tool.call.started', 'running'],
    ['agent.tool.call.output_streamed', 'running'],
    ['agent.tool.call.completed', 'success'],
    ['agent.tool.call.failed', 'error'],
    ['agent.tool.call.cancelled', 'cancelled'],
    ['agent.tool.call.denied', 'cancelled'],
  ] as const)('projects %s Item snapshots with %s status', (type, status) => {
    expect(projectAgentTurnRuntimeToolCall(runtimeEvent(type, {
      itemId: 'provider-item.command',
      payload: {
        item: {
          command: 'pnpm test',
          id: 'provider-item.command',
          type: 'command_execution',
        },
      },
    }))).toEqual({
      id: 'provider-item.command',
      record: {
        command: 'pnpm test',
        id: 'provider-item.command',
        status,
        type: 'command_execution',
      },
    });
  });

  it('ignores non-tool Item snapshots and redacted tool payloads', () => {
    expect(projectAgentTurnRuntimeToolCall(runtimeEvent('agent.message.updated', {
      payload: {
        item: { id: 'provider-item.message', text: 'Hello', type: 'agent_message' },
      },
    }))).toBeNull();
    expect(projectAgentTurnRuntimeToolCall(runtimeEvent('agent.tool.call.started', {
      itemId: null,
      payload: { redacted: true },
    }))).toBeNull();
  });
});
