import { describe, expect, it } from 'vitest';

import {
  normalizeAgentSessionItemLifecycleEvents,
  normalizeAgentSessionItemToolCalls,
  type AgentSessionItemToolCallView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { resolveAgentSessionProviderPayload } from '../src/services/agentSessionProviderPayload.ts';

type RealtimeProviderEngineId =
  | 'claude-code'
  | 'gemini'
  | 'hermes'
  | 'openclaw'
  | 'opencode';

function projectProviderCalls(
  values: readonly unknown[],
  engineId: RealtimeProviderEngineId,
): AgentSessionItemToolCallView[] {
  const payload = resolveAgentSessionProviderPayload(values, {
    completedAt: '2026-08-01T08:00:01.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    itemId: `provider-realtime-${engineId}`,
  });
  expect(payload).not.toBeNull();
  return normalizeAgentSessionItemToolCalls(payload?.toolCalls, { engineId });
}

function projectProviderPayload(values: readonly unknown[]) {
  const payload = resolveAgentSessionProviderPayload(values, {
    completedAt: '2026-08-01T08:00:01.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    itemId: 'provider-realtime-opencode-payload',
  });
  expect(payload).not.toBeNull();
  return payload;
}

function createOpenClawApproval(
  status: 'allowed' | 'denied' | 'pending',
  decision?: 'allow-once' | 'deny',
) {
  return {
    id: 'openclaw-approval-1',
    urlPath: '/approval/openclaw-approval-1',
    createdAtMs: 1_785_568_800_000,
    expiresAtMs: 1_785_568_860_000,
    status,
    ...(decision ? { decision, reason: 'user' } : {}),
    presentation: {
      kind: 'exec',
      commandText: 'pnpm test',
      commandPreview: 'pnpm test',
      warningText: 'Run the repository tests?',
      allowedDecisions: ['allow-once', 'deny'],
    },
  };
}

describe('provider realtime event projection', () => {
  it('merges Claude Code assistant tool use with its user tool result block', () => {
    const calls = projectProviderCalls([
      {
        type: 'assistant',
        uuid: 'claude-assistant-1',
        sessionId: 'claude-provider-session-1',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 'claude-tool-1',
            name: 'mcp__filesystem__read_file',
            input: { path: 'README.md' },
          }],
        },
      },
      {
        type: 'user',
        uuid: 'claude-tool-result-1',
        sessionId: 'claude-provider-session-1',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'claude-tool-1',
            content: [{ type: 'text', text: 'README content' }],
          }],
        },
      },
    ], 'claude-code');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'claude-tool-1',
      kind: 'mcp',
      name: 'read_file',
      output: 'README content',
      serverName: 'filesystem',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('merges Gemini stream-json tool_use and tool_result records by tool_id', () => {
    const calls = projectProviderCalls([
      {
        type: 'tool_use',
        timestamp: '2026-08-01T08:00:00.000Z',
        tool_name: 'read_file',
        tool_id: 'gemini-tool-1',
        parameters: { path: 'README.md' },
      },
      {
        type: 'tool_result',
        timestamp: '2026-08-01T08:00:01.000Z',
        tool_id: 'gemini-tool-1',
        status: 'success',
        output: 'README content',
      },
    ], 'gemini');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'gemini-tool-1',
      kind: 'file',
      name: 'read_file',
      output: 'README content',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('merges OpenCode message.part.updated tool snapshots by callID', () => {
    const basePart = {
      id: 'opencode-part-1',
      sessionID: 'opencode-provider-session-1',
      messageID: 'opencode-message-1',
      type: 'tool',
      callID: 'opencode-tool-1',
      tool: 'mcp__filesystem__read_file',
    };
    const calls = projectProviderCalls([
      {
        type: 'message.part.updated',
        properties: {
          sessionID: 'opencode-provider-session-1',
          time: 1_785_568_800_001,
          part: {
            ...basePart,
            state: {
              status: 'running',
              input: { path: 'README.md' },
              title: 'Read README.md',
              time: { start: 1_785_568_800_000 },
            },
          },
        },
      },
      {
        type: 'message.part.updated',
        properties: {
          sessionID: 'opencode-provider-session-1',
          time: 1_785_568_800_250,
          part: {
            ...basePart,
            state: {
              status: 'completed',
              input: { path: 'README.md' },
              output: 'README content',
              title: 'Read README.md',
              metadata: {},
              time: {
                start: 1_785_568_800_000,
                end: 1_785_568_800_250,
              },
            },
          },
        },
      },
    ], 'opencode');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      durationMs: 250,
      id: 'opencode-tool-1',
      kind: 'mcp',
      name: 'mcp__filesystem__read_file',
      output: 'README content',
      serverName: 'filesystem',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('replays OpenCode part deltas in wire order and lets a full snapshot replace them', () => {
    const sessionID = 'opencode-provider-session-delta';
    const messageID = 'opencode-message-delta';
    const updated = (id: string, text: string) => ({
      type: 'message.part.updated',
      properties: {
        sessionID,
        time: 1_785_568_800_001,
        part: { id, messageID, sessionID, text, type: 'text' },
      },
    });
    const delta = (partID: string, value: string) => ({
      type: 'message.part.delta',
      properties: {
        delta: value,
        field: 'text',
        messageID,
        partID,
        sessionID,
      },
    });
    const payload = projectProviderPayload([
      updated('opencode-part-delta-1', 'ha'),
      delta('opencode-part-delta-1', ' ha'),
      delta('opencode-part-delta-1', ' ha'),
      updated('opencode-part-delta-2', 'Draft'),
      delta('opencode-part-delta-2', ' text'),
      updated('opencode-part-delta-2', 'Final answer'),
    ]);

    expect(payload?.content).toBe('ha ha ha\n\nFinal answer');
  });

  it('honors OpenCode part removal and restores only from a later full update', () => {
    const sessionID = 'opencode-provider-session-remove';
    const messageID = 'opencode-message-remove';
    const part = {
      callID: 'opencode-tool-remove',
      id: 'opencode-part-remove',
      messageID,
      sessionID,
      state: {
        input: { path: 'removed.txt' },
        status: 'running',
        time: { start: 1_785_568_800_000 },
      },
      tool: 'read_file',
      type: 'tool',
    };
    const update = (nextPart: Record<string, unknown>) => ({
      type: 'message.part.updated',
      properties: { part: nextPart, sessionID, time: 1_785_568_800_001 },
    });
    const removed = {
      type: 'message.part.removed',
      properties: { messageID, partID: part.id, sessionID },
    };

    expect(projectProviderCalls([update(part), removed], 'opencode')).toEqual([]);

    const restored = projectProviderCalls([
      update(part),
      removed,
      update({
        ...part,
        state: {
          input: { path: 'restored.txt' },
          status: 'completed',
          time: { start: 1_785_568_800_000, end: 1_785_568_800_100 },
        },
      }),
    ], 'opencode');
    expect(restored).toHaveLength(1);
    expect(JSON.parse(restored[0]?.arguments ?? '{}')).toEqual({ path: 'restored.txt' });
  });

  it('keeps OpenCode message removal authoritative until its parent is restored', () => {
    const sessionID = 'opencode-provider-session-message-remove';
    const messageID = 'opencode-message-parent-remove';
    const part = {
      callID: 'opencode-tool-parent-remove',
      id: 'opencode-part-parent-remove',
      messageID,
      sessionID,
      state: { input: {}, status: 'running', time: { start: 1_785_568_800_000 } },
      tool: 'list_files',
      type: 'tool',
    };
    const messageUpdated = () => ({
      type: 'message.updated',
      properties: {
        info: { id: messageID, role: 'assistant', sessionID },
        sessionID,
      },
    });
    const partUpdated = () => ({
      type: 'message.part.updated',
      properties: { part, sessionID, time: 1_785_568_800_001 },
    });
    const messageRemoved = {
      type: 'message.removed',
      properties: { messageID, sessionID },
    };

    expect(projectProviderCalls([
      messageUpdated(),
      partUpdated(),
      messageRemoved,
      partUpdated(),
    ], 'opencode')).toEqual([]);

    expect(projectProviderCalls([
      messageUpdated(),
      partUpdated(),
      messageRemoved,
      messageUpdated(),
      partUpdated(),
    ], 'opencode')).toHaveLength(1);
  });

  it('merges OpenClaw start, update, and result events by toolCallId', () => {
    const calls = projectProviderCalls([
      {
        runId: 'openclaw-run-1',
        seq: 1,
        stream: 'tool',
        ts: 1_785_568_800_001,
        data: {
          phase: 'start',
          name: 'filesystem__read_file',
          toolCallId: 'openclaw-tool-1',
          args: { path: 'README.md' },
        },
      },
      {
        runId: 'openclaw-run-1',
        seq: 2,
        stream: 'tool',
        ts: 1_785_568_800_002,
        data: {
          phase: 'update',
          name: 'filesystem__read_file',
          toolCallId: 'openclaw-tool-1',
          partialResult: [{ type: 'text', text: 'README partial' }],
        },
      },
      {
        runId: 'openclaw-run-1',
        seq: 3,
        stream: 'tool',
        ts: 1_785_568_800_003,
        data: {
          phase: 'result',
          name: 'filesystem__read_file',
          toolCallId: 'openclaw-tool-1',
          isError: false,
          result: [{ type: 'text', text: 'README content' }],
        },
      },
    ], 'openclaw');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'openclaw-tool-1',
      kind: 'mcp',
      name: 'read_file',
      serverName: 'filesystem',
      status: 'success',
      output: 'README content',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
    expect(calls[0]?.resultBlocks).toEqual([{
      type: 'text',
      text: 'README content',
    }]);
  });

  it('retains OpenClaw partial output when the terminal error has no result body', () => {
    const calls = projectProviderCalls([
      {
        runId: 'openclaw-run-error',
        seq: 1,
        stream: 'tool',
        ts: 1_785_568_800_010,
        data: {
          phase: 'start',
          name: 'exec',
          toolCallId: 'openclaw-tool-error',
          args: { command: 'pnpm test' },
        },
      },
      {
        runId: 'openclaw-run-error',
        seq: 2,
        stream: 'tool',
        ts: 1_785_568_800_011,
        data: {
          phase: 'update',
          name: 'exec',
          toolCallId: 'openclaw-tool-error',
          partialResult: { stdout: 'First suite passed.' },
        },
      },
      {
        runId: 'openclaw-run-error',
        seq: 3,
        stream: 'tool',
        ts: 1_785_568_800_012,
        data: {
          phase: 'result',
          name: 'exec',
          toolCallId: 'openclaw-tool-error',
          isError: true,
          toolErrorSummary: 'Second suite failed.',
        },
      },
    ], 'openclaw');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'openclaw-tool-error',
      command: 'pnpm test',
      output: 'Second suite failed.',
      status: 'error',
    }));
    expect(calls[0]?.resultBlocks).toEqual([
      { type: 'error', message: 'Second suite failed.' },
      { type: 'text', text: 'First suite passed.' },
    ]);
  });

  it('merges Hermes tool progress lifecycle events', () => {
    const calls = projectProviderCalls([
      {
        event: 'hermes.tool.progress',
        data: {
          tool: 'web_search',
          label: 'Search for Session protocol',
          toolCallId: 'hermes-tool-1',
          status: 'running',
          args: { query: 'Session protocol' },
        },
      },
      {
        event: 'hermes.tool.progress',
        data: {
          tool: 'web_search',
          toolCallId: 'hermes-tool-1',
          status: 'completed',
        },
      },
    ], 'hermes');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'hermes-tool-1',
      kind: 'web',
      name: 'web_search',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({
      query: 'Session protocol',
    });
  });

  it('merges Hermes TUI gateway JSON-RPC tool frames by tool_id', () => {
    const calls = projectProviderCalls([
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.start',
          session_id: 'hermes-live-1',
          payload: {
            tool_id: 'hermes-tui-tool-1',
            name: 'read_file',
            context: 'README.md',
          },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.complete',
          session_id: 'hermes-live-1',
          payload: {
            tool_id: 'hermes-tui-tool-1',
            name: 'read_file',
            args: { path: 'README.md' },
            result: 'README content',
            duration_s: 0.25,
          },
        },
      },
    ], 'hermes');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'hermes-tui-tool-1',
      durationMs: 250,
      kind: 'file',
      name: 'read_file',
      output: 'README content',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('settles a Hermes TUI tool frame when tool.complete omits the optional name', () => {
    const calls = projectProviderCalls([
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.start',
          session_id: 'hermes-live-1',
          payload: {
            tool_id: 'hermes-tui-tool-without-terminal-name',
            name: 'read_file',
            args_text: '{"path":"README.md"}',
          },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.complete',
          session_id: 'hermes-live-1',
          payload: {
            tool_id: 'hermes-tui-tool-without-terminal-name',
            result_text: 'README content',
          },
        },
      },
    ], 'hermes');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'hermes-tui-tool-without-terminal-name',
      name: 'read_file',
      output: 'README content',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({ path: 'README.md' });
  });

  it('fails closed for Hermes approval.request frames without a stable request id', () => {
    const calls = projectProviderCalls([{
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'approval.request',
        session_id: 'hermes-live-1',
        payload: {
          command: 'pnpm test',
          description: 'Run project tests',
          choices: ['once', 'session', 'always', 'deny'],
        },
      },
    }], 'hermes');

    expect(calls).toEqual([]);
  });

  it('projects direct Hermes lifecycle payloads without claiming typed provider items', () => {
    const calls = projectProviderCalls([
      {
        tool: 'web_search',
        toolCallId: 'hermes-direct-tool-1',
        status: 'running',
        args: { query: 'provider protocol' },
      },
      {
        tool: 'web_search',
        toolCallId: 'hermes-direct-tool-1',
        status: 'completed',
      },
    ], 'hermes');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'hermes-direct-tool-1',
      kind: 'web',
      name: 'web_search',
      status: 'success',
    }));
    expect(JSON.parse(calls[0]?.arguments ?? '{}')).toEqual({
      query: 'provider protocol',
    });
  });

  it.each([
    ['allowed', 'allow-once', 'success', 'approved'],
    ['denied', 'deny', 'cancelled', 'denied'],
  ] as const)(
    'merges OpenClaw Session approval pending and %s transitions',
    (approvalStatus, decision, toolStatus, interactionStatus) => {
      const pendingEvent = {
        event: 'session.approval',
        data: {
          phase: 'pending',
          sessionKey: 'agent:main:session-1',
          updatedAtMs: 1_785_568_800_020,
          approval: createOpenClawApproval('pending'),
        },
      };
      const pendingCalls = projectProviderCalls([pendingEvent], 'openclaw');
      const mergedCalls = projectProviderCalls([
        pendingEvent,
        {
          event: 'session.approval',
          data: {
            phase: 'terminal',
            sessionKey: 'agent:main:session-1',
            updatedAtMs: 1_785_568_800_021,
            approval: createOpenClawApproval(approvalStatus, decision),
          },
        },
      ], 'openclaw');

      expect(pendingCalls).toHaveLength(1);
      expect(pendingCalls[0]).toEqual(expect.objectContaining({
        id: 'openclaw-approval-1',
        kind: 'approval',
        status: 'waiting',
        interaction: expect.objectContaining({
          requiresResponse: true,
          status: 'pending',
        }),
      }));
      expect(mergedCalls).toHaveLength(1);
      expect(mergedCalls[0]).toEqual(expect.objectContaining({
        id: 'openclaw-approval-1',
        kind: 'approval',
        status: toolStatus,
        interaction: expect.objectContaining({
          decision,
          status: interactionStatus,
        }),
      }));
      expect(mergedCalls[0]?.interaction?.requiresResponse).toBeUndefined();
    },
  );

  it('merges legacy exec approval request and resolution wrappers', () => {
    const calls = projectProviderCalls([
      {
        event: 'exec.approval.requested',
        payload: {
          id: 'legacy-exec-approval-1',
          request: {
            command: 'pnpm lint',
            warningText: 'Run the lint command?',
          },
        },
      },
      {
        event: 'exec.approval.resolved',
        payload: {
          id: 'legacy-exec-approval-1',
          decision: 'deny',
        },
      },
    ], 'openclaw');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'legacy-exec-approval-1',
      kind: 'approval',
      status: 'cancelled',
      interaction: expect.objectContaining({
        action: 'pnpm lint',
        decision: 'deny',
        prompt: 'Run the lint command?',
        status: 'denied',
      }),
    }));
  });

  it('merges Hermes Responses items by call_id and flattens input_text output', () => {
    const calls = projectProviderCalls([
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          id: 'fc_hermes_1',
          type: 'function_call',
          status: 'in_progress',
          name: 'read_file',
          call_id: 'hermes-response-call-1',
          arguments: '{"path":"README.md"}',
        },
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: {
          id: 'fc_hermes_1',
          type: 'function_call',
          status: 'completed',
          name: 'read_file',
          call_id: 'hermes-response-call-1',
          arguments: '{"path":"README.md"}',
        },
      },
      {
        type: 'response.output_item.added',
        output_index: 1,
        item: {
          id: 'fco_hermes_1',
          type: 'function_call_output',
          status: 'completed',
          call_id: 'hermes-response-call-1',
          output: [{ type: 'input_text', text: 'README content' }],
        },
      },
    ], 'hermes');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.objectContaining({
      id: 'hermes-response-call-1',
      kind: 'file',
      name: 'read_file',
      output: 'README content',
      status: 'success',
    }));
    expect(calls[0]?.resultBlocks).toEqual([{
      type: 'text',
      text: 'README content',
    }]);
  });

  it('assembles Hermes message and reasoning deltas without losing spaces or duplicating final snapshots', () => {
    const payload = resolveAgentSessionProviderPayload([
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'message.delta',
          payload: { text: 'Draft' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'message.delta',
          payload: { text: ' text' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'message.interim',
          payload: { text: 'Draft text' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'reasoning.delta',
          payload: { text: 'Inspect' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'reasoning.delta',
          payload: { text: ' the repository' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'reasoning.available',
          payload: { text: 'This snapshot must not replace streamed reasoning.' },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'message.complete',
          payload: { text: 'Final answer' },
        },
      },
    ], {
      completedAt: '2026-08-01T08:00:01.000Z',
      createdAt: '2026-08-01T08:00:00.000Z',
      itemId: 'hermes-message-stream',
    });

    expect(payload).toEqual(expect.objectContaining({
      content: 'Final answer',
      role: 'assistant',
    }));
    expect(payload?.content).not.toContain('Draft text');
    expect(payload?.reasoning).toEqual([
      expect.objectContaining({ summary: 'Inspect the repository' }),
    ]);
  });

  it('retains repeated Hermes delta fragments in their exact wire order', () => {
    const payload = resolveAgentSessionProviderPayload([
      {
        method: 'event',
        params: { type: 'message.delta', payload: { text: 'ha' } },
      },
      {
        method: 'event',
        params: { type: 'message.delta', payload: { text: 'ha' } },
      },
      {
        method: 'event',
        params: { type: 'message.delta', payload: { text: ' again' } },
      },
    ], {
      createdAt: '2026-08-01T08:00:00.000Z',
      itemId: 'hermes-repeated-deltas',
    });

    expect(payload?.content).toBe('haha again');
  });

  it('projects Hermes tool context and retains result text beside inline diffs', () => {
    const frames = [
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.start',
          payload: {
            tool_id: 'hermes-edit-1',
            name: 'edit_file',
            context: 'src/session.ts',
          },
        },
      },
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'tool.complete',
          payload: {
            tool_id: 'hermes-edit-1',
            name: 'edit_file',
            args: { path: 'src/session.ts' },
            result: { changed: true },
            result_text: 'Updated src/session.ts',
            inline_diff: '@@ -1 +1 @@\n-threadId\n+sessionId',
          },
        },
      },
    ];
    const liveCalls = projectProviderCalls(frames.slice(0, 1), 'hermes');
    const completedCalls = projectProviderCalls(frames, 'hermes');

    expect(liveCalls[0]).toEqual(expect.objectContaining({
      id: 'hermes-edit-1',
      status: 'running',
      title: 'src/session.ts',
    }));
    expect(JSON.parse(liveCalls[0]?.arguments ?? '{}')).toEqual({
      context: 'src/session.ts',
    });
    expect(completedCalls[0]).toEqual(expect.objectContaining({
      id: 'hermes-edit-1',
      status: 'success',
      title: 'src/session.ts',
    }));
    expect(completedCalls[0]?.resultBlocks).toEqual(expect.arrayContaining([
      { type: 'text', text: 'Updated src/session.ts' },
      {
        type: 'diff',
        content: '@@ -1 +1 @@\n-threadId\n+sessionId',
      },
    ]));
  });

  it('projects Hermes clarify request and expiry by stable request_id', () => {
    const request = {
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'clarify.request',
        payload: {
          request_id: 'hermes-question-1',
          question: 'Which Session should be resumed?',
          choices: ['Current Session', 'New Session'],
          multi_select: true,
        },
      },
    };
    const pendingCalls = projectProviderCalls([request], 'hermes');
    const expiredCalls = projectProviderCalls([
      request,
      {
        jsonrpc: '2.0',
        method: 'event',
        params: {
          type: 'clarify.expire',
          payload: { request_id: 'hermes-question-1' },
        },
      },
    ], 'hermes');

    expect(pendingCalls).toHaveLength(1);
    expect(pendingCalls[0]).toEqual(expect.objectContaining({
      id: 'hermes-question-1',
      kind: 'question',
      status: 'waiting',
      interaction: expect.objectContaining({
        id: 'hermes-question-1',
        requiresResponse: true,
        status: 'pending',
        questions: [{
          id: 'hermes-question-1',
          question: 'Which Session should be resumed?',
          options: [
            { label: 'Current Session' },
            { label: 'New Session' },
          ],
          multiple: true,
          allowCustomAnswer: true,
        }],
      }),
    }));
    expect(expiredCalls[0]).toEqual(expect.objectContaining({
      id: 'hermes-question-1',
      kind: 'question',
      status: 'cancelled',
      interaction: expect.objectContaining({
        status: 'cancelled',
      }),
    }));
    expect(expiredCalls[0]?.interaction?.requiresResponse).toBeUndefined();
    expect(expiredCalls[0]?.interaction?.questions).toEqual(
      pendingCalls[0]?.interaction?.questions,
    );
  });

  it('maps Hermes compaction status and error frames to canonical lifecycle events', () => {
    const compacted = normalizeAgentSessionItemLifecycleEvents([{
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'status.update',
        payload: {
          kind: 'compacting',
          text: 'Summarizing conversation context...',
        },
      },
    }]);
    const failed = normalizeAgentSessionItemLifecycleEvents([{
      jsonrpc: '2.0',
      method: 'event',
      params: {
        type: 'error',
        payload: { message: 'Provider disconnected.' },
      },
    }]);

    expect(compacted).toEqual([
      expect.objectContaining({
        automatic: true,
        detail: 'Summarizing conversation context...',
        kind: 'compacted',
      }),
    ]);
    expect(failed).toEqual([
      expect.objectContaining({
        detail: 'Provider disconnected.',
        kind: 'failed',
      }),
    ]);
  });
});
