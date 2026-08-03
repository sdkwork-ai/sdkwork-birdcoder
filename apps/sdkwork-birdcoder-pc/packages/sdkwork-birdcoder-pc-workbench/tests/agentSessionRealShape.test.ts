import { describe, expect, it } from 'vitest';

import {
  normalizeAgentSessionItemToolCalls,
  resolveAgentSessionItemPresentation,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  toAgentSessionTranscriptItemViews,
  type AgentSessionItemRecord,
} from '../src/services/agentSessionViewModels.ts';

function createItem(
  itemId: string,
  kind: string,
  toolName: string | null,
  toolArguments: Record<string, unknown> | null,
  toolResult: Record<string, unknown> | null,
  parentItemId: string | null = null,
  sequence = '1',
  turnId = 'agent-turn-1',
  toolCallId: string | null = itemId,
): AgentSessionItemRecord {
  return {
    tenantId: '1001', organizationId: '2001', sessionId: 'agent-session-1',
    itemId, kind: kind as never, content: null, contentType: 'application/json',
    status: 'completed', sequence, inputTokens: '0', outputTokens: '0',
    modelId: 'gpt-5', providerId: 'openai', turnId,
    toolName, toolCallId, toolArguments: toolArguments as never,
    toolResult: toolResult as never, driveRefs: [], parentItemId: parentItemId as never,
    createdBy: '3001', version: '1',
    createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:01.000Z',
  };
}

const CTX = {
  engineId: 'codex', providerId: 'codex', layout: 'main',
  isLive: false, environment: {} as never,
};

function callsOf(views: ReturnType<typeof toAgentSessionTranscriptItemViews>) {
  return normalizeAgentSessionItemToolCalls(
    views.flatMap(v => v.tool_calls ?? []), { engineId: 'codex' });
}

describe('Codex real provider shape', () => {
  it('merges paired tool_call + tool_result rows into one', () => {
    const rawMcp = {
      type: 'mcp_tool_call', id: 'mcp-1', server: 'docs', tool: 'search',
      status: 'completed', arguments: { query: 'codex' }, appContext: null,
      pluginId: null, readOnlyHint: true,
      result: { content: [{ type: 'text', text: 'Found 3 docs' }], structuredContent: null, _meta: null },
      error: null, durationMs: 1,
    };
    const call = createItem('call-1', 'tool_call', 'search', rawMcp, null, null, '1', 't', 'mcp-1');
    const result = createItem('result-1', 'tool_result', 'search', null, rawMcp, 'call-1', '2', 't', 'mcp-1');
    const views = toAgentSessionTranscriptItemViews([call, result], CTX);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('search');
    expect(calls[0]?.kind).toBe('mcp');
    const presentation = resolveAgentSessionItemPresentation(views[0]!, { engineId: 'codex', layout: 'main' });
    const toolBlock = presentation.blocks.find(b => b.type === 'tool-calls');
    expect(toolBlock?.type === 'tool-calls' && toolBlock.calls[0]?.output).toContain('Found 3 docs');
  });

  it('hides sleep tool calls from the transcript', () => {
    const rawSleep = { type: 'sleep', id: 'sleep-1', durationMs: 10 };
    const item = createItem('sleep-1', 'tool_call', 'sleep', rawSleep, null);
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    expect(callsOf(views)).toHaveLength(0);
  });

  it('renders subAgentActivity raw items as one activity row', () => {
    const rawSubagent = {
      type: 'subAgentActivity', id: 'sub-1', kind: 'started',
      agentThreadId: 'child', agentPath: 'sdkwork-birdcoder/subagents/code-reviewer',
    };
    const item = createItem('sub-1', 'tool_result', 'sub_agent_activity', null, rawSubagent);
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('subagent_started');
    expect(calls[0]?.kind).toBe('agent');
  });

  it('renders commandExecution raw items as a command row', () => {
    const rawCommand = {
      type: 'commandExecution', id: 'cmd-1', command: 'pnpm test', cwd: 'E:/workspace',
      status: 'completed', aggregatedOutput: 'All tests passed', exitCode: 0, durationMs: 42,
    };
    const item = createItem('cmd-1', 'tool_result', 'shell_command', null, rawCommand);
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('shell_command');
    expect(calls[0]?.kind).toBe('command');
  });

  it('renders webSearch raw items as a web row', () => {
    const rawWeb = {
      type: 'webSearch', id: 'web-1', query: 'codex protocol', action: 'search', results: [],
    };
    const item = createItem('web-1', 'tool_result', 'web_search', null, rawWeb);
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('web_search');
    expect(calls[0]?.kind).toBe('web');
  });

  it('groups consecutive imageView raw items', () => {
    const rawView1 = { type: 'imageView', id: 'view-1', path: 'E:/workspace/a.png' };
    const rawView2 = { type: 'imageView', id: 'view-2', path: 'E:/workspace/b.png' };
    const items = [
      createItem('view-1', 'tool_result', 'image_view', null, rawView1, null, '1'),
      createItem('view-2', 'tool_result', 'image_view', null, rawView2, null, '2'),
    ];
    const views = toAgentSessionTranscriptItemViews(items, CTX);
    expect(views).toHaveLength(1);
    expect((views[0]?.resources ?? []).length).toBe(2);
  });

  it('renders failed MCP error message text as output', () => {
    const rawMcp = {
      type: 'mcp_tool_call', id: 'mcp-err', server: 'github', tool: 'get_issue',
      status: 'failed', arguments: { owner: 'sdkwork' }, appContext: null,
      pluginId: null, readOnlyHint: false, result: null,
      error: { message: 'API rate limit exceeded' }, durationMs: 5,
    };
    const item = createItem('mcp-err', 'tool_result', 'get_issue', null, rawMcp);
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.status).toBe('error');
    const presentation = resolveAgentSessionItemPresentation(views[0]!, { engineId: 'codex', layout: 'main' });
    const toolBlock = presentation.blocks.find(b => b.type === 'tool-calls');
    const errorBlock = toolBlock?.type === 'tool-calls'
      ? (toolBlock.calls[0]?.resultBlocks ?? []).find(b => b.type === 'error')
      : undefined;
    expect(errorBlock?.type === 'error' ? errorBlock.message : '').toBe('API rate limit exceeded');
  });
});

