import assert from 'node:assert/strict';

import {
  resolveChatMessageView,
  type ChatMessageViewSource,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';
import {
  areBirdCoderChatMessagesLogicallyMatched,
  deduplicateBirdCoderComparableChatMessages,
  extractBirdCoderProtocolNotices,
  extractBirdCoderTextContent,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/coding-session.ts';
import {
  mergeBirdCoderProjectionMessages,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  resolveMessageCopyContent,
  projectChatTranscriptToolActivity,
  resolveChatTurnActivitySummary,
  resolveProjectedActivityFileChanges,
  resolveVisibleAssistantMessageContent,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-activity-projection.ts';
import {
  projectChatMessageToolCalls,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts';
import { resolveTaskProgressDisplayState } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-task-progress.ts';
import {
  isSupportedEditorMessageFilePath,
  resolveEditorMessageFilePath,
  resolveEditorMessageFilePathResolution,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/editorMessageFilePath.ts';

const editorMessageFilePathOptions = {
  filePaths: new Set([
    '/Message Display Project/src/features/chat/ProviderMessageAdapter.ts',
    '/Message Display Project/packages/a/index.ts',
    '/Message Display Project/packages/b/index.ts',
  ]),
  loadedDirectoryPaths: new Set([
    '/Message Display Project',
    '/Message Display Project/src',
    '/Message Display Project/src/features',
  ]),
};
const resolvedProviderMessagePath = '/Message Display Project/src/features/chat/ProviderMessageAdapter.ts';
for (const providerPath of [
  resolvedProviderMessagePath,
  'src/features/chat/ProviderMessageAdapter.ts',
  './src/features/chat/ProviderMessageAdapter.ts',
  'src\\features\\chat\\ProviderMessageAdapter.ts',
  'a/src/features/chat/ProviderMessageAdapter.ts',
  'C:\\workspace\\src\\features\\chat\\ProviderMessageAdapter.ts',
  '/home/developer/workspace/src/features/chat/ProviderMessageAdapter.ts',
  String.raw`\\server\share\workspace\src\features\chat\ProviderMessageAdapter.ts`,
]) {
  assert.equal(
    resolveEditorMessageFilePath(providerPath, editorMessageFilePathOptions),
    resolvedProviderMessagePath,
    `Provider file path ${providerPath} must resolve inside the active project tree.`,
  );
}
assert.equal(
  resolveEditorMessageFilePath('src/lazy/NotLoadedYet.ts', editorMessageFilePathOptions),
  '/Message Display Project/src/lazy/NotLoadedYet.ts',
  'Relative provider paths must resolve below the single loaded project root before lazy expansion.',
);
assert.equal(
  resolveEditorMessageFilePath('/Message Display Project/src/lazy/NotLoadedYet.ts', editorMessageFilePathOptions),
  '/Message Display Project/src/lazy/NotLoadedYet.ts',
  'Exact virtual workspace paths must remain stable before their directory is expanded.',
);
assert.equal(resolveEditorMessageFilePath('../secrets.txt', editorMessageFilePathOptions), null);
assert.equal(resolveEditorMessageFilePath('index.ts', editorMessageFilePathOptions), null);
assert.equal(resolveEditorMessageFilePath('src/unsafe\u0000.ts', editorMessageFilePathOptions), null);
for (const directoryPath of [
  '/Message Display Project',
  '/Message Display Project/',
  '/Message Display Project/src',
  'src',
]) {
  assert.equal(
    resolveEditorMessageFilePath(directoryPath, editorMessageFilePathOptions),
    null,
    `Provider directory path ${directoryPath} must not create an editor file tab.`,
  );
}
assert.deepEqual(
  resolveEditorMessageFilePathResolution(
    '/Message Display Project/src',
    editorMessageFilePathOptions,
  ),
  { status: 'rejected', reason: 'directory' },
  'A known provider directory must be rejected instead of becoming a permanent pending file intent.',
);
for (const unsupportedPath of [
  String.raw`C:src\features\chat\ProviderMessageAdapter.ts`,
  'file:///Message%20Display%20Project/src/features/chat/ProviderMessageAdapter.ts',
  'https://example.com/src/features/chat/ProviderMessageAdapter.ts',
  String.raw`\\?\C:\workspace\src\features\chat\ProviderMessageAdapter.ts`,
  String.raw`\\.\C:\workspace\src\features\chat\ProviderMessageAdapter.ts`,
]) {
  assert.equal(
    isSupportedEditorMessageFilePath(unsupportedPath),
    false,
    `Unsupported provider path ${unsupportedPath} must be rejected before editor navigation.`,
  );
  assert.equal(
    resolveEditorMessageFilePath(unsupportedPath, editorMessageFilePathOptions),
    null,
    `Unsupported provider path ${unsupportedPath} must not be interpreted as a workspace file.`,
  );
}
assert.equal(
  isSupportedEditorMessageFilePath('src/features/chat/ProviderMessageAdapter.ts'),
  true,
  'A safe project-relative provider path must remain eligible for lazy editor resolution.',
);
for (const windowsProviderPath of [
  String.raw`c:\WORKSPACE\SRC\FEATURES\CHAT\providermessageadapter.ts`,
  String.raw`\\SERVER\SHARE\WORKSPACE\SRC\FEATURES\CHAT\providermessageadapter.ts`,
]) {
  assert.equal(
    resolveEditorMessageFilePath(windowsProviderPath, editorMessageFilePathOptions),
    resolvedProviderMessagePath,
    'Windows drive and UNC provider paths must resolve case-insensitively when their suffix is unique.',
  );
}
assert.equal(
  resolveEditorMessageFilePath(
    '/home/developer/workspace/src/features/chat/providermessageadapter.ts',
    editorMessageFilePathOptions,
  ),
  null,
  'Unix provider paths must retain case-sensitive file semantics.',
);
assert.equal(
  resolveEditorMessageFilePath(
    String.raw`C:\workspace\src\FOO.ts`,
    {
      filePaths: new Set([
        '/Case Sensitive Project/src/Foo.ts',
        '/Case Sensitive Project/src/foo.ts',
      ]),
      loadedDirectoryPaths: new Set(['/Case Sensitive Project']),
    },
  ),
  null,
  'Case-insensitive Windows suffix resolution must reject ambiguous files.',
);
assert.deepEqual(
  resolveEditorMessageFilePathResolution(
    String.raw`C:\workspace\src\FOO.ts`,
    {
      filePaths: new Set([
        '/Case Sensitive Project/src/Foo.ts',
        '/Case Sensitive Project/src/foo.ts',
      ]),
      loadedDirectoryPaths: new Set(['/Case Sensitive Project']),
    },
  ),
  { status: 'rejected', reason: 'ambiguous' },
  'A known ambiguous provider path must be rejected before the UI changes surfaces.',
);
assert.deepEqual(
  resolveEditorMessageFilePathResolution(
    'src/features/chat/Pending.ts',
    { filePaths: new Set(), loadedDirectoryPaths: new Set() },
  ),
  { status: 'pending' },
  'A safe provider path may remain pending only while the project file index is unavailable.',
);

const headerOnlyActivityMessage: ChatMessageViewSource = {
  id: 'msg-assistant-header',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: 'Updated the following files:',
  createdAt: '2026-06-22T00:00:01.000Z',
  fileChanges: [
    {
      path: 'src/example.ts',
      additions: 3,
      deletions: 1,
    },
  ],
};

assert.equal(
  resolveVisibleAssistantMessageContent(headerOnlyActivityMessage),
  '',
  'header-only activity messages must not expose duplicate raw tool summary text.',
);

assert.equal(
  resolveMessageCopyContent(headerOnlyActivityMessage),
  '',
  'copy projection must omit hidden tool summary prose.',
);

const parsedSummaryMessage: ChatMessageViewSource = {
  id: 'msg-assistant-parsed',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: [
    'Here is the plan.',
    '',
    'Updated the following files:',
    'M src/example.ts',
  ].join('\n'),
  createdAt: '2026-06-22T00:00:02.000Z',
};

assert.equal(
  resolveVisibleAssistantMessageContent(parsedSummaryMessage),
  'Here is the plan.',
  'surrounding assistant prose must remain visible after stripping parsed file summaries.',
);

assert.equal(
  resolveProjectedActivityFileChanges(parsedSummaryMessage).length,
  1,
  'parsed file summaries must become structured activity file changes.',
);

const turnMessages: ChatMessageViewSource[] = [
  {
    id: 'turn-user',
    codingSessionId: 'session-1',
    turnId: 'turn-1',
    role: 'user',
    content: 'Update the app and verify it.',
    createdAt: '2026-06-22T00:00:03.000Z',
  },
  {
    id: 'turn-tool',
    codingSessionId: 'session-1',
    turnId: 'turn-1',
    role: 'tool',
    content: 'ok',
    createdAt: '2026-06-22T00:00:04.000Z',
    commands: [{ command: 'pnpm typecheck', status: 'success' }],
    fileChanges: [{ path: 'src/App.tsx', additions: 2, deletions: 1 }],
  },
  {
    id: 'turn-assistant',
    codingSessionId: 'session-1',
    turnId: 'turn-1',
    role: 'assistant',
    content: 'Completed the update.',
    createdAt: '2026-06-22T00:00:05.000Z',
  },
];
const projectedTurnMessages = projectChatTranscriptToolActivity(turnMessages);
assert.deepEqual(
  projectedTurnMessages.map((message) => message.id),
  ['turn-user', 'turn-tool', 'turn-assistant'],
  'authored and activity messages must preserve their transcript order.',
);
const activityTurnMessage = projectedTurnMessages[1]!;
const finalTurnMessage = projectedTurnMessages[2]!;
const turnActivitySummary = resolveChatTurnActivitySummary(
  projectedTurnMessages,
  activityTurnMessage,
);
assert.deepEqual(
  turnActivitySummary,
  {
    commands: [{ command: 'pnpm typecheck', status: 'success' }],
    fileChanges: [{ path: 'src/App.tsx', additions: 2, deletions: 1 }],
  },
  'the activity slot must own its commands and file changes.',
);
assert.equal(
  resolveChatTurnActivitySummary(projectedTurnMessages, finalTurnMessage),
  null,
  'the final assistant reply must not duplicate prior activity.',
);
const completedTurnView = resolveChatMessageView(activityTurnMessage, {
  activitySummary: turnActivitySummary,
});
assert.equal(
  completedTurnView.kind,
  'tool.result',
  'a tool-owned activity slot must remain a tool result instead of becoming an authored reply.',
);

const protocolOnlyTurnMessages: ChatMessageViewSource[] = [
  {
    id: 'protocol-tool-call',
    codingSessionId: 'session-1',
    turnId: 'turn-protocol',
    role: 'assistant',
    content: '',
    createdAt: '2026-06-22T00:00:06.000Z',
    tool_calls: [{
      id: 'command-call-1',
      type: 'function',
      function: {
        name: 'bash',
        arguments: '{"command":"pnpm test"}',
      },
    }],
  },
  {
    id: 'protocol-tool-result',
    codingSessionId: 'session-1',
    turnId: 'turn-protocol',
    role: 'tool',
    content: 'tests passed',
    tool_call_id: 'command-call-1',
    createdAt: '2026-06-22T00:00:07.000Z',
  },
  {
    id: 'protocol-final-reply',
    codingSessionId: 'session-1',
    turnId: 'turn-protocol',
    role: 'assistant',
    content: 'Verification completed.',
    createdAt: '2026-06-22T00:00:08.000Z',
  },
];
const projectedProtocolOnlyTurnMessages = projectChatTranscriptToolActivity(
  protocolOnlyTurnMessages,
);
assert.deepEqual(
  projectedProtocolOnlyTurnMessages.map((message) => message.id),
  ['protocol-tool-call', 'protocol-final-reply'],
  'a tool result must update and collapse into the first lifecycle slot.',
);
const protocolActivitySummary = resolveChatTurnActivitySummary(
  projectedProtocolOnlyTurnMessages,
  projectedProtocolOnlyTurnMessages[0]!,
);
assert.equal(protocolActivitySummary?.commands.length, 1);
assert.deepEqual(protocolActivitySummary?.commands[0], {
  command: 'pnpm test',
  status: 'success',
  output: 'tests passed',
  kind: 'command',
  toolName: 'bash',
  toolCallId: 'command-call-1',
});
assert.equal(
  resolveChatTurnActivitySummary(
    projectedProtocolOnlyTurnMessages,
    projectedProtocolOnlyTurnMessages[1]!,
  ),
  null,
  'the final protocol reply must not receive a duplicate command summary.',
);

const parsedOnlyView = resolveChatMessageView(parsedSummaryMessage);
assert.equal(parsedOnlyView.blocks.some((block) => block.type === 'activity'), true);
assert.equal(
  parsedOnlyView.blocks.some((block) => block.type === 'markdown' && block.content === 'Here is the plan.'),
  true,
);

assert.equal(
  resolveTaskProgressDisplayState({ total: '4', completed: '2' })?.percent,
  50,
  'task progress normalization must accept string counters from native engine payloads.',
);

assert.equal(
  resolveTaskProgressDisplayState({ total: Number.NaN, completed: 1 }),
  null,
  'task progress blocks must be omitted when counters are non-finite.',
);

const invalidProgressView = resolveChatMessageView({
  id: 'msg-assistant-invalid-progress',
  codingSessionId: 'session-1',
  role: 'assistant',
  content: 'working',
  createdAt: '2026-06-22T00:00:03.000Z',
  taskProgress: {
    total: Number.NaN,
    completed: 1,
  },
});
assert.equal(
  invalidProgressView.blocks.some((block) => block.type === 'task-progress'),
  false,
);

assert.equal(
  extractBirdCoderTextContent([
    {
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'internal reasoning' }],
    },
    { type: 'text', text: 'Visible final answer.' },
    {
      type: 'tool_use',
      id: 'toolu-private',
      name: 'Bash',
      input: { command: 'pnpm test' },
    },
    { thought: true, text: 'private Gemini thought' },
  ]),
  'Visible final answer.',
  'provider reasoning, thought, and tool blocks must never leak into answer markdown.',
);
assert.equal(
  extractBirdCoderTextContent({ functionCall: { name: 'read_file', args: { path: 'secret' } } }),
  undefined,
  'Gemini function-call parts must be projected as tools instead of answer text.',
);
assert.equal(
  extractBirdCoderTextContent({ type: 'content', value: 'Gemini answer.' }),
  'Gemini answer.',
  'Gemini content events must remain visible after non-answer filtering.',
);
assert.equal(
  extractBirdCoderTextContent({ type: 'text', text: 'ignored OpenCode text', ignored: true }),
  undefined,
  'OpenCode ignored text parts must not enter the assistant answer.',
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'Claude SDK final answer.',
  }),
  'Claude SDK final answer.',
  'Claude SDK result envelopes must expose only their final answer.',
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'result',
    subtype: 'success',
    isError: 'true',
    result: 'raw provider error payload',
  }),
  undefined,
  'String and camel-case provider error flags must prevent result payloads from becoming answers.',
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'error',
    severity: 'error',
    message: 'Gemini provider failed',
  }),
  undefined,
  'Provider error envelopes must become notices instead of assistant markdown.',
);
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'error',
    value: { error: { message: 'Gemini provider failed' } },
  }),
  [{ kind: 'failed', message: 'Gemini provider failed' }],
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'error',
    severity: 'warning',
    message: 'Gemini recovered from a transient stream issue',
  }),
  undefined,
  'Gemini warning events must remain system protocol content.',
);
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'error',
    severity: 'warning',
    message: 'Gemini recovered from a transient stream issue',
  }),
  [{ kind: 'warning', message: 'Gemini recovered from a transient stream issue' }],
  'Gemini warning events must remain visible without being styled as failures.',
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'result',
    status: 'error',
    error: { type: 'MaxSessionTurnsError', message: 'Maximum session turns exceeded' },
  }),
  undefined,
  'Gemini stream-json error results must not leak their error object into assistant markdown.',
);
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'result',
    status: 'error',
    error: { type: 'MaxSessionTurnsError', message: 'Maximum session turns exceeded' },
  }),
  [{ kind: 'failed', message: 'Maximum session turns exceeded' }],
  'Gemini stream-json terminal errors must become concise system notices.',
);
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'result',
    subtype: 'error_during_execution',
    isError: 'true',
    error: { message: '[Operation Cancelled] stopped by user' },
  }),
  [{ kind: 'cancelled', message: '[Operation Cancelled] stopped by user' }],
  'Explicit provider cancellation must take precedence over an error result envelope.',
);

