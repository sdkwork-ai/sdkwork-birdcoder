import type { AgentSessionItemViewSource } from './agent-session-view.ts';

export interface AgentSessionItemTaskProgressDisplayState {
  completed: number;
  percent: number;
  total: number;
}

export function readTaskProgressCounter(
  taskProgress: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(taskProgress, key)) {
      return taskProgress[key];
    }
  }

  return undefined;
}

export function normalizeTaskProgressCounter(value: unknown): number | null {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Math.max(0, Math.floor(parsedValue));
}

export function resolveTaskProgressDisplayState(
  taskProgress: AgentSessionItemViewSource['taskProgress'] | undefined,
): AgentSessionItemTaskProgressDisplayState | null {
  if (!taskProgress || typeof taskProgress !== 'object') {
    return null;
  }

  const taskProgressRecord = taskProgress as unknown as Record<string, unknown>;
  const total = normalizeTaskProgressCounter(
    readTaskProgressCounter(taskProgressRecord, ['total', 'totalSteps', 'totalCount']),
  );
  if (!total || total <= 0) {
    return null;
  }

  const completed = Math.min(
    total,
    normalizeTaskProgressCounter(
      readTaskProgressCounter(taskProgressRecord, [
        'completed',
        'completedSteps',
        'completedCount',
        'current',
        'currentStep',
      ]),
    ) ?? 0,
  );
  const percent = Math.round((completed / total) * 100);

  return {
    completed,
    percent,
    total,
  };
}
