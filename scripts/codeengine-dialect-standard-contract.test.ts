import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canonicalizeBirdCoderCodeEngineToolName,
  canonicalizeBirdCoderCodeEngineProviderToolName,
  isBirdCoderCodeEngineApprovalToolName,
  isBirdCoderCodeEngineSettledStatus,
  isBirdCoderCodeEngineUserQuestionToolName,
  flushBirdCoderCodeEngineToolCallDeltas,
  mergeBirdCoderCodeEngineToolCallDelta,
  mergeBirdCoderCodeEngineCommandSnapshot,
  normalizeBirdCoderCodeEngineBoolean,
  normalizeBirdCoderCodeEngineDialectKey,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  resolveBirdCoderCodingSessionRuntimeStatus,
  resolveBirdCoderCodeEngineApprovalRuntimeStatus,
  resolveBirdCoderCodeEngineCommandText,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineCommandInteractionState,
  resolveBirdCoderCodeEngineApprovalId,
  resolveBirdCoderCodeEngineCheckpointId,
  resolveBirdCoderCodeEngineRiskLevel,
  resolveBirdCoderCodeEngineSessionRuntimeStatus,
  resolveBirdCoderCodeEngineSessionStatusFromRuntime,
  resolveBirdCoderCodeEngineToolCallId,
  resolveBirdCoderCodeEngineToolKind,
  resolveBirdCoderCodeEngineUserQuestionId,
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const userQuestionAliases = [
  'question',
  'ask-user',
  'ask_user',
  'prompt user',
  'input-request',
  'user input',
  'user_question',
];

for (const alias of userQuestionAliases) {
  assert.equal(normalizeBirdCoderCodeEngineDialectKey(alias)?.includes('-'), false);
  assert.equal(isBirdCoderCodeEngineUserQuestionToolName(alias), true);
  assert.equal(canonicalizeBirdCoderCodeEngineToolName(alias), 'user_question');
}

const approvalAliases = [
  'approval_request',
  'permission request',
  'confirm',
  'authorization-request',
  'request permission',
  'request_approval',
];

for (const alias of approvalAliases) {
  assert.equal(isBirdCoderCodeEngineApprovalToolName(alias), true);
  assert.equal(canonicalizeBirdCoderCodeEngineToolName(alias), 'permission_request');
}