for (const cancellationDetail of [
  'Cancelled',
  'Canceled by user',
  'User cancelled the request',
]) {
  assert.deepEqual(
    extractBirdCoderProtocolNotices({
      type: 'result',
      status: 'error',
      error: { message: cancellationDetail },
    }),
    [{ kind: 'cancelled', message: cancellationDetail }],
    `Explicit cancellation detail "${cancellationDetail}" must outrank the provider error envelope.`,
  );
}
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'result',
    status: 'error',
    error: { message: 'The user cancelled an earlier request before this failure.' },
  }),
  [{ kind: 'failed', message: 'The user cancelled an earlier request before this failure.' }],
  'Cancellation words in ordinary explanatory prose must not override an actual error status.',
);

const claudeApiRetry = {
  type: 'system',
  subtype: 'api_retry',
  attempt: 2,
  max_retries: 5,
  retry_delay_ms: 1_000,
  error_status: 429,
  error: 'rate_limit',
};
assert.equal(extractBirdCoderTextContent(claudeApiRetry), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudeApiRetry),
  [{ kind: 'retry', message: 'Retrying provider request (attempt 2).' }],
);

const claudeCompactFailure = {
  type: 'system',
  subtype: 'status',
  status: null,
  compact_result: 'failed',
  compact_error: 'Compaction failed safely',
};
assert.equal(extractBirdCoderTextContent(claudeCompactFailure), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudeCompactFailure),
  [{ kind: 'warning', message: 'Conversation context compression failed: Compaction failed safely' }],
);
for (const status of ['requesting', 'compacting', null]) {
  assert.deepEqual(
    extractBirdCoderProtocolNotices({ type: 'system', subtype: 'status', status }),
    [],
    `Claude ${String(status)} status must remain ephemeral instead of creating a history row.`,
  );
}

for (const ambientClaudeMessage of [
  {
    type: 'system',
    subtype: 'background_tasks_changed',
    tasks: [{ task_id: 'ambient-1', task_type: 'housekeeping', description: 'Refresh index' }],
  },
  {
    type: 'system',
    subtype: 'notification',
    key: 'workspace-index',
    text: 'Index refreshed',
    priority: 'low',
  },
]) {
  assert.equal(
    extractBirdCoderTextContent(ambientClaudeMessage),
    undefined,
    `${ambientClaudeMessage.subtype} must not become assistant markdown.`,
  );
  assert.deepEqual(
    projectChatMessageToolCalls([ambientClaudeMessage], { engineId: 'claude-code' }),
    [],
    `${ambientClaudeMessage.subtype} must not become an ordinary tool row.`,
  );
}

const claudePermissionDeniedMessage = {
  type: 'system',
  subtype: 'permission_denied',
  tool_name: 'Bash',
  tool_use_id: 'toolu-denied-notice-1',
  decision_reason_type: 'rule',
  decision_reason: 'Command is outside the workspace policy.',
  message: 'Permission denied',
};
assert.equal(extractBirdCoderTextContent(claudePermissionDeniedMessage), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudePermissionDeniedMessage),
  [],
  'Claude permission denial is represented by its correlated cancelled tool row, not a duplicate notice.',
);

const claudeMirrorError = {
  type: 'system',
  subtype: 'mirror_error',
  error: 'Session store append timed out',
  key: { projectKey: 'birdcoder', sessionId: 'session-claude-mirror' },
};
assert.equal(extractBirdCoderTextContent(claudeMirrorError), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudeMirrorError),
  [{ kind: 'failed', message: 'Transcript persistence failed: Session store append timed out' }],
);

const claudeRefusalFallback = {
  type: 'system',
  subtype: 'model_refusal_fallback',
  trigger: 'refusal',
  direction: 'retry',
  original_model: 'claude-opus-4-6',
  fallback_model: 'claude-sonnet-4-6',
  request_id: 'request-refused-1',
  content: 'Retrying the request with the configured fallback model.',
};
assert.equal(extractBirdCoderTextContent(claudeRefusalFallback), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudeRefusalFallback),
  [{ kind: 'retry', message: 'Model response refused; retrying with claude-sonnet-4-6.' }],
);

const claudeRefusalNoFallback = {
  type: 'system',
  subtype: 'model_refusal_no_fallback',
  original_model: 'claude-opus-4-6',
  request_id: 'request-refused-2',
  api_refusal_explanation: 'The model declined this request.',
  content: 'No fallback model is available.',
};
assert.equal(extractBirdCoderTextContent(claudeRefusalNoFallback), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(claudeRefusalNoFallback),
  [{ kind: 'failed', message: 'The model declined this request.' }],
);

for (const { record, expectedNotice } of [
  {
    record: {
      type: 'system',
      subtype: 'informational',
      content: 'Hook feedback for the host transcript.',
      level: 'notice',
    },
    expectedNotice: { kind: 'info', message: 'Hook feedback for the host transcript.' },
  },
  {
    record: {
      type: 'system',
      subtype: 'informational',
      message: 'Consider checking the workspace policy first.',
      level: 'suggestion',
    },
    expectedNotice: { kind: 'info', message: 'Consider checking the workspace policy first.' },
  },
  {
    record: {
      type: 'system',
      subtype: 'informational',
      message: 'Workspace policy may restrict this operation.',
      level: 'warning',
    },
    expectedNotice: { kind: 'warning', message: 'Workspace policy may restrict this operation.' },
  },
  {
    record: {
      type: 'system',
      subtype: 'informational',
      message: 'Cancelled by a hook before execution.',
      level: 'suggestion',
      prevent_continuation: true,
    },
    expectedNotice: { kind: 'stopped', message: 'Cancelled by a hook before execution.' },
  },
  {
    record: {
      type: 'informational',
      level: 'info',
      preventContinuation: true,
      content: { internal: 'must not be serialized into the transcript' },
    },
    expectedNotice: { kind: 'stopped', message: 'Agent execution stopped.' },
  },
] as const) {
  assert.equal(
    extractBirdCoderTextContent(record),
    undefined,
    'Claude informational messages must not masquerade as assistant answers.',
  );
  assert.deepEqual(extractBirdCoderProtocolNotices(record), [expectedNotice]);
}

for (const claudeSystemText of [
  {
    type: 'system',
    subtype: 'local_command_output',
    content: 'Local slash-command output.',
  },
]) {
  assert.equal(
    extractBirdCoderTextContent(claudeSystemText),
    undefined,
    `${claudeSystemText.subtype} must not masquerade as an assistant answer.`,
  );
}
assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'system',
    subtype: 'local_command_output',
    content: 'Local slash-command output.',
  }),
  [{ kind: 'info', message: 'Local slash-command output.' }],
  'Claude local command output must remain visible as provider-neutral transcript information.',
);

for (const syntheticUserMessage of [
  {
    type: 'user',
    isSynthetic: true,
    message: { role: 'user', content: 'Synthetic SDK bridge prompt.' },
  },
  {
    type: 'user',
    is_synthetic: 'true',
    message: { role: 'user', content: 'Synthetic snake-case bridge prompt.' },
  },
  {
    role: 'user',
    isMeta: true,
    content: 'Synthetic native-history prompt.',
  },
  {
    role: 'user',
    is_meta: true,
    content: 'Synthetic snake-case native-history prompt.',
  },
]) {
  assert.equal(
    extractBirdCoderTextContent(syntheticUserMessage),
    undefined,
    'Claude synthetic user envelopes must not become authored user markdown.',
  );
}
assert.equal(
  extractBirdCoderTextContent({
    type: 'user',
    shouldQuery: false,
    message: { role: 'user', content: 'Authored queued transcript note.' },
  }),
  'Authored queued transcript note.',
  'Claude shouldQuery:false controls model invocation, not transcript visibility.',
);

const openCodeAbortedAssistant = {
  role: 'assistant',
  content: 'Partial provider output that must not be treated as final.',
  error: {
    name: 'MessageAbortedError',
    data: { message: 'Request aborted by user' },
  },
};
assert.equal(extractBirdCoderTextContent(openCodeAbortedAssistant), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(openCodeAbortedAssistant),
  [{ kind: 'cancelled', message: 'Request aborted by user' }],
);

const openCodeFailedAssistant = {
  role: 'assistant',
  content: 'Provider error body',
  error: {
    name: 'APIError',
    data: { message: 'Upstream provider unavailable', isRetryable: false },
  },
};
assert.equal(extractBirdCoderTextContent(openCodeFailedAssistant), undefined);
assert.deepEqual(
  extractBirdCoderProtocolNotices(openCodeFailedAssistant),
  [{ kind: 'failed', message: 'Upstream provider unavailable' }],
);

assert.deepEqual(
  extractBirdCoderProtocolNotices({
    type: 'assistant',
    aborted: true,
    message: { content: [{ type: 'text', text: 'Partial generat' }] },
  }),
  [{ kind: 'cancelled', message: 'Generation cancelled.' }],
);
assert.equal(
  extractBirdCoderTextContent({
    type: 'tool_use_summary',
    summary: 'Read 10 files',
    preceding_tool_use_ids: ['toolu-read-1'],
  }),
  undefined,
  'Claude tool-use summaries must not become assistant markdown.',
);
assert.equal(
  extractBirdCoderTextContent({ type: 'contextCompaction', id: 'codex-compaction-1' }),
  undefined,
  'Codex context-compaction items must never become assistant markdown.',
);
assert.deepEqual(
  extractBirdCoderProtocolNotices({ type: 'contextCompaction', id: 'codex-compaction-1' }),
  [{ kind: 'compression', message: 'Conversation context compressed.' }],
);

assert.deepEqual(
  extractBirdCoderProtocolNotices([
    { type: 'compaction', encrypted_content: 'not-displayable' },
    { type: 'retry', attempt: 2, error: { message: 'rate limited' } },
    { type: 'agent_execution_blocked', value: { reason: 'Policy denied this action.' } },
    { type: 'citation', value: 'https://example.com/reference' },
  ]),
  [
    { kind: 'compression', message: 'Conversation context compressed.' },
    { kind: 'retry', message: 'Retrying provider request (attempt 2).' },
    { kind: 'blocked', message: 'Agent execution blocked: Policy denied this action.' },
  ],
  'provider lifecycle events must become concise notices while citations remain answer content.',
);

const providerLifecycleProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-provider-lifecycle',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-provider-lifecycle',
    codingSessionId: 'session-provider-lifecycle',
    turnId: 'turn-provider-lifecycle',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: [
        { type: 'chat_compressed', value: { originalTokenCount: 10_000 } },
        { type: 'user_cancelled' },
        { type: 'citation', value: 'Citations:\nhttps://example.com/reference' },
      ],
    },
    createdAt: '2026-06-22T00:00:08.500Z',
  }],
});
assert.equal(
  providerLifecycleProjection.some((message) => (
    message.role === 'system' && message.content === 'Conversation context compressed.'
  )),
  true,
);
assert.equal(
  providerLifecycleProjection.some((message) => (
    message.role === 'system' && message.content === 'Generation cancelled.'
  )),
  true,
);
assert.equal(
  providerLifecycleProjection.some((message) => (
    message.role === 'assistant' && message.content.includes('https://example.com/reference')
  )),
  true,
  'Gemini citations must remain visible in the assistant answer.',
);

const failedTurnProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-failed',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-turn-failed',
    codingSessionId: 'session-failed',
    turnId: 'turn-failed',
    kind: 'turn.failed',
    sequence: '1',
    payload: { errorMessage: 'Provider connection closed unexpectedly.' },
    createdAt: '2026-06-22T00:00:09.000Z',
  }],
});
assert.equal(failedTurnProjection.length, 1);
assert.equal(failedTurnProjection[0]?.role, 'system');
assert.equal(failedTurnProjection[0]?.content, 'Provider connection closed unexpectedly.');
assert.equal(
  resolveChatMessageView(failedTurnProjection[0]!).kind,
  'system.notice',
  'turn failures must become compact system notices instead of disappearing from the transcript.',
);
assert.equal(
  resolveChatMessageView(failedTurnProjection[0]!).blocks.find(
    (block) => block.type === 'markdown',
  )?.noticeKind,
  'failed',
  'turn failures must retain a dedicated failure notice tone and their safe detail text.',
);

const claudeSyntheticUserProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-synthetic-user',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-claude-authored-queued-user',
      codingSessionId: 'session-claude-synthetic-user',
      turnId: 'turn-claude-synthetic-user',
      kind: 'message.completed',
      sequence: '1',
      payload: {
        role: 'user',
        content: {
          type: 'user',
          shouldQuery: false,
          message: { role: 'user', content: 'Inspect the queued provider result.' },
        },
      },
      createdAt: '2026-06-22T00:00:09.100Z',
    },
    {
      id: 'event-claude-synthetic-user-text',
      codingSessionId: 'session-claude-synthetic-user',
      turnId: 'turn-claude-synthetic-user',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'user',
        content: {
          type: 'user',
          is_synthetic: true,
          message: { role: 'user', content: 'Internal bridge context must stay hidden.' },
        },
      },
      createdAt: '2026-06-22T00:00:09.200Z',
    },
    {
      id: 'event-claude-synthetic-tool-use',
      codingSessionId: 'session-claude-synthetic-user',
      turnId: 'turn-claude-synthetic-user',
      kind: 'message.completed',
      sequence: '3',
      payload: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'toolu-synthetic-result-1',
          name: 'Bash',
          input: { command: 'pnpm typecheck' },
        }],
      },
      createdAt: '2026-06-22T00:00:09.300Z',
    },
    {
      id: 'event-claude-synthetic-tool-result',
      codingSessionId: 'session-claude-synthetic-user',
      turnId: 'turn-claude-synthetic-user',
      kind: 'message.completed',
      sequence: '4',
      payload: {
        role: 'user',
        content: {
          type: 'user',
          isSynthetic: true,
          shouldQuery: false,
          tool_use_result: {
            stdout: 'Structured SDK output.',
            interrupted: false,
          },
          message: {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: 'toolu-synthetic-result-1',
              content: 'Model-facing result text must not become a user bubble.',
            }],
          },
        },
      },
      createdAt: '2026-06-22T00:00:09.400Z',
    },
    {
      id: 'event-claude-synthetic-final',
      codingSessionId: 'session-claude-synthetic-user',
      turnId: 'turn-claude-synthetic-user',
      kind: 'message.completed',
      sequence: '5',
      payload: { role: 'assistant', content: 'Queued provider result inspected.' },
      createdAt: '2026-06-22T00:00:09.500Z',
    },
  ],
});
assert.equal(
  claudeSyntheticUserProjection.some((message) => (
    message.role === 'user' && message.content.includes('Internal bridge context')
  )),
  false,
  'Synthetic Claude user text must be removed before stable message projection.',
);
const claudeSyntheticToolResult = claudeSyntheticUserProjection.find(
  (message) => message.role === 'tool',
);
assert.ok(
  claudeSyntheticToolResult,
  'A synthetic Claude user wrapper containing tool_result must normalize to tool activity.',
);
assert.equal(claudeSyntheticToolResult.content, '');
const claudeSyntheticUserDisplay = projectChatTranscriptToolActivity(
  claudeSyntheticUserProjection,
  { engineId: 'claude-code' },
);
assert.deepEqual(
  claudeSyntheticUserDisplay.map((message) => [message.role, message.content]),
  [
    ['user', 'Inspect the queued provider result.'],
    ['assistant', ''],
    ['assistant', 'Queued provider result inspected.'],
  ],
  'shouldQuery:false authored text remains visible around its ordered activity slot.',
);
const claudeSyntheticResultCalls = projectChatMessageToolCalls(
  claudeSyntheticUserDisplay[1]?.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(claudeSyntheticResultCalls.length, 1);
assert.equal(claudeSyntheticResultCalls[0]?.id, 'toolu-synthetic-result-1');
assert.equal(claudeSyntheticResultCalls[0]?.status, 'success');
assert.match(claudeSyntheticResultCalls[0]?.output ?? '', /Structured SDK output\./u);
assert.doesNotMatch(
  claudeSyntheticResultCalls[0]?.output ?? '',
  /Model-facing result text/u,
  'Synthetic model-facing result text must not replace the structured SDK output.',
);
assert.ok(
  (claudeSyntheticResultCalls[0]?.resultBlocks?.length ?? 0) > 0,
  'Structured SDK tool output must enter the provider-neutral semantic result boundary.',
);

const claudeToolLifecycleProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-tools',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-claude-user',
      codingSessionId: 'session-claude-tools',
      turnId: 'turn-claude-tools',
      kind: 'message.completed',
      sequence: '1',
      payload: { role: 'user', content: 'Inspect the project.' },
      createdAt: '2026-06-22T00:00:10.000Z',
    },
    {
      id: 'event-claude-tool-use',
      codingSessionId: 'session-claude-tools',
      turnId: 'turn-claude-tools',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu-read-1', name: 'Read', input: { path: 'src/App.tsx' } }],
      },
      createdAt: '2026-06-22T00:00:11.000Z',
    },
    {
      id: 'event-claude-tool-result',
      codingSessionId: 'session-claude-tools',
      turnId: 'turn-claude-tools',
      kind: 'message.completed',
      sequence: '3',
      payload: {
        role: 'tool',
        content: [{
          type: 'tool_result',
          tool_use_id: 'toolu-read-1',
          content: 'Permission denied',
          is_error: true,
        }],
        toolCallId: 'toolu-read-1',
      },
      createdAt: '2026-06-22T00:00:12.000Z',
    },
    {
      id: 'event-claude-final',
      codingSessionId: 'session-claude-tools',
      turnId: 'turn-claude-tools',
      kind: 'message.completed',
      sequence: '4',
      payload: { role: 'assistant', content: 'The requested file could not be read.' },
      createdAt: '2026-06-22T00:00:13.000Z',
    },
  ],
});
assert.equal(
  new Set(claudeToolLifecycleProjection.map((message) => message.id)).size,
  claudeToolLifecycleProjection.length,
  'tool-use, tool-result, and final reply events in one turn must retain distinct projection identities.',
);
const claudeDisplayMessages = projectChatTranscriptToolActivity(
  claudeToolLifecycleProjection,
  { engineId: 'claude-code' },
);
assert.equal(
  claudeDisplayMessages.length,
  3,
  'provider tool protocol rows must collapse into one ordered activity slot between authored messages.',
);
const claudeActivityDisplayMessage = claudeDisplayMessages[1]!;
const claudeFinalDisplayMessage = claudeDisplayMessages[2]!;
assert.equal(claudeFinalDisplayMessage.content, 'The requested file could not be read.');
const claudeDisplayToolCalls = projectChatMessageToolCalls(
  claudeActivityDisplayMessage.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(claudeDisplayToolCalls.length, 1);
assert.deepEqual(claudeDisplayToolCalls[0], {
  id: 'toolu-read-1',
  type: 'tool_use',
  name: 'Read',
  arguments: '{\n  "path": "src/App.tsx"\n}',
  kind: 'file',
  status: 'error',
  output: 'Permission denied',
  resultBlocks: [{ type: 'error', message: 'Permission denied' }],
  target: 'src/App.tsx',
});

const claudeTaskLifecycleProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-task-lifecycle',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-claude-task-started',
      codingSessionId: 'session-claude-task-lifecycle',
      turnId: 'turn-claude-task-lifecycle',
      kind: 'message.completed',
      sequence: '1',
      payload: {
        role: 'assistant',
        content: [{
          type: 'system',
          subtype: 'task_started',
          task_id: 'claude-task-lifecycle-1',
          tool_use_id: 'toolu-task-lifecycle-1',
          description: 'Audit provider messages',
          task_type: 'local_agent',
        }],
      },
      createdAt: '2026-06-22T00:00:13.100Z',
    },
    {
      id: 'event-claude-task-updated',
      codingSessionId: 'session-claude-task-lifecycle',
      turnId: 'turn-claude-task-lifecycle',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'assistant',
        content: [{
          type: 'system',
          subtype: 'task_updated',
          task_id: 'claude-task-lifecycle-1',
          patch: {
            status: 'completed',
            description: 'Provider message audit completed',
            end_time: 1_789_000_000_000,
          },
        }],
      },
      createdAt: '2026-06-22T00:00:13.200Z',
    },
    {
      id: 'event-claude-task-final',
      codingSessionId: 'session-claude-task-lifecycle',
      turnId: 'turn-claude-task-lifecycle',
      kind: 'message.completed',
      sequence: '3',
      payload: { role: 'assistant', content: 'Provider audit completed.' },
      createdAt: '2026-06-22T00:00:13.300Z',
    },
  ],
});
const claudeTaskLifecycleDisplay = projectChatTranscriptToolActivity(
  claudeTaskLifecycleProjection,
  { engineId: 'claude-code' },
);
const claudeTaskLifecycleFinal = claudeTaskLifecycleDisplay.find(
  (message) => message.content === 'Provider audit completed.',
);
const claudeTaskLifecycleCalls = projectChatMessageToolCalls(
  claudeTaskLifecycleDisplay[0]?.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(
  claudeTaskLifecycleCalls.length,
  1,
  'Claude task_started and task_updated snapshots must correlate by task_id into one row.',
);
assert.equal(claudeTaskLifecycleCalls[0]?.id, 'toolu-task-lifecycle-1');
assert.equal(claudeTaskLifecycleCalls[0]?.status, 'success');
assert.equal(claudeTaskLifecycleCalls[0]?.title, 'Provider message audit completed');

const claudeRefusalFallbackProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-refusal-fallback',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-claude-refused-tool-use',
      codingSessionId: 'session-claude-refusal-fallback',
      turnId: 'turn-claude-refusal-fallback',
      kind: 'message.completed',
      sequence: '1',
      payload: {
        role: 'assistant',
        content: {
          type: 'assistant',
          uuid: 'claude-refused-tool-use',
          message: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: 'toolu-refused-read',
              name: 'Read',
              input: { path: 'src/stale.ts' },
            }],
          },
        },
      },
      createdAt: '2026-06-22T00:00:13.310Z',
    },
    {
      id: 'event-claude-refused-tool-result',
      codingSessionId: 'session-claude-refusal-fallback',
      turnId: 'turn-claude-refusal-fallback',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'tool',
        content: {
          type: 'user',
          uuid: 'claude-refused-tool-result',
          message: {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: 'toolu-refused-read',
              content: 'stale tool output',
            }],
          },
        },
      },
      createdAt: '2026-06-22T00:00:13.320Z',
    },
    {
      id: 'event-claude-fallback-answer',
      codingSessionId: 'session-claude-refusal-fallback',
      turnId: 'turn-claude-refusal-fallback',
      kind: 'message.completed',
      sequence: '3',
      payload: {
        role: 'assistant',
        content: {
          type: 'assistant',
          uuid: 'claude-fallback-answer',
          supersedes: ['claude-refused-tool-use', 'claude-refused-tool-result'],
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Fallback answer without stale activity.' }],
          },
        },
      },
      createdAt: '2026-06-22T00:00:13.330Z',
    },
    {
      id: 'event-claude-fallback-notice',
      codingSessionId: 'session-claude-refusal-fallback',
      turnId: 'turn-claude-refusal-fallback',
      kind: 'message.completed',
      sequence: '4',
      payload: {
        role: 'assistant',
        content: {
          type: 'system',
          subtype: 'model_refusal_fallback',
          uuid: 'claude-fallback-notice',
          direction: 'retry',
          fallback_model: 'claude-sonnet-4-6',
          retracted_message_uuids: ['claude-refused-tool-use', 'claude-refused-tool-result'],
        },
      },
      createdAt: '2026-06-22T00:00:13.340Z',
    },
  ],
});
const claudeRefusalFallbackDisplay = projectChatTranscriptToolActivity(
  claudeRefusalFallbackProjection,
  { engineId: 'claude-code' },
);
assert.equal(
  claudeRefusalFallbackDisplay.some((message) =>
    message.content.includes('stale tool output')
    || projectChatMessageToolCalls(message.tool_calls, { engineId: 'claude-code' })
      .some((call) => call.id === 'toolu-refused-read'),
  ),
  false,
  'Claude refusal fallback must evict superseded tool-use and tool-result messages.',
);
assert.equal(
  claudeRefusalFallbackDisplay.some(
    (message) => message.content === 'Fallback answer without stale activity.',
  ),
  true,
  'Claude refusal fallback must retain its canonical replacement answer.',
);

const claudeResolutionRetractionProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-resolution-retraction',
  existingMessages: [{
    id: 'claude-refused-partial',
    codingSessionId: 'session-claude-resolution-retraction',
    turnId: 'turn-claude-resolution-retraction',
    role: 'assistant',
    content: 'Refused partial answer.',
    createdAt: '2026-06-22T00:00:13.350Z',
  }],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-claude-resolution-retraction',
    codingSessionId: 'session-claude-resolution-retraction',
    turnId: 'turn-claude-resolution-retraction',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: {
        type: 'system',
        subtype: 'model_refusal_fallback',
        uuid: 'claude-resolution-retraction',
        direction: 'retry',
        fallback_model: 'claude-sonnet-4-6',
        retracted_message_uuids: ['claude-refused-partial'],
      },
    },
    createdAt: '2026-06-22T00:00:13.360Z',
  }],
});
assert.equal(
  claudeResolutionRetractionProjection.some((message) => message.id === 'claude-refused-partial'),
  false,
  'Claude resolution-time retraction must evict an existing provider message idempotently.',
);

const claudeAmbientTaskProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-claude-ambient-task',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-claude-ambient-task',
    codingSessionId: 'session-claude-ambient-task',
    turnId: 'turn-claude-ambient-task',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: [{
        type: 'system',
        subtype: 'task_started',
        task_id: 'claude-ambient-task-1',
        tool_use_id: 'toolu-ambient-task-1',
        description: 'Refresh internal cache',
        skip_transcript: true,
      }],
    },
    createdAt: '2026-06-22T00:00:13.400Z',
  }],
});
assert.equal(
  claudeAmbientTaskProjection.some((message) => Boolean(message.content.trim())),
  false,
  'Claude ambient task metadata must not become transcript text.',
);
assert.deepEqual(
  claudeAmbientTaskProjection.flatMap((message) =>
    projectChatMessageToolCalls(message.tool_calls, { engineId: 'claude-code' }),
  ),
  [],
  'Claude skip_transcript tasks must remain hidden after native recursive discovery.',
);

