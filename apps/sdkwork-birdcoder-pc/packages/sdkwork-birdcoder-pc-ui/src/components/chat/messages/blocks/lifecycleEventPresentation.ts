import type {
  AgentSessionItemLifecycleEventView,
  AgentSessionItemTokenUsageView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { ChatMessageTranslate } from '../types.ts';

export function formatLifecycleDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return '';
  }
  if (durationMs < 1_000) return `${Math.round(durationMs)}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function formatLifecycleTokenCount(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return '';
  }
  if (value < 1_000) return String(Math.floor(value));
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)}m`;
}

export function resolveLifecycleTotalTokens(
  usage: AgentSessionItemTokenUsageView | undefined,
): number | undefined {
  if (!usage) return undefined;
  if (usage.totalTokens !== undefined) return usage.totalTokens;
  const values = [usage.inputTokens, usage.outputTokens, usage.reasoningTokens]
    .filter((value): value is number => value !== undefined);
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : undefined;
}

export function formatLifecycleCost(cost: number | undefined): string {
  if (cost === undefined || !Number.isFinite(cost) || cost < 0) {
    return '';
  }
  if (cost === 0) return '$0';
  return `$${cost.toFixed(cost < 0.01 ? 4 : cost < 1 ? 3 : 2)}`;
}

export function resolveLifecycleEventLabel(
  event: AgentSessionItemLifecycleEventView,
  t?: ChatMessageTranslate,
): string {
  if (event.kind === 'compacted' && event.automatic === true) {
    return t?.('chat.lifecycleAutomaticallyCompacted') ?? 'Context automatically compacted';
  }
  const labels = {
    blocked: t?.('chat.lifecycleBlocked') ?? 'Execution blocked',
    cancelled: t?.('chat.lifecycleCancelled') ?? 'Execution cancelled',
    checkpoint: t?.('chat.lifecycleCheckpoint') ?? 'Checkpoint saved',
    compacted: t?.('chat.lifecycleCompacted') ?? 'Context compacted',
    completed: t?.('chat.lifecycleCompleted') ?? 'Turn completed',
    failed: t?.('chat.lifecycleFailed') ?? 'Turn failed',
    retrying: t?.('chat.lifecycleRetrying') ?? 'Retrying request',
    started: t?.('chat.lifecycleStarted') ?? 'Turn started',
    stopped: t?.('chat.lifecycleStopped') ?? 'Execution stopped',
  } as const;
  return labels[event.kind];
}

export function resolveLifecycleEventMeta(
  event: AgentSessionItemLifecycleEventView,
  t?: ChatMessageTranslate,
): string[] {
  const values: string[] = [];
  if (event.attempt !== undefined) {
    values.push(t?.('chat.lifecycleAttempt', { attempt: event.attempt }) ?? `Attempt ${event.attempt}`);
  }
  const duration = formatLifecycleDuration(event.durationMs);
  if (duration) values.push(duration);
  const totalTokens = formatLifecycleTokenCount(resolveLifecycleTotalTokens(event.usage));
  if (totalTokens) {
    values.push(t?.('chat.lifecycleTokens', { count: totalTokens }) ?? `${totalTokens} tokens`);
  }
  const cost = formatLifecycleCost(event.cost);
  if (cost) values.push(cost);
  return values;
}

export function hasLifecycleEventDetails(event: AgentSessionItemLifecycleEventView): boolean {
  return Boolean(
    event.detail?.trim()
    || event.usage
    || event.retryAt
    || event.automatic !== undefined,
  );
}
