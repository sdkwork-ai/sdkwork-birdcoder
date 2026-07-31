import { describe, expect, it } from 'vitest';

import {
  isAgentSessionItemVisibleInTranscript,
  normalizeAgentSessionItemToolCalls,
  resolveAgentSessionItemPresentation,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  toAgentSessionItemView,
  toAgentSessionTranscriptItemViews,
  type AgentSessionItemRecord,
} from '../src/services/agentSessionViewModels.ts';

function createProviderSessionItem(
  itemId: string,
  providerItem: Record<string, unknown>,
): AgentSessionItemRecord {
  return {
    tenantId: '1001',
    organizationId: '2001',
    sessionId: 'agent-session-1',
    itemId,
    kind: 'tool_result',
    content: null,
    contentType: 'application/json',
    status: 'completed',
    sequence: itemId,
    inputTokens: '0',
    outputTokens: '0',
    modelId: 'gpt-5',
    providerId: 'openai',
    turnId: 'agent-turn-1',
    toolName: 'provider_event',
    toolCallId: itemId,
    toolResult: providerItem,
    driveRefs: [],
    createdBy: '3001',
    version: '1',
    createdAt: '2026-07-31T08:00:00.000Z',
    updatedAt: '2026-07-31T08:00:01.000Z',
    completedAt: '2026-07-31T08:00:01.000Z',
  };
}

function createProviderUserSessionItem(
  itemId: string,
  providerItem: Record<string, unknown>,
): AgentSessionItemRecord {
  return {
    ...createProviderSessionItem(itemId, providerItem),
    kind: 'user_input',
    content: JSON.stringify(providerItem),
    providerId: 'provider.model.codex',
    toolName: null,
    toolCallId: null,
    toolResult: undefined,
  };
}

function projectSingleToolCall(item: AgentSessionItemRecord) {
  const view = toAgentSessionItemView(item);
  return normalizeAgentSessionItemToolCalls(view.tool_calls, { engineId: 'codex' })[0];
}