describe('real provider shape (pair reconciliation)', () => {
  it('carries call arguments into the merged result row', () => {
    const callPayload = {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'read-readme',
        name: 'read_file',
        arguments: { path: 'docs/README.md' },
      }],
    };
    const resultPayload = {
      role: 'toolResult',
      toolCallId: 'read-readme',
      toolName: 'read_file',
      content: [{ type: 'text', text: '# README' }],
      isError: false,
    };
    const call = createItem('item-1', 'tool_call', 'provider_history', null, callPayload, null, '1', 't', 'read-readme');
    const result = createItem('item-2', 'tool_result', 'provider_history', null, resultPayload, 'item-1', '2', 't', 'read-readme');
    const views = toAgentSessionTranscriptItemViews([call, result], CTX);
    expect(views).toHaveLength(1);
    const calls = callsOf(views);
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.arguments ?? '')).toContain('README.md');
  });
});

describe('hermes real pair', () => {
  it('merges hermes mcp pair into one mcp row', () => {
    const callPayload = {
      role: 'assistant', content: '',
      tool_calls: [{
        id: 'e2e-hermes-mcp-read', type: 'function',
        function: { name: 'mcp__filesystem__read_file', arguments: '{"path":"docs/providers/hermes.md"}' },
      }],
    };
    const resultPayload = {
      role: 'tool', tool_call_id: 'e2e-hermes-mcp-read',
      content: 'Hermes MCP provider specification',
    };
    const call = createItem('e2e-hermes-item-1', 'tool_call', 'provider_history', null, callPayload, null, '1', 'agent-turn-1', 'e2e-hermes-mcp-read');
    const result = createItem('e2e-hermes-item-2', 'tool_result', 'provider_history', null, resultPayload, 'e2e-hermes-item-1', '2', 'agent-turn-1', 'e2e-hermes-mcp-read');
    const views = toAgentSessionTranscriptItemViews([call, result], {
      engineId: 'hermes', providerId: 'hermes',
    });
    console.log('VIEWS:', JSON.stringify(views.map(v => v.tool_calls), null, 1));
    const calls = normalizeAgentSessionItemToolCalls(
      views.flatMap(v => v.tool_calls ?? []), { engineId: 'hermes' });
    console.log('CALLS:', JSON.stringify(calls.map(c => ({ name: c.name, kind: c.kind, output: String(c.output ?? '').slice(0, 60) })), null, 1));
    expect(calls).toHaveLength(1);
  });
});

