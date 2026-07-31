import type {
  SubmitAgentTurnOptions,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IAgentSessionService';
import type {
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export type AgentTurnRuntimeEvent = Parameters<
  NonNullable<SubmitAgentTurnOptions['onRuntimeEvent']>
>[0];

export interface AgentTurnRuntimePresentation {
  activityAt: string;
  providerSessionId?: string;
  runtimeStatus?: AgentSessionView['runtimeStatus'];
}

export interface AgentTurnRuntimeToolCallPresentation {
  id: string;
  record: Record<string, unknown>;
}

const RUNTIME_EVENT_STATUS_BY_TYPE = new Map<
  string,
  AgentSessionView['runtimeStatus']
>([
  ['agent.turn.started', 'streaming'],
  ['approval.required', 'awaiting_approval'],
  ['user.question.required', 'awaiting_user'],
  ['agent.turn.failed', 'failed'],
  ['agent.runtime.failed', 'failed'],
]);

function resolveRuntimeToolCallStatus(
  eventType: string,
): 'cancelled' | 'error' | 'pending' | 'running' | 'success' | undefined {
  if (/\.(?:cancelled|denied)$/u.test(eventType)) {
    return 'cancelled';
  }
  if (/\.failed$/u.test(eventType)) {
    return 'error';
  }
  if (/\.completed$/u.test(eventType)) {
    return 'success';
  }
  if (/\.(?:started|updated|output_streamed|streamed)$/u.test(eventType)) {
    return 'running';
  }
  if (/\.requested$/u.test(eventType)) {
    return 'pending';
  }
  return undefined;
}

export function projectAgentTurnRuntimeToolCall(
  event: AgentTurnRuntimeEvent,
): AgentTurnRuntimeToolCallPresentation | null {
  if (!event.type.startsWith('agent.tool.')) {
    return null;
  }
  const payloadItem = event.payload.item;
  if (!payloadItem || typeof payloadItem !== 'object' || Array.isArray(payloadItem)) {
    return null;
  }
  const record = structuredClone(payloadItem) as Record<string, unknown>;
  const id = event.itemId?.trim()
    || (typeof record.id === 'string' ? record.id.trim() : '');
  if (!id) {
    return null;
  }
  const status = resolveRuntimeToolCallStatus(event.type);
  if (status && !(typeof record.status === 'string' && record.status.trim())) {
    record.status = status;
  }
  return { id, record };
}

export function projectAgentTurnRuntimeEvent(
  event: AgentTurnRuntimeEvent,
  observedAt: string,
): AgentTurnRuntimePresentation {
  const providerSessionId = event.providerSessionId?.trim();
  return {
    activityAt: event.occurredAt ?? observedAt,
    ...(providerSessionId ? { providerSessionId } : {}),
    ...(RUNTIME_EVENT_STATUS_BY_TYPE.has(event.type)
      ? { runtimeStatus: RUNTIME_EVENT_STATUS_BY_TYPE.get(event.type)! }
      : {}),
  };
}
