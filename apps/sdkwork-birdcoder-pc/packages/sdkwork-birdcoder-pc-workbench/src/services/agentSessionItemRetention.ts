export const AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS = 2_000;
export const AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS = 16 * 1_048_576;
export const AGENT_SESSION_ITEM_RETENTION_MAX_ESTIMATE_NODES = 262_144;

export interface AgentSessionItemRetentionEstimateBudget {
  remainingNodes: number;
}

type StructuredValueEstimateFrame =
  | {
      index: number;
      kind: 'array';
      value: readonly unknown[];
    }
  | {
      entries: Generator<readonly [string, unknown], void>;
      kind: 'object';
    }
  | {
      kind: 'value';
      value: unknown;
    };

function* iterateOwnEnumerableEntries(
  value: object,
): Generator<readonly [string, unknown], void> {
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      yield [key, record[key]] as const;
    }
  }
}

export function estimateAgentSessionItemRetentionCharacters(
  value: unknown,
  limit: number,
  budget: AgentSessionItemRetentionEstimateBudget,
): number {
  if (limit <= 0 || budget.remainingNodes <= 0) {
    return limit + 1;
  }

  const visited = new WeakSet<object>();
  const frames: StructuredValueEstimateFrame[] = [{ kind: 'value', value }];
  let characters = 0;

  while (frames.length > 0 && characters <= limit) {
    const frame = frames.pop()!;
    if (frame.kind === 'array') {
      if (frame.index < frame.value.length) {
        frames.push({ ...frame, index: frame.index + 1 });
        frames.push({ kind: 'value', value: frame.value[frame.index] });
      }
      continue;
    }
    if (frame.kind === 'object') {
      const nextEntry = frame.entries.next();
      if (!nextEntry.done) {
        const [key, candidate] = nextEntry.value;
        characters += Math.min(key.length, Math.max(0, limit - characters) + 1);
        frames.push(frame);
        frames.push({ kind: 'value', value: candidate });
      }
      continue;
    }

    if (budget.remainingNodes <= 0) {
      return limit + 1;
    }
    budget.remainingNodes -= 1;
    const candidate = frame.value;
    if (typeof candidate === 'string') {
      characters += Math.min(candidate.length, Math.max(0, limit - characters) + 1);
      continue;
    }
    if (candidate === null || candidate === undefined) {
      characters += 4;
      continue;
    }
    if (typeof candidate !== 'object') {
      characters += Math.min(
        String(candidate).length,
        Math.max(0, limit - characters) + 1,
      );
      continue;
    }
    if (visited.has(candidate)) {
      continue;
    }
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      frames.push({ index: 0, kind: 'array', value: candidate });
    } else {
      frames.push({
        entries: iterateOwnEnumerableEntries(candidate),
        kind: 'object',
      });
    }
  }
  return characters;
}