describe('codex hook delivery metadata', () => {
  function createUserItem(
    itemId: string,
    content: string,
    extra: Record<string, unknown> = {},
    sequence = '1',
  ): AgentSessionItemRecord {
    return {
      tenantId: '1001', organizationId: '2001', sessionId: 'agent-session-1',
      itemId, kind: 'user_input', content, contentType: 'text/plain',
      status: 'completed', sequence, inputTokens: '0', outputTokens: '0',
      modelId: 'gpt-5', providerId: 'openai', turnId: 'agent-turn-1',
      toolName: null, toolCallId: null, toolArguments: null as never,
      toolResult: null as never, driveRefs: [], parentItemId: null,
      createdBy: '3001', version: '1',
      createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:01.000Z',
      ...extra,
    } as AgentSessionItemRecord;
  }

  it('surfaces deliveryStatus not-sent with blocked sources and hook stats', () => {
    const item = createUserItem('hook-1', 'gated message', {
      deliveryStatus: 'not-sent',
      blockedSources: ['pre-message', 'pre-command'],
      hookStats: {
        count: 4,
        blockedCount: 1,
        errorCount: 1,
        runs: [
          { eventName: 'UserPromptSubmit', source: 'pre-message', statusMessage: 'Blocked by policy' },
          { eventName: 'PreToolUse', source: 'pre-command', count: 2, statusMessage: 'Blocked risky command' },
        ],
      },
    });
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    expect(views).toHaveLength(1);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.deliveryStatus).toBe('not-sent');
    expect(metadata?.blockedSources).toEqual(['pre-message', 'pre-command']);
    const hookStats = metadata?.hookStats as Record<string, unknown> | undefined;
    expect(hookStats?.count).toBe(4);
    expect(hookStats?.blockedCount).toBe(1);
    expect(hookStats?.runs).toHaveLength(2);
    expect((hookStats?.runs as Array<Record<string, unknown>>)[1]?.count).toBe(2);
  });

  it('drops hook metadata when deliveryStatus is missing or not not-sent', () => {
    const plain = createUserItem('plain-1', 'normal message');
    const plainViews = toAgentSessionTranscriptItemViews([plain], CTX);
    const plainMetadata = plainViews[0]?.metadata as Record<string, unknown> | undefined;
    expect(plainMetadata?.deliveryStatus).toBeUndefined();
    expect(plainMetadata?.hookStats).toBeUndefined();

    const delivered = createUserItem('delivered-1', 'delivered message', {
      deliveryStatus: 'sent',
      hookStats: { count: 1 },
    });
    const deliveredViews = toAgentSessionTranscriptItemViews([delivered], CTX);
    const deliveredMetadata = deliveredViews[0]?.metadata as Record<string, unknown> | undefined;
    expect(deliveredMetadata?.deliveryStatus).toBeUndefined();
    expect(deliveredMetadata?.hookStats).toBeUndefined();
  });

  it('ignores malformed hook stats records', () => {
    const item = createUserItem('bad-1', 'message', {
      deliveryStatus: 'not-sent',
      hookStats: { blockedCount: 3 },
    });
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.deliveryStatus).toBe('not-sent');
    expect(metadata?.hookStats).toBeUndefined();
  });
});


describe('codex prior conversation reference', () => {
  it('surfaces referencesPriorConversation on the user message metadata', () => {
    const item = {
      tenantId: '1001', organizationId: '2001', sessionId: 'agent-session-1',
      itemId: 'prior-1', kind: 'user_input', content: 'continue from before',
      contentType: 'text/plain', status: 'completed', sequence: '1',
      inputTokens: '0', outputTokens: '0', modelId: 'gpt-5', providerId: 'openai',
      turnId: 'agent-turn-1', toolName: null, toolCallId: null,
      toolArguments: null as never, toolResult: null as never, driveRefs: [], parentItemId: null,
      createdBy: '3001', version: '1',
      createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:01.000Z',
      referencesPriorConversation: true,
    } as AgentSessionItemRecord;
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    expect(views).toHaveLength(1);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.referencesPriorConversation).toBe(true);
  });

  it('omits the flag when absent or false', () => {
    const item = {
      tenantId: '1001', organizationId: '2001', sessionId: 'agent-session-1',
      itemId: 'plain-prior-1', kind: 'user_input', content: 'plain',
      contentType: 'text/plain', status: 'completed', sequence: '1',
      inputTokens: '0', outputTokens: '0', modelId: 'gpt-5', providerId: 'openai',
      turnId: 'agent-turn-1', toolName: null, toolCallId: null,
      toolArguments: null as never, toolResult: null as never, driveRefs: [], parentItemId: null,
      createdBy: '3001', version: '1',
      createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:01.000Z',
      referencesPriorConversation: false,
    } as AgentSessionItemRecord;
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.referencesPriorConversation).toBeUndefined();
  });
});


describe('codex user message goal and hook feedback', () => {
  function createUserItem(
    itemId: string,
    content: string,
    extra: Record<string, unknown> = {},
  ): AgentSessionItemRecord {
    return {
      tenantId: '1001', organizationId: '2001', sessionId: 'agent-session-1',
      itemId, kind: 'user_input', content, contentType: 'text/plain',
      status: 'completed', sequence: '1', inputTokens: '0', outputTokens: '0',
      modelId: 'gpt-5', providerId: 'openai', turnId: 'agent-turn-1',
      toolName: null, toolCallId: null, toolArguments: null as never,
      toolResult: null as never, driveRefs: [], parentItemId: null,
      createdBy: '3001', version: '1',
      createdAt: '2026-07-31T08:00:00.000Z', updatedAt: '2026-07-31T08:00:01.000Z',
      ...extra,
    } as AgentSessionItemRecord;
  }

  it('surfaces goal and hookFeedback flags on user message metadata', () => {
    const item = createUserItem('goal-1', 'my goal message', {
      goal: true,
      hookFeedback: true,
    });
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.goal).toBe(true);
    expect(metadata?.hookFeedback).toBe(true);
  });

  it('omits goal and hookFeedback flags when absent', () => {
    const item = createUserItem('plain-2', 'plain message', { goal: false });
    const views = toAgentSessionTranscriptItemViews([item], CTX);
    const metadata = views[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.goal).toBeUndefined();
    expect(metadata?.hookFeedback).toBeUndefined();
  });
});
