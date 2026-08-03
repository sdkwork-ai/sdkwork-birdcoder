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

/**
 * Codex desktop elapsed-time format (`fMs`/`mMs` in the pinned bundle):
 * `0s`, `42s`, `2m 30s`, `1h 5m`, `1d 2h` — seconds-based with zero units
 * trimmed, unlike the millisecond format used inside tool rows.
 */
export function formatTurnDividerDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return '';
  }
  const totalSeconds = Math.floor(Math.max(durationMs, 0) / 1_000);
  if (totalSeconds < 1) {
    return '0s';
  }
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const days = Math.floor(totalSeconds / (3_600 * 24));
  const hours = Math.floor(totalSeconds / 3_600) % 24;
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || !days) parts.push(`${hours}h`);
  if (minutes > 0 || (!days && !hours)) parts.push(`${minutes}m`);
  if (seconds > 0 || (!days && !hours && !minutes)) parts.push(`${seconds}s`);
  return parts.join(' ');
}

export interface TurnDividerPresentation {
  /** Codex `f8c` divider status. */
  status: 'working' | 'worked' | 'stopped';
  label: string;
}

/**
 * Maps lifecycle events onto the Codex desktop turn divider (`f8c`):
 * `Working` / `Working for {time}` while in progress, `Worked for {time}`
 * on completion, `You stopped after {time}` when the user interrupted.
 * Events without a measurable duration keep their descriptive labels.
 */
export function resolveTurnDividerPresentation(
  event: AgentSessionItemLifecycleEventView,
  t?: ChatMessageTranslate,
): TurnDividerPresentation | null {
  const duration = formatTurnDividerDuration(event.durationMs);
  if (event.kind === 'started') {
    return {
      status: 'working',
      label: duration && duration !== '0s'
        ? t?.('chat.turnDividerWorkingFor', { time: duration }) ?? `Working for ${duration}`
        : t?.('chat.turnDividerWorking') ?? 'Working',
    };
  }
  if (event.kind === 'completed') {
    // Codex desktop always renders the worked divider before the final
    // response (`f8c`); when the provider did not report a duration the
    // divider keeps its descriptive completion label.
    return duration && duration !== '0s'
      ? {
          status: 'worked',
          label: t?.('chat.turnDividerWorkedFor', { time: duration }) ?? `Worked for ${duration}`,
        }
      : {
          status: 'worked',
          label: t?.('chat.lifecycleCompleted') ?? 'Turn completed',
        };
  }
  if (event.kind === 'stopped' || event.kind === 'cancelled') {
    return duration && duration !== '0s'
      ? {
          status: 'stopped',
          label: t?.('chat.turnDividerUserStoppedAfter', { time: duration })
            ?? `You stopped after ${duration}`,
        }
      : null;
  }
  return null;
}