assert.equal(canonicalizeBirdCoderCodeEngineToolName('read_file'), 'read_file');
assert.equal(canonicalizeBirdCoderCodeEngineToolName('bash'), 'run_command');
assert.equal(canonicalizeBirdCoderCodeEngineToolName('shell-command'), 'run_command');
assert.equal(canonicalizeBirdCoderCodeEngineToolName('execute_command'), 'run_command');
assert.equal(canonicalizeBirdCoderCodeEngineToolName('command_execution'), 'run_command');
assert.equal(canonicalizeBirdCoderCodeEngineToolName('todoWrite'), 'write_todo');
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'Bash',
  }),
  'run_command',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude code',
    toolName: 'Read',
  }),
  'read_file',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'Edit',
  }),
  'edit_file',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'Write',
  }),
  'write_file',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'MultiEdit',
  }),
  'multi_edit',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'Grep',
  }),
  'grep_code',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'Glob',
  }),
  'search_code',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'claude-code',
    toolName: 'TodoWrite',
  }),
  'write_todo',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'gemini',
    toolName: 'shell-command',
  }),
  'run_command',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'gemini',
    toolName: 'approval-request',
  }),
  'permission_request',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'codex',
    toolName: 'command_execution',
  }),
  'run_command',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'opencode',
    toolName: 'bash',
  }),
  'run_command',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    provider: 'opencode',
    toolName: 'question',
  }),
  'user_question',
);
assert.equal(
  canonicalizeBirdCoderCodeEngineProviderToolName({
    fallbackToolName: 'tool_use',
    provider: 'claude-code',
    toolName: '   ',
  }),
  'tool_use',
);
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'question' }), 'user_question');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'ask-user' }), 'user_question');
assert.equal(
  resolveBirdCoderCodeEngineToolKind({
    toolName: 'read_file',
    runtimeStatus: 'awaiting_user',
  }),
  'user_question',
);
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'approval_request' }), 'approval');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'permission request' }), 'approval');
assert.equal(
  resolveBirdCoderCodeEngineToolKind({
    toolName: 'read_file',
    runtimeStatus: 'awaiting_approval',
  }),
  'approval',
);
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'bash' }), 'command');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'shell' }), 'command');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'shell-command' }), 'command');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'execute_command' }), 'command');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'run command' }), 'command');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'pty_exec' }), 'command');
assert.equal(
  resolveBirdCoderCodeEngineToolKind({
    hasCommandArguments: true,
    toolName: 'read_file',
  }),
  'command',
);
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'apply_patch' }), 'file_change');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'str-replace-editor' }), 'file_change');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'multi_edit' }), 'file_change');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'write file' }), 'file_change');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'todo' }), 'task');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'todoWrite' }), 'task');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'update_todo' }), 'task');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'write-todo' }), 'task');
assert.equal(resolveBirdCoderCodeEngineToolKind({ toolName: 'read_file' }), 'tool');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'bash' }), 'command-log');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'shell-command' }), 'command-log');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'create_file' }), 'patch');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'multi_edit' }), 'patch');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'todoWrite' }), 'todo-list');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'pty_exec' }), 'pty-transcript');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'read_file' }), 'diagnostic-bundle');
assert.equal(resolveBirdCoderCodeEngineArtifactKind({ toolName: 'unknown_tool' }), 'structured-output');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'question' }), 'P0');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'read_file' }), 'P0');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'todoWrite' }), 'P1');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'approval_request' }), 'P1');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'bash' }), 'P2');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'create_file' }), 'P2');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'pty_exec' }), 'P2');
assert.equal(resolveBirdCoderCodeEngineRiskLevel({ toolName: 'unknown_tool' }), 'P1');
assert.equal(normalizeBirdCoderCodeEngineBoolean(true), true);
assert.equal(normalizeBirdCoderCodeEngineBoolean('yes'), true);
assert.equal(normalizeBirdCoderCodeEngineBoolean('1'), true);
assert.equal(normalizeBirdCoderCodeEngineBoolean('false'), false);
assert.equal(normalizeBirdCoderCodeEngineBoolean('0'), false);
assert.equal(normalizeBirdCoderCodeEngineBoolean('unknown'), undefined);
assert.equal(
  resolveBirdCoderCodeEngineToolCallId({
    payload: {
      callID: 'tool-opencode-1',
    },
  }),
  'tool-opencode-1',
);
assert.equal(
  resolveBirdCoderCodeEngineToolCallId({
    payload: {
      id: 'generic-payload-id',
    },
    toolArguments: {
      toolCallId: 'specific-tool-argument-id',
    },
  }),
  'specific-tool-argument-id',
);
assert.equal(
  resolveBirdCoderCodeEngineToolCallId({
    payload: {
      tool_call_id: 'tool-snake-1',
    },
  }),
  'tool-snake-1',
);
assert.equal(
  resolveBirdCoderCodeEngineUserQuestionId({
    payload: {
      callID: 'tool-opencode-question-1',
    },
    toolArguments: {
      requestID: 'question-opencode-1',
    },
  }),
  'question-opencode-1',
);
assert.equal(
  resolveBirdCoderCodeEngineUserQuestionId({
    toolArguments: {
      request_id: 'question-snake-1',
    },
  }),
  'question-snake-1',
);
assert.equal(
  resolveBirdCoderCodeEngineUserQuestionId({
    toolCallId: 'tool-fallback-question-1',
  }),
  'tool-fallback-question-1',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalId({
    toolArguments: {
      permissionId: 'permission-provider-1',
    },
  }),
  'permission-provider-1',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalId({
    payload: {
      id: 'generic-approval-payload-id',
    },
    toolArguments: {
      permissionId: 'specific-permission-provider-1',
    },
  }),
  'specific-permission-provider-1',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalId({
    toolArguments: {
      approval_id: 'approval-snake-1',
    },
  }),
  'approval-snake-1',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalId({
    toolArguments: {
      requestID: 'approval-request-provider-1',
    },
  }),
  'approval-request-provider-1',
);
assert.equal(
  resolveBirdCoderCodeEngineCheckpointId({
    payload: {
      checkpointID: 'checkpoint-provider-1',
    },
  }),
  'checkpoint-provider-1',
);
assert.deepEqual(
  resolveBirdCoderCodeEngineCommandInteractionState({
    kind: 'approval',
    runtimeStatus: 'awaiting_approval',
    status: 'running',
  }),
  {
    isRunning: true,
    requiresApproval: true,
    requiresReply: false,
  },
);
assert.deepEqual(
  resolveBirdCoderCodeEngineCommandInteractionState({
    kind: 'approval',
    runtimeStatus: 'awaiting_approval',
    status: 'success',
  }),
  {
    isRunning: false,
    requiresApproval: false,
    requiresReply: false,
  },
);
assert.deepEqual(
  resolveBirdCoderCodeEngineCommandInteractionState({
    kind: 'tool',
    requiresApprovalValues: ['false', 'yes'],
    status: 'running',
  }),
  {
    isRunning: true,
    requiresApproval: true,
    requiresReply: false,
  },
);
assert.deepEqual(
  resolveBirdCoderCodeEngineCommandInteractionState({
    kind: 'user_question',
    runtimeStatus: 'awaiting_user',
    status: 'running',
  }),
  {
    isRunning: true,
    requiresApproval: false,
    requiresReply: true,
  },
);
assert.deepEqual(
  resolveBirdCoderCodeEngineCommandInteractionState({
    kind: 'user_question',
    requiresReply: true,
    runtimeStatus: 'awaiting_user',
    status: 'error',
  }),
  {
    isRunning: false,
    requiresApproval: false,
    requiresReply: false,
  },
);
assert.equal(
  resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: '{"query":"TODO"}',
    toolArguments: {
      query: 'TODO',
    },
    toolName: 'search_code',
  }),
  'TODO',
);
assert.equal(
  resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: '{"request":{"args":{"file_path":"src/App.tsx"}}}',
    toolArguments: {
      request: {
        args: {
          file_path: 'src/App.tsx',
        },
      },
    },
    toolName: 'permission_request',
  }),
  'Permission required: src/App.tsx',
);
assert.equal(
  resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: '{"changes":[]}',
    toolArguments: {
      changes: [
        {
          path: 'src/App.tsx',
        },
        {
          file_path: 'src/index.ts',
        },
      ],
    },
    toolName: 'apply_patch',
  }),
  'apply_patch: src/App.tsx, src/index.ts',
);
assert.equal(
  resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: '{"status":"awaiting_user"}',
    toolArguments: {
      questions: [
        {
          question: 'Which tests should I run?',
        },
      ],
      status: 'awaiting_user',
    },
    toolName: 'question',
  }),
  'Which tests should I run?',
);
assert.equal(
  resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: '{"status":"completed","answer":"Unit"}',
    toolArguments: {
      answer: 'Unit',
      status: 'completed',
    },
    toolName: 'user_question',
  }),
  'Unit',
);
assert.deepEqual(
  mergeBirdCoderCodeEngineCommandSnapshot(
    {
      command: 'Which tests should I run?',
      kind: 'user_question',
      output: '{"status":"awaiting_user"}',
      requiresReply: true,
      status: 'running',
      toolName: 'user_question',
    },
    {
      command: 'user_question',
      kind: 'user_question',
      output: '{"answer":"Unit"}',
      requiresReply: false,
      runtimeStatus: 'awaiting_tool',
      status: 'success',
      toolName: 'user_question',
    },
  ),
  {
    command: 'Which tests should I run?',
    kind: 'user_question',
    output: '{"answer":"Unit"}',
    requiresReply: false,
    runtimeStatus: 'awaiting_tool',
    status: 'success',
    toolName: 'user_question',
  },
);

