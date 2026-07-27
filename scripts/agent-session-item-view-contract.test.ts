import assert from 'node:assert/strict';

import type { AgentSessionItemRecord } from '@sdkwork/agents-app-sdk';
import {
  areAgentSessionItemsLogicallyMatched,
  deduplicateAgentSessionItemViews,
  type AgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import { isAgentSessionItemVisibleInTranscript } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-transcript.ts';
import { resolveAgentSessionItemPresentation } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import {
  composeAgentSessionTranscriptActivity,
  resolveAgentTurnActivityPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-activity-presentation.ts';
import {
  toAgentSessionItemView,
  toAgentSessionTranscriptItemViews,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';

const canonicalItem: AgentSessionItemRecord = {
  tenantId: '1001',
  organizationId: '2001',
  sessionId: 'agent-session-1',
  itemId: 'agent-item-1',
  kind: 'assistant_output',
  content: 'The canonical Agents response.',
  contentType: 'text/markdown',
  status: 'completed',
  sequence: '7',
  inputTokens: '11',
  outputTokens: '23',
  modelId: 'gpt-5',
  providerId: 'openai',
  turnId: 'agent-turn-1',
  driveRefs: [],
  createdBy: '3001',
  version: '1',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:01.000Z',
  completedAt: '2026-07-23T08:00:01.000Z',
};

const transientItemView = toAgentSessionItemView(canonicalItem);

assert.deepEqual(
  {
    id: transientItemView.id,
    sessionId: transientItemView.sessionId,
    turnId: transientItemView.turnId,
    role: transientItemView.role,
    content: transientItemView.content,
  },
  {
    id: canonicalItem.itemId,
    sessionId: canonicalItem.sessionId,
    turnId: canonicalItem.turnId,
    role: 'assistant',
    content: canonicalItem.content,
  },
);
assert.deepEqual(transientItemView.metadata, {
  agentItemKind: canonicalItem.kind,
  agentItemSequence: canonicalItem.sequence,
  agentItemStatus: canonicalItem.status,
  contentType: canonicalItem.contentType,
  inputTokens: canonicalItem.inputTokens,
  outputTokens: canonicalItem.outputTokens,
  parentItemId: undefined,
  providerId: canonicalItem.providerId,
  modelId: canonicalItem.modelId,
});
assert.equal('agentSessionId' in transientItemView, false);
assert.equal('conversationId' in transientItemView, false);

const legacyItemWithoutDriveRefs = {
  ...canonicalItem,
  itemId: 'agent-item-without-drive-refs',
  driveRefs: undefined,
} as unknown as AgentSessionItemRecord;
assert.equal(
  toAgentSessionItemView(legacyItemWithoutDriveRefs).content,
  canonicalItem.content,
  'Legacy Session Items without Drive references must remain renderable.',
);

const renderedView = resolveAgentSessionItemPresentation(transientItemView, {
  engineId: canonicalItem.providerId ?? undefined,
});
assert.equal(renderedView.kind, 'assistant.text');
assert.equal(renderedView.source, transientItemView);
assert.equal(renderedView.engineId, canonicalItem.providerId);
assert.equal(
  renderedView.blocks.some(
    (block) => block.type === 'markdown' && block.content === canonicalItem.content,
  ),
  true,
);

const canonicalReasoningItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-reasoning',
  kind: 'reasoning',
  content: 'Planning the provider-neutral message projection.',
  sequence: '8',
  driveRefs: [{
    resourceRole: 'artifact',
    driveSpaceId: 'drive-space-1',
    driveNodeId: 'drive-node-plan',
    altText: 'Provider plan',
    sortOrder: 0,
    status: 'active',
    createdBy: canonicalItem.createdBy,
    createdAt: canonicalItem.createdAt,
    updatedAt: canonicalItem.updatedAt,
  }, {
    resourceRole: 'image',
    driveSpaceId: 'drive-space-1',
    driveNodeId: 'drive-node-deleted',
    altText: 'Deleted preview',
    sortOrder: 1,
    status: 'deleted',
    createdBy: canonicalItem.createdBy,
    createdAt: canonicalItem.createdAt,
    updatedAt: canonicalItem.updatedAt,
  }],
};
const reasoningItemView = toAgentSessionItemView(canonicalReasoningItem);
assert.equal(reasoningItemView.content, '');
assert.deepEqual(reasoningItemView.reasoning, [{
  id: canonicalReasoningItem.itemId,
  summary: canonicalReasoningItem.content,
  createdAt: canonicalReasoningItem.createdAt,
  startedAt: canonicalReasoningItem.createdAt,
  completedAt: canonicalReasoningItem.completedAt,
  durationMs: 1_000,
}]);
assert.deepEqual(reasoningItemView.resources, [{
  id: 'drive-node-plan',
  kind: 'file',
  name: 'Provider plan',
  uri: 'drive://nodes/drive-node-plan',
}]);
assert.deepEqual(
  resolveAgentSessionItemPresentation(reasoningItemView).blocks.map((block) => block.type),
  ['reasoning', 'resources'],
  'Canonical reasoning and Drive references must render as structured blocks, not raw Markdown.',
);

const canonicalSystemInstruction: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-system-instruction',
  kind: 'system_instruction',
  content: 'Internal execution guidance that must not be shown.',
  sequence: '8',
};
const legacyCodexInstructionsUserItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-legacy-codex-instructions',
  kind: 'user_input',
  content: [
    '# AGENTS.md instructions for E:\\workspace',
    '',
    '<INSTRUCTIONS>',
    'Internal execution guidance that must not be shown.',
    '</INSTRUCTIONS>',
    '<environment_context><cwd>E:\\workspace</cwd></environment_context>',
  ].join('\n'),
  sequence: '8',
};
const canonicalStatusNotice: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-status-notice',
  kind: 'status_notice',
  content: 'The agent resumed after reconnecting.',
  sequence: '9',
};
const canonicalErrorNotice: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-error-notice',
  kind: 'error_notice',
  content: 'The agent turn failed.',
  status: 'failed',
  sequence: '10',
};
const systemInstructionView = toAgentSessionItemView(canonicalSystemInstruction);
const legacyCodexInstructionsUserView = toAgentSessionItemView(legacyCodexInstructionsUserItem);
const statusNoticeView = toAgentSessionItemView(canonicalStatusNotice);
const errorNoticeView = toAgentSessionItemView(canonicalErrorNotice);