const claudeProgressLifecycleMessages: ChatMessageViewSource[] = [
  {
    id: 'claude-progress-request',
    codingSessionId: 'session-claude-progress',
    turnId: 'turn-claude-progress',
    role: 'assistant',
    content: '',
    tool_calls: [{
      type: 'tool_use',
      id: 'toolu-bash-progress',
      name: 'Bash',
      input: { command: 'pnpm typecheck' },
    }],
    createdAt: '2026-06-22T00:00:14.000Z',
  },
  {
    id: 'claude-progress-update',
    codingSessionId: 'session-claude-progress',
    turnId: 'turn-claude-progress',
    role: 'assistant',
    content: '',
    tool_calls: [{
      type: 'tool_progress',
      tool_use_id: 'toolu-bash-progress',
      tool_name: 'Bash',
      elapsed_time_seconds: 2.5,
    }],
    createdAt: '2026-06-22T00:00:15.000Z',
  },
  {
    id: 'claude-progress-result',
    codingSessionId: 'session-claude-progress',
    turnId: 'turn-claude-progress',
    role: 'tool',
    content: 'typecheck passed',
    tool_calls: [{
      type: 'tool_result',
      tool_use_id: 'toolu-bash-progress',
      content: 'typecheck passed',
    }],
    createdAt: '2026-06-22T00:00:16.000Z',
  },
  {
    id: 'claude-progress-final',
    codingSessionId: 'session-claude-progress',
    turnId: 'turn-claude-progress',
    role: 'assistant',
    content: 'Type checking completed.',
    createdAt: '2026-06-22T00:00:17.000Z',
  },
];
const claudeProgressDisplayMessages = projectChatTranscriptToolActivity(
  claudeProgressLifecycleMessages,
  { engineId: 'claude-code' },
);
assert.equal(
  claudeProgressDisplayMessages.length,
  2,
  'Claude progress must remain before its authored completion reply.',
);
const claudeProgressCalls = projectChatMessageToolCalls(
  claudeProgressDisplayMessages[0]?.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(claudeProgressCalls.length, 1, 'Claude progress must merge into its tool_use request.');
assert.deepEqual(claudeProgressCalls[0], {
  id: 'toolu-bash-progress',
  type: 'tool_use',
  name: 'Bash',
  arguments: '{\n  "command": "pnpm typecheck"\n}',
  kind: 'command',
  status: 'success',
  output: 'typecheck passed',
  resultBlocks: [{ type: 'text', text: 'typecheck passed' }],
  command: 'pnpm typecheck',
  durationMs: 2_500,
});

const codexResponsesLifecycleMessages: ChatMessageViewSource[] = [
  {
    id: 'codex-response-request',
    codingSessionId: 'session-codex-response',
    turnId: 'turn-codex-response',
    role: 'assistant',
    content: '',
    tool_calls: [{
      item: {
        type: 'function_call',
        id: 'fc-item-1',
        call_id: 'call-codex-response-1',
        name: 'shell_command',
        arguments: '{"command":"pwd"}',
      },
    }],
    createdAt: '2026-06-22T00:00:17.000Z',
  },
  {
    id: 'codex-response-result',
    codingSessionId: 'session-codex-response',
    turnId: 'turn-codex-response',
    role: 'tool',
    content: 'workspace',
    tool_calls: [{
      item: {
        type: 'function_call_output',
        call_id: 'call-codex-response-1',
        output: 'workspace',
      },
    }],
    createdAt: '2026-06-22T00:00:18.000Z',
  },
  {
    id: 'codex-response-final',
    codingSessionId: 'session-codex-response',
    turnId: 'turn-codex-response',
    role: 'assistant',
    content: 'Command completed.',
    createdAt: '2026-06-22T00:00:19.000Z',
  },
];
const codexResponsesDisplayMessages = projectChatTranscriptToolActivity(
  codexResponsesLifecycleMessages,
  { engineId: 'codex' },
);
const codexResponsesCalls = projectChatMessageToolCalls(
  codexResponsesDisplayMessages[0]?.tool_calls,
  { engineId: 'codex' },
);
assert.equal(codexResponsesCalls.length, 1);
assert.equal(codexResponsesCalls[0]?.id, 'call-codex-response-1');
assert.equal(codexResponsesCalls[0]?.name, 'shell_command');
assert.equal(codexResponsesCalls[0]?.output, 'workspace');

const geminiNativeParallelMessages: ChatMessageViewSource[] = [
  {
    id: 'gemini-native-requests',
    codingSessionId: 'session-gemini-native',
    turnId: 'turn-gemini-native',
    role: 'assistant',
    content: '',
    tool_calls: [
      { functionCall: { name: 'read_a', args: { path: 'a.ts' } } },
      { functionCall: { name: 'read_b', args: { path: 'b.ts' } } },
    ],
    createdAt: '2026-06-22T00:00:20.000Z',
  },
  {
    id: 'gemini-native-results',
    codingSessionId: 'session-gemini-native',
    turnId: 'turn-gemini-native',
    role: 'tool',
    content: '',
    tool_calls: [
      { functionResponse: { name: 'read_b', response: { output: 'B' } } },
      { functionResponse: { name: 'read_a', response: { output: 'A' } } },
    ],
    createdAt: '2026-06-22T00:00:21.000Z',
  },
  {
    id: 'gemini-native-final',
    codingSessionId: 'session-gemini-native',
    turnId: 'turn-gemini-native',
    role: 'assistant',
    content: 'Files read.',
    createdAt: '2026-06-22T00:00:22.000Z',
  },
];
const geminiNativeDisplayMessages = projectChatTranscriptToolActivity(
  geminiNativeParallelMessages,
  { engineId: 'gemini' },
);
const geminiNativeCalls = projectChatMessageToolCalls(
  geminiNativeDisplayMessages[0]?.tool_calls,
  { engineId: 'gemini' },
);
assert.equal(geminiNativeCalls.length, 2);
assert.deepEqual(
  geminiNativeCalls.map((call) => ({
    arguments: call.arguments,
    name: call.name,
    output: call.output,
  })),
  [
    { arguments: '{\n  "path": "a.ts"\n}', name: 'read_a', output: 'A' },
    { arguments: '{\n  "path": "b.ts"\n}', name: 'read_b', output: 'B' },
  ],
  'Gemini native responses must correlate by function name without exposing response wrapper JSON.',
);

const geminiNoticeLifecycleDisplay = projectChatTranscriptToolActivity([
  {
    id: 'gemini-notice-request',
    codingSessionId: 'session-gemini-notice-lifecycle',
    turnId: 'turn-gemini-notice-lifecycle',
    role: 'assistant',
    content: '',
    createdAt: '2026-06-22T00:00:22.100Z',
    tool_calls: [{
      type: 'tool_request',
      requestId: 'call-gemini-notice-lifecycle',
      name: 'topic_update',
      display: {
        format: 'notice',
        name: 'Provider alignment',
        description: 'Alignment started',
      },
    }],
  },
  {
    id: 'gemini-notice-response',
    codingSessionId: 'session-gemini-notice-lifecycle',
    turnId: 'turn-gemini-notice-lifecycle',
    role: 'tool',
    content: '',
    createdAt: '2026-06-22T00:00:22.200Z',
    tool_calls: [{
      type: 'tool_response',
      requestId: 'call-gemini-notice-lifecycle',
      name: 'topic_update',
      display: {
        format: 'notice',
        name: 'Provider alignment',
        description: 'Alignment completed',
        resultSummary: 'Ready',
        result: { type: 'text', text: 'Internal result must not become notice body.' },
      },
    }],
  },
  {
    id: 'gemini-notice-final',
    codingSessionId: 'session-gemini-notice-lifecycle',
    turnId: 'turn-gemini-notice-lifecycle',
    role: 'assistant',
    content: 'Provider alignment is complete.',
    createdAt: '2026-06-22T00:00:22.300Z',
  },
], { engineId: 'gemini' });
assert.equal(geminiNoticeLifecycleDisplay.length, 2);
const geminiNoticeLifecycleCalls = projectChatMessageToolCalls(
  geminiNoticeLifecycleDisplay[0]?.tool_calls,
  { engineId: 'gemini' },
);
assert.deepEqual(geminiNoticeLifecycleCalls, [{
  arguments: '',
  id: 'call-gemini-notice-lifecycle',
  kind: 'other',
  name: 'Provider alignment',
  presentation: 'notice',
  status: 'success',
  title: 'Alignment completed',
  type: 'tool_request',
}]);
const geminiNoticeLifecycleView = resolveChatMessageView(
  geminiNoticeLifecycleDisplay[0]!,
  { engineId: 'gemini' },
);
assert.deepEqual(
  geminiNoticeLifecycleView.blocks.map((block) => block.type),
  ['notice'],
  'Gemini notice request/response records must merge in their ordered activity slot.',
);
assert.deepEqual(geminiNoticeLifecycleView.blocks[0], {
  type: 'notice',
  id: 'call-gemini-notice-lifecycle',
  noticeKind: 'info',
  title: 'Provider alignment',
  detail: 'Alignment completed',
});

const lateProgressMessages: ChatMessageViewSource[] = [
  {
    id: 'late-progress-request', codingSessionId: 'session-late-progress', turnId: 'turn-late-progress',
    role: 'assistant', content: '', createdAt: '2026-06-22T00:00:23.000Z',
    tool_calls: [{ type: 'tool_use', id: 'toolu-late-1', name: 'Bash', input: { command: 'pnpm test' } }],
  },
  {
    id: 'late-progress-result', codingSessionId: 'session-late-progress', turnId: 'turn-late-progress',
    role: 'tool', content: 'passed', createdAt: '2026-06-22T00:00:24.000Z',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'toolu-late-1', content: 'passed' }],
  },
  {
    id: 'late-progress-update', codingSessionId: 'session-late-progress', turnId: 'turn-late-progress',
    role: 'assistant', content: '', createdAt: '2026-06-22T00:00:25.000Z',
    tool_calls: [{ type: 'tool_progress', tool_use_id: 'toolu-late-1', tool_name: 'Bash', elapsed_time_seconds: 3 }],
  },
  {
    id: 'late-progress-final', codingSessionId: 'session-late-progress', turnId: 'turn-late-progress',
    role: 'assistant', content: 'Tests completed.', createdAt: '2026-06-22T00:00:26.000Z',
  },
];
const lateProgressDisplay = projectChatTranscriptToolActivity(
  lateProgressMessages,
  { engineId: 'claude-code' },
);
const lateProgressCall = projectChatMessageToolCalls(
  lateProgressDisplay[0]?.tool_calls,
  { engineId: 'claude-code' },
)[0];
assert.equal(lateProgressCall?.status, 'success');
assert.equal(lateProgressCall?.output, 'passed');
assert.equal(lateProgressCall?.durationMs, 3_000);

const cancellationPriorityDisplay = projectChatTranscriptToolActivity([
  {
    id: 'cancel-priority-cancelled',
    codingSessionId: 'session-cancel-priority',
    turnId: 'turn-cancel-priority',
    role: 'assistant',
    content: '',
    createdAt: '2026-06-22T00:00:26.100Z',
    tool_calls: [{
      id: 'call-cancel-priority',
      name: 'replace',
      arguments: { file_path: 'src/App.tsx' },
      status: 'cancelled',
      output: 'Cancelled',
    }],
  },
  {
    id: 'cancel-priority-legacy-success',
    codingSessionId: 'session-cancel-priority',
    turnId: 'turn-cancel-priority',
    role: 'assistant',
    content: '',
    createdAt: '2026-06-22T00:00:26.200Z',
    tool_calls: [{
      id: 'call-cancel-priority',
      name: 'replace',
      arguments: { file_path: 'src/App.tsx' },
      status: 'success',
      output: 'Legacy terminal snapshot',
    }],
  },
  {
    id: 'cancel-priority-final',
    codingSessionId: 'session-cancel-priority',
    turnId: 'turn-cancel-priority',
    role: 'assistant',
    content: 'The edit was not applied.',
    createdAt: '2026-06-22T00:00:26.300Z',
  },
], { engineId: 'gemini' });
assert.equal(
  projectChatMessageToolCalls(
    cancellationPriorityDisplay[0]?.tool_calls,
    { engineId: 'gemini' },
  )[0]?.status,
  'cancelled',
  'A provider success snapshot must never override an already observed cancellation for the same call id.',
);

const repeatedCommandsDisplay = projectChatTranscriptToolActivity([
  {
    id: 'repeat-command-1', codingSessionId: 'session-repeat', turnId: 'turn-repeat', role: 'tool',
    content: 'first', commands: [{ command: 'pnpm test', status: 'success', output: 'first' }],
    createdAt: '2026-06-22T00:00:27.000Z',
  },
  {
    id: 'repeat-command-2', codingSessionId: 'session-repeat', turnId: 'turn-repeat', role: 'tool',
    content: 'second', commands: [{ command: 'pnpm test', status: 'success', output: 'second' }],
    createdAt: '2026-06-22T00:00:28.000Z',
  },
  {
    id: 'repeat-command-final', codingSessionId: 'session-repeat', turnId: 'turn-repeat', role: 'assistant',
    content: 'Repeated verification completed.', createdAt: '2026-06-22T00:00:29.000Z',
  },
]);
assert.equal(repeatedCommandsDisplay[0]?.commands?.length, 2);
const repeatedCommandsView = resolveChatMessageView(repeatedCommandsDisplay[0]!);
assert.equal(
  repeatedCommandsView.blocks.find((block) => block.type === 'commands')?.items.length,
  2,
  'The message view must preserve repeated command occurrences without provider call ids.',
);

const caseSensitiveFileDisplay = projectChatTranscriptToolActivity([
  {
    id: 'case-file-1', codingSessionId: 'session-case-files', turnId: 'turn-case-files', role: 'tool',
    content: '', fileChanges: [{ path: 'src/Foo.ts', additions: 1, deletions: 0 }],
    createdAt: '2026-06-22T00:00:30.000Z',
  },
  {
    id: 'case-file-2', codingSessionId: 'session-case-files', turnId: 'turn-case-files', role: 'tool',
    content: '', fileChanges: [{ path: 'src/foo.ts', additions: 0, deletions: 1 }],
    createdAt: '2026-06-22T00:00:31.000Z',
  },
  {
    id: 'case-file-final', codingSessionId: 'session-case-files', turnId: 'turn-case-files', role: 'assistant',
    content: 'Both files updated.', createdAt: '2026-06-22T00:00:32.000Z',
  },
]);
assert.equal(caseSensitiveFileDisplay[0]?.fileChanges?.length, 2);