const pendingChunkedToolCalls = new Map();
const pendingChunkedToolCallOrder: string[] = [];
mergeBirdCoderCodeEngineToolCallDelta({
  pendingToolCallOrder: pendingChunkedToolCallOrder,
  pendingToolCalls: pendingChunkedToolCalls,
  toolCall: {
    id: 'tool-run-tests',
    index: 0,
    type: 'function',
    function: {
      name: 'run_command',
      arguments: '{"command":"pnpm',
    },
  },
});
mergeBirdCoderCodeEngineToolCallDelta({
  pendingToolCallOrder: pendingChunkedToolCallOrder,
  pendingToolCalls: pendingChunkedToolCalls,
  toolCall: {
    index: 0,
    function: {
      arguments: ' test","cwd":"D:/workspace/demo"}',
    },
  },
});
assert.deepEqual(
  flushBirdCoderCodeEngineToolCallDeltas({
    pendingToolCallOrder: pendingChunkedToolCallOrder,
    pendingToolCalls: pendingChunkedToolCalls,
  }),
  [
    {
      id: 'tool-run-tests',
      type: 'function',
      function: {
        name: 'run_command',
        arguments: '{"command":"pnpm test","cwd":"D:/workspace/demo"}',
      },
    },
  ],
  'shared tool-call delta accumulator must merge OpenAI-style chunked arguments by index',
);