assert.equal(systemInstructionView.role, 'system');
assert.equal(isAgentSessionItemVisibleInTranscript(systemInstructionView), false);
assert.equal(legacyCodexInstructionsUserView.role, 'user');
assert.equal(isAgentSessionItemVisibleInTranscript(legacyCodexInstructionsUserView), false);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...transientItemView,
    metadata: { agentItemKind: 'future_internal_context' },
  }),
  false,
  'unknown canonical item kinds must stay hidden until their transcript presentation is defined.',
);
assert.equal(statusNoticeView.metadata?.noticeKind, 'info');
assert.equal(errorNoticeView.metadata?.noticeKind, 'failed');
assert.equal(isAgentSessionItemVisibleInTranscript(statusNoticeView), true);
assert.equal(isAgentSessionItemVisibleInTranscript(errorNoticeView), true);
assert.deepEqual(
  toAgentSessionTranscriptItemViews([
    canonicalSystemInstruction,
    legacyCodexInstructionsUserItem,
    canonicalStatusNotice,
    canonicalErrorNotice,
    canonicalItem,
  ]).map((item) => item.id),
  [canonicalStatusNotice.itemId, canonicalErrorNotice.itemId, canonicalItem.itemId],
  'canonical system instructions must remain execution facts without entering the user transcript.',
);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...systemInstructionView,
    metadata: undefined,
  }),
  false,
  'unknown system-role items must fail closed instead of exposing internal context.',
);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...systemInstructionView,
    metadata: { noticeKind: 'warning' },
  }),
  true,
  'explicit user-facing protocol warnings remain visible.',
);

const statusNoticePresentation = resolveAgentSessionItemPresentation(statusNoticeView);
const errorNoticePresentation = resolveAgentSessionItemPresentation(errorNoticeView);
assert.equal(statusNoticePresentation.kind, 'system.notice');
assert.equal(errorNoticePresentation.kind, 'system.notice');
assert.equal(
  statusNoticePresentation.blocks.some(
    (block) => block.type === 'markdown' && block.noticeKind === 'info',
  ),
  true,
);
assert.equal(
  errorNoticePresentation.blocks.some(
    (block) => block.type === 'markdown' && block.noticeKind === 'failed',
  ),
  true,
);

const canonicalToolItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-2',
  kind: 'tool_result',
  content: null,
  sequence: '8',
  toolName: 'typecheck',
  toolCallId: 'agent-tool-call-1',
  toolResult: { exitCode: 0 },
};
const transientToolView = toAgentSessionItemView(canonicalToolItem);

