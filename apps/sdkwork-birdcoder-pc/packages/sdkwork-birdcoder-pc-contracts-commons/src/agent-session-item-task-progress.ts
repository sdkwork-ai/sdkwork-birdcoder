import type {
  AgentSessionItemToolCallView,
  AgentSessionItemViewSource,
  AgentSessionTaskItemStatus,
  AgentSessionTaskItemView,
  AgentSessionTaskProgressView,
} from './agent-session-view.ts';

export interface AgentSessionItemTaskProgressDisplayState {
  activeItem?: AgentSessionTaskItemView;
  completed: number;
  items: readonly AgentSessionTaskItemView[];
  percent: number;
  total: number;
}

const TASK_PROGRESS_COLLECTION_KEYS = ['items', 'todos', 'tasks', 'plan', 'steps'] as const;
const TASK_ITEM_TEXT_KEYS = [
  'text', 'content', 'description', 'task', 'step', 'title', 'name', 'activeForm',
] as const;
const TODO_TOOL_NAMES = new Set([
  'plan',
  'plan_update',
  'set_plan',
  'todo',
  'todo_read',
  'todo_write',
  'todoread',
  'todowrite',
  'update_plan',
  'update_todo',
  'write_todo',
  'write_todos',
]);

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeTaskItemStatus(value: unknown, completed: unknown): AgentSessionTaskItemStatus {
  if (completed === true) {
    return 'completed';
  }
  const status = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/gu, '_')
    : '';
  if (['blocked', 'failed', 'failure'].includes(status)) {
    return 'blocked';
  }
  if (['cancelled', 'canceled', 'skipped', 'stopped'].includes(status)) {
    return 'cancelled';
  }
  if (['complete', 'completed', 'done', 'success', 'succeeded'].includes(status)) {
    return 'completed';
  }
  if (['active', 'in_progress', 'inprogress', 'running', 'started', 'working'].includes(status)) {
    return 'running';
  }
  return 'pending';
}

function normalizeTaskItem(value: unknown, index: number): AgentSessionTaskItemView | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return null;
    }
    const marked = /^\[([xX~!\- ])\]\s*(.+)$/u.exec(text);
    if (!marked) {
      return { text, status: 'pending' };
    }
    const statusByMarker: Readonly<Record<string, AgentSessionTaskItemStatus>> = {
      '!': 'blocked',
      '-': 'cancelled',
      ' ': 'pending',
      '~': 'running',
      X: 'completed',
      x: 'completed',
    };
    return {
      text: marked[2]?.trim() ?? '',
      status: statusByMarker[marked[1] ?? ' '] ?? 'pending',
    };
  }

  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const text = readString(record, TASK_ITEM_TEXT_KEYS);
  if (!text) {
    return null;
  }
  const id = readString(record, ['id', 'taskId', 'task_id']) || `task-${index + 1}`;
  return {
    id,
    text,
    status: normalizeTaskItemStatus(record.status ?? record.state, record.completed),
  };
}

function normalizeTaskProgressItems(record: Record<string, unknown>): AgentSessionTaskItemView[] {
  const collection = TASK_PROGRESS_COLLECTION_KEYS
    .map((key) => record[key])
    .find((value): value is unknown[] => Array.isArray(value));
  if (!collection) {
    return [];
  }
  return collection.flatMap((item, index) => {
    const normalized = normalizeTaskItem(item, index);
    return normalized?.text ? [normalized] : [];
  });
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
  taskProgress: AgentSessionItemViewSource['taskProgress'] | AgentSessionTaskProgressView | undefined,
): AgentSessionItemTaskProgressDisplayState | null {
  if (!taskProgress || typeof taskProgress !== 'object') {
    return null;
  }

  const taskProgressRecord = taskProgress as unknown as Record<string, unknown>;
  const items = normalizeTaskProgressItems(taskProgressRecord);
  const parsedTotal = normalizeTaskProgressCounter(
    readTaskProgressCounter(taskProgressRecord, ['total', 'totalSteps', 'totalCount']),
  );
  const total = Math.max(parsedTotal ?? 0, items.length);
  if (total <= 0) {
    return null;
  }

  const completedFromItems = items.filter((item) => item.status === 'completed').length;
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
    ) ?? completedFromItems,
  );
  const percent = Math.round((completed / total) * 100);
  const activeItem = items.find((item) => item.status === 'running')
    ?? items.find((item) => item.status === 'pending')
    ?? [...items].reverse().find((item) => item.status === 'completed')
    ?? items[0];

  return {
    ...(activeItem ? { activeItem } : {}),
    completed,
    items,
    percent,
    total,
  };
}

function parseTaskProgressArguments(argumentsText: string): AgentSessionItemTaskProgressDisplayState | null {
  if (!argumentsText.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(argumentsText) as unknown;
    const record = readRecord(parsed);
    return record
      ? resolveTaskProgressDisplayState(record as unknown as AgentSessionTaskProgressView)
      : null;
  } catch {
    return null;
  }
}

function parseTaskProgressOutput(output: string | undefined): AgentSessionItemTaskProgressDisplayState | null {
  if (!output?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(output) as unknown;
    const record = readRecord(parsed);
    const displayState = record
      ? resolveTaskProgressDisplayState(record as unknown as AgentSessionTaskProgressView)
      : null;
    if (displayState) {
      return displayState;
    }
  } catch {
    // Continue with provider text output such as `[~] Running task`.
  }
  const markedItems = output
    .split(/\r?\n/gu)
    .filter((line) => /^\s*\[[xX~!\- ]\]\s*\S/u.test(line));
  if (markedItems.length === 0) {
    return null;
  }
  return resolveTaskProgressDisplayState({
    completed: markedItems.filter((item) => /^\s*\[[xX]\]/u.test(item)).length,
    items: markedItems,
    total: markedItems.length,
  } as unknown as AgentSessionTaskProgressView);
}

function parseTaskProgressResultBlocks(
  resultBlocks: AgentSessionItemToolCallView['resultBlocks'],
): AgentSessionItemTaskProgressDisplayState | null {
  const output = resultBlocks?.flatMap((block) => {
    if (block.type === 'list') {
      return block.items;
    }
    if (block.type === 'text') {
      return [block.text];
    }
    return [];
  }).join('\n');
  return parseTaskProgressOutput(output);
}

export function isAgentSessionTodoToolCall(call: AgentSessionItemToolCallView): boolean {
  const name = call.name
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[.\s-]+/gu, '_');
  return call.kind === 'task' && TODO_TOOL_NAMES.has(name);
}

export function resolveToolCallsTaskProgressDisplayState(
  calls: readonly AgentSessionItemToolCallView[],
): AgentSessionItemTaskProgressDisplayState | null {
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const call = calls[index];
    if (!call || !isAgentSessionTodoToolCall(call)) {
      continue;
    }
    const displayState = parseTaskProgressArguments(call.arguments)
      ?? parseTaskProgressOutput(call.output)
      ?? parseTaskProgressResultBlocks(call.resultBlocks);
    if (displayState) {
      return displayState;
    }
  }
  return null;
}