const distinctToolResults = deduplicateBirdCoderComparableChatMessages([
  {
    id: 'result-a', codingSessionId: 'session-dedup', turnId: 'turn-dedup', role: 'tool' as const,
    content: 'ok', tool_call_id: 'call-a', createdAt: '2026-06-22T00:00:33.000Z',
  },
  {
    id: 'result-b', codingSessionId: 'session-dedup', turnId: 'turn-dedup', role: 'tool' as const,
    content: 'ok', tool_call_id: 'call-b', createdAt: '2026-06-22T00:00:34.000Z',
  },
]);
assert.equal(distinctToolResults.length, 2, 'Distinct tool_call_id values must never deduplicate by output text.');

const refreshedDeduplication = deduplicateBirdCoderComparableChatMessages([
  {
    id: 'mutable-message', codingSessionId: 'session-dedup-refresh', turnId: 'turn-refresh', role: 'assistant' as const,
    content: 'old', createdAt: '2026-06-22T00:00:35.000Z',
  },
  {
    id: 'mutable-message', codingSessionId: 'session-dedup-refresh', turnId: 'turn-refresh', role: 'assistant' as const,
    content: 'new', createdAt: '2026-06-22T00:00:36.000Z',
  },
  {
    id: 'independent-message', codingSessionId: 'session-dedup-refresh', turnId: 'turn-refresh', role: 'assistant' as const,
    content: 'old', createdAt: '2026-06-22T00:00:37.000Z',
  },
]);
assert.equal(refreshedDeduplication.length, 2, 'Replacing a message must remove its stale logical dedup keys.');

const providerToolLifecycleCases = [
  {
    engineId: 'codex',
    request: {
      type: 'function_call',
      call_id: 'call-codex-web',
      name: 'web_search',
      arguments: '{"query":"BirdCoder protocol"}',
    },
    result: {
      type: 'function_call_output',
      call_id: 'call-codex-web',
      output: 'Official protocol reference found.',
    },
    expectedKind: 'web',
    expectedOutput: 'Official protocol reference found.',
  },
  {
    engineId: 'opencode',
    request: {
      part: {
        type: 'tool',
        callID: 'call-opencode-search',
        tool: 'grep',
        state: {
          status: 'running',
          input: { pattern: 'ToolCall', path: 'src' },
        },
      },
    },
    result: {
      part: {
        type: 'tool',
        callID: 'call-opencode-search',
        tool: 'grep',
        state: {
          status: 'completed',
          input: { pattern: 'ToolCall', path: 'src' },
          output: '3 matches',
        },
      },
    },
    expectedKind: 'search',
    expectedOutput: '3 matches',
  },
  {
    engineId: 'gemini',
    request: {
      type: 'tool_call_request',
      value: {
        callId: 'call-gemini-read',
        name: 'read_file',
        args: { path: 'src/main.ts' },
      },
    },
    result: {
      type: 'tool_call_response',
      value: {
        callId: 'call-gemini-read',
        responseParts: [{ text: 'export const main = true;' }],
      },
    },
    expectedKind: 'file',
    expectedOutput: 'export const main = true;',
  },
] as const;

for (const providerCase of providerToolLifecycleCases) {
  const providerMessages: ChatMessageViewSource[] = [
    {
      id: `${providerCase.engineId}-request`,
      codingSessionId: 'session-provider-tools',
      turnId: `turn-${providerCase.engineId}`,
      role: 'assistant',
      content: '',
      tool_calls: [providerCase.request],
      createdAt: '2026-06-22T00:00:14.000Z',
    },
    {
      id: `${providerCase.engineId}-result`,
      codingSessionId: 'session-provider-tools',
      turnId: `turn-${providerCase.engineId}`,
      role: 'tool',
      content: providerCase.expectedOutput,
      tool_calls: [providerCase.result],
      createdAt: '2026-06-22T00:00:15.000Z',
    },
    {
      id: `${providerCase.engineId}-final`,
      codingSessionId: 'session-provider-tools',
      turnId: `turn-${providerCase.engineId}`,
      role: 'assistant',
      content: 'Provider tool lifecycle completed.',
      createdAt: '2026-06-22T00:00:16.000Z',
    },
  ];
  const providerDisplayMessages = projectChatTranscriptToolActivity(providerMessages, {
    engineId: providerCase.engineId,
  });
  assert.equal(
    providerDisplayMessages.length,
    2,
    `${providerCase.engineId} activity must remain before its authored reply.`,
  );
  const providerCalls = projectChatMessageToolCalls(
    providerDisplayMessages[0]?.tool_calls,
    { engineId: providerCase.engineId },
  );
  assert.equal(providerCalls.length, 1, `${providerCase.engineId} request/result must merge by call id.`);
  assert.equal(providerCalls[0]?.kind, providerCase.expectedKind);
  assert.match(providerCalls[0]?.output ?? '', new RegExp(providerCase.expectedOutput.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.equal(providerCalls[0]?.status, 'success');
}

const providerNeutralReadFileCases = [
  {
    engineId: 'claude-code',
    request: {
      type: 'tool_use',
      id: 'call-claude-read-file',
      name: 'read_file',
      input: { path: 'src/App.tsx' },
    },
    result: {
      type: 'tool_result',
      tool_use_id: 'call-claude-read-file',
      content: [{ type: 'text', text: 'export function App() { return null; }' }],
    },
  },
  {
    engineId: 'codex',
    request: {
      type: 'function_call',
      call_id: 'call-codex-read-file',
      name: 'read_file',
      arguments: '{"path":"src/App.tsx"}',
    },
    result: {
      type: 'function_call_output',
      call_id: 'call-codex-read-file',
      output: 'export function App() { return null; }',
    },
  },
  {
    engineId: 'opencode',
    request: {
      part: {
        type: 'tool',
        callID: 'call-opencode-read-file',
        tool: 'read_file',
        state: {
          status: 'running',
          input: { path: 'src/App.tsx' },
        },
      },
    },
    result: {
      part: {
        type: 'tool',
        callID: 'call-opencode-read-file',
        tool: 'read_file',
        state: {
          status: 'completed',
          input: { path: 'src/App.tsx' },
          output: 'export function App() { return null; }',
        },
      },
    },
  },
  {
    engineId: 'gemini',
    request: {
      type: 'tool_call_request',
      value: {
        callId: 'call-gemini-read-file',
        name: 'read_file',
        args: { path: 'src/App.tsx' },
      },
    },
    result: {
      type: 'tool_call_response',
      value: {
        callId: 'call-gemini-read-file',
        responseParts: [{ text: 'export function App() { return null; }' }],
      },
    },
  },
] as const;

for (const providerCase of providerNeutralReadFileCases) {
  const displayMessages = projectChatTranscriptToolActivity([
    {
      id: `${providerCase.engineId}-neutral-request`,
      codingSessionId: 'session-provider-neutral-read-file',
      turnId: `turn-${providerCase.engineId}-neutral-read-file`,
      role: 'assistant',
      content: '',
      tool_calls: [providerCase.request],
      createdAt: '2026-06-22T00:00:42.000Z',
    },
    {
      id: `${providerCase.engineId}-neutral-result`,
      codingSessionId: 'session-provider-neutral-read-file',
      turnId: `turn-${providerCase.engineId}-neutral-read-file`,
      role: 'tool',
      content: 'export function App() { return null; }',
      tool_calls: [providerCase.result],
      createdAt: '2026-06-22T00:00:43.000Z',
    },
    {
      id: `${providerCase.engineId}-neutral-final`,
      codingSessionId: 'session-provider-neutral-read-file',
      turnId: `turn-${providerCase.engineId}-neutral-read-file`,
      role: 'assistant',
      content: 'Read complete.',
      createdAt: '2026-06-22T00:00:44.000Z',
    },
  ], { engineId: providerCase.engineId });

  assert.equal(
    displayMessages.length,
    2,
    `${providerCase.engineId} must fold a read lifecycle into one ordered activity slot plus its reply.`,
  );
  const view = resolveChatMessageView(displayMessages[0]!, {
    engineId: providerCase.engineId,
  });
  const toolCallsBlock = view.blocks.find((block) => block.type === 'tool-calls');
  assert.ok(toolCallsBlock && toolCallsBlock.type === 'tool-calls');
  const visibleMarkdown = view.blocks
    .filter((block) => block.type === 'markdown')
    .map((block) => block.content)
    .join('\n');
  assert.deepEqual(
    {
      blockTypes: view.blocks.map((block) => block.type),
      kind: toolCallsBlock.calls[0]?.kind,
      resultTypes: toolCallsBlock.calls[0]?.resultBlocks?.map((block) => block.type),
      status: toolCallsBlock.calls[0]?.status,
      target: toolCallsBlock.calls[0]?.target,
      visibleMarkdown,
    },
    {
      blockTypes: ['tool-calls'],
      kind: 'file',
      resultTypes: ['text'],
      status: 'success',
      target: 'src/App.tsx',
      visibleMarkdown: '',
    },
    `${providerCase.engineId} must resolve to the provider-neutral read-file UI signature.`,
  );
  assert.doesNotMatch(
    visibleMarkdown,
    /function_call|function_call_output|tool_call_request|tool_call_response|tool_result|tool_use/u,
    `${providerCase.engineId} must not expose its native protocol envelope as assistant text.`,
  );
}

const providerNativeContentProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-native-content',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-gemini-native-content',
      codingSessionId: 'session-native-content',
      turnId: 'turn-gemini-native-content',
      kind: 'message.completed',
      sequence: '1',
      payload: {
        role: 'assistant',
        content: { parts: [{ functionCall: { name: 'read_file', args: { path: 'src/gemini.ts' } } }] },
      },
      createdAt: '2026-06-22T00:00:38.000Z',
    },
    {
      id: 'event-opencode-native-content',
      codingSessionId: 'session-native-content',
      turnId: 'turn-opencode-native-content',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'assistant',
        content: {
          parts: [{
            type: 'tool',
            callID: 'call-opencode-native-content',
            tool: 'grep',
            state: { status: 'running', input: { pattern: 'ToolCall', path: 'src' } },
          }],
        },
      },
      createdAt: '2026-06-22T00:00:39.000Z',
    },
    {
      id: 'event-codex-native-file-change',
      codingSessionId: 'session-native-content',
      turnId: 'turn-codex-native-file-change',
      kind: 'message.completed',
      sequence: '3',
      payload: {
        role: 'assistant',
        content: {
          items: [{
            id: 'file-change-codex-native',
            type: 'file_change',
            status: 'completed',
            changes: [
              { path: 'src/a.ts', kind: 'update' },
              { path: 'src/b.ts', kind: 'add', diff: '@@ -0,0 +1 @@\n+export const b = true;' },
              {
                path: 'src/legacy-provider.ts',
                kind: { type: 'update', move_path: 'src/provider.ts' },
                diff: '',
              },
            ],
          }],
        },
      },
      createdAt: '2026-06-22T00:00:40.000Z',
    },
    {
      id: 'event-codex-native-todo',
      codingSessionId: 'session-native-content',
      turnId: 'turn-codex-native-todo',
      kind: 'message.completed',
      sequence: '4',
      payload: {
        role: 'assistant',
        content: {
          items: [{
            id: 'todo-codex-native',
            type: 'todo_list',
            items: [{ text: 'Verify history replay', completed: false }],
          }],
        },
      },
      createdAt: '2026-06-22T00:00:41.000Z',
    },
  ],
});
assert.equal(providerNativeContentProjection.length, 4);
assert.equal(providerNativeContentProjection[0]?.tool_calls?.length, 1);
assert.equal(providerNativeContentProjection[1]?.tool_calls?.length, 1);
assert.equal(
  projectChatMessageToolCalls(providerNativeContentProjection[0]?.tool_calls, { engineId: 'gemini' })[0]?.kind,
  'file',
);
assert.equal(
  projectChatMessageToolCalls(providerNativeContentProjection[1]?.tool_calls, { engineId: 'opencode' })[0]?.kind,
  'search',
);
assert.deepEqual(
  providerNativeContentProjection[2]?.fileChanges?.map((fileChange) => ({
    lineImpactKnown: fileChange.lineImpactKnown,
    path: fileChange.path,
  })),
  [
    { lineImpactKnown: false, path: 'src/a.ts' },
    { lineImpactKnown: true, path: 'src/b.ts' },
    { lineImpactKnown: false, path: 'src/provider.ts' },
  ],
  'Codex native multi-file change items must become independently navigable file activity.',
);
assert.equal(
  providerNativeContentProjection[2]?.fileChanges?.[2]?.updateStatus,
  'moved from src/legacy-provider.ts',
  'Codex move updates must preserve their source path while exposing the target as the openable path.',
);
assert.equal(
  projectChatMessageToolCalls(providerNativeContentProjection[3]?.tool_calls, { engineId: 'codex' })[0]?.kind,
  'task',
  'Codex native todo_list items must remain visible task activity.',
);

const geminiResultDisplayProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-gemini-result-display',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-gemini-result-display',
    codingSessionId: 'session-gemini-result-display',
    turnId: 'turn-gemini-result-display',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call-gemini-edit-history',
          name: 'replace',
          args: { file_path: 'src/gemini-history.ts' },
          status: 'success',
          resultDisplay: {
            fileDiff: '@@ -1 +1 @@\n-export const history = false;\n+export const history = true;',
            fileName: 'gemini-history.ts',
            filePath: 'src/gemini-history.ts',
            originalContent: 'export const history = false;',
            newContent: 'export const history = true;',
            diffStat: { model_added_lines: 1, model_removed_lines: 1 },
          },
        },
        {
          id: 'call-gemini-todos-history',
          name: 'write_todos',
          args: { todos: [] },
          status: 'success',
          resultDisplay: {
            todos: [
              { description: 'Project FileDiff', status: 'completed' },
              { description: 'Render result blocks', status: 'in_progress' },
            ],
          },
        },
      ],
    },
    createdAt: '2026-06-22T00:00:42.000Z',
  }],
});
assert.equal(geminiResultDisplayProjection.length, 1);
assert.deepEqual(geminiResultDisplayProjection[0]?.fileChanges, [{
  path: 'src/gemini-history.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  diff: '@@ -1 +1 @@\n-export const history = false;\n+export const history = true;',
  content: 'export const history = true;',
  originalContent: 'export const history = false;',
}]);
assert.deepEqual(geminiResultDisplayProjection[0]?.taskProgress, {
  total: 2,
  completed: 1,
});
assert.deepEqual(
  projectChatMessageToolCalls(
    geminiResultDisplayProjection[0]?.tool_calls,
    { engineId: 'gemini' },
  ).map((call) => call.kind),
  ['file', 'task'],
);

const providerNativeFileMatrixProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-provider-native-file-matrix',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [{
    id: 'event-provider-native-file-matrix',
    codingSessionId: 'session-provider-native-file-matrix',
    turnId: 'turn-provider-native-file-matrix',
    kind: 'message.completed',
    sequence: '1',
    payload: {
      role: 'assistant',
      content: [
        {
          type: 'itemCompleted',
          item: {
            type: 'fileChange',
            id: 'codex-file-completed',
            status: 'completed',
            changes: [{
              path: 'src/codex.ts',
              diff: '@@ -1 +1 @@\n-old\n+new',
            }],
          },
        },
        {
          type: 'itemCompleted',
          item: {
            type: 'fileChange',
            id: 'codex-file-declined',
            status: 'declined',
            changes: [{ path: 'src/declined.ts', diff: '@@ -0,0 +1 @@\n+denied' }],
          },
        },
        {
          type: 'itemCompleted',
          item: {
            type: 'todoList',
            id: 'codex-todo-native',
            items: [
              { text: 'Project provider files', status: 'completed' },
              { text: 'Keep validating', status: 'inProgress' },
            ],
          },
        },
        {
          type: 'message.part.updated',
          properties: {
            part: {
              type: 'tool',
              callID: 'opencode-edit-native',
              tool: 'edit',
              state: {
                status: 'completed',
                input: { filePath: 'src/opencode.ts' },
                output: 'Edit applied successfully.',
                metadata: {
                  files: [{}],
                  filediff: {
                    file: 'src/opencode.ts',
                    patch: '@@ -1 +1 @@\n-old\n+new',
                    additions: 1,
                    deletions: 1,
                  },
                },
              },
            },
          },
        },
        {
          type: 'patch',
          hash: 'opencode-patch-hash',
          files: ['src/opencode-patch.ts'],
        },
        {
          type: 'user',
          toolUseResult: {
            type: 'update',
            filePath: 'src/claude.ts',
            content: 'new',
            originalFile: 'old',
            structuredPatch: [{
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              lines: ['-old', '+new'],
            }],
          },
        },
        {
          id: 'gemini-running-diff',
          name: 'replace',
          status: 'inProgress',
          resultDisplay: {
            filePath: 'src/gemini-running.ts',
            fileName: 'gemini-running.ts',
            fileDiff: '@@ -1 +1 @@\n-old\n+new',
          },
        },
      ],
    },
    createdAt: '2026-06-22T00:00:43.000Z',
  }],
});
assert.equal(providerNativeFileMatrixProjection.length, 1);
assert.deepEqual(
  providerNativeFileMatrixProjection[0]?.fileChanges?.map((change) => change.path),
  ['src/codex.ts', 'src/opencode.ts', 'src/opencode-patch.ts', 'src/claude.ts'],
  'Only applied provider-native file changes may enter the historical file list.',
);
assert.deepEqual(providerNativeFileMatrixProjection[0]?.taskProgress, {
  total: 2,
  completed: 1,
});
assert.deepEqual(providerNativeFileMatrixProjection[0]?.fileChanges?.[0], {
  path: 'src/codex.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  diff: '@@ -1 +1 @@\n-old\n+new',
});

const canonicalAppliedFileProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-canonical-applied-files',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-file-awaiting',
      codingSessionId: 'session-canonical-applied-files',
      turnId: 'turn-canonical-applied-files',
      kind: 'tool.call.requested',
      sequence: '1',
      payload: {
        toolName: 'apply_patch',
        toolCallId: 'call-file-rejected',
        status: 'running',
        runtimeStatus: 'awaiting_approval',
        toolArguments: {
          path: 'src/rejected.ts',
          diff: '@@ -1 +1 @@\n-old\n+rejected',
        },
      },
      createdAt: '2026-06-22T00:00:39.000Z',
    },
    {
      id: 'event-file-rejected',
      codingSessionId: 'session-canonical-applied-files',
      turnId: 'turn-canonical-applied-files',
      kind: 'tool.call.completed',
      sequence: '2',
      payload: {
        toolName: 'apply_patch',
        toolCallId: 'call-file-rejected',
        status: 'rejected',
        runtimeStatus: 'terminated',
        toolArguments: {
          path: 'src/rejected.ts',
          diff: '@@ -1 +1 @@\n-old\n+rejected',
        },
      },
      createdAt: '2026-06-22T00:00:39.100Z',
    },
    {
      id: 'event-file-applied',
      codingSessionId: 'session-canonical-applied-files',
      turnId: 'turn-canonical-applied-files',
      kind: 'tool.call.completed',
      sequence: '3',
      payload: {
        toolName: 'apply_patch',
        toolCallId: 'call-file-applied',
        status: 'success',
        runtimeStatus: 'completed',
        toolArguments: {
          path: 'src/applied.ts',
          diff: '@@ -1 +1 @@\n-old\n+applied',
        },
      },
      createdAt: '2026-06-22T00:00:39.200Z',
    },
    {
      id: 'event-file-final',
      codingSessionId: 'session-canonical-applied-files',
      turnId: 'turn-canonical-applied-files',
      kind: 'message.completed',
      sequence: '4',
      payload: { role: 'assistant', content: 'Applied the approved edit.' },
      createdAt: '2026-06-22T00:00:39.300Z',
    },
  ],
});
assert.deepEqual(
  canonicalAppliedFileProjection[0]?.fileChanges?.map((change) => change.path),
  ['src/applied.ts'],
  'Requested, running, and rejected canonical edits must not enter applied file history.',
);

const parallelDeltaProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-parallel-delta',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'event-delta-a',
      codingSessionId: 'session-parallel-delta',
      turnId: 'turn-parallel-delta',
      kind: 'message.delta',
      sequence: '1',
      payload: {
        role: 'assistant',
        toolCalls: [{ type: 'tool_use', id: 'toolu-delta-a', name: 'Read', input: { path: 'a.ts' } }],
      },
      createdAt: '2026-06-22T00:00:40.000Z',
    },
    {
      id: 'event-delta-b',
      codingSessionId: 'session-parallel-delta',
      turnId: 'turn-parallel-delta',
      kind: 'message.delta',
      sequence: '2',
      payload: {
        role: 'assistant',
        toolCalls: [{ type: 'tool_use', id: 'toolu-delta-b', name: 'Read', input: { path: 'b.ts' } }],
      },
      createdAt: '2026-06-22T00:00:41.000Z',
    },
  ],
});
assert.equal(parallelDeltaProjection.length, 2);
assert.deepEqual(
  parallelDeltaProjection.flatMap((message) =>
    projectChatMessageToolCalls(message.tool_calls, { engineId: 'claude-code' })
      .map((call) => call.id),
  ),
  ['toolu-delta-a', 'toolu-delta-b'],
  'Parallel structured-only tool deltas must remain distinct and retain first-seen order.',
);

const orderedBoundaryMessages: ChatMessageViewSource[] = [
  {
    id: 'ordered-preface', codingSessionId: 'session-ordered-slots', turnId: 'turn-ordered-slots',
    role: 'assistant', content: 'I will run the verification.',
    createdAt: '2026-06-22T00:00:45.000Z',
  },
  {
    id: 'ordered-command', codingSessionId: 'session-ordered-slots', turnId: 'turn-ordered-slots',
    role: 'assistant', content: '',
    tool_calls: [{ type: 'tool_use', id: 'ordered-call', name: 'Bash', input: { command: 'pnpm test' } }],
    createdAt: '2026-06-22T00:00:46.000Z',
  },
  {
    id: 'ordered-result', codingSessionId: 'session-ordered-slots', turnId: 'turn-ordered-slots',
    role: 'tool', content: 'passed',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'ordered-call', content: 'passed' }],
    createdAt: '2026-06-22T00:00:47.000Z',
  },
  {
    id: 'ordered-reply', codingSessionId: 'session-ordered-slots', turnId: 'turn-ordered-slots',
    role: 'assistant', content: 'Verification passed.',
    createdAt: '2026-06-22T00:00:48.000Z',
  },
];
const orderedBoundaryProjection = projectChatTranscriptToolActivity(
  orderedBoundaryMessages,
  { engineId: 'claude-code' },
);
assert.deepEqual(
  orderedBoundaryProjection.map((message) => message.id),
  ['ordered-preface', 'ordered-command', 'ordered-reply'],
  'text -> tool -> text order must survive lifecycle folding.',
);
assert.equal(
  projectChatTranscriptToolActivity(orderedBoundaryProjection, { engineId: 'claude-code' }),
  orderedBoundaryProjection,
  'an already projected transcript must retain its array identity.',
);
assert.equal(
  resolveChatTurnActivitySummary(orderedBoundaryProjection, orderedBoundaryProjection[1]!, {
    engineId: 'claude-code',
  })?.commands[0]?.output,
  'passed',
);
assert.equal(
  resolveChatTurnActivitySummary(orderedBoundaryProjection, orderedBoundaryProjection[2]!, {
    engineId: 'claude-code',
  }),
  null,
  'the authored completion reply must not duplicate its preceding activity summary.',
);

const reasoningToolLifecycleProjection = projectChatTranscriptToolActivity([
  {
    id: 'reasoning-tool-request',
    codingSessionId: 'session-reasoning-tool-slot',
    turnId: 'turn-reasoning-tool-slot',
    role: 'assistant',
    content: '',
    tool_calls: [{
      type: 'tool_use',
      id: 'reasoning-tool-call',
      name: 'read_file',
      input: { path: 'src/provider.ts' },
    }],
    createdAt: '2026-06-22T00:00:48.100Z',
  },
  {
    id: 'reasoning-tool-result',
    codingSessionId: 'session-reasoning-tool-slot',
    turnId: 'turn-reasoning-tool-slot',
    role: 'assistant',
    content: '',
    reasoning: [{
      id: 'reasoning-tool-summary',
      summary: 'Validated the provider file before continuing.',
    }],
    tool_calls: [{
      type: 'tool_result',
      tool_use_id: 'reasoning-tool-call',
      content: 'export const provider = true;',
    }],
    createdAt: '2026-06-22T00:00:48.200Z',
  },
], { engineId: 'opencode' });
assert.equal(
  reasoningToolLifecycleProjection.length,
  1,
  'A reasoning-plus-tool lifecycle must remain one ordered activity slot.',
);
assert.deepEqual(
  reasoningToolLifecycleProjection[0]?.reasoning,
  [{
    id: 'reasoning-tool-summary',
    summary: 'Validated the provider file before continuing.',
  }],
  'Collapsing a tool lifecycle must preserve provider-authored display reasoning on its slot.',
);
assert.equal(
  projectChatTranscriptToolActivity(reasoningToolLifecycleProjection, { engineId: 'opencode' }),
  reasoningToolLifecycleProjection,
  'A projected reasoning-plus-tool activity slot must remain identity-idempotent.',
);

const toolBeforeTextProjection = projectChatTranscriptToolActivity([
  {
    id: 'before-text-request', codingSessionId: 'session-before-text', turnId: 'turn-before-text',
    role: 'assistant', content: '',
    tool_calls: [{ type: 'tool_use', id: 'before-text-call', name: 'Read', input: { path: 'README.md' } }],
    createdAt: '2026-06-22T00:00:49.000Z',
  },
  {
    id: 'before-text-result', codingSessionId: 'session-before-text', turnId: 'turn-before-text',
    role: 'tool', content: 'BirdCoder',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'before-text-call', content: 'BirdCoder' }],
    createdAt: '2026-06-22T00:00:50.000Z',
  },
  {
    id: 'before-text-reply', codingSessionId: 'session-before-text', turnId: 'turn-before-text',
    role: 'assistant', content: 'The README is available.',
    createdAt: '2026-06-22T00:00:51.000Z',
  },
], { engineId: 'claude-code' });
assert.deepEqual(
  toolBeforeTextProjection.map((message) => message.id),
  ['before-text-request', 'before-text-reply'],
  'tool activity before the first authored answer must remain first.',
);

const embeddedToolProjection = projectChatTranscriptToolActivity([
  {
    id: 'embedded-authored', codingSessionId: 'session-embedded', turnId: 'turn-embedded',
    role: 'assistant', content: 'I will inspect the file.',
    tool_calls: [{ type: 'tool_use', id: 'embedded-call', name: 'Read', input: { path: 'src/App.tsx' } }],
    createdAt: '2026-06-22T00:00:52.000Z',
  },
  {
    id: 'embedded-result', codingSessionId: 'session-embedded', turnId: 'turn-embedded',
    role: 'tool', content: 'export function App() {}',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'embedded-call', content: 'export function App() {}' }],
    createdAt: '2026-06-22T00:00:53.000Z',
  },
  {
    id: 'embedded-reply', codingSessionId: 'session-embedded', turnId: 'turn-embedded',
    role: 'assistant', content: 'The file is valid.',
    createdAt: '2026-06-22T00:00:54.000Z',
  },
], { engineId: 'claude-code' });
assert.deepEqual(
  embeddedToolProjection.map((message) => message.id),
  ['embedded-authored', 'embedded-reply'],
  'authored Markdown with an embedded tool must stay in place while its result folds into it.',
);
assert.equal(
  projectChatMessageToolCalls(
    embeddedToolProjection[0]?.tool_calls,
    { engineId: 'claude-code' },
  )[0]?.output,
  'export function App() {}',
);