describe('Codex provider Session item routing', () => {
  it('codex-provider-item-user-message: projects visible input and suppresses empty input', () => {
    const visibleItem = createProviderUserSessionItem('codex-user-message-1', {
      id: 'codex-user-message-1',
      type: 'userMessage',
      clientId: 'birdcoder-composer-1',
      content: [
        { type: 'text', text: 'Inspect the Session presentation.' },
        { type: 'localImage', path: 'E:\\workspace\\input.png' },
      ],
    });
    const visibleView = toAgentSessionItemView(visibleItem, { engineId: 'codex' });

    expect(visibleView.role).toBe('user');
    expect(visibleView.content).toBe('Inspect the Session presentation.');
    expect(visibleView.resources).toEqual([
      expect.objectContaining({ kind: 'image', path: 'E:\\workspace\\input.png' }),
    ]);
    expect(toAgentSessionTranscriptItemViews([visibleItem], { engineId: 'codex' }))
      .toHaveLength(1);

    const emptyItem = createProviderUserSessionItem('codex-user-message-empty', {
      id: 'codex-user-message-empty',
      type: 'userMessage',
      clientId: null,
      content: [],
    });
    expect(toAgentSessionTranscriptItemViews([emptyItem], { engineId: 'codex' }))
      .toEqual([]);
  });

  it('codex-provider-item-hook-prompt: projects non-empty fragments as hook feedback', () => {
    const visibleItem = createProviderSessionItem('codex-hook-prompt-1', {
      id: 'codex-hook-prompt-1',
      type: 'hookPrompt',
      fragments: [
        { text: 'Hook validation failed.', hookRunId: 'hook-run-1' },
        { text: 'Update the affected file.', hookRunId: 'hook-run-2' },
      ],
    });
    const visibleView = toAgentSessionItemView(visibleItem);

    expect(visibleView.role).toBe('user');
    expect(visibleView.content).toBe('Hook validation failed.\nUpdate the affected file.');
    expect(toAgentSessionTranscriptItemViews([visibleItem])).toHaveLength(1);

    const emptyItem = createProviderSessionItem('codex-hook-prompt-empty', {
      id: 'codex-hook-prompt-empty',
      type: 'hookPrompt',
      fragments: [{ text: '   ', hookRunId: 'hook-run-empty' }],
    });
    expect(toAgentSessionTranscriptItemViews([emptyItem])).toEqual([]);
  });

  it('codex-provider-item-agent-message: projects assistant Markdown', () => {
    const view = toAgentSessionItemView(createProviderSessionItem('codex-agent-message-1', {
      id: 'codex-agent-message-1',
      type: 'agentMessage',
      text: 'The Session projection is ready.',
      phase: 'final_answer',
      memoryCitation: null,
    }));

    expect(view.role).toBe('assistant');
    expect(view.content).toBe('The Session projection is ready.');
    expect(resolveAgentSessionItemPresentation(view).blocks)
      .toEqual(expect.arrayContaining([expect.objectContaining({ type: 'markdown' })]));
  });

  it('codex-provider-item-plan: keeps durable plan text separate from task progress', () => {
    const view = toAgentSessionItemView(createProviderSessionItem('codex-plan-1', {
      id: 'codex-plan-1',
      type: 'plan',
      text: '1. Inspect\n2. Repair\n3. Verify',
    }));

    expect(view.role).toBe('assistant');
    expect(view.content).toContain('Repair');
    expect(view.taskProgress).toBeUndefined();
  });

  it('codex-provider-item-reasoning: exposes summaries but suppresses raw content alone', () => {
    const summaryItem = createProviderSessionItem('codex-reasoning-1', {
      id: 'codex-reasoning-1',
      type: 'reasoning',
      summary: ['Checking provider Session routing.'],
      content: ['raw provider reasoning must not be exposed'],
    });
    const summaryView = toAgentSessionItemView(summaryItem);

    expect(summaryView.reasoning?.[0]?.summary).toBe('Checking provider Session routing.');
    expect(JSON.stringify(summaryView)).not.toContain('raw provider reasoning must not be exposed');
    expect(toAgentSessionTranscriptItemViews([summaryItem])).toHaveLength(1);

    const contentOnlyItem = createProviderSessionItem('codex-reasoning-content-only', {
      id: 'codex-reasoning-content-only',
      type: 'reasoning',
      summary: [],
      content: ['hidden chain-of-thought sentinel'],
    });
    expect(toAgentSessionTranscriptItemViews([contentOnlyItem])).toEqual([]);
    expect(JSON.stringify(toAgentSessionItemView(contentOnlyItem)))
      .not.toContain('hidden chain-of-thought sentinel');
  });

  it('codex-provider-item-command-execution: routes command state and bounded output', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-command-1', {
      id: 'codex-command-1',
      type: 'commandExecution',
      pluginId: null,
      scriptPath: null,
      command: 'pnpm typecheck',
      cwd: 'E:\\workspace',
      processId: 'process-1',
      source: 'agent',
      status: 'completed',
      commandActions: [],
      aggregatedOutput: 'Types are valid.',
      exitCode: 0,
      durationMs: 42,
    }));

    expect(call).toEqual(expect.objectContaining({
      kind: 'command',
      command: 'pnpm typecheck',
      durationMs: 42,
      status: 'success',
    }));
    expect(call?.output).toContain('Types are valid.');
  });

  it('codex-provider-item-file-change: routes non-empty changes and suppresses empty changes', () => {
    const changedItem = createProviderSessionItem('codex-file-change-1', {
      id: 'codex-file-change-1',
      type: 'fileChange',
      changes: [{ path: 'src/session.ts', kind: { type: 'update' }, diff: '+export {}' }],
      status: 'completed',
    });
    const changedView = toAgentSessionItemView(changedItem);

    expect(changedView.fileChanges).toEqual([
      expect.objectContaining({ path: 'src/session.ts', updateStatus: 'M' }),
    ]);
    expect(toAgentSessionTranscriptItemViews([changedItem])).toHaveLength(1);

    const emptyItem = createProviderSessionItem('codex-file-change-empty', {
      id: 'codex-file-change-empty',
      type: 'fileChange',
      changes: [],
      status: 'completed',
    });
    expect(toAgentSessionTranscriptItemViews([emptyItem])).toEqual([]);
  });

  it('codex-provider-item-mcp-tool-call: preserves MCP identity, result, and duration', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-mcp-1', {
      id: 'codex-mcp-1',
      type: 'mcpToolCall',
      server: 'docs',
      tool: 'search',
      status: 'completed',
      arguments: { query: 'Session contract' },
      appContext: null,
      pluginId: null,
      result: { content: [{ type: 'text', text: 'Found.' }] },
      error: null,
      durationMs: 18,
    }));

    expect(call).toEqual(expect.objectContaining({
      kind: 'mcp',
      name: 'search',
      serverName: 'docs',
      durationMs: 18,
      status: 'success',
    }));
    expect(call?.output).toContain('Found.');
  });

  it('codex-provider-item-dynamic-tool-call: shows public tools and hides internal tools', () => {
    const visibleItem = createProviderSessionItem('codex-dynamic-tool-1', {
      id: 'codex-dynamic-tool-1',
      type: 'dynamicToolCall',
      namespace: 'workspace',
      tool: 'inspect_symbols',
      arguments: { path: 'src/session.ts' },
      status: 'completed',
      contentItems: [{ type: 'inputText', text: 'Symbol found.' }],
      success: true,
      durationMs: 9,
    });
    expect(projectSingleToolCall(visibleItem)).toEqual(expect.objectContaining({
      name: 'inspect_symbols',
      status: 'success',
    }));
    expect(toAgentSessionTranscriptItemViews([visibleItem])).toHaveLength(1);

    const internalItem = createProviderSessionItem('codex-dynamic-tool-internal', {
      id: 'codex-dynamic-tool-internal',
      type: 'dynamicToolCall',
      namespace: null,
      tool: 'load_workspace_dependencies',
      arguments: {},
      status: 'completed',
      contentItems: null,
      success: true,
      durationMs: 1,
    });
    expect(toAgentSessionTranscriptItemViews([internalItem])).toEqual([]);
  });

  it('codex-provider-item-image-view: projects and groups consecutive typed image resources', () => {
    const view = toAgentSessionItemView(createProviderSessionItem('codex-image-view-1', {
      id: 'codex-image-view-1',
      type: 'imageView',
      path: 'E:\\workspace\\preview.png',
    }));

    expect(view.resources).toEqual([expect.objectContaining({
      kind: 'image',
      path: 'E:\\workspace\\preview.png',
    })]);
    expect(resolveAgentSessionItemPresentation(view).blocks.map((block) => block.type))
      .toEqual(['resources']);

    const groupedViews = toAgentSessionTranscriptItemViews([
      createProviderSessionItem('codex-image-view-1', {
        id: 'codex-image-view-1',
        type: 'imageView',
        path: 'E:\\workspace\\preview-1.png',
      }),
      createProviderSessionItem('codex-image-view-2', {
        id: 'codex-image-view-2',
        type: 'imageView',
        path: 'E:\\workspace\\preview-2.png',
      }),
      createProviderSessionItem('codex-agent-message-after-images', {
        id: 'codex-agent-message-after-images',
        type: 'agentMessage',
        text: 'Images inspected.',
        phase: 'final_answer',
        memoryCitation: null,
      }),
    ]);
    expect(groupedViews).toHaveLength(2);
    expect(groupedViews[0]?.resources?.map((resource) => resource.path)).toEqual([
      'E:\\workspace\\preview-1.png',
      'E:\\workspace\\preview-2.png',
    ]);

    const separatedViews = toAgentSessionTranscriptItemViews([
      createProviderSessionItem('codex-image-view-before-sleep', {
        id: 'codex-image-view-before-sleep',
        type: 'imageView',
        path: 'E:\\workspace\\before-sleep.png',
      }),
      createProviderSessionItem('codex-sleep-between-images', {
        id: 'codex-sleep-between-images',
        type: 'sleep',
        durationMs: 25,
      }),
      createProviderSessionItem('codex-image-view-after-sleep', {
        id: 'codex-image-view-after-sleep',
        type: 'imageView',
        path: 'E:\\workspace\\after-sleep.png',
      }),
    ]);
    expect(separatedViews).toHaveLength(2);
    expect(separatedViews.map((item) => item.resources?.[0]?.path)).toEqual([
      'E:\\workspace\\before-sleep.png',
      'E:\\workspace\\after-sleep.png',
    ]);
  });

  it('codex-provider-item-web-search: routes direct items through the Codex web adapter', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-web-search-1', {
      id: 'codex-web-search-1',
      type: 'webSearch',
      query: 'BirdCoder provider Session protocol',
      action: { type: 'search', query: 'BirdCoder provider Session protocol' },
      results: [{
        type: 'text_result',
        ref_id: 'turn0search0',
        url: 'https://example.test/provider-session-protocol',
      }],
    }));

    expect(call).toEqual(expect.objectContaining({
      kind: 'web',
      name: 'web_search',
      target: 'BirdCoder provider Session protocol',
    }));
  });

  it('codex-provider-item-collaboration-tool-call: routes non-wait actions with Session identifiers', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-collaboration-1', {
      id: 'codex-collaboration-1',
      type: 'collabAgentToolCall',
      tool: 'spawnAgent',
      status: 'completed',
      senderThreadId: 'provider-session-parent',
      receiverThreadIds: ['provider-session-child'],
      prompt: 'Inspect provider payload routing.',
    }));
    const args = JSON.parse(call?.arguments ?? '{}') as Record<string, unknown>;

    expect(call).toEqual(expect.objectContaining({ kind: 'agent', name: 'spawnAgent' }));
    expect(args).toEqual(expect.objectContaining({
      senderSessionId: 'provider-session-parent',
      receiverSessionIds: ['provider-session-child'],
    }));
    expect(JSON.stringify(args)).not.toMatch(/"[^"]*thread[^"]*"\s*:/iu);

    const waitItem = createProviderSessionItem('codex-collaboration-wait', {
      id: 'codex-collaboration-wait',
      type: 'collabAgentToolCall',
      tool: 'wait',
      status: 'completed',
      senderThreadId: 'provider-session-parent',
      receiverThreadIds: ['provider-session-child'],
      prompt: null,
    });
    expect(toAgentSessionTranscriptItemViews([waitItem])).toEqual([]);
  });

  it('codex-provider-item-sub-agent-activity: routes direct items with Session identifiers', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-subagent-1', {
      id: 'codex-subagent-1',
      type: 'subAgentActivity',
      kind: 'interrupted',
      agentThreadId: 'provider-session-child',
      agentPath: '/root/worker',
    }));
    const args = JSON.parse(call?.arguments ?? '{}') as Record<string, unknown>;

    expect(call).toEqual(expect.objectContaining({
      kind: 'agent',
      name: 'subagent_interrupted',
      status: 'cancelled',
      target: '/root/worker',
    }));
    expect(args).toEqual(expect.objectContaining({
      agentSessionId: 'provider-session-child',
    }));
    expect(JSON.stringify(args)).not.toMatch(/"[^"]*thread[^"]*"\s*:/iu);
  });

  it('codex-provider-item-context-compaction: renders only a visible lifecycle marker', () => {
    const item = createProviderSessionItem('codex-context-compaction-1', {
      id: 'codex-context-compaction-1',
      type: 'contextCompaction',
      source: 'manual',
    });
    const view = toAgentSessionItemView(item);
    const presentation = resolveAgentSessionItemPresentation(view);

    expect(isAgentSessionItemVisibleInTranscript(view)).toBe(true);
    expect(view.lifecycleEvents).toEqual([{
      id: 'codex-context-compaction-1',
      kind: 'compacted',
    }]);
    expect(presentation.blocks.map((block) => block.type)).toEqual(['lifecycle']);
  });

  it.each([
    ['codex-provider-item-sleep', { id: 'codex-sleep-1', type: 'sleep', durationMs: 750 }],
    ['codex-provider-item-entered-review-mode', {
      id: 'codex-entered-review-1',
      type: 'enteredReviewMode',
      review: 'Review the current changes.',
    }],
    ['codex-provider-item-exited-review-mode', {
      id: 'codex-exited-review-1',
      type: 'exitedReviewMode',
      review: 'Review completed.',
    }],
  ])('%s: suppresses the direct item through canonical transcript visibility metadata', (_, providerItem) => {
    const item = createProviderSessionItem(String(providerItem.id), providerItem);
    const view = toAgentSessionItemView(item);

    expect(view.metadata?.transcriptVisibility).toBe('hidden');
    expect(isAgentSessionItemVisibleInTranscript(view)).toBe(false);
    expect(toAgentSessionTranscriptItemViews([item])).toEqual([]);
  });

  it('codex-provider-item-image-generation: preserves generated media output', () => {
    const item = createProviderSessionItem('codex-image-generation-1', {
      id: 'codex-image-generation-1',
      type: 'imageGeneration',
      status: 'completed',
      revisedPrompt: 'A precise Session state diagram',
      result: 'aGVsbG8=',
      savedPath: 'E:\\workspace\\session-diagram.png',
    });
    const call = projectSingleToolCall(item);

    expect(call).toEqual(expect.objectContaining({
      kind: 'media',
      name: 'image_generation',
      status: 'success',
      target: 'E:\\workspace\\session-diagram.png',
    }));
    expect(call?.resultBlocks).toEqual([
      expect.objectContaining({ type: 'image', source: 'data:image/png;base64,aGVsbG8=' }),
    ]);
  });
});
