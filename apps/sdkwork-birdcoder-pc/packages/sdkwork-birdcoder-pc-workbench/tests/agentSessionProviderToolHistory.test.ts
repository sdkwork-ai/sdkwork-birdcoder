import { describe, expect, it } from 'vitest';

import {
  composeAgentSessionTranscriptActivity,
  normalizeAgentSessionItemToolCalls,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  toAgentSessionItemView,
  type AgentSessionItemRecord,
} from '../src/services/agentSessionViewModels.ts';

function createProviderToolHistoryItem(
  itemId: string,
  kind: 'tool_call' | 'tool_result',
  toolCallId: string,
  providerPayload: Record<string, unknown>,
): AgentSessionItemRecord {
  return {
    tenantId: '1001',
    organizationId: '2001',
    sessionId: 'agent-session-provider-history',
    itemId,
    kind,
    content: null,
    contentType: 'application/json',
    status: 'completed',
    sequence: itemId,
    inputTokens: '0',
    outputTokens: '0',
    modelId: 'provider-model',
    providerId: 'provider-host',
    turnId: 'agent-turn-provider-history',
    toolName: 'provider_history',
    toolCallId,
    toolResult: providerPayload,
    driveRefs: [],
    createdBy: '3001',
    version: '1',
    createdAt: kind === 'tool_call'
      ? '2026-08-01T08:00:00.000Z'
      : '2026-08-01T08:00:01.000Z',
    updatedAt: '2026-08-01T08:00:01.000Z',
    completedAt: '2026-08-01T08:00:01.000Z',
  };
}

function projectMergedHistory(
  engineId: 'hermes' | 'openclaw',
  request: AgentSessionItemRecord,
  result: AgentSessionItemRecord,
) {
  const items = [request, result].map((item) => toAgentSessionItemView(item, { engineId }));
  return composeAgentSessionTranscriptActivity(items, { engineId });
}

describe('provider durable tool history projection', () => {
  it('projects and merges OpenClaw llm-core toolCall and toolResult messages', () => {
    const toolCallId = 'openclaw-tool-call-1';
    const request = createProviderToolHistoryItem(
      'openclaw-request-1',
      'tool_call',
      toolCallId,
      {
        role: 'assistant',
        content: [{
          type: 'toolCall',
          id: toolCallId,
          name: 'read_file',
          arguments: { path: 'README.md' },
        }],
      },
    );
    const result = createProviderToolHistoryItem(
      'openclaw-result-1',
      'tool_result',
      toolCallId,
      {
        role: 'toolResult',
        toolCallId,
        toolName: 'read_file',
        content: [{ type: 'text', text: 'README content' }],
        isError: false,
      },
    );

    const merged = projectMergedHistory('openclaw', request, result);
    const calls = normalizeAgentSessionItemToolCalls(merged[0]?.tool_calls, {
      engineId: 'openclaw',
    });

    expect(merged).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: toolCallId,
      name: 'read_file',
      kind: 'file',
      status: 'success',
    }));
    expect(calls[0]?.output).toContain('README content');
    expect(calls[0]?.resultBlocks).toEqual([{
      type: 'text',
      text: 'README content',
    }]);
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('maps an OpenClaw llm-core toolResult error to a failed canonical call', () => {
    const view = toAgentSessionItemView(createProviderToolHistoryItem(
      'openclaw-result-error',
      'tool_result',
      'openclaw-tool-call-error',
      {
        role: 'toolResult',
        toolCallId: 'openclaw-tool-call-error',
        toolName: 'read_file',
        content: [{ type: 'text', text: 'File not found' }],
        isError: true,
      },
    ), { engineId: 'openclaw' });
    const call = normalizeAgentSessionItemToolCalls(view.tool_calls, {
      engineId: 'openclaw',
    })[0];

    expect(call).toEqual(expect.objectContaining({
      id: 'openclaw-tool-call-error',
      status: 'error',
    }));
    expect(call?.output).toContain('File not found');
    expect(call?.resultBlocks).toEqual([{
      type: 'error',
      message: 'File not found',
    }]);
  });

  it('projects and merges Hermes OpenAI-compatible assistant and tool messages', () => {
    const toolCallId = 'hermes-tool-call-1';
    const request = createProviderToolHistoryItem(
      'hermes-request-1',
      'tool_call',
      toolCallId,
      {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: toolCallId,
          type: 'function',
          function: {
            name: 'mcp__filesystem__read_file',
            arguments: '{"path":"README.md"}',
          },
        }],
      },
    );
    const result = createProviderToolHistoryItem(
      'hermes-result-1',
      'tool_result',
      toolCallId,
      {
        role: 'tool',
        tool_call_id: toolCallId,
        content: 'README content',
      },
    );

    const merged = projectMergedHistory('hermes', request, result);
    const calls = normalizeAgentSessionItemToolCalls(merged[0]?.tool_calls, {
      engineId: 'hermes',
    });

    expect(merged).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: toolCallId,
      kind: 'mcp',
      name: 'read_file',
      serverName: 'filesystem',
      output: 'README content',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });
});
