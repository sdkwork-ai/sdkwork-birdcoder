import assert from 'node:assert/strict';

import {
  projectChatMessageCommand,
  projectChatMessageToolCall,
  projectChatMessageToolCalls,
  projectChatMessageToolNotice,
  projectChatMessageToolNotices,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts';
import { resolveChatMessageView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';

const structuredToolCall = projectChatMessageToolCall(
  {
    id: 'call-1',
    type: 'function',
    function: {
      name: 'bash',
      arguments: '{"command":"pnpm run typecheck"}',
    },
  },
  0,
);
assert.deepEqual(structuredToolCall, {
  id: 'call-1',
  type: 'function',
  name: 'bash',
  arguments: '{"command":"pnpm run typecheck"}',
  kind: 'command',
  command: 'pnpm run typecheck',
});

const projectedToolCalls = projectChatMessageToolCalls([
  structuredToolCall,
  'raw tool output',
]);
assert.equal(projectedToolCalls.length, 2);
assert.equal(projectedToolCalls[1]?.name, 'tool');
assert.equal(projectedToolCalls[1]?.arguments, 'raw tool output');

const toolCallView = resolveChatMessageView({
  id: 'msg-tool-1',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-06-22T00:00:02.000Z',
  tool_calls: [
    {
      id: 'call-2',
      function: {
        name: 'read',
        arguments: '{"path":"src/index.ts"}',
      },
    },
  ],
});
const toolCallBlock = toolCallView.blocks.find((block) => block.type === 'tool-calls');
assert.ok(toolCallBlock && toolCallBlock.type === 'tool-calls');
assert.equal(toolCallBlock.calls.length, 1);
assert.equal(toolCallBlock.calls[0]?.name, 'read');

assert.equal(projectChatMessageToolCall({}, 0), null);
assert.equal(projectChatMessageToolCall({ type: 'function' }, 0), null);

const claudeToolUse = projectChatMessageToolCall({
  type: 'tool_use',
  id: 'toolu-1',
  name: 'Grep',
  input: { pattern: 'ToolCall', path: 'src' },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeToolUse?.kind, 'search');
assert.equal(claudeToolUse?.target, 'src');

const codexMcpCall = projectChatMessageToolCall({
  type: 'mcp_tool_call',
  id: 'mcp-1',
  server: 'linear',
  tool: 'list_issues',
  arguments: { team: 'SDK' },
  status: 'completed',
  result: { issues: 2 },
}, 0, { engineId: 'codex' });
assert.equal(codexMcpCall?.kind, 'mcp');
assert.equal(codexMcpCall?.serverName, 'linear');
assert.equal(codexMcpCall?.name, 'list_issues');
assert.equal(codexMcpCall?.status, 'success');
assert.match(codexMcpCall?.output ?? '', /"issues": 2/);

const openCodeToolPart = projectChatMessageToolCall({
  part: {
    type: 'tool',
    callID: 'call-opencode-1',
    tool: 'bash',
    state: {
      status: 'completed',
      input: { command: 'pnpm lint' },
      output: 'lint passed',
    },
  },
}, 0, { engineId: 'opencode' });
assert.equal(openCodeToolPart?.id, 'call-opencode-1');
assert.equal(openCodeToolPart?.kind, 'command');
assert.equal(openCodeToolPart?.command, 'pnpm lint');
assert.equal(openCodeToolPart?.output, 'lint passed');

const codexLocalShellCall = projectChatMessageToolCall({
  item: {
    type: 'local_shell_call',
    call_id: 'call-codex-shell-1',
    status: 'completed',
    action: {
      type: 'exec',
      command: ['git', 'commit', '-m', 'align providers'],
      working_directory: 'E:/workspace',
    },
  },
}, 0, { engineId: 'codex' });
assert.equal(codexLocalShellCall?.id, 'call-codex-shell-1');
assert.equal(codexLocalShellCall?.kind, 'command');
assert.equal(codexLocalShellCall?.command, 'git commit -m "align providers"');
assert.equal(codexLocalShellCall?.status, 'success');

const codexCustomToolCall = projectChatMessageToolCall({
  type: 'custom_tool_call',
  call_id: 'call-codex-skill-1',
  name: 'skill',
  input: 'frontend-design',
}, 0, { engineId: 'codex' });
assert.equal(codexCustomToolCall?.kind, 'skill');
assert.equal(codexCustomToolCall?.arguments, 'frontend-design');

const codexResponsesFunctionCall = projectChatMessageToolCall({
  item: {
    type: 'function_call',
    id: 'fc-item-1',
    call_id: 'call-codex-response-1',
    name: 'shell_command',
    arguments: '{"command":"pwd"}',
  },
}, 0, { engineId: 'codex' });
assert.equal(
  codexResponsesFunctionCall?.id,
  'call-codex-response-1',
  'Codex lifecycle identity must use call_id instead of the response item id.',
);

const claudeFailedToolResult = projectChatMessageToolCall({
  content_block: {
    type: 'tool_result',
    tool_use_id: 'toolu-2',
    content: [{ type: 'text', text: 'Permission denied' }],
    is_error: true,
  },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeFailedToolResult?.id, 'toolu-2');
assert.equal(claudeFailedToolResult?.status, 'error');
assert.match(claudeFailedToolResult?.output ?? '', /Permission denied/);

const mcpCamelCaseErrorResult = projectChatMessageToolCall({
  id: 'call-mcp-camel-error',
  name: 'mcp__workspace__read_secret',
  status: 'completed',
  result: {
    isError: true,
    content: [{ type: 'text', text: 'Access denied by MCP server' }],
  },
}, 0);
assert.equal(mcpCamelCaseErrorResult?.status, 'error');
assert.deepEqual(mcpCamelCaseErrorResult?.resultBlocks, [{
  type: 'error',
  message: 'Access denied by MCP server',
}]);

const mcpStringErrorResult = projectChatMessageToolCall({
  id: 'call-mcp-string-error',
  name: 'mcp__workspace__write_file',
  status: 'completed',
  result: {
    isError: 'true',
    content: [{ type: 'text', text: 'Write denied by MCP server' }],
  },
}, 0);
assert.equal(mcpStringErrorResult?.status, 'error');

const claudeToolProgress = projectChatMessageToolCall({
  type: 'tool_progress',
  tool_use_id: 'toolu-progress-1',
  tool_name: 'Bash',
  elapsed_time_seconds: 1.5,
}, 0, { engineId: 'claude-code' });
assert.equal(claudeToolProgress?.id, 'toolu-progress-1');
assert.equal(claudeToolProgress?.status, 'running');
assert.equal(claudeToolProgress?.durationMs, 1_500);

const claudeServerToolUse = projectChatMessageToolCall({
  content_block: {
    type: 'server_tool_use',
    id: 'srvtoolu-search-1',
    name: 'web_search',
    input: { query: 'BirdCoder' },
  },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeServerToolUse?.id, 'srvtoolu-search-1');
assert.equal(claudeServerToolUse?.kind, 'web');

const claudeServerToolResult = projectChatMessageToolCall({
  content_block: {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu-search-1',
    content: [{ title: 'BirdCoder', url: 'https://example.test' }],
  },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeServerToolResult?.id, 'srvtoolu-search-1');
assert.equal(claudeServerToolResult?.status, 'success');
assert.equal(claudeServerToolResult?.kind, 'web');
assert.match(claudeServerToolResult?.output ?? '', /BirdCoder/);
assert.deepEqual(claudeServerToolResult?.resultBlocks, [{
  type: 'link',
  url: 'https://example.test',
  title: 'BirdCoder',
}]);

const codexRichMcpResult = projectChatMessageToolCall({
  type: 'mcp_tool_call',
  id: 'mcp-rich-1',
  server: 'assets',
  tool: 'inspect',
  status: 'completed',
  result: {
    content: [
      { type: 'text', text: 'Inspection complete' },
      { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///workspace/report.txt',
          name: 'report.txt',
          mimeType: 'text/plain',
          text: 'Report content',
        },
      },
    ],
  },
}, 0, { engineId: 'codex' });
assert.deepEqual(codexRichMcpResult?.resultBlocks?.map((block) => block.type), [
  'text',
  'image',
  'resource',
]);
assert.equal(codexRichMcpResult?.resultBlocks?.[1]?.type, 'image');
if (codexRichMcpResult?.resultBlocks?.[1]?.type === 'image') {
  assert.equal(codexRichMcpResult.resultBlocks[1].source, 'data:image/png;base64,aGVsbG8=');
}

const codexEmbeddedMcpMedia = projectChatMessageToolCall({
  type: 'mcp_tool_call',
  id: 'mcp-embedded-media-1',
  server: 'assets',
  tool: 'read_resource',
  status: 'completed',
  result: {
    content: [
      {
        type: 'resource',
        resource: {
          uri: 'mcp://assets/preview.png',
          mimeType: 'image/png',
          blob: 'aGVsbG8=',
        },
      },
      {
        type: 'resource',
        resource: {
          uri: 'mcp://assets/voice.ogg',
          mimeType: 'audio/ogg',
          blob: 'd29ybGQ=',
        },
      },
      {
        type: 'resource_link',
        uri: 'mcp://assets/report.pdf',
        name: 'report.pdf',
        mimeType: 'application/pdf',
      },
    ],
  },
}, 0, { engineId: 'codex' });
assert.deepEqual(codexEmbeddedMcpMedia?.resultBlocks, [
  {
    type: 'image',
    source: 'data:image/png;base64,aGVsbG8=',
    mimeType: 'image/png',
  },
  {
    type: 'audio',
    source: 'data:audio/ogg;base64,d29ybGQ=',
    mimeType: 'audio/ogg',
  },
  {
    type: 'resource',
    uri: 'mcp://assets/report.pdf',
    name: 'report.pdf',
    mimeType: 'application/pdf',
  },
]);

const openCodeTimedToolPart = projectChatMessageToolCall({
  part: {
    type: 'tool',
    callID: 'call-opencode-2',
    tool: 'read_file',
    state: {
      status: 'completed',
      input: { path: 'src/App.tsx' },
      output: 'export default App',
      title: 'Read src/App.tsx',
      time: { start: 1_000, end: 2_250 },
    },
  },
}, 0, { engineId: 'opencode' });
assert.equal(openCodeTimedToolPart?.title, 'Read src/App.tsx');
assert.equal(openCodeTimedToolPart?.durationMs, 1_250);

const openCodeSubtask = projectChatMessageToolCall({
  part: {
    type: 'subtask',
    id: 'subtask-opencode-1',
    agent: 'explore',
    description: 'Inspect provider protocol',
    prompt: 'Find the official event types.',
  },
}, 0, { engineId: 'opencode' });
assert.equal(openCodeSubtask?.kind, 'agent');
assert.equal(openCodeSubtask?.name, 'explore');
assert.equal(openCodeSubtask?.title, 'Inspect provider protocol');

const openCodeInterruptedTool = projectChatMessageToolCall({
  part: {
    type: 'tool',
    callID: 'call-opencode-interrupted',
    tool: 'bash',
    state: {
      status: 'error',
      input: { command: 'pnpm test' },
      error: 'Tool execution aborted',
      metadata: { interrupted: true, output: 'partial test output' },
    },
  },
}, 0, { engineId: 'opencode' });
assert.equal(openCodeInterruptedTool?.status, 'cancelled');
assert.equal(openCodeInterruptedTool?.output, 'partial test output');
assert.deepEqual(openCodeInterruptedTool?.resultBlocks, [
  { type: 'error', message: 'Tool execution aborted' },
  { type: 'text', text: 'partial test output' },
]);

const failedToolWithPartialOutput = projectChatMessageToolCall({
  id: 'call-failed-with-output',
  name: 'run_tests',
  status: 'error',
  error: 'Test process exited with code 1',
  output: 'PASS parser.test.ts\nFAIL renderer.test.ts',
}, 0);
assert.deepEqual(failedToolWithPartialOutput?.resultBlocks, [
  { type: 'error', message: 'Test process exited with code 1' },
  { type: 'text', text: 'PASS parser.test.ts\nFAIL renderer.test.ts' },
]);

const openCodeToolWithAttachments = projectChatMessageToolCall({
  part: {
    type: 'tool',
    callID: 'call-opencode-attachments',
    tool: 'inspect',
    state: {
      status: 'completed',
      input: {},
      output: 'Inspection complete',
      attachments: [
        { type: 'file', mime: 'image/png', filename: 'preview.png', url: 'data:image/png;base64,aGVsbG8=' },
        { type: 'file', mime: 'application/pdf', filename: 'report.pdf', url: 'https://example.test/report.pdf' },
      ],
    },
  },
}, 0, { engineId: 'opencode' });
assert.deepEqual(openCodeToolWithAttachments?.resultBlocks?.map((block) => block.type), [
  'text',
  'image',
  'resource',
]);

const codexCommandExecution = projectChatMessageToolCall({
  item: {
    id: 'cmd-codex-1',
    type: 'command_execution',
    command: 'pnpm typecheck',
    aggregated_output: 'Typecheck passed',
    exit_code: 0,
    status: 'completed',
  },
}, 0, { engineId: 'codex' });
assert.equal(codexCommandExecution?.kind, 'command');
assert.equal(codexCommandExecution?.command, 'pnpm typecheck');
assert.equal(codexCommandExecution?.output, 'Typecheck passed');
assert.equal(codexCommandExecution?.status, 'success');

const codexMovedFileChange = projectChatMessageToolCall({
  item: {
    id: 'file-change-codex-move',
    type: 'fileChange',
    status: 'completed',
    changes: [{
      path: 'src/legacy-name.ts',
      kind: { type: 'update', move_path: 'src/provider-message.ts' },
      diff: '',
    }],
  },
}, 0, { engineId: 'codex' });
assert.equal(codexMovedFileChange?.target, 'src/provider-message.ts');
assert.equal(
  codexMovedFileChange?.title,
  'Moved src/legacy-name.ts -> src/provider-message.ts',
);

const codexWebSearch = projectChatMessageToolCall({
  item: {
    id: 'web-codex-1',
    type: 'web_search',
    query: 'BirdCoder protocol',
    action: { type: 'search', query: 'BirdCoder protocol', queries: null },
    results: [{
      type: 'text_result',
      ref_id: 'turn0search0',
      url: 'https://example.test/birdcoder-protocol',
    }],
  },
}, 0, { engineId: 'codex' });
assert.equal(codexWebSearch?.kind, 'web');
assert.equal(codexWebSearch?.target, 'BirdCoder protocol');
assert.deepEqual(codexWebSearch?.resultBlocks, [{
  type: 'link',
  url: 'https://example.test/birdcoder-protocol',
}]);

const codexSleep = projectChatMessageToolCall({
  item: {
    id: 'sleep-codex-1',
    type: 'sleep',
    durationMs: 750,
  },
}, 0, { engineId: 'codex' });
assert.equal(codexSleep?.name, 'sleep');
assert.equal(codexSleep?.status, 'success');
assert.equal(codexSleep?.durationMs, 750);

const codexSubAgentActivity = projectChatMessageToolCall({
  item: {
    id: 'subagent-codex-1',
    type: 'subAgentActivity',
    kind: 'interrupted',
    agentThreadId: 'thread-child',
    agentPath: '/root/worker',
  },
}, 0, { engineId: 'codex' });
assert.equal(codexSubAgentActivity?.kind, 'agent');
assert.equal(codexSubAgentActivity?.name, 'subagent_interrupted');
assert.equal(codexSubAgentActivity?.target, '/root/worker');
assert.equal(codexSubAgentActivity?.status, 'cancelled');

const codexStartedSubAgentActivity = projectChatMessageToolCall({
  item: {
    id: 'subagent-codex-started',
    type: 'subAgentActivity',
    kind: 'started',
    agentThreadId: 'thread-started',
    agentPath: '/root/started',
  },
}, 0, { engineId: 'codex' });
assert.equal(codexStartedSubAgentActivity?.status, 'running');

const codexInteractedSubAgentActivity = projectChatMessageToolCall({
  item: {
    id: 'subagent-codex-interacted',
    type: 'subAgentActivity',
    kind: 'interacted',
    agentThreadId: 'thread-interacted',
    agentPath: '/root/interacted',
  },
}, 0, { engineId: 'codex' });
assert.equal(codexInteractedSubAgentActivity?.status, undefined);

const codexTodoList = projectChatMessageToolCall({
  item: {
    id: 'todo-codex-1',
    type: 'todo_list',
    items: [
      { text: 'Normalize provider messages', completed: true },
      { text: 'Verify narrow layout', completed: false },
    ],
  },
}, 0, { engineId: 'codex' });
assert.equal(codexTodoList?.kind, 'task');
assert.equal(codexTodoList?.status, 'running');
assert.equal(codexTodoList?.title, '1/2');
assert.deepEqual(codexTodoList?.resultBlocks, [{
  type: 'list',
  items: ['[x] Normalize provider messages', '[ ] Verify narrow layout'],
}]);

const completedCodexTodoList = projectChatMessageToolCall({
  item: {
    id: 'todo-codex-completed',
    type: 'todo_list',
    status: 'completed',
    items: [
      { text: 'Preserve explicit lifecycle status', completed: false },
      { text: 'Render historical snapshot', completed: false },
    ],
  },
}, 0, { engineId: 'codex' });
assert.equal(completedCodexTodoList?.status, 'success');

const codexStatusTodoList = projectChatMessageToolCall({
  item: {
    id: 'todo-codex-status-items',
    type: 'todo_list',
    items: [
      { text: 'Completed from status', status: 'completed' },
      { text: 'Still running', status: 'in_progress' },
      { text: 'Blocked by input', status: 'blocked' },
    ],
  },
}, 0, { engineId: 'codex' });
assert.equal(codexStatusTodoList?.title, '1/3');
assert.deepEqual(codexStatusTodoList?.resultBlocks, [{
  type: 'list',
  items: ['[x] Completed from status', '[~] Still running', '[!] Blocked by input'],
}]);

const codexCollabAgentToolCall = projectChatMessageToolCall({
  type: 'collabAgentToolCall',
  id: 'collab-codex-1',
  tool: 'spawnAgent',
  status: 'inProgress',
  senderThreadId: 'thread-root',
  receiverThreadIds: ['thread-child'],
  prompt: 'Audit provider messages',
  model: 'gpt-5',
  reasoningEffort: 'high',
  agentsStates: {},
}, 0, { engineId: 'codex' });
assert.equal(codexCollabAgentToolCall?.kind, 'agent');
assert.equal(codexCollabAgentToolCall?.name, 'spawnAgent');
assert.equal(codexCollabAgentToolCall?.status, 'running');
assert.equal(codexCollabAgentToolCall?.title, '1 agent');

for (const agentToolName of [
  'send_input',
  'resume_agent',
  'wait_agent',
  'close_agent',
  'send_message',
  'followup_task',
  'list_agents',
  'SendMessage',
  'TeamCreate',
  'TeamDelete',
]) {
  assert.equal(projectChatMessageToolCall({
    id: `agent-tool-${agentToolName}`,
    name: agentToolName,
    arguments: {},
  }, 0)?.kind, 'agent', `${agentToolName} must use agent activity semantics.`);
}

const geminiToolRequest = projectChatMessageToolCall({
  type: 'tool_call_request',
  value: {
    callId: 'call-gemini-1',
    name: 'read_file',
    args: { path: 'src/main.ts' },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiToolRequest?.id, 'call-gemini-1');
assert.equal(geminiToolRequest?.kind, 'file');
assert.equal(geminiToolRequest?.target, 'src/main.ts');

const geminiToolDisplayCall = projectChatMessageToolCall({
  status: 'success',
  request: {
    callId: 'call-gemini-display-1',
    name: 'read_file',
    args: { path: 'src/display.ts' },
    display: {
      format: 'compact',
      name: 'Read source',
      description: 'Request description',
      resultSummary: 'Stale request summary',
    },
  },
  response: {
    callId: 'call-gemini-display-1',
    display: {
      format: 'box',
      name: 'Source loaded',
      description: 'Loaded the provider-neutral source file',
      resultSummary: '1 file loaded',
      result: { type: 'text', text: 'export const display = true;' },
    },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiToolDisplayCall?.id, 'call-gemini-display-1');
assert.equal(geminiToolDisplayCall?.name, 'Source loaded');
assert.equal(geminiToolDisplayCall?.title, 'Loaded the provider-neutral source file');
assert.equal(geminiToolDisplayCall?.kind, 'file');
assert.equal(geminiToolDisplayCall?.target, 'src/display.ts');
assert.equal(geminiToolDisplayCall?.status, 'success');
assert.deepEqual(geminiToolDisplayCall?.resultBlocks, [
  { type: 'text', text: 'export const display = true;' },
  { type: 'text', text: '1 file loaded' },
]);
assert.doesNotMatch(geminiToolDisplayCall?.output ?? '', /call-gemini-display-1|resultSummary|"format"/u);

const geminiSnakeCaseToolDisplay = projectChatMessageToolCall({
  type: 'tool_response',
  request_id: 'call-gemini-display-snake',
  name: 'replace',
  tool_display: {
    format: 'box',
    name: 'Update source',
    description: 'Applied one source change',
    result_summary: '1 file changed',
    result: {
      type: 'diff',
      path: 'src/display.ts',
      before_text: 'export const display = false;',
      after_text: 'export const display = true;',
    },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiSnakeCaseToolDisplay?.id, 'call-gemini-display-snake');
assert.equal(geminiSnakeCaseToolDisplay?.kind, 'file');
assert.equal(geminiSnakeCaseToolDisplay?.status, 'success');
assert.deepEqual(geminiSnakeCaseToolDisplay?.resultBlocks?.map((block) => block.type), [
  'diff',
  'text',
]);
assert.match(geminiSnakeCaseToolDisplay?.output ?? '', /export const display = true/u);

assert.equal(projectChatMessageToolCall({
  type: 'tool_request',
  request_id: 'call-gemini-hidden',
  name: 'read_file',
  args: { path: 'src/private.ts' },
  display: {
    format: 'hidden',
    name: 'Private tool',
  },
}, 0, { engineId: 'gemini' }), null);

const geminiToolDisplayNoticeSource = {
  type: 'tool_response',
  requestId: 'call-gemini-notice',
  name: 'topic_update',
  display: {
    format: 'notice',
    name: 'Provider alignment',
    description: 'Provider-neutral history is ready',
    resultSummary: 'Ready',
    result: { type: 'text', text: 'No protocol envelope is shown.' },
  },
  internalEnvelope: { requestId: 'must-not-render' },
};
assert.deepEqual(projectChatMessageToolCall(
  geminiToolDisplayNoticeSource,
  0,
  { engineId: 'gemini' },
), {
  arguments: '',
  id: 'call-gemini-notice',
  kind: 'other',
  name: 'Provider alignment',
  presentation: 'notice',
  status: 'success',
  title: 'Provider-neutral history is ready',
  type: 'tool_response',
});
const geminiToolDisplayNotice = projectChatMessageToolNotice(
  geminiToolDisplayNoticeSource,
  0,
  { engineId: 'gemini' },
);
assert.deepEqual(geminiToolDisplayNotice, {
  content: 'Provider alignment: Provider-neutral history is ready',
  description: 'Provider-neutral history is ready',
  id: 'call-gemini-notice',
  kind: 'notice',
  name: 'Provider alignment',
  result: 'No protocol envelope is shown.\n\nReady',
  resultSummary: 'Ready',
});
assert.doesNotMatch(geminiToolDisplayNotice?.content ?? '', /internalEnvelope|must-not-render|requestId/u);
assert.deepEqual(
  projectChatMessageToolNotices([
    {
      type: 'tool_request',
      requestId: 'call-gemini-notice-lifecycle',
      name: 'topic_update',
      display: {
        format: 'notice',
        name: 'Provider alignment',
        description: 'Alignment started',
      },
    },
    {
      type: 'tool_response',
      requestId: 'call-gemini-notice-lifecycle',
      name: 'topic_update',
      display: {
        format: 'notice',
        name: 'Provider alignment',
        description: 'Alignment completed',
        resultSummary: 'Ready',
      },
    },
  ], { engineId: 'gemini' }),
  [{
    content: 'Provider alignment: Alignment completed',
    description: 'Alignment completed',
    id: 'call-gemini-notice-lifecycle',
    kind: 'notice',
    name: 'Provider alignment',
    result: 'Ready',
    resultSummary: 'Ready',
  }],
  'Gemini request/response display notices must collapse into one latest lifecycle row.',
);
const geminiToolDisplayNoticeView = resolveChatMessageView({
  id: 'message-gemini-notice',
  codingSessionId: 'session-gemini-notice',
  role: 'assistant',
  content: '',
  createdAt: '2026-07-21T00:00:00.000Z',
  tool_calls: [geminiToolDisplayNoticeSource],
}, { engineId: 'gemini' });
assert.equal(geminiToolDisplayNoticeView.blocks.some((block) => block.type === 'tool-calls'), false);
assert.deepEqual(geminiToolDisplayNoticeView.blocks, [{
  type: 'notice',
  id: 'call-gemini-notice',
  noticeKind: 'info',
  title: 'Provider alignment',
  detail: 'Provider-neutral history is ready',
}]);

const geminiMixedNoticeView = resolveChatMessageView({
  id: 'message-gemini-mixed-notice',
  codingSessionId: 'session-gemini-notice',
  role: 'assistant',
  content: 'The provider-neutral reply remains authored content.',
  createdAt: '2026-07-21T00:00:01.000Z',
  tool_calls: [geminiToolDisplayNoticeSource],
}, { engineId: 'gemini' });
assert.deepEqual(
  geminiMixedNoticeView.blocks.map((block) => block.type),
  ['notice', 'markdown'],
  'A Gemini notice must remain an independent block instead of changing authored reply semantics.',
);

const geminiToolResponse = projectChatMessageToolCall({
  type: 'tool_call_response',
  value: {
    callId: 'call-gemini-1',
    responseParts: [{ text: 'file contents' }],
    error: undefined,
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiToolResponse?.status, 'success');
assert.match(geminiToolResponse?.output ?? '', /file contents/);

const geminiToolResponseWithNullError = projectChatMessageToolCall({
  type: 'tool_call_response',
  value: {
    callId: 'call-gemini-null-error-1',
    responseParts: [{ functionResponse: { response: { output: 'command completed', error: null } } }],
    error: null,
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiToolResponseWithNullError?.status, 'success');
assert.deepEqual(geminiToolResponseWithNullError?.resultBlocks, [{
  type: 'text',
  text: 'command completed',
}]);

const geminiFunctionResponseWithNullError = projectChatMessageToolCall({
  functionResponse: {
    id: 'call-gemini-null-error-2',
    name: 'run_shell_command',
    response: { output: 'build passed', error: null },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiFunctionResponseWithNullError?.status, 'success');
assert.deepEqual(geminiFunctionResponseWithNullError?.resultBlocks, [{
  type: 'text',
  text: 'build passed',
}]);

const geminiFailedFunctionResponse = projectChatMessageToolCall({
  functionResponse: {
    id: 'call-gemini-error-1',
    name: 'read_file',
    response: { error: 'Permission denied' },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiFailedFunctionResponse?.status, 'error');
assert.deepEqual(geminiFailedFunctionResponse?.resultBlocks, [{
  type: 'error',
  message: 'Permission denied',
}]);

const geminiMultimodalFunctionResponse = projectChatMessageToolCall({
  functionResponse: {
    id: 'call-gemini-media-1',
    name: 'capture_screen',
    response: { status: 'success' },
    parts: [
      { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
      { text: 'Screenshot captured' },
    ],
  },
}, 0, { engineId: 'gemini' });
assert.deepEqual(geminiMultimodalFunctionResponse?.resultBlocks?.map((block) => block.type), [
  'image',
  'text',
]);

const geminiDirectFileDiff = projectChatMessageToolCall({
  id: 'call-gemini-direct-file-diff',
  name: 'replace',
  args: { file_path: 'src/provider.ts' },
  status: 'success',
  resultDisplay: {
    fileDiff: '@@ -1 +1 @@\n-export const provider = "legacy";\n+export const provider = "gemini";',
    fileName: 'provider.ts',
    filePath: 'src/provider.ts',
    originalContent: 'export const provider = "legacy";',
    newContent: 'export const provider = "gemini";',
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiDirectFileDiff?.kind, 'file');
assert.deepEqual(geminiDirectFileDiff?.resultBlocks, [{
  type: 'diff',
  path: 'src/provider.ts',
  content: '@@ -1 +1 @@\n-export const provider = "legacy";\n+export const provider = "gemini";',
}]);

const geminiDirectTodoList = projectChatMessageToolCall({
  id: 'call-gemini-direct-todos',
  name: 'write_todos',
  args: { todos: [] },
  status: 'success',
  resultDisplay: {
    todos: [
      { description: 'Normalize provider history', status: 'completed' },
      { description: 'Verify commercial transcript', status: 'in_progress' },
    ],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiDirectTodoList?.kind, 'task');
assert.deepEqual(geminiDirectTodoList?.resultBlocks, [{
  type: 'list',
  items: ['[x] Normalize provider history', '[~] Verify commercial transcript'],
}]);

const geminiDirectGrepResult = projectChatMessageToolCall({
  id: 'call-gemini-direct-grep',
  name: 'grep_search',
  args: { pattern: 'resultDisplay' },
  status: 'success',
  resultDisplay: {
    summary: 'Found 1 match',
    matches: [{
      filePath: 'src/provider.ts',
      absolutePath: 'C:/workspace/src/provider.ts',
      lineNumber: 42,
      line: 'const resultDisplay = response.resultDisplay;',
    }],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiDirectGrepResult?.kind, 'search');
assert.deepEqual(geminiDirectGrepResult?.resultBlocks, [
  { type: 'text', text: 'Found 1 match' },
  { type: 'list', items: ['src/provider.ts:42: const resultDisplay = response.resultDisplay;'] },
]);

const geminiDirectAnsiOutput = projectChatMessageToolCall({
  id: 'call-gemini-direct-ansi',
  name: 'run_shell_command',
  args: { command: 'pnpm typecheck' },
  status: 'success',
  resultDisplay: [
    [{ text: 'TypeScript ', bold: false, fg: '', bg: '' }, { text: 'passed', bold: true, fg: 'green', bg: '' }],
    [{ text: '0 errors', bold: false, fg: '', bg: '' }],
  ],
}, 0, { engineId: 'gemini' });
assert.equal(geminiDirectAnsiOutput?.kind, 'command');
assert.equal(geminiDirectAnsiOutput?.command, 'pnpm typecheck');
assert.deepEqual(geminiDirectAnsiOutput?.resultBlocks, [{
  type: 'text',
  text: 'TypeScript passed\n0 errors',
}]);

const geminiDynamicSubagent = projectChatMessageToolCall({
  id: 'call-gemini-dynamic-agent',
  name: 'research-specialist',
  args: { goal: 'Compare provider protocols' },
  status: 'executing',
  resultDisplay: {
    isSubagentProgress: true,
    agentName: 'research-specialist',
    state: 'running',
    recentActivity: [{
      id: 'activity-1',
      type: 'tool_call',
      content: 'Inspecting protocol schemas',
      status: 'running',
    }],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiDynamicSubagent?.kind, 'agent');
assert.deepEqual(geminiDynamicSubagent?.resultBlocks, [{
  type: 'list',
  items: ['[running] Inspecting protocol schemas'],
}]);

const geminiDirectCancelledCall = projectChatMessageToolCall({
  status: 'cancelled',
  request: {
    callId: 'call-gemini-direct-cancelled',
    name: 'run_shell_command',
    args: { command: 'pnpm test' },
  },
  response: {
    responseParts: [{
      functionResponse: {
        name: 'run_shell_command',
        response: { error: 'Operation cancelled by user' },
      },
    }],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiDirectCancelledCall?.status, 'cancelled');
assert.deepEqual(geminiDirectCancelledCall?.resultBlocks, [{
  type: 'error',
  message: 'Operation cancelled by user',
}]);

const geminiCancelledToolResponse = projectChatMessageToolCall({
  type: 'tool_call_response',
  value: {
    callId: 'call-gemini-cancelled-response',
    responseParts: [{
      functionResponse: {
        id: 'call-gemini-cancelled-response',
        name: 'run_shell_command',
        response: { error: '[Operation Cancelled] User stopped execution.' },
      },
    }],
    error: undefined,
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiCancelledToolResponse?.name, 'run_shell_command');
assert.equal(geminiCancelledToolResponse?.kind, 'command');
assert.equal(geminiCancelledToolResponse?.status, 'cancelled');
assert.deepEqual(geminiCancelledToolResponse?.resultBlocks, [{
  type: 'error',
  message: '[Operation Cancelled] User stopped execution.',
}]);

const geminiNestedFailedToolResponse = projectChatMessageToolCall({
  type: 'tool_call_response',
  value: {
    callId: 'call-gemini-nested-failure',
    responseParts: [{
      functionResponse: {
        name: 'read_file',
        response: { error: 'Permission denied' },
      },
    }],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiNestedFailedToolResponse?.name, 'read_file');
assert.equal(geminiNestedFailedToolResponse?.status, 'error');
assert.deepEqual(geminiNestedFailedToolResponse?.resultBlocks, [{
  type: 'error',
  message: 'Permission denied',
}]);

const mcpResourceLink = projectChatMessageToolCall({
  id: 'mcp-resource-link-1',
  name: 'mcp__docs__lookup',
  output: {
    content: [{
      type: 'resource_link',
      uri: 'mcp://docs/provider-protocol',
      name: 'Provider protocol',
      description: 'Canonical provider protocol documentation',
      mimeType: 'text/markdown',
      size: 2048,
    }],
  },
  status: 'completed',
}, 0);
assert.deepEqual(mcpResourceLink?.resultBlocks, [{
  type: 'resource',
  uri: 'mcp://docs/provider-protocol',
  name: 'Provider protocol',
  mimeType: 'text/markdown',
  description: 'Canonical provider protocol documentation',
  size: 2048,
}]);

const malformedCanonicalResultBlocks = projectChatMessageToolCall({
  id: 'malformed-result-blocks-1',
  name: 'inspect',
  output: 'Safe fallback output',
  resultBlocks: [
    { type: 'image' },
    { type: 'link', url: null },
    { type: 'text', text: '' },
  ],
}, 0);
assert.deepEqual(malformedCanonicalResultBlocks?.resultBlocks, [{
  type: 'text',
  text: 'Safe fallback output',
}]);

const claudeAdvisorResult = projectChatMessageToolCall({
  type: 'advisor_tool_result',
  tool_use_id: 'srvtoolu-advisor-1',
  content: { type: 'advisor_result', text: 'Review the cancellation state.' },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeAdvisorResult?.id, 'srvtoolu-advisor-1');
assert.equal(claudeAdvisorResult?.name, 'advisor');
assert.deepEqual(claudeAdvisorResult?.resultBlocks, [{
  type: 'text',
  text: 'Review the cancellation state.',
}]);

const claudeInlineDocumentResult = projectChatMessageToolCall({
  type: 'tool_result',
  tool_use_id: 'toolu-claude-document',
  name: 'ReadDocument',
  content: [{
    type: 'document',
    title: 'provider-contract.pdf',
    source: {
      type: 'base64',
      media_type: 'application/pdf',
      data: 'JVBERi0xLjQKPRIVATE_BASE64_MUST_NOT_RENDER',
    },
  }],
}, 0, { engineId: 'claude-code' });
assert.deepEqual(claudeInlineDocumentResult?.resultBlocks, [{
  type: 'resource',
  name: 'provider-contract.pdf',
  mimeType: 'application/pdf',
}]);
assert.doesNotMatch(
  JSON.stringify(claudeInlineDocumentResult?.resultBlocks),
  /PRIVATE_BASE64_MUST_NOT_RENDER|JVBER/iu,
  'Claude rich document results must retain safe metadata without flattening base64 into transcript text.',
);

const geminiConfirmation = projectChatMessageToolCall({
  type: 'tool_call_confirmation',
  value: {
    request: {
      callId: 'call-gemini-approval-1',
      name: 'replace',
      args: { file_path: 'src/App.tsx' },
    },
    details: {
      type: 'edit',
      title: 'Confirm Edit: App.tsx',
      filePath: 'src/App.tsx',
      fileDiff: '@@ -1 +1 @@\n-old\n+new',
    },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiConfirmation?.kind, 'approval');
assert.equal(geminiConfirmation?.status, 'waiting');
assert.equal(geminiConfirmation?.title, 'Confirm Edit: App.tsx');
assert.equal(geminiConfirmation?.target, 'src/App.tsx');
assert.deepEqual(geminiConfirmation?.resultBlocks, [{
  type: 'diff',
  content: '@@ -1 +1 @@\n-old\n+new',
  path: 'src/App.tsx',
}]);

const cancelledToolCall = projectChatMessageToolCall({
  id: 'call-cancelled-1',
  name: 'shell_command',
  arguments: { command: 'pnpm test' },
  status: 'cancelled',
}, 0);
assert.equal(cancelledToolCall?.status, 'cancelled');

const cancelledToolCallWithReason = projectChatMessageToolCall({
  id: 'call-cancelled-with-reason',
  name: 'shell_command',
  arguments: { command: 'pnpm test' },
  status: 'cancelled',
  error: 'Cancelled by user',
}, 0);
assert.equal(cancelledToolCallWithReason?.status, 'cancelled');
assert.deepEqual(cancelledToolCallWithReason?.resultBlocks, [{
  type: 'error',
  message: 'Cancelled by user',
}]);
assert.deepEqual(projectChatMessageCommand(cancelledToolCallWithReason!), {
  command: 'pnpm test',
  status: 'error',
  output: 'Cancelled by user',
  runtimeStatus: 'terminated',
  kind: 'command',
  toolName: 'shell_command',
  toolCallId: 'call-cancelled-with-reason',
});

for (const status of ['declined', 'rejected']) {
  assert.equal(projectChatMessageToolCall({
    id: `call-${status}`,
    name: 'shell_command',
    arguments: { command: 'pnpm test' },
    status,
    error: `${status} by user`,
  }, 0)?.status, 'cancelled');
}

assert.equal(projectChatMessageToolCall({
  type: 'reasoning',
  summary: [{ type: 'summary_text', text: 'private reasoning' }],
}, 0, { engineId: 'codex' }), null);
assert.deepEqual(projectChatMessageToolCall({
  type: 'tool_use_summary',
  uuid: 'tool-summary-1',
  summary: 'Read 10 files',
  preceding_tool_use_ids: ['toolu-read-1', 'toolu-read-2'],
}, 0, { engineId: 'claude-code' }), {
  arguments: '{\n  "precedingToolUseIds": [\n    "toolu-read-1",\n    "toolu-read-2"\n  ]\n}',
  id: 'tool-summary-1',
  kind: 'task',
  name: 'tool_summary',
  output: 'Read 10 files',
  resultBlocks: [{ type: 'text', text: 'Read 10 files' }],
  status: 'success',
  title: 'Read 10 files',
  type: 'tool_use_summary',
});

const geminiStreamToolUse = projectChatMessageToolCall({
  type: 'tool_use',
  tool_id: 'gemini-stream-tool-1',
  tool_name: 'run_shell_command',
  parameters: { command: 'pnpm test' },
}, 0, { engineId: 'gemini' });
assert.equal(geminiStreamToolUse?.id, 'gemini-stream-tool-1');
assert.equal(geminiStreamToolUse?.command, 'pnpm test');
assert.equal(geminiStreamToolUse?.status, 'pending');

const geminiStreamToolResult = projectChatMessageToolCall({
  type: 'tool_result',
  tool_id: 'gemini-stream-tool-1',
  status: 'error',
  error: { type: 'COMMAND_FAILED', message: 'Tests failed' },
}, 0, { engineId: 'gemini' });
assert.equal(geminiStreamToolResult?.id, 'gemini-stream-tool-1');
assert.equal(geminiStreamToolResult?.status, 'error');
assert.deepEqual(geminiStreamToolResult?.resultBlocks, [{
  type: 'error',
  message: 'Tests failed',
}]);

const geminiStreamCancelledToolResult = projectChatMessageToolCall({
  type: 'tool_result',
  tool_id: 'gemini-stream-tool-cancelled',
  status: 'success',
  output: 'Cancelled',
}, 0, { engineId: 'gemini' });
assert.equal(
  geminiStreamCancelledToolResult?.status,
  'cancelled',
  'Gemini stream-json legacy success status must not override its explicit cancellation output.',
);

const codexDynamicTool = projectChatMessageToolCall({
  type: 'dynamicToolCall',
  id: 'codex-dynamic-1',
  tool: 'capture_preview',
  arguments: { path: 'preview.png' },
  status: 'completed',
  success: true,
  contentItems: [
    { type: 'inputText', text: 'Preview captured' },
    { type: 'inputImage', imageUrl: 'data:image/png;base64,aGVsbG8=' },
    { type: 'inputAudio', audioUrl: 'data:audio/wav;base64,YXVkaW8=' },
  ],
}, 0, { engineId: 'codex' });
assert.deepEqual(codexDynamicTool?.resultBlocks?.map((block) => block.type), [
  'text',
  'image',
  'audio',
]);
assert.deepEqual(codexDynamicTool?.resultBlocks?.[2], {
  type: 'audio',
  source: 'data:audio/wav;base64,YXVkaW8=',
  mimeType: 'audio/wav',
});

const codexAppServerCommand = projectChatMessageToolCall({
  type: 'commandExecution',
  id: 'codex-command-camel-1',
  command: 'pnpm typecheck',
  aggregatedOutput: 'Typecheck passed',
  status: 'completed',
  durationMs: 250,
}, 0, { engineId: 'codex' });
assert.equal(codexAppServerCommand?.output, 'Typecheck passed');
assert.equal(codexAppServerCommand?.durationMs, 250);

const claudeTaskNotification = projectChatMessageToolCall({
  type: 'system',
  subtype: 'task_notification',
  task_id: 'claude-task-1',
  status: 'stopped',
  summary: 'Worker stopped by user',
  output_file: 'C:/tmp/claude-task-1.log',
  usage: { duration_ms: 750 },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeTaskNotification?.id, 'claude-task-1');
assert.equal(claudeTaskNotification?.kind, 'agent');
assert.equal(claudeTaskNotification?.status, 'cancelled');
assert.equal(claudeTaskNotification?.durationMs, 750);

for (const subtype of ['task_started', 'task_notification']) {
  assert.equal(projectChatMessageToolCall({
    type: 'system',
    subtype,
    task_id: `claude-ambient-${subtype}`,
    tool_use_id: `toolu-ambient-${subtype}`,
    description: 'Internal housekeeping',
    status: 'completed',
    summary: 'Ambient task completed',
    skip_transcript: true,
  }, 0, { engineId: 'claude-code' }), null);
}

const claudeTaskUpdated = projectChatMessageToolCall({
  type: 'system',
  subtype: 'task_updated',
  task_id: 'claude-task-updated-1',
  patch: {
    status: 'paused',
    description: 'Waiting for review',
    total_paused_ms: 500,
  },
}, 0, { engineId: 'claude-code' });
assert.equal(claudeTaskUpdated?.id, 'claude-task-updated-1');
assert.equal(claudeTaskUpdated?.status, 'waiting');
assert.equal(claudeTaskUpdated?.title, 'Waiting for review');

const claudePermissionDenied = projectChatMessageToolCall({
  type: 'system',
  subtype: 'permission_denied',
  tool_name: 'Bash',
  tool_use_id: 'toolu-permission-denied-1',
  decision_reason_type: 'rule',
  decision_reason: 'Command is outside the workspace policy.',
  message: 'Permission denied',
}, 0, { engineId: 'claude-code' });
assert.equal(claudePermissionDenied?.id, 'toolu-permission-denied-1');
assert.equal(claudePermissionDenied?.name, 'Bash');
assert.equal(claudePermissionDenied?.status, 'cancelled');
assert.equal(claudePermissionDenied?.output, 'Permission denied');

const geminiErroredSubagent = projectChatMessageToolCall({
  id: 'gemini-agent-error-1',
  name: 'browser_agent',
  status: 'success',
  resultDisplay: {
    isSubagentProgress: true,
    agentName: 'browser_agent',
    state: 'error',
    result: 'Navigation failed',
    recentActivity: [],
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiErroredSubagent?.status, 'error');

const geminiNativeError = projectChatMessageToolCall({
  status: 'error',
  request: {
    callId: 'gemini-native-error-1',
    name: 'read_file',
    args: { file_path: 'src/private.ts' },
  },
  response: {
    responseParts: [],
    error: new Error('Native read failed'),
  },
}, 0, { engineId: 'gemini' });
assert.deepEqual(geminiNativeError?.resultBlocks, [{
  type: 'error',
  message: 'Native read failed',
}]);

const structuredMcpResult = projectChatMessageToolCall({
  id: 'mcp-structured-1',
  server: 'issues',
  tool: 'list_issues',
  type: 'mcpToolCall',
  status: 'completed',
  arguments: {},
  result: {
    content: [],
    structuredContent: {
      issues: [{ id: 'SDK-1', priority: 1 }],
    },
  },
}, 0, { engineId: 'codex' });
assert.deepEqual(structuredMcpResult?.resultBlocks, [{
  type: 'list',
  items: ['issues[0].id: SDK-1', 'issues[0].priority: 1'],
}]);

const boundedGeminiGrepResult = projectChatMessageToolCall({
  id: 'gemini-grep-bounded-1',
  name: 'grep_search',
  status: 'completed',
  resultDisplay: {
    matches: [{
      filePath: 'src/large.ts',
      lineNumber: 10,
      line: 'x'.repeat(3_000),
    }],
  },
}, 0, { engineId: 'gemini' });
const boundedGeminiGrepList = boundedGeminiGrepResult?.resultBlocks?.find(
  (block) => block.type === 'list',
);
assert.ok(boundedGeminiGrepList && boundedGeminiGrepList.type === 'list');
assert.equal(boundedGeminiGrepList.items[0]?.length, 2_003);
assert.equal(boundedGeminiGrepList.items[0]?.endsWith('...'), true);

const canonicalResultWithTrailingError = projectChatMessageToolCall({
  id: 'canonical-trailing-error',
  name: 'read_file',
  arguments: { path: 'src/App.tsx' },
  resultBlocks: [
    ...Array.from({ length: 24 }, (_, index) => ({
      type: 'text' as const,
      text: `partial result ${index + 1}`,
    })),
    { type: 'error', message: 'final provider failure' },
  ],
}, 0);
assert.equal(
  canonicalResultWithTrailingError?.status,
  'error',
  'A canonical trailing error block must drive the normalized tool status even without a provider status field.',
);
assert.equal(canonicalResultWithTrailingError?.resultBlocks?.length, 25);
assert.deepEqual(canonicalResultWithTrailingError?.resultBlocks?.at(-1), {
  type: 'error',
  message: 'final provider failure',
});

for (const [toolName, kind] of [
  ['codesearch', 'search'],
  ['ls', 'search'],
  ['multiedit', 'file'],
  ['webfetch', 'web'],
  ['TaskCreate', 'task'],
  ['TaskOutput', 'agent'],
  ['AskUserQuestion', 'question'],
] as const) {
  assert.equal(
    projectChatMessageToolCall({ id: `classification-${toolName}`, name: toolName }, 0)?.kind,
    kind,
  );
}

const commandOnlyView = resolveChatMessageView({
  id: 'msg-command-1',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-06-22T00:00:03.000Z',
  tool_calls: [openCodeToolPart],
  commands: [{
    command: 'pnpm lint',
    status: 'error',
    output: 'authoritative lint failure',
    toolCallId: 'call-opencode-1',
  }],
}, { engineId: 'opencode' });
assert.equal(commandOnlyView.kind, 'assistant.activity');
assert.equal(commandOnlyView.blocks.some((block) => block.type === 'commands'), false);
const commandActivityBlock = commandOnlyView.blocks.find((block) => block.type === 'activity');
assert.ok(commandActivityBlock && commandActivityBlock.type === 'activity');
assert.equal(commandActivityBlock.commands.length, 1);
assert.equal(
  (commandActivityBlock.commands[0] as { status?: string }).status,
  'error',
  'structured command snapshots must win over protocol-derived fallback state.',
);
assert.equal(commandOnlyView.blocks.some((block) => block.type === 'tool-calls'), false);

const toolResultView = resolveChatMessageView({
  id: 'msg-result-1',
  codingSessionId: 'session-1',
  role: 'tool',
  name: 'mcp__linear__list_issues',
  tool_call_id: 'mcp-1',
  content: '{"issues":[{"id":"SDK-1"}]}',
  createdAt: '2026-06-22T00:00:04.000Z',
});
assert.equal(toolResultView.blocks.some((block) => block.type === 'markdown'), false);
assert.equal(toolResultView.blocks.some((block) => block.type === 'tool-calls'), true);

console.log('chat message tool calls contract passed.');