const pendingSnapshotToolCalls = new Map();
const pendingSnapshotToolCallOrder: string[] = [];
mergeBirdCoderCodeEngineToolCallDelta({
  pendingToolCallOrder: pendingSnapshotToolCallOrder,
  pendingToolCalls: pendingSnapshotToolCalls,
  toolCall: {
    id: 'tool-snapshot-command',
    type: 'function',
    function: {
      name: 'run_command',
      arguments: '{"command":"pnpm test","status":"running"}',
    },
  },
});
mergeBirdCoderCodeEngineToolCallDelta({
  pendingToolCallOrder: pendingSnapshotToolCallOrder,
  pendingToolCalls: pendingSnapshotToolCalls,
  toolCall: {
    id: 'tool-snapshot-command',
    type: 'function',
    function: {
      name: 'run_command',
      arguments: '{"command":"pnpm test","status":"completed","output":"ok"}',
    },
  },
});
assert.deepEqual(
  flushBirdCoderCodeEngineToolCallDeltas({
    pendingToolCallOrder: pendingSnapshotToolCallOrder,
    pendingToolCalls: pendingSnapshotToolCalls,
  }),
  [
    {
      id: 'tool-snapshot-command',
      type: 'function',
      function: {
        name: 'run_command',
        arguments: '{"command":"pnpm test","status":"completed","output":"ok"}',
      },
    },
  ],
  'shared tool-call delta accumulator must replace repeated complete snapshots instead of concatenating invalid JSON',
);
assert.deepEqual(
  mergeBirdCoderCodeEngineCommandSnapshot(
    {
      command: 'permission_request',
      kind: 'approval',
      requiresApproval: true,
      status: 'running',
      toolName: 'permission_request',
    },
    {
      command: 'apply_patch src/App.tsx',
      kind: 'approval',
      requiresApproval: false,
      status: 'success',
      toolName: 'permission_request',
    },
  ),
  {
    command: 'apply_patch src/App.tsx',
    kind: 'approval',
    requiresApproval: false,
    status: 'success',
    toolName: 'permission_request',
  },
);
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('needs approval'), 'awaiting_approval');
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('waiting-for-user'), 'awaiting_user');
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('success'), 'completed');
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('running'), 'streaming');
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('busy'), 'streaming');
assert.equal(normalizeBirdCoderCodeEngineRuntimeStatus('retry'), 'failed');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('busy'), 'streaming');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('retry'), 'failed');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('active'), 'streaming');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('paused'), 'failed');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('archived'), 'completed');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus(undefined), 'completed');
assert.equal(resolveBirdCoderCodeEngineSessionRuntimeStatus('unknown'), 'ready');
assert.equal(resolveBirdCoderCodeEngineSessionStatusFromRuntime('streaming'), 'active');
assert.equal(resolveBirdCoderCodeEngineSessionStatusFromRuntime('awaiting_user'), 'active');
assert.equal(resolveBirdCoderCodeEngineSessionStatusFromRuntime('failed'), 'paused');
assert.equal(resolveBirdCoderCodeEngineSessionStatusFromRuntime('completed'), 'completed');
assert.equal(resolveBirdCoderCodeEngineSessionStatusFromRuntime('terminated'), 'completed');
assert.equal(
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      payload: {
        runtimeStatus: 'busy',
      },
    },
  ]),
  'streaming',
  'coding session runtime-status resolver must normalize native event aliases through the shared code-engine dialect.',
);
assert.equal(
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      payload: {
        runtimeStatus: 'retry',
      },
    },
  ]),
  'failed',
  'coding session runtime-status resolver must canonicalize failed native event aliases before UI hydration.',
);
assert.equal(
  resolveBirdCoderCodingSessionRuntimeStatus(
    [
      {
        payload: {
          runtimeStatus: 'unknown-runtime-status',
        },
      },
    ],
    'ready',
  ),
  'ready',
  'coding session runtime-status resolver must fall back when an event carries an unknown runtime status.',
);

assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('permission asked'), 'awaiting_approval');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('user input required'), 'awaiting_user');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('in-progress'), 'running');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('allow'), 'completed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('approve'), 'completed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('grant'), 'completed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('approved'), 'completed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('deny'), 'failed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('decline'), 'failed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('reject'), 'failed');
assert.equal(normalizeBirdCoderCodeEngineToolLifecycleStatus('cancelled'), 'cancelled');
assert.equal(isBirdCoderCodeEngineSettledStatus('awaiting_tool'), true);
assert.equal(isBirdCoderCodeEngineSettledStatus('blocked'), true);
assert.equal(isBirdCoderCodeEngineSettledStatus('waiting_for_user'), false);

assert.equal(
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus({
    status: 'completed',
  }),
  'awaiting_tool',
);
assert.equal(
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus({
    status: 'rejected',
  }),
  'failed',
);
assert.equal(
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus({
    runtimeStatus: 'completed',
    hasAnswer: true,
  }),
  'awaiting_tool',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: 'approved',
  }),
  'awaiting_tool',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: 'allow',
  }),
  'awaiting_tool',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: 'denied',
  }),
  'failed',
);
assert.equal(
  resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: 'deny',
  }),
  'failed',
);

const adapterFiles = [
  'packages/sdkwork-birdcoder-chat-claude/src/index.ts',
  'packages/sdkwork-birdcoder-types/src/index.ts',
  'packages/sdkwork-birdcoder-chat-gemini/src/index.ts',
  'packages/sdkwork-birdcoder-chat-opencode/src/index.ts',
  'packages/sdkwork-birdcoder-codeengine/src/runtime.ts',
  'packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts',
  'scripts/codeengine-official-sdk-bridge.ts',
];

