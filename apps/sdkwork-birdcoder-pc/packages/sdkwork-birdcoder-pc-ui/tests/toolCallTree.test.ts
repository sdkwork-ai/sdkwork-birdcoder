import { describe, expect, it } from 'vitest';

import { normalizeAgentSessionItemToolCalls } from '@sdkwork/birdcoder-pc-contracts-commons';

function mcpCall(
  id: string,
  tool: string,
  options: { parentExecutionId?: string; status?: string } = {},
) {
  return {
    id,
    type: 'mcp_tool_call',
    server: 'browser-use',
    tool,
    arguments: { action: tool },
    status: options.status ?? 'completed',
    ...(options.parentExecutionId ? { parentExecutionId: options.parentExecutionId } : {}),
  };
}

describe('tool call tree grouping', () => {
  it('attaches calls with a matching parentExecutionId as children', () => {
    const calls = normalizeAgentSessionItemToolCalls([
      mcpCall('browser-nav', 'navigate'),
      mcpCall('browser-step-1', 'act', { parentExecutionId: 'browser-nav' }),
      mcpCall('browser-step-2', 'act', { parentExecutionId: 'browser-nav' }),
    ], { engineId: 'codex' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.serverName).toBe('browser-use');
    expect(calls[0]?.children).toHaveLength(2);
    expect(calls[0]?.children?.[0]?.name).toBe('act');
    expect(calls[0]?.children?.[1]?.name).toBe('act');
  });

  it('keeps calls without a resolvable parent as roots', () => {
    const calls = normalizeAgentSessionItemToolCalls([
      mcpCall('a', 'navigate'),
      mcpCall('b', 'act', { parentExecutionId: 'missing-parent' }),
    ], { engineId: 'codex' });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.children).toBeUndefined();
    expect(calls[1]?.children).toBeUndefined();
  });

  it('preserves display order of children', () => {
    const calls = normalizeAgentSessionItemToolCalls([
      mcpCall('parent', 'navigate'),
      mcpCall('step-2', 'act', { parentExecutionId: 'parent' }),
      mcpCall('step-1', 'act', { parentExecutionId: 'parent' }),
    ], { engineId: 'codex' });

    expect(calls[0]?.children?.map((child) => child.id)).toEqual(['step-2', 'step-1']);
  });
});
