import { describe, expect, it } from 'vitest';

import { normalizeAgentSessionItemToolCalls } from '@sdkwork/birdcoder-pc-contracts-commons';

const parent = {
  id: 'e2e-codex-browser-nav',
  type: 'mcp_tool_call',
  server: 'browser-use',
  tool: 'navigate',
  arguments: { url: 'https://example.com/target' },
  status: 'completed',
  durationMs: 800,
  result: { content: [{ type: 'text', text: 'Started browser background' }] },
};
const child = {
  id: 'e2e-codex-browser-step-1',
  type: 'mcp_tool_call',
  server: 'browser-use',
  tool: 'act',
  arguments: { action: 'start', detail: 'Started browser background' },
  status: 'completed',
  durationMs: 920,
  parentExecutionId: 'e2e-codex-browser-nav',
  result: { content: [{ type: 'text', text: 'Started browser background' }] },
};

describe('browser-use mock shape', () => {
  it('normalizes the mock payload into a grouped mcp tree', () => {
    const calls = normalizeAgentSessionItemToolCalls([parent, child], { engineId: 'codex' });
    console.log('CALLS:', JSON.stringify(calls.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      serverName: c.serverName,
      children: c.children?.map((ch) => ({ id: ch.id, name: ch.name })),
    })), null, 1));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('navigate');
    expect(calls[0]?.children).toHaveLength(1);
  });
});
