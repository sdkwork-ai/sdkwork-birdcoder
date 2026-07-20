import assert from 'node:assert/strict';

import {
  resolveChatMessageView,
  type ChatMessageViewSource,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';
import {
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
const finalTurnMessage = turnMessages[2]!;
const turnActivitySummary = resolveChatTurnActivitySummary(turnMessages, finalTurnMessage);
assert.deepEqual(
  turnActivitySummary,
  {
    commands: [{ command: 'pnpm typecheck', status: 'success' }],
    fileChanges: [{ path: 'src/App.tsx', additions: 2, deletions: 1 }],
  },
  'the final assistant reply must collect tool activity from its completed turn for one end-of-turn summary card.',
);
assert.equal(
  resolveChatTurnActivitySummary(turnMessages, turnMessages[1]!),
  null,
  'tool messages must not render a duplicate turn-end summary before the final assistant reply.',
);
const completedTurnView = resolveChatMessageView(finalTurnMessage, {
  activitySummary: turnActivitySummary,
});
assert.equal(
  completedTurnView.kind,
  'assistant.activity',
  'a final reply with collected tool activity must render through the activity summary surface.',
);
assert.deepEqual(
  completedTurnView.blocks.find((block) => block.type === 'activity'),
  {
    type: 'activity',
    messageId: 'turn-assistant',
    commands: [{ command: 'pnpm typecheck', status: 'success' }],
    fileChanges: [{ path: 'src/App.tsx', additions: 2, deletions: 1 }],
  },
  'the turn-end activity card must expose both commands and file changes from the completed turn.',
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
const protocolActivitySummary = resolveChatTurnActivitySummary(
  protocolOnlyTurnMessages,
  protocolOnlyTurnMessages[2]!,
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

for (const claudeSystemText of [
  {
    type: 'system',
    subtype: 'informational',
    content: 'Hook feedback for the host transcript.',
    level: 'notice',
  },
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
  2,
  'provider tool protocol rows must collapse into the final turn reply instead of rendering as raw messages.',
);
const claudeFinalDisplayMessage = claudeDisplayMessages[1]!;
assert.equal(claudeFinalDisplayMessage.content, 'The requested file could not be read.');
const claudeDisplayToolCalls = projectChatMessageToolCalls(
  claudeFinalDisplayMessage.tool_calls,
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
  claudeTaskLifecycleFinal?.tool_calls,
  { engineId: 'claude-code' },
);
assert.equal(
  claudeTaskLifecycleCalls.length,
  1,
  'Claude task_started and task_updated snapshots must correlate by task_id into one row.',
);
assert.equal(claudeTaskLifecycleCalls[0]?.id, 'claude-task-lifecycle-1');
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
assert.equal(claudeProgressDisplayMessages.length, 1);
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
  repeatedCommandsView.blocks.find((block) => block.type === 'activity')?.commands.length,
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
  assert.equal(providerDisplayMessages.length, 1);
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
    1,
    `${providerCase.engineId} must fold a read lifecycle into one display message.`,
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
      blockTypes: ['markdown', 'tool-calls'],
      kind: 'file',
      resultTypes: ['text'],
      status: 'success',
      target: 'src/App.tsx',
      visibleMarkdown: 'Read complete.',
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
assert.equal(parallelDeltaProjection.length, 1);
assert.deepEqual(
  projectChatMessageToolCalls(
    parallelDeltaProjection[0]?.tool_calls,
    { engineId: 'claude-code' },
  ).map((call) => call.id),
  ['toolu-delta-a', 'toolu-delta-b'],
  'Streaming deltas must accumulate parallel tools in first-seen order.',
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