const lateBoundaryProjection = projectChatTranscriptToolActivity([
  {
    id: 'late-boundary-request', codingSessionId: 'session-late-boundary', turnId: 'turn-late-boundary',
    role: 'assistant', content: '',
    tool_calls: [{ type: 'tool_use', id: 'late-boundary-call', name: 'Bash', input: { command: 'pnpm lint' } }],
    createdAt: '2026-06-22T00:00:55.000Z',
  },
  {
    id: 'late-boundary-authored', codingSessionId: 'session-late-boundary', turnId: 'turn-late-boundary',
    role: 'assistant', content: 'The command is still settling.',
    createdAt: '2026-06-22T00:00:56.000Z',
  },
  {
    id: 'late-boundary-result', codingSessionId: 'session-late-boundary', turnId: 'turn-late-boundary',
    role: 'tool', content: 'lint passed',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'late-boundary-call', content: 'lint passed' }],
    createdAt: '2026-06-22T00:00:57.000Z',
  },
  {
    id: 'late-boundary-reply', codingSessionId: 'session-late-boundary', turnId: 'turn-late-boundary',
    role: 'assistant', content: 'Lint passed.',
    createdAt: '2026-06-22T00:00:58.000Z',
  },
], { engineId: 'claude-code' });
assert.deepEqual(
  lateBoundaryProjection.map((message) => message.id),
  ['late-boundary-request', 'late-boundary-authored', 'late-boundary-reply'],
  'a late result must update the first call slot without crossing an authored boundary.',
);
assert.equal(
  projectChatMessageToolCalls(
    lateBoundaryProjection[0]?.tool_calls,
    { engineId: 'claude-code' },
  )[0]?.output,
  'lint passed',
);

const parallelActivityProjection = projectChatTranscriptToolActivity([
  {
    id: 'parallel-slot-a', codingSessionId: 'session-parallel-slots', turnId: 'turn-parallel-slots',
    role: 'assistant', content: '',
    tool_calls: [{ id: 'parallel-a', name: 'read_file', arguments: { path: 'a.ts' } }],
    createdAt: '2026-06-22T00:00:59.000Z',
  },
  {
    id: 'parallel-slot-b', codingSessionId: 'session-parallel-slots', turnId: 'turn-parallel-slots',
    role: 'assistant', content: '',
    tool_calls: [{ id: 'parallel-b', name: 'read_file', arguments: { path: 'b.ts' } }],
    createdAt: '2026-06-22T00:01:00.000Z',
  },
  {
    id: 'parallel-slot-reply', codingSessionId: 'session-parallel-slots', turnId: 'turn-parallel-slots',
    role: 'assistant', content: 'Both files were queued.',
    createdAt: '2026-06-22T00:01:01.000Z',
  },
]);
assert.deepEqual(
  projectChatMessageToolCalls(parallelActivityProjection[0]?.tool_calls).map((call) => call.id),
  ['parallel-a', 'parallel-b'],
  'consecutive parallel activity rows must coalesce in first-seen order.',
);

const singleMessageNoticeProjection = projectChatTranscriptToolActivity([{
  id: 'single-notice', codingSessionId: 'session-single-notice', turnId: 'turn-single-notice',
  role: 'assistant', content: '',
  tool_calls: [
    {
      type: 'tool_request', requestId: 'single-notice-call', name: 'topic_update',
      display: { format: 'notice', name: 'Index', description: 'Indexing' },
    },
    {
      type: 'tool_response', requestId: 'single-notice-call', name: 'topic_update',
      display: { format: 'notice', name: 'Index', description: 'Indexed', resultSummary: 'Ready' },
    },
  ],
  createdAt: '2026-06-22T00:01:02.000Z',
}], { engineId: 'gemini' });
const singleMessageNoticeCalls = projectChatMessageToolCalls(
  singleMessageNoticeProjection[0]?.tool_calls,
  { engineId: 'gemini' },
);
assert.equal(singleMessageNoticeCalls.length, 1);
assert.equal(singleMessageNoticeCalls[0]?.status, 'success');
assert.equal(
  projectChatTranscriptToolActivity(singleMessageNoticeProjection, { engineId: 'gemini' }),
  singleMessageNoticeProjection,
  'a normalized single-message request/response notice must be idempotent.',
);

const claudeTaskAliasProjection = projectChatTranscriptToolActivity([{
  id: 'claude-task-alias', codingSessionId: 'session-task-alias', turnId: 'turn-task-alias',
  role: 'assistant', content: '',
  tool_calls: [
    {
      type: 'tool_use', id: 'toolu-task-alias', name: 'Task',
      input: { taskId: 'task-alias-1', prompt: 'Audit the transcript' },
    },
    {
      type: 'system', subtype: 'task_started', task_id: 'task-alias-1',
      tool_use_id: 'toolu-task-alias', description: 'Audit the transcript', task_type: 'local_agent',
    },
    {
      type: 'system', subtype: 'task_updated', task_id: 'task-alias-1',
      patch: { status: 'completed', description: 'Transcript audited' },
    },
  ],
  createdAt: '2026-06-22T00:01:03.000Z',
}], { engineId: 'claude-code' });
const claudeTaskAliasCalls = projectChatMessageToolCalls(
  claudeTaskAliasProjection[0]?.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(claudeTaskAliasCalls.length, 1);
assert.equal(claudeTaskAliasCalls[0]?.id, 'toolu-task-alias');
assert.equal(claudeTaskAliasCalls[0]?.status, 'success');

const legacyNoTurnProjection = projectChatTranscriptToolActivity([
  {
    id: 'legacy-request-1', codingSessionId: 'session-legacy-no-turn',
    role: 'assistant', content: '',
    tool_calls: [{ type: 'tool_use', id: 'legacy-reused-call', name: 'Bash', input: { command: 'pnpm test' } }],
    createdAt: '2026-06-22T00:01:04.000Z',
  },
  {
    id: 'legacy-result-1', codingSessionId: 'session-legacy-no-turn',
    role: 'tool', content: 'first pass',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'legacy-reused-call', content: 'first pass' }],
    createdAt: '2026-06-22T00:01:05.000Z',
  },
  {
    id: 'legacy-final-1', codingSessionId: 'session-legacy-no-turn',
    role: 'assistant', content: 'First verification complete.',
    createdAt: '2026-06-22T00:01:06.000Z',
  },
  {
    id: 'legacy-user-2', codingSessionId: 'session-legacy-no-turn',
    role: 'user', content: 'Run it again.',
    createdAt: '2026-06-22T00:01:07.000Z',
  },
  {
    id: 'legacy-request-2', codingSessionId: 'session-legacy-no-turn',
    role: 'assistant', content: '',
    tool_calls: [{ type: 'tool_use', id: 'legacy-reused-call', name: 'Bash', input: { command: 'pnpm test' } }],
    createdAt: '2026-06-22T00:01:08.000Z',
  },
  {
    id: 'legacy-result-2', codingSessionId: 'session-legacy-no-turn',
    role: 'tool', content: 'second pass',
    tool_calls: [{ type: 'tool_result', tool_use_id: 'legacy-reused-call', content: 'second pass' }],
    createdAt: '2026-06-22T00:01:09.000Z',
  },
  {
    id: 'legacy-final-2', codingSessionId: 'session-legacy-no-turn',
    role: 'assistant', content: 'Second verification complete.',
    createdAt: '2026-06-22T00:01:10.000Z',
  },
], { engineId: 'claude-code' });
assert.deepEqual(
  legacyNoTurnProjection.map((message) => message.id),
  ['legacy-request-1', 'legacy-final-1', 'legacy-user-2', 'legacy-request-2', 'legacy-final-2'],
  'legacy request/result messages without turnId must merge within a session and stay separated by user turns.',
);
assert.deepEqual(
  [legacyNoTurnProjection[0], legacyNoTurnProjection[3]].map((message) => (
    projectChatMessageToolCalls(message?.tool_calls, { engineId: 'claude-code' })[0]?.output
  )),
  ['first pass', 'second pass'],
  'a reused provider call id must not merge across a no-turn user boundary.',
);

const opencodeOrderedPartProjection = projectChatTranscriptToolActivity([
  {
    id: 'opencode-part-text-before', codingSessionId: 'session-opencode-parts',
    turnId: 'turn-opencode-parts', role: 'assistant',
    content: 'I will inspect the adapter first.',
    createdAt: '2026-06-22T00:01:11.000Z',
  },
  {
    id: 'opencode-part-tool', codingSessionId: 'session-opencode-parts',
    turnId: 'turn-opencode-parts', role: 'assistant', content: '',
    tool_calls: [{
      id: 'opencode-part-tool', type: 'tool', callID: 'opencode-call-read', tool: 'read',
      state: {
        status: 'completed',
        input: { path: 'src/adapter.ts' },
        output: 'export const adapter = true;',
      },
    }],
    createdAt: '2026-06-22T00:01:12.000Z',
  },
  {
    id: 'opencode-part-text-after', codingSessionId: 'session-opencode-parts',
    turnId: 'turn-opencode-parts', role: 'assistant',
    content: 'The adapter already exposes the required hook.',
    createdAt: '2026-06-22T00:01:13.000Z',
  },
], { engineId: 'opencode' });
assert.deepEqual(
  opencodeOrderedPartProjection.map((message) => message.id),
  ['opencode-part-text-before', 'opencode-part-tool', 'opencode-part-text-after'],
  'OpenCode text/tool/text parts must retain their source order after activity projection.',
);
assert.equal(
  projectChatMessageToolCalls(
    opencodeOrderedPartProjection[1]?.tool_calls,
    { engineId: 'opencode' },
  )[0]?.id,
  'opencode-call-read',
  'The ordered OpenCode tool slot must retain its provider call identity.',
);

const opencodeToolReasoningProjection = projectChatTranscriptToolActivity([
  {
    id: 'opencode-part-tool-before-reasoning', codingSessionId: 'session-opencode-reasoning',
    turnId: 'turn-opencode-reasoning', role: 'assistant', content: '',
    tool_calls: [{
      id: 'opencode-part-search', type: 'tool', callID: 'opencode-call-search', tool: 'grep',
      state: {
        status: 'completed',
        input: { pattern: 'MessagePart' },
        output: 'src/message.ts:12',
      },
    }],
    createdAt: '2026-06-22T00:01:14.000Z',
  },
  {
    id: 'opencode-part-reasoning-after-tool', codingSessionId: 'session-opencode-reasoning',
    turnId: 'turn-opencode-reasoning', role: 'assistant', content: '',
    reasoning: [{
      id: 'opencode-reasoning-after-tool',
      summary: 'The protocol renderer consumes parts in source order.',
    }],
    createdAt: '2026-06-22T00:01:15.000Z',
  },
  {
    id: 'opencode-part-reply-after-reasoning', codingSessionId: 'session-opencode-reasoning',
    turnId: 'turn-opencode-reasoning', role: 'assistant',
    content: 'The source confirms ordered rendering.',
    createdAt: '2026-06-22T00:01:16.000Z',
  },
], { engineId: 'opencode' });
assert.deepEqual(
  opencodeToolReasoningProjection.map((message) => message.id),
  [
    'opencode-part-tool-before-reasoning',
    'opencode-part-reasoning-after-tool',
    'opencode-part-reply-after-reasoning',
  ],
  'OpenCode tool/reasoning/text parts must not be reordered by stable view projection.',
);

assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      id: 'completed-record-before',
      codingSessionId: 'session-logical-record-identity',
      turnId: 'turn-logical-record-identity',
      role: 'assistant',
      content: 'Repeated provider text.',
      createdAt: '2026-07-21T00:00:00.000Z',
    },
    {
      id: 'completed-record-after',
      codingSessionId: 'session-logical-record-identity',
      turnId: 'turn-logical-record-identity',
      role: 'assistant',
      content: 'Repeated provider text.',
      createdAt: '2026-07-21T00:00:00.000Z',
    },
  ),
  false,
  'Distinct completed record ids must not logically match only because turn, role, and text are equal.',
);
assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      id: 'reasoning-record-before',
      codingSessionId: 'session-logical-structured-identity',
      turnId: 'turn-logical-structured-identity',
      role: 'assistant',
      content: '',
      reasoning: [{ id: 'reasoning-shared', summary: 'Initial public summary.' }],
      createdAt: '2026-07-21T00:00:01.000Z',
    },
    {
      id: 'reasoning-record-after',
      codingSessionId: 'session-logical-structured-identity',
      turnId: 'turn-logical-structured-identity',
      role: 'assistant',
      content: '',
      reasoning: [
        { id: 'reasoning-shared', summary: 'Updated public summary.' },
        { id: 'reasoning-added', summary: 'Additional public summary.' },
      ],
      createdAt: '2026-07-21T00:00:02.000Z',
    },
  ),
  true,
  'Structured-only updates with an overlapping canonical child id must retain their logical slot.',
);
assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      id: 'reasoning-kind-record',
      codingSessionId: 'session-logical-structured-kind',
      turnId: 'turn-logical-structured-kind',
      role: 'assistant',
      content: '',
      reasoning: [{ id: 'shared-across-kinds', summary: 'Public reasoning.' }],
      createdAt: '2026-07-21T00:00:01.000Z',
    },
    {
      id: 'resource-kind-record',
      codingSessionId: 'session-logical-structured-kind',
      turnId: 'turn-logical-structured-kind',
      role: 'assistant',
      content: '',
      resources: [{ id: 'shared-across-kinds', kind: 'file', path: 'src/provider.ts' }],
      createdAt: '2026-07-21T00:00:02.000Z',
    },
  ),
  false,
  'Reasoning and resource child ids must remain type-scoped when matching stable slots.',
);
assert.equal(
  areBirdCoderChatMessagesLogicallyMatched(
    {
      id: 'resource-first-turn',
      codingSessionId: 'session-logical-structured-turn',
      turnId: 'turn-logical-structured-one',
      role: 'assistant',
      content: '',
      resources: [{ id: 'provider-reused-resource', kind: 'file', path: 'src/one.ts' }],
      createdAt: '2026-07-21T00:00:01.000Z',
    },
    {
      id: 'resource-second-turn',
      codingSessionId: 'session-logical-structured-turn',
      turnId: 'turn-logical-structured-two',
      role: 'assistant',
      content: '',
      resources: [{ id: 'provider-reused-resource', kind: 'file', path: 'src/two.ts' }],
      createdAt: '2026-07-21T00:00:02.000Z',
    },
  ),
  false,
  'Provider child ids reused in different turns must not merge their transcript slots.',
);

