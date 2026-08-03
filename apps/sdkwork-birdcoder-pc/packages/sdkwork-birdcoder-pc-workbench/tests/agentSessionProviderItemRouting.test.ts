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

  it('codex-provider-item-user-message: unwraps the delegation envelope into a source label', () => {
    const delegatedItem = createProviderUserSessionItem('codex-user-message-delegated', {
      id: 'codex-user-message-delegated',
      type: 'userMessage',
      content: [{
        type: 'text',
        text: '<codex_delegation>\n'
          + '<source_thread_id>provider-session-source-1</source_thread_id>\n'
          + '<input>Finish the protocol notes.</input>\n'
          + '</codex_delegation>',
      }],
    });
    const delegatedView = toAgentSessionItemView(delegatedItem, { engineId: 'codex' });

    expect(delegatedView.role).toBe('user');
    expect(delegatedView.content).toBe('Finish the protocol notes.');
    expect(delegatedView.metadata?.providerUserMessageSource).toEqual({
      kind: 'codex-delegation',
      sourceSessionId: 'provider-session-source-1',
    });
    expect(delegatedView.content).not.toMatch(/codex_delegation|source_thread_id/iu);

    const plainItem = createProviderUserSessionItem('codex-user-message-plain', {
      id: 'codex-user-message-plain',
      type: 'userMessage',
      content: [{ type: 'text', text: 'A regular prompt.' }],
    });
    const plainView = toAgentSessionItemView(plainItem, { engineId: 'codex' });
    expect(plainView.metadata?.providerUserMessageSource).toBeUndefined();
  });

  it('codex-provider-item-user-message: unwraps the scheduled-task heartbeat envelope', () => {
    const heartbeatItem = createProviderUserSessionItem('codex-user-message-heartbeat', {
      id: 'codex-user-message-heartbeat',
      type: 'userMessage',
      content: [{
        type: 'text',
        text: '<heartbeat>\n'
          + '<automation_id>automation.e2e-1</automation_id>\n'
          + '<current_time_iso>2026-08-03T00:00:00Z</current_time_iso>\n'
          + '<instructions>Run the nightly Session audit.</instructions>\n'
          + '</heartbeat>',
      }],
    });
    const heartbeatView = toAgentSessionItemView(heartbeatItem, { engineId: 'codex' });

    expect(heartbeatView.role).toBe('user');
    expect(heartbeatView.content).toBe('Run the nightly Session audit.');
    expect(heartbeatView.metadata?.providerUserMessageSource).toEqual({
      kind: 'automation-heartbeat',
      automationId: 'automation.e2e-1',
    });
    expect(heartbeatView.content).not.toMatch(/heartbeat|automation_id/iu);

    const inlineItem = createProviderUserSessionItem('codex-user-message-inline-heartbeat', {
      id: 'codex-user-message-inline-heartbeat',
      type: 'userMessage',
      content: [{
        type: 'text',
        text: 'Morning check.\n<heartbeat><automation_id>a-2</automation_id>'
          + '<current_time_iso>2026-08-03T00:00:00Z</current_time_iso>'
          + '<instructions>hidden</instructions></heartbeat>\nStill here.',
      }],
    });
    const inlineView = toAgentSessionItemView(inlineItem, { engineId: 'codex' });

    expect(inlineView.content).toBe('Morning check.\n\nStill here.');
    expect(inlineView.metadata?.providerUserMessageSource).toEqual({
      kind: 'automation-heartbeat',
    });
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
    expect(visibleView.content).toBe('Hook validation failed. | Update the affected file.');
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
      text: '<![CDATA[ The Session projection is ready.\n<oai-mem-citation>internal</oai-mem-citation> ]]>',
      phase: 'final_answer',
      memoryCitation: {
        entries: [{
          path: 'memory/session-notes.md',
          lineStart: 12,
          lineEnd: 15,
          note: 'Prior Session decision.',
        }],
        threadIds: ['provider-session-memory-1'],
      },
    }));

    expect(view.role).toBe('assistant');
    expect(view.content).toBe('The Session projection is ready.');
    expect(view.metadata?.providerMessagePhase).toBe('final_answer');
    expect(view.metadata?.providerMessageCompleted).toBe(true);
    expect(view.resources).toEqual([
      expect.objectContaining({
        kind: 'citation',
        path: 'memory/session-notes.md',
        citation: {
          lineStart: 12,
          lineEnd: 15,
          note: 'Prior Session decision.',
        },
      }),
    ]);
    expect(JSON.stringify(view)).not.toMatch(/"[^"]*thread[^"]*"\s*:/iu);
    expect(resolveAgentSessionItemPresentation(view).blocks)
      .toEqual(expect.arrayContaining([expect.objectContaining({ type: 'markdown' })]));
  });

  it('codex-provider-item-agent-message: mirrors streaming cleanup and completion state', () => {
    const streamingItem = {
      ...createProviderSessionItem('codex-agent-message-streaming', {
        id: 'codex-agent-message-streaming',
        type: 'agentMessage',
        text: '<![CDATA[ Streaming answer\n\n`<oai-mem-citation>`\n\nvisible<oai-mem-cit',
        phase: 'final_answer',
      }),
      status: 'pending' as const,
      completedAt: null,
    };
    const streamingView = toAgentSessionItemView(streamingItem);

    expect(streamingView.content).toBe(
      'Streaming answer\n\n`<oai-mem-citation>`\n\nvisible',
    );
    expect(streamingView.metadata?.providerMessageCompleted).toBe(false);

    const hiddenView = toAgentSessionItemView(createProviderSessionItem(
      'codex-agent-message-external-tool',
      {
        id: 'codex-agent-message-external-tool',
        type: 'agentMessage',
        text: [
          'Before',
          '[external_agent_tool_call:delegate]',
          'private payload',
          '[/external_agent_tool_call]',
          'After',
        ].join('\n'),
        phase: 'commentary',
      },
    ));
    expect(hiddenView.content).toBe('Before\nAfter');
    expect(hiddenView.metadata?.providerMessagePhase).toBe('commentary');

    const wrappedView = toAgentSessionItemView(createProviderSessionItem(
      'codex-agent-message-wrapped',
      {
        method: 'item/completed',
        params: {
          item: {
            id: 'codex-agent-message-wrapped',
            type: 'agentMessage',
            text: 'Wrapped commentary.',
            phase: 'commentary',
          },
        },
      },
    ));
    expect(wrappedView.content).toBe('Wrapped commentary.');
    expect(wrappedView.metadata?.providerMessagePhase).toBe('commentary');
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

  it('codex-provider-item-command-execution: expands actions and preserves execution facts', () => {
    const view = toAgentSessionItemView(createProviderSessionItem('codex-command-1', {
      id: 'codex-command-1',
      type: 'commandExecution',
      pluginId: null,
      scriptPath: null,
      command: 'pnpm typecheck',
      cwd: 'E:\\workspace',
      processId: 'process-1',
      source: 'agent',
      status: 'completed',
      commandActions: [
        {
          type: 'read',
          command: 'Get-Content src/session.ts',
          name: 'session.ts',
          path: 'src/session.ts',
        },
        {
          type: 'search',
          command: 'rg Session src',
          path: 'src',
          query: 'Session',
        },
        {
          type: 'unknown',
          command: 'pnpm typecheck',
        },
      ],
      aggregatedOutput: 'Types are valid.',
      exitCode: 0,
      durationMs: 42,
    }));
    const calls = normalizeAgentSessionItemToolCalls(view.tool_calls, { engineId: 'codex' });

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.id)).toEqual([
      'codex-command-1:0',
      'codex-command-1:1',
      'codex-command-1:2',
    ]);
    expect(calls.map((call) => call.command)).toEqual([
      'Get-Content src/session.ts',
      'rg Session src',
      'pnpm typecheck',
    ]);
    expect(calls[0]).toEqual(expect.objectContaining({
      commandAction: {
        kind: 'read',
        name: 'session.ts',
        path: 'src/session.ts',
      },
      durationMs: 42,
      exitCode: 0,
      kind: 'command',
      output: 'Types are valid.',
      parentExecutionId: 'codex-command-1',
      processId: 'process-1',
      status: 'success',
      workingDirectory: 'E:\\workspace',
    }));
    expect(calls[1]?.commandAction).toEqual({
      kind: 'search',
      path: 'src',
      query: 'Session',
    });

    const commands = resolveAgentSessionItemPresentation(view, { engineId: 'codex' })
      .blocks.flatMap((block) => block.type === 'activity' ? block.commands : []);
    expect(commands).toHaveLength(3);
    expect(commands[2]).toEqual(expect.objectContaining({
      command: 'pnpm typecheck',
      durationMs: 42,
      exitCode: 0,
      parentExecutionId: 'codex-command-1',
      processId: 'process-1',
      workingDirectory: 'E:\\workspace',
    }));
  });

  it('codex-provider-item-command-execution: treats a non-zero exit code as failed', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-command-failed', {
      id: 'codex-command-failed',
      type: 'commandExecution',
      command: 'pnpm test',
      status: 'completed',
      commandActions: [],
      aggregatedOutput: 'Tests failed.',
      exitCode: 1,
    }));

    expect(call).toEqual(expect.objectContaining({
      command: 'pnpm test',
      exitCode: 1,
      status: 'error',
    }));
  });

  it('codex-provider-item-file-change: matches patch and visualization visibility rules', () => {
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

    const visualizationPath = [
      'C:\\Users\\admin\\.codex\\visualizations',
      '2026\\07\\31\\session-visual-1\\provider-routing.html',
    ].join('\\');
    const visualizationUpdate = createProviderSessionItem('codex-file-change-visual-update', {
      id: 'codex-file-change-visual-update',
      type: 'fileChange',
      changes: [{ path: visualizationPath, kind: { type: 'update' } }],
      status: 'inProgress',
    });
    expect(toAgentSessionTranscriptItemViews([visualizationUpdate])).toHaveLength(1);

    const visualizationDelete = createProviderSessionItem('codex-file-change-visual-delete', {
      id: 'codex-file-change-visual-delete',
      type: 'fileChange',
      changes: [{ path: visualizationPath, kind: { type: 'delete' } }],
      status: 'completed',
    });
    expect(toAgentSessionTranscriptItemViews([visualizationDelete])).toEqual([]);

    const failedVisualizationAdd = createProviderSessionItem('codex-file-change-visual-failed', {
      id: 'codex-file-change-visual-failed',
      type: 'fileChange',
      changes: [{ path: visualizationPath, kind: { type: 'add' } }],
      status: 'failed',
    });
    expect(toAgentSessionTranscriptItemViews([failedVisualizationAdd])).toEqual([]);

    const failedSourceChange = createProviderSessionItem('codex-file-change-source-failed', {
      id: 'codex-file-change-source-failed',
      type: 'fileChange',
      changes: [{ path: 'src/session.ts', kind: { type: 'update' } }],
      status: 'failed',
    });
    expect(toAgentSessionTranscriptItemViews([failedSourceChange])).toHaveLength(1);
  });

  it('codex-provider-item-mcp-tool-call: preserves MCP identity, result, and duration', () => {
    const call = projectSingleToolCall(createProviderSessionItem('codex-mcp-1', {
      id: 'codex-mcp-1',
      type: 'mcpToolCall',
      server: 'docs',
      tool: 'search',
      status: 'completed',
      arguments: { query: 'Session contract' },
      appContext: { resourceUri: 'ui://docs/search-result' },
      pluginId: 'plugin.docs',
      result: { content: [{ type: 'text', text: 'Found.' }] },
      error: null,
      durationMs: 18,
    }));

    expect(call).toEqual(expect.objectContaining({
      kind: 'mcp',
      name: 'search',
      serverName: 'docs',
      durationMs: 18,
      mcpAppResourceUri: 'ui://docs/search-result',
      pluginId: 'plugin.docs',
      status: 'success',
    }));
    expect(call?.output).toContain('Found.');
    expect(call?.resultBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'resource',
        uri: 'ui://docs/search-result',
        name: 'plugin.docs',
      }),
    ]));
  });

  it('codex-provider-item-dynamic-tool-call: matches public and internal tool visibility', () => {
    const visibleItem = createProviderSessionItem('codex-dynamic-tool-1', {
      id: 'codex-dynamic-tool-1',
      type: 'dynamicToolCall',
      namespace: 'workspace',
      tool: 'inspect_symbols',
      arguments: { path: 'src/session.ts' },
      status: 'completed',
      contentItems: [
        { type: 'inputText', text: 'Symbol found.' },
        { type: 'inputImage', imageUrl: 'https://example.test/symbol.png' },
        { type: 'inputAudio', audioUrl: 'https://example.test/symbol.mp3' },
      ],
      success: true,
      durationMs: 9,
    });
    expect(projectSingleToolCall(visibleItem)).toEqual(expect.objectContaining({
      name: 'inspect_symbols',
      status: 'success',
      resultBlocks: expect.arrayContaining([
        expect.objectContaining({
          type: 'image',
          source: 'https://example.test/symbol.png',
        }),
        expect.objectContaining({
          type: 'audio',
          source: 'https://example.test/symbol.mp3',
        }),
      ]),
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

    const validAutomationItem = createProviderSessionItem('codex-dynamic-tool-automation', {
      id: 'codex-dynamic-tool-automation',
      type: 'dynamicToolCall',
      namespace: null,
      tool: 'automation_update',
      arguments: { mode: 'view', id: 'automation-1' },
      status: 'completed',
      contentItems: [{ type: 'inputText', text: 'Rendered automation card in the app.' }],
      success: true,
      durationMs: 2,
    });
    expect(toAgentSessionTranscriptItemViews([validAutomationItem])).toHaveLength(1);

    const invalidAutomationItem = createProviderSessionItem('codex-dynamic-tool-automation-invalid', {
      id: 'codex-dynamic-tool-automation-invalid',
      type: 'dynamicToolCall',
      namespace: null,
      tool: 'automation_update',
      arguments: {},
      status: 'completed',
      contentItems: null,
      success: true,
      durationMs: 1,
    });
    expect(toAgentSessionTranscriptItemViews([invalidAutomationItem])).toEqual([]);
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
    });
    const view = toAgentSessionItemView(item);
    const presentation = resolveAgentSessionItemPresentation(view);

    expect(isAgentSessionItemVisibleInTranscript(view)).toBe(true);
    expect(view.lifecycleEvents).toEqual([{
      automatic: true,
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

function createOpenCodeEventItem(
  sequence: number,
  event: Record<string, unknown>,
): AgentSessionItemRecord {
  return {
    ...createProviderSessionItem(`opencode-event-${sequence}`, event),
    sequence: String(sequence),
    toolResult: event,
  };
}

describe('OpenCode provider Session event replay', () => {
  const providerIdentity = { engineId: 'opencode' } as const;

  it('keeps an identity-less full text snapshot visible as compatibility payload', () => {
    const views = toAgentSessionTranscriptItemViews([createOpenCodeEventItem(1, {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'opencode-text-part-without-parent-identity',
          text: 'Visible compatibility snapshot',
          type: 'text',
        },
      },
    })], providerIdentity);

    expect(views).toHaveLength(1);
    expect(views[0]).toEqual(expect.objectContaining({
      content: 'Visible compatibility snapshot',
      role: 'assistant',
    }));
    expect(views[0]?.tool_calls).toBeUndefined();
  });

  it('replays part deltas across canonical Session Items without creating delta rows', () => {
    const sessionID = 'opencode-provider-session-cross-item';
    const messageID = 'opencode-message-cross-item';
    const partID = 'opencode-part-cross-item';
    const items = [
      createOpenCodeEventItem(1, {
        type: 'message.part.updated',
        properties: {
          part: { id: partID, messageID, sessionID, text: 'ha', type: 'text' },
          sessionID,
          time: 1_785_568_800_001,
        },
      }),
      createOpenCodeEventItem(2, {
        type: 'message.part.delta',
        properties: { delta: ' ha', field: 'text', messageID, partID, sessionID },
      }),
      createOpenCodeEventItem(3, {
        type: 'message.part.delta',
        properties: { delta: ' ha', field: 'text', messageID, partID, sessionID },
      }),
    ];

    const views = toAgentSessionTranscriptItemViews(items, providerIdentity);
    expect(views).toHaveLength(1);
    expect(views[0]?.content).toBe('ha ha ha');
  });

  it('removes a cross-Item part and restores it only from a later full snapshot', () => {
    const sessionID = 'opencode-provider-session-cross-remove';
    const messageID = 'opencode-message-cross-remove';
    const partID = 'opencode-part-cross-remove';
    const updated = (sequence: number, text: string) => createOpenCodeEventItem(sequence, {
      type: 'message.part.updated',
      properties: {
        part: { id: partID, messageID, sessionID, text, type: 'text' },
        sessionID,
        time: 1_785_568_800_000 + sequence,
      },
    });
    const removed = createOpenCodeEventItem(2, {
      type: 'message.part.removed',
      properties: { messageID, partID, sessionID },
    });

    expect(toAgentSessionTranscriptItemViews([
      updated(1, 'Removed text'),
      removed,
    ], providerIdentity)).toEqual([]);

    const restored = toAgentSessionTranscriptItemViews([
      updated(1, 'Removed text'),
      removed,
      updated(3, 'Restored text'),
    ], providerIdentity);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.content).toBe('Restored text');
  });

  it('groups ordered parts from one OpenCode message into one transcript row', () => {
    const sessionID = 'opencode-provider-session-grouped';
    const messageID = 'opencode-message-grouped';
    const updated = (sequence: number, id: string, text: string) =>
      createOpenCodeEventItem(sequence, {
        type: 'message.part.updated',
        properties: {
          part: { id, messageID, sessionID, text, type: 'text' },
          sessionID,
          time: 1_785_568_800_000 + sequence,
        },
      });

    const views = toAgentSessionTranscriptItemViews([
      updated(1, 'opencode-part-grouped-2', 'Second part'),
      updated(2, 'opencode-part-grouped-1', 'First part'),
    ], providerIdentity);
    expect(views).toHaveLength(1);
    expect(views[0]?.content).toBe('First part\n\nSecond part');
  });

  it('correlates equal message and part IDs independently by provider Session', () => {
    const messageID = 'opencode-message-shared';
    const partID = 'opencode-part-shared';
    const updated = (sequence: number, sessionID: string, text: string) =>
      createOpenCodeEventItem(sequence, {
        type: 'message.part.updated',
        properties: {
          part: { id: partID, messageID, sessionID, text, type: 'text' },
          sessionID,
          time: 1_785_568_800_000 + sequence,
        },
      });

    const views = toAgentSessionTranscriptItemViews([
      updated(1, 'opencode-provider-session-a', 'Session A'),
      updated(2, 'opencode-provider-session-b', 'Session B'),
    ], providerIdentity);
    expect(views.map((view) => view.content)).toEqual(['Session A', 'Session B']);
  });
});