assert.equal(transientToolView.role, 'tool');
assert.equal(transientToolView.name, canonicalToolItem.toolName);
assert.equal(transientToolView.tool_call_id, canonicalToolItem.toolCallId);
assert.equal(transientToolView.content, JSON.stringify(canonicalToolItem.toolResult, null, 2));
assert.deepEqual(transientToolView.tool_calls, [{
  id: canonicalToolItem.toolCallId,
  type: canonicalToolItem.kind,
  name: canonicalToolItem.toolName,
  status: canonicalToolItem.status,
  output: canonicalToolItem.toolResult,
}]);

const commandText = 'pnpm typecheck';
const canonicalCommandCall: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-command-call',
  kind: 'tool_call',
  content: null,
  sequence: '9',
  status: 'pending',
  toolName: 'shell_command',
  toolCallId: 'agent-tool-call-command-1',
  toolArguments: { command: commandText, workdir: 'E:/sdkwork-space/sdkwork-birdcoder' },
};
const canonicalCommandResult: AgentSessionItemRecord = {
  ...canonicalCommandCall,
  itemId: 'agent-item-command-result',
  kind: 'tool_result',
  sequence: '10',
  status: 'completed',
  toolArguments: undefined,
  toolResult: {
    exitCode: 0,
    stdout: 'TypeScript check passed.',
    fileChanges: [{
      path: 'src/message.tsx',
      additions: 12,
      deletions: 3,
      originalContent: 'before',
      content: 'after',
    }],
  },
};
const commandCallView = toAgentSessionItemView(canonicalCommandCall);
const commandResultView = toAgentSessionItemView(canonicalCommandResult);
assert.deepEqual(commandResultView.fileChanges, [{
  path: 'src/message.tsx',
  additions: 12,
  deletions: 3,
  lineImpactKnown: true,
  originalContent: 'before',
  content: 'after',
}]);
const commandTranscript = composeAgentSessionTranscriptActivity(
  [commandCallView, commandResultView],
  { engineId: 'codex' },
);
const commandActivity = commandTranscript
  .map((item) => resolveAgentTurnActivityPresentation(commandTranscript, item, { engineId: 'codex' }))
  .find((activity) => (activity?.commands.length ?? 0) > 0);

assert.ok(commandActivity, 'canonical command Session Items must produce transcript command activity');
assert.deepEqual(commandActivity.commands, [{
  command: commandText,
  status: 'success',
  output: 'TypeScript check passed.',
  kind: 'command',
  toolName: canonicalCommandCall.toolName,
  toolCallId: canonicalCommandCall.toolCallId,
}]);

const provisionalUserItem: AgentSessionItemView = {
  id: '',
  sessionId: canonicalItem.sessionId,
  turnId: canonicalItem.turnId,
  role: 'user',
  content: 'First item without a canonical id.',
  createdAt: '2026-07-23T08:01:00.000Z',
};
const unrelatedProvisionalAssistantItem: AgentSessionItemView = {
  ...provisionalUserItem,
  role: 'assistant',
  content: 'A distinct item without a canonical id.',
  createdAt: '2026-07-23T08:01:01.000Z',
};
const completedUserItem: AgentSessionItemView = {
  ...provisionalUserItem,
  id: 'agent-item-provisional-completed',
  commands: [{ command: 'pnpm typecheck', status: 'success' }],
};

assert.equal(
  areAgentSessionItemsLogicallyMatched(
    provisionalUserItem,
    unrelatedProvisionalAssistantItem,
  ),
  false,
  'blank provisional ids must not collapse unrelated canonical Session Item candidates.',
);
assert.deepEqual(
  deduplicateAgentSessionItemViews([
    provisionalUserItem,
    unrelatedProvisionalAssistantItem,
    completedUserItem,
  ]).map((item) => ({
    id: item.id,
    role: item.role,
    content: item.content,
    commands: item.commands,
  })),
  [
    {
      id: 'agent-item-provisional-completed',
      role: 'user',
      content: 'First item without a canonical id.',
      commands: [{ command: 'pnpm typecheck', status: 'success' }],
    },
    {
      id: '',
      role: 'assistant',
      content: 'A distinct item without a canonical id.',
      commands: undefined,
    },
  ],
  'a canonical item may complete one matching provisional item without collapsing other rows.',
);

const longMetadataItems = deduplicateAgentSessionItemViews([
  {
    ...provisionalUserItem,
    id: 'agent-item-with-long-metadata',
    metadata: { requestId: 101777208078558063n },
  },
  {
    ...unrelatedProvisionalAssistantItem,
    id: 'agent-item-without-long-metadata',
  },
]);
assert.equal(
  longMetadataItems.length,
  2,
  'Session Item signatures must preserve Long-safe metadata without crashing synchronization.',
);

console.log('agent session item view contract passed.');
