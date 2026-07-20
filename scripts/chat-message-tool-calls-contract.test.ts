import assert from 'node:assert/strict';

import {
  projectChatMessageToolCall,
  projectChatMessageToolCalls,
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

const codexWebSearch = projectChatMessageToolCall({
  item: {
    id: 'web-codex-1',
    type: 'web_search',
    query: 'BirdCoder protocol',
  },
}, 0, { engineId: 'codex' });
assert.equal(codexWebSearch?.kind, 'web');
assert.equal(codexWebSearch?.target, 'BirdCoder protocol');

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

const geminiConfirmation = projectChatMessageToolCall({
  type: 'tool_call_confirmation',
  value: {
    request: {
      callId: 'call-gemini-approval-1',
      name: 'shell_command',
      args: { command: 'pnpm test' },
    },
    details: { type: 'exec' },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiConfirmation?.kind, 'approval');
assert.equal(geminiConfirmation?.status, 'waiting');

const cancelledToolCall = projectChatMessageToolCall({
  id: 'call-cancelled-1',
  name: 'shell_command',
  arguments: { command: 'pnpm test' },
  status: 'cancelled',
}, 0);
assert.equal(cancelledToolCall?.status, 'cancelled');

assert.equal(projectChatMessageToolCall({
  type: 'reasoning',
  summary: [{ type: 'summary_text', text: 'private reasoning' }],
}, 0, { engineId: 'codex' }), null);
assert.equal(projectChatMessageToolCall({
  type: 'tool_use_summary',
  summary: 'Read 10 files',
}, 0, { engineId: 'claude-code' }), null);

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