const forbiddenLocalDialectPatterns = [
  /(?:USER_QUESTION|APPROVAL)_TOOL_NAME_ALIASES/u,
  /(?:USER_QUESTION|APPROVAL)_(?:AWAITING_TOOL|FAILED)_STATUSES/u,
  /OPENCODE_PERMISSION_(?:AWAITING_TOOL|FAILED)_STATUSES/u,
  /SETTLED_(?:USER_QUESTION|APPROVAL)_STATUSES/u,
  /normalize(?:Gemini|OpenCode|Canonical|Projection)?ToolNameAlias/u,
  /normalizeClaudeToolName/u,
  /switch \(toolName\.trim\(\)\.toLocaleLowerCase\(\)\)/u,
  /normalize(?:Gemini|OpenCode|Canonical|Projection)?StatusKey/u,
  /normalizedToolName === '(?:bash|command|command_execution|execute_command|pty_exec|run_command|shell|shell_command)'/u,
  /normalizedToolName === '(?:apply_patch|create_file|edit_file|multi_edit|replace_file|str_replace_editor|write_file)'/u,
  /normalizedToolName === '(?:todo|todowrite|update_todo|write_todo)'/u,
  /case '(?:bash|command|command_execution|execute_command|pty_exec|run_command|shell|shell_command)'/u,
  /case '(?:apply_patch|create_file|edit_file|multi_edit|replace_file|str_replace_editor|write_file)'/u,
  /case '(?:todo|todowrite|update_todo|write_todo)'/u,
  /PROJECTION_FILE_CHANGE_TOOL_NAMES/u,
];

for (const filePath of adapterFiles) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenLocalDialectPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${filePath} must consume the shared code-engine dialect standard instead of ${pattern}`,
    );
  }
}

const interactionSemanticFiles = [
  'packages/sdkwork-birdcoder-types/src/index.ts',
  'packages/sdkwork-birdcoder-codeengine/src/runtime.ts',
  'packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx',
  'scripts/codeengine-official-sdk-bridge.ts',
];

const forbiddenLocalInteractionPatterns = [
  /function normalizeCanonicalToolStatus/u,
  /function normalizeCanonicalToolExitCode/u,
  /function resolve(?:Projection|ToolCall)?PermissionRequestText/u,
  /function resolve(?:Projection|ToolCall)?ToolPromptText/u,
  /function normalize(?:ProjectionPayload|ToolCall)Boolean/u,
  /kind === 'approval'/u,
  /kind === 'user_question'/u,
  /runtimeStatus === 'awaiting_approval'/u,
  /runtimeStatus === 'awaiting_user'/u,
];

for (const filePath of interactionSemanticFiles) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenLocalInteractionPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${filePath} must consume the shared code-engine interaction state standard instead of ${pattern}`,
    );
  }
}

const toolCallDeltaConsumerFiles = [
  'packages/sdkwork-birdcoder-codeengine/src/runtime.ts',
  'scripts/codeengine-official-sdk-bridge.ts',
];

const chatPackageDialectExportSource = readFileSync(
  'packages/sdkwork-birdcoder-chat/src/index.ts',
  'utf8',
);
for (const exportName of [
  'mergeBirdCoderCodeEngineToolCallDelta',
  'flushBirdCoderCodeEngineToolCallDeltas',
  'BirdCoderCodeEngineToolCallDelta',
  'BirdCoderCodeEnginePendingToolCallDelta',
]) {
  assert.equal(
    chatPackageDialectExportSource.includes(exportName),
    true,
    `@sdkwork/birdcoder-chat must re-export ${exportName} with the rest of the shared code-engine dialect surface.`,
  );
}

const forbiddenLocalToolCallDeltaPatterns = [
  /function merge(?:Canonical)?ToolCallDelta/u,
  /function merge(?:Canonical)?ToolCallArguments/u,
  /function isCompleteJsonToolArguments/u,
  /function flush(?:Canonical)?ToolCallDeltas/u,
];

for (const filePath of toolCallDeltaConsumerFiles) {
  const source = readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenLocalToolCallDeltaPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${filePath} must consume the shared tool-call delta accumulator instead of ${pattern}`,
    );
  }
}

const openCodeAdapterSource = readFileSync(
  'packages/sdkwork-birdcoder-chat-opencode/src/index.ts',
  'utf8',
);
assert.equal(
  /status === 'completed'|status === 'failed' \|\| status === 'cancelled'/u.test(openCodeAdapterSource),
  false,
  'OpenCode adapter must use the shared code-engine interaction runtime resolver instead of local lifecycle branching.',
);

console.log('Code engine dialect standard contract passed.');