const distinctExistingCompletedRecords = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-existing-completed-records',
  existingMessages: [
    {
      id: 'existing-completed-record-one',
      codingSessionId: 'session-existing-completed-records',
      turnId: 'turn-existing-completed-records',
      role: 'assistant',
      content: 'Provider repeated this text.',
      createdAt: '2026-07-21T00:00:00.000Z',
    },
    {
      id: 'existing-completed-record-two',
      codingSessionId: 'session-existing-completed-records',
      turnId: 'turn-existing-completed-records',
      role: 'assistant',
      content: 'Provider repeated this text.',
      createdAt: '2026-07-21T00:00:01.000Z',
    },
  ],
  idPrefix: 'authoritative',
  events: [{
    id: 'authoritative-completed-record-three',
    codingSessionId: 'session-existing-completed-records',
    turnId: 'turn-existing-completed-records',
    kind: 'message.completed',
    sequence: '3',
    payload: { role: 'assistant', content: 'Provider repeated this text.' },
    createdAt: '2026-07-21T00:00:02.000Z',
  }],
});
assert.deepEqual(
  distinctExistingCompletedRecords.map((message) => message.id),
  [
    'existing-completed-record-one',
    'existing-completed-record-two',
    'session-existing-completed-records:authoritative:authoritative-completed-record-three:assistant',
  ],
  'Projection reconciliation must retain distinct existing and authoritative completed records with equal logical text.',
);

const expandingStructuredUpdateProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-expanding-structured-update',
  existingMessages: [{
    id: 'stable-expanding-reasoning-slot',
    codingSessionId: 'session-expanding-structured-update',
    turnId: 'turn-expanding-structured-update',
    role: 'assistant',
    content: '',
    reasoning: [{ id: 'expanding-reasoning-one', summary: 'Initial summary.' }],
    createdAt: '2026-07-21T00:00:03.000Z',
  }],
  idPrefix: 'authoritative',
  events: [{
    id: 'expanding-structured-update-event',
    codingSessionId: 'session-expanding-structured-update',
    turnId: 'turn-expanding-structured-update',
    kind: 'message.delta',
    sequence: '1',
    payload: {
      role: 'assistant',
      reasoning: [
        { id: 'expanding-reasoning-one', summary: 'Updated summary.' },
        { id: 'expanding-reasoning-two', summary: 'Additional summary.' },
      ],
    },
    createdAt: '2026-07-21T00:00:04.000Z',
  }],
});
assert.equal(expandingStructuredUpdateProjection.length, 1);
assert.equal(
  expandingStructuredUpdateProjection[0]?.id,
  'stable-expanding-reasoning-slot',
  'An expanding structured update must retain the first matching message slot id.',
);
assert.deepEqual(
  expandingStructuredUpdateProjection[0]?.reasoning?.map((item) => [item.id, item.summary]),
  [
    ['expanding-reasoning-one', 'Updated summary.'],
    ['expanding-reasoning-two', 'Additional summary.'],
  ],
  'An expanding structured update must merge every canonical child into the retained slot.',
);

const equalTimestampStructuredSlotProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-equal-timestamp-structured-slot',
  existingMessages: [
    {
      id: 'equal-timestamp-slot-before',
      codingSessionId: 'session-equal-timestamp-structured-slot',
      turnId: 'turn-equal-timestamp-structured-slot',
      role: 'assistant',
      content: '',
      resources: [{ id: 'slot-resource-before', kind: 'file', path: 'src/before.ts' }],
      createdAt: '2026-07-21T00:00:05.000Z',
    },
    {
      id: 'equal-timestamp-slot-updated',
      codingSessionId: 'session-equal-timestamp-structured-slot',
      turnId: 'turn-equal-timestamp-structured-slot',
      role: 'assistant',
      content: '',
      reasoning: [{ id: 'slot-reasoning-updated', summary: 'Initial summary.' }],
      createdAt: '2026-07-21T00:00:05.000Z',
    },
    {
      id: 'equal-timestamp-slot-after',
      codingSessionId: 'session-equal-timestamp-structured-slot',
      turnId: 'turn-equal-timestamp-structured-slot',
      role: 'assistant',
      content: '',
      resources: [{ id: 'slot-resource-after', kind: 'file', path: 'src/after.ts' }],
      createdAt: '2026-07-21T00:00:05.000Z',
    },
  ],
  idPrefix: 'authoritative',
  events: [{
    id: 'equal-timestamp-slot-update-event',
    codingSessionId: 'session-equal-timestamp-structured-slot',
    turnId: 'turn-equal-timestamp-structured-slot',
    kind: 'message.delta',
    sequence: '1',
    payload: {
      role: 'assistant',
      reasoning: [{ id: 'slot-reasoning-updated', summary: 'Updated in place.' }],
    },
    createdAt: '2026-07-21T00:00:05.000Z',
  }],
});
assert.deepEqual(
  equalTimestampStructuredSlotProjection.map((message) => message.id),
  [
    'equal-timestamp-slot-before',
    'equal-timestamp-slot-updated',
    'equal-timestamp-slot-after',
  ],
  'A structured update must retain its existing slot among equal-timestamp history records.',
);

const equalTimestampExistingProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-equal-timestamp-existing',
  existingMessages: [
    {
      id: 'equal-timestamp-existing-tool',
      codingSessionId: 'session-equal-timestamp-existing',
      turnId: 'turn-equal-timestamp-existing',
      role: 'tool',
      content: 'Tool output',
      tool_call_id: 'equal-timestamp-existing-call',
      createdAt: '2026-07-21T00:00:02.000Z',
    },
    {
      id: 'equal-timestamp-existing-assistant',
      codingSessionId: 'session-equal-timestamp-existing',
      turnId: 'turn-equal-timestamp-existing',
      role: 'assistant',
      content: 'Authored follow-up',
      createdAt: '2026-07-21T00:00:02.000Z',
    },
  ],
  idPrefix: 'authoritative',
  events: [],
});
assert.deepEqual(
  equalTimestampExistingProjection.map((message) => message.role),
  ['tool', 'assistant'],
  'Existing provider records with equal timestamps must retain their input order.',
);

const orderedCompletedPartProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-ordered-completed-parts',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'ordered-completed-text-before',
      codingSessionId: 'session-ordered-completed-parts',
      turnId: 'turn-ordered-completed-parts',
      kind: 'message.completed',
      sequence: '1',
      payload: { role: 'assistant', content: 'Before the tool.' },
      createdAt: '2026-07-21T00:00:00.000Z',
    },
    {
      id: 'ordered-completed-tool',
      codingSessionId: 'session-ordered-completed-parts',
      turnId: 'turn-ordered-completed-parts',
      kind: 'message.completed',
      sequence: '2',
      payload: {
        role: 'assistant',
        content: '',
        toolCalls: [{ type: 'tool_use', id: 'ordered-completed-call', name: 'Read', input: { path: 'src/App.tsx' } }],
      },
      createdAt: '2026-07-21T00:00:01.000Z',
    },
    {
      id: 'ordered-completed-text-after',
      codingSessionId: 'session-ordered-completed-parts',
      turnId: 'turn-ordered-completed-parts',
      kind: 'message.completed',
      sequence: '3',
      payload: { role: 'assistant', content: 'After the tool.' },
      createdAt: '2026-07-21T00:00:02.000Z',
    },
  ],
});
assert.deepEqual(
  orderedCompletedPartProjection.map((message) => message.content),
  ['Before the tool.', '', 'After the tool.'],
  'Completed records in one turn must keep text -> tool -> text provider order and distinct identities.',
);
assert.equal(new Set(orderedCompletedPartProjection.map((message) => message.id)).size, 3);

const equalTimestampSequenceProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-equal-timestamp-sequence',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'equal-timestamp-tool',
      codingSessionId: 'session-equal-timestamp-sequence',
      turnId: 'turn-equal-timestamp-sequence',
      kind: 'message.completed',
      sequence: '1',
      payload: { role: 'tool', content: 'Tool output', toolCallId: 'equal-timestamp-call' },
      createdAt: '2026-07-21T00:00:03.000Z',
    },
    {
      id: 'equal-timestamp-assistant',
      codingSessionId: 'session-equal-timestamp-sequence',
      turnId: 'turn-equal-timestamp-sequence',
      kind: 'message.completed',
      sequence: '2',
      payload: { role: 'assistant', content: 'Authored follow-up' },
      createdAt: '2026-07-21T00:00:03.000Z',
    },
  ],
});
assert.deepEqual(
  equalTimestampSequenceProjection.map((message) => message.role),
  ['tool', 'assistant'],
  'Equal timestamps must not replace exact provider sequence with lexical role order.',
);

const equalSequenceAndTimestampProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-equal-sequence-and-timestamp',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'z-provider-tool-record',
      codingSessionId: 'session-equal-sequence-and-timestamp',
      turnId: 'turn-equal-sequence-and-timestamp',
      kind: 'message.completed',
      sequence: '7',
      payload: { role: 'tool', content: 'Provider tool output', toolCallId: 'equal-sequence-call' },
      createdAt: '2026-07-21T00:00:03.500Z',
    },
    {
      id: 'a-provider-assistant-record',
      codingSessionId: 'session-equal-sequence-and-timestamp',
      turnId: 'turn-equal-sequence-and-timestamp',
      kind: 'message.completed',
      sequence: '7',
      payload: { role: 'assistant', content: 'Provider-authored follow-up' },
      createdAt: '2026-07-21T00:00:03.500Z',
    },
  ],
});
assert.deepEqual(
  equalSequenceAndTimestampProjection.map((message) => message.role),
  ['tool', 'assistant'],
  'Provider input order must remain stable when both exact sequence and timestamp are equal.',
);

const orderedStructuredDeltaProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-ordered-structured-deltas',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'ordered-resource-delta',
      codingSessionId: 'session-ordered-structured-deltas',
      turnId: 'turn-ordered-structured-deltas',
      kind: 'message.delta',
      sequence: '1',
      payload: { role: 'assistant', resources: [{ id: 'ordered-resource', kind: 'file', path: 'src/provider.ts' }] },
      createdAt: '2026-07-21T00:00:04.000Z',
    },
    {
      id: 'ordered-reasoning-delta',
      codingSessionId: 'session-ordered-structured-deltas',
      turnId: 'turn-ordered-structured-deltas',
      kind: 'message.delta',
      sequence: '2',
      payload: { role: 'assistant', reasoning: [{ id: 'ordered-reasoning', summary: 'Reasoned after the resource.' }] },
      createdAt: '2026-07-21T00:00:04.000Z',
    },
  ],
});
assert.deepEqual(
  orderedStructuredDeltaProjection.flatMap((message) =>
    resolveChatMessageView(message).blocks.map((block) => block.type),
  ),
  ['resources', 'reasoning'],
  'Structured-only delta children must retain their cross-block provider order even when timestamps are equal.',
);

const textToolTextDeltaProjection = mergeBirdCoderProjectionMessages({
  codingSessionId: 'session-text-tool-text-deltas',
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'text-tool-text-before',
      codingSessionId: 'session-text-tool-text-deltas',
      turnId: 'turn-text-tool-text-deltas',
      kind: 'message.delta',
      sequence: '1',
      payload: { role: 'assistant', contentDelta: 'Before the tool.' },
      createdAt: '2026-07-21T00:00:05.000Z',
    },
    {
      id: 'text-tool-text-tool',
      codingSessionId: 'session-text-tool-text-deltas',
      turnId: 'turn-text-tool-text-deltas',
      kind: 'message.delta',
      sequence: '2',
      payload: {
        role: 'assistant',
        toolCalls: [{
          type: 'tool_use',
          id: 'text-tool-text-call',
          name: 'Read',
          input: { path: 'src/provider.ts' },
        }],
      },
      createdAt: '2026-07-21T00:00:05.000Z',
    },
    {
      id: 'text-tool-text-after',
      codingSessionId: 'session-text-tool-text-deltas',
      turnId: 'turn-text-tool-text-deltas',
      kind: 'message.delta',
      sequence: '3',
      payload: { role: 'assistant', contentDelta: 'After the tool.' },
      createdAt: '2026-07-21T00:00:05.000Z',
    },
  ],
});
assert.deepEqual(
  textToolTextDeltaProjection.map((message) => message.content),
  ['Before the tool.', '', 'After the tool.'],
  'A structured delta boundary must split text streams into stable provider-ordered segments.',
);
assert.equal(
  projectChatMessageToolCalls(
    textToolTextDeltaProjection[1]?.tool_calls,
    { engineId: 'claude-code' },
  )[0]?.id,
  'text-tool-text-call',
  'The structured delta between text segments must retain its provider call identity.',
);

function createIndexCountingMessages(
  messages: ChatMessageViewSource[],
): { messages: ChatMessageViewSource[]; readCount: () => number } {
  let indexedReads = 0;
  const countedMessages = new Proxy(messages, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/u.test(property)) {
        indexedReads += 1;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return {
    messages: countedMessages,
    readCount: () => indexedReads,
  };
}

const largeTranscript = Array.from({ length: 1_200 }, (_, index): ChatMessageViewSource => ({
  id: `linear-message-${index}`,
  codingSessionId: 'session-linear-projection',
  turnId: `linear-turn-${index}`,
  role: 'assistant',
  content: 'Completed.',
  tool_calls: [{
    id: `linear-call-${index}`,
    name: 'read_file',
    arguments: { path: `src/file-${index}.ts` },
  }],
  createdAt: '2026-06-22T00:00:18.000Z',
}));
const projectionAccess = createIndexCountingMessages(largeTranscript);
const projectedLargeTranscript = projectChatTranscriptToolActivity(projectionAccess.messages);
assert.equal(
  projectedLargeTranscript,
  projectionAccess.messages,
  'A clean transcript must retain its array identity when no tool rows need folding.',
);
assert.ok(
  projectionAccess.readCount() < largeTranscript.length * 12,
  `turn projection must stay linear; observed ${projectionAccess.readCount()} indexed reads.`,
);

const summaryAccess = createIndexCountingMessages(largeTranscript);
for (const message of summaryAccess.messages) {
  resolveChatTurnActivitySummary(summaryAccess.messages, message);
}
assert.ok(
  summaryAccess.readCount() < largeTranscript.length * 12,
  `turn summary lookup must reuse one linear index; observed ${summaryAccess.readCount()} indexed reads.`,
);

console.log('chat message projection contract passed.');
