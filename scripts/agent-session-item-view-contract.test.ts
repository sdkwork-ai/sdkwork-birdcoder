import assert from 'node:assert/strict';

import type { AgentSessionItemRecord } from '@sdkwork/agents-app-sdk';
import {
  areAgentSessionItemsLogicallyMatched,
  deduplicateAgentSessionItemViews,
  type AgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import {
  MAX_AGENT_SESSION_ITEM_RESOURCES,
  normalizeAgentSessionItemResources,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-resources.ts';
import { isAgentSessionItemVisibleInTranscript } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-transcript.ts';
import { resolveAgentSessionItemPresentation } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import {
  composeAgentSessionTranscriptActivity,
  resolveAgentTurnActivityPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-activity-presentation.ts';
import { normalizeAgentSessionItemToolCalls } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts';
import {
  MAX_AGENT_SESSION_FILE_CHANGES,
  MAX_FILE_CHANGE_TEXT_CHARACTERS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/file-change.ts';
import {
  toAgentSessionItemView,
  toAgentSessionTranscriptItemViews,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';

assert.deepEqual(
  normalizeAgentSessionItemResources([{
    citation: { sessionIds: ['agent-session-related'] },
    id: 'session-citation',
    kind: 'citation',
  }]),
  [{
    citation: { sessionIds: ['agent-session-related'] },
    id: 'session-citation',
    kind: 'citation',
  }],
  'Provider-neutral resource citations must expose canonical Session identifiers.',
);

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

const codexUserMessageCreatedAt = '2026-07-23T08:00:02.000Z';
const codexUserTextItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-user-text',
  kind: 'user_input',
  content: 'Inspect the attached screenshot and README.',
  contentType: 'text/plain',
  providerId: 'openai',
  sequence: '20',
  createdAt: codexUserMessageCreatedAt,
};
const codexUserImageItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-user-image',
  kind: 'artifact_reference',
  content: JSON.stringify({
    type: 'input_image',
    image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  }),
  contentType: 'application/json',
  providerId: null,
  sequence: '21',
  createdAt: '2026-07-23T08:00:02.001Z',
};
const codexUserMentionItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-user-mention',
  kind: 'artifact_reference',
  content: JSON.stringify({
    type: 'mention',
    name: 'README.md',
    path: 'E:\\workspace\\README.md',
  }),
  contentType: 'application/json',
  providerId: 'openai',
  sequence: '22',
  createdAt: '2026-07-23T08:00:02.002Z',
};
const codexUserMessageViews = toAgentSessionTranscriptItemViews([
  codexUserImageItem,
  codexUserTextItem,
  codexUserMentionItem,
], {
  engineId: 'codex',
  providerBindingId: 'codex',
  providerId: 'openai',
});
assert.equal(
  codexUserMessageViews.length,
  1,
  'Codex rollout parts from one user message must render as one transcript message.',
);
assert.equal(codexUserMessageViews[0]?.role, 'user');
assert.equal(codexUserMessageViews[0]?.content, codexUserTextItem.content);
assert.deepEqual(
  codexUserMessageViews[0]?.resources?.map((resource) => ({
    kind: resource.kind,
    name: resource.name,
    path: resource.path,
  })),
  [
    { kind: 'image', name: 'Image', path: undefined },
    { kind: 'mention', name: 'README.md', path: 'E:\\workspace\\README.md' },
  ],
  'Codex image and mention inputs must remain structured user-message resources.',
);
assert.equal(
  codexUserMessageViews[0]?.resources?.[0]?.mediaSource,
  JSON.parse(codexUserImageItem.content ?? '{}').image_url,
);

const codexEnvelopeItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-user-envelope',
  kind: 'user_input',
  content: JSON.stringify({
    id: 'codex-user-message-1',
    content: [
      { type: 'text', text: 'Use every referenced input.' },
      { type: 'localImage', path: 'E:\\workspace\\capture.png' },
      { type: 'audio', url: 'data:audio/wav;base64,UklGRg==' },
      { type: 'local_audio', path: 'E:\\workspace\\note.mp3' },
      { type: 'file', name: 'requirements.pdf', path: 'E:\\workspace\\requirements.pdf' },
      { type: 'skill', name: 'release-check', path: 'E:\\skills\\release-check\\SKILL.md' },
    ],
  }),
  contentType: 'application/json',
  providerId: 'provider.model.codex',
  sequence: '23',
};
const codexEnvelopeView = toAgentSessionItemView(codexEnvelopeItem);
assert.equal(codexEnvelopeView.content, 'Use every referenced input.');
assert.deepEqual(
  codexEnvelopeView.resources?.map((resource) => resource.kind),
  ['image', 'audio', 'audio', 'file', 'skill'],
  'Codex App Server UserInput variants must project through the shared resource model.',
);
assert.equal(codexEnvelopeView.resources?.[0]?.path, 'E:\\workspace\\capture.png');
assert.equal(codexEnvelopeView.resources?.[1]?.mediaSource, 'data:audio/wav;base64,UklGRg==');
assert.equal(codexEnvelopeView.resources?.[2]?.path, 'E:\\workspace\\note.mp3');

const codexRolloutImagePath = 'C:\\Users\\admin\\AppData\\Local\\Temp\\codex-screenshot.png';
const codexRolloutImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const codexRolloutAnnotatedText = `
# Files mentioned by the user:

## codex-screenshot.png: ${codexRolloutImagePath}

## codex-protocol-notes.md: E:\\workspace\\codex-protocol-notes.md

## My request for Codex:
Render the screenshot and keep this request as the only visible text.
`;
const codexRolloutResponseItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-rollout-response-item',
  kind: 'user_input',
  content: JSON.stringify({
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'user',
      content: [
        { type: 'input_text', text: codexRolloutAnnotatedText },
        {
          type: 'input_text',
          text: `<image name=[Image #1] path="${codexRolloutImagePath}">`,
        },
        { type: 'input_image', image_url: codexRolloutImageData },
        { type: 'input_text', text: '</image>' },
      ],
    },
  }),
  contentType: 'application/json',
  providerId: 'openai',
  sequence: '24',
};
const codexRolloutResponseView = toAgentSessionItemView(codexRolloutResponseItem, {
  engineId: 'codex',
  providerBindingId: 'codex',
  providerId: 'openai',
});
assert.equal(
  codexRolloutResponseView.content,
  'Render the screenshot and keep this request as the only visible text.',
  'Codex transcript projection must strip generated file context and media tags.',
);
assert.equal(codexRolloutResponseView.resources?.length, 2);
assert.deepEqual(
  codexRolloutResponseView.resources?.map((resource) => ({
    kind: resource.kind,
    name: resource.name,
    path: resource.path,
  })),
  [
    {
      kind: 'image',
      name: 'codex-screenshot.png',
      path: codexRolloutImagePath,
    },
    {
      kind: 'file',
      name: 'codex-protocol-notes.md',
      path: 'E:\\workspace\\codex-protocol-notes.md',
    },
  ],
  'Codex file annotations and image placeholders must project as structured resources.',
);
assert.equal(
  codexRolloutResponseView.resources?.[0]?.mediaSource,
  codexRolloutImageData,
  'Codex local image metadata and encoded image data must coalesce into one preview.',
);
assert.doesNotMatch(codexRolloutResponseView.content, /Files mentioned|<\/?image>/u);

const codexLossyAnnotatedTextView = toAgentSessionItemView({
  ...codexRolloutResponseItem,
  itemId: 'agent-item-codex-lossy-annotated-text',
  content: codexRolloutAnnotatedText,
  contentType: 'text/plain',
}, {
  engineId: 'codex',
  providerId: 'openai',
});
assert.equal(codexLossyAnnotatedTextView.content, codexRolloutResponseView.content);
assert.deepEqual(
  codexLossyAnnotatedTextView.resources?.map((resource) => resource.kind),
  ['image', 'file'],
  'A lossy Codex text projection must still recover mentioned local files.',
);

const boundedCodexResourceView = toAgentSessionItemView({
  ...codexEnvelopeItem,
  itemId: 'agent-item-codex-bounded-resources',
  content: JSON.stringify({
    content: Array.from({ length: 300 }, (_, index) => ({
      type: 'file',
      name: `file-${index}.txt`,
      path: `E:\\workspace\\file-${index}.txt`,
    })),
  }),
});
assert.equal(
  boundedCodexResourceView.resources?.length,
  MAX_AGENT_SESSION_ITEM_RESOURCES,
  'Codex payloads must cap retained resources before quadratic coalescing and rendering.',
);

const unsafeCodexResourceView = toAgentSessionItemView({
  ...codexEnvelopeItem,
  itemId: 'agent-item-codex-unsafe-resource-schemes',
  content: JSON.stringify({
    content: [
      { type: 'text', text: 'Keep the safe file only.' },
      { type: 'file', name: 'unsafe.txt', path: 'javascript:alert(1)' },
      { type: 'image', name: 'unsafe.png', url: 'javascript:alert(2)' },
      { type: 'file', name: 'safe.txt', path: 'E:\\workspace\\safe.txt' },
    ],
  }),
});
assert.equal(unsafeCodexResourceView.content, 'Keep the safe file only.');
assert.deepEqual(
  unsafeCodexResourceView.resources?.map((resource) => resource.path),
  ['E:\\workspace\\safe.txt'],
  'Protocol resources with executable URI schemes must not become openable local file paths.',
);

const boundedMentionedFilesView = toAgentSessionItemView({
  ...codexRolloutResponseItem,
  itemId: 'agent-item-codex-bounded-mentioned-files',
  content: [
    '# Files mentioned by the user:',
    '',
    ...Array.from(
      { length: 80 },
      (_, index) => `## file-${index}.txt: E:\\workspace\\file-${index}.txt`,
    ),
    '',
    '## My request for Codex:',
    'Bound the file list.',
  ].join('\n'),
  contentType: 'text/plain',
}, {
  engineId: 'codex',
  providerId: 'openai',
});
assert.equal(boundedMentionedFilesView.content, 'Bound the file list.');
assert.equal(
  boundedMentionedFilesView.resources?.length,
  MAX_AGENT_SESSION_ITEM_RESOURCES,
  'Text-only Codex file annotations must be parsed incrementally with a fixed resource bound.',
);

const codexLegacyEnvelopeItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-codex-legacy-user-envelope',
  kind: 'user_input',
  content: JSON.stringify({
    message: 'Preserve the legacy Codex user message.',
    images: ['data:image/png;base64,aGVsbG8='],
    local_images: ['E:\\workspace\\legacy.png'],
    audio: ['data:audio/wav;base64,UklGRg=='],
    local_audio: ['E:\\workspace\\legacy.wav'],
  }),
  contentType: 'application/json',
  providerId: 'openai',
  sequence: '25',
};
const codexLegacyEnvelopeView = toAgentSessionItemView(codexLegacyEnvelopeItem, {
  engineId: 'openai-codex',
  providerId: 'openai',
});
assert.equal(
  codexLegacyEnvelopeView.content,
  'Preserve the legacy Codex user message.',
  'Codex legacy UserMessageEvent text must not leak as raw JSON.',
);
assert.deepEqual(
  codexLegacyEnvelopeView.resources?.map((resource) => resource.kind),
  ['image', 'image', 'audio', 'audio'],
  'Codex legacy remote and local media fields must remain structured resources.',
);
assert.equal(
  codexLegacyEnvelopeView.resources?.[0]?.mediaSource,
  'data:image/png;base64,aGVsbG8=',
);
assert.equal(codexLegacyEnvelopeView.resources?.[1]?.path, 'E:\\workspace\\legacy.png');
assert.equal(codexLegacyEnvelopeView.resources?.[2]?.mediaSource, 'data:audio/wav;base64,UklGRg==');
assert.equal(codexLegacyEnvelopeView.resources?.[3]?.path, 'E:\\workspace\\legacy.wav');

const unrelatedJsonUserItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-openai-json-user',
  kind: 'user_input',
  content: '{"type":"input_image","image_url":"https://example.test/image.png"}',
  contentType: 'application/json',
  providerId: 'openai',
};
assert.equal(
  toAgentSessionItemView(unrelatedJsonUserItem).content,
  unrelatedJsonUserItem.content,
  'Provider-native parsing must require explicit Codex provider evidence.',
);
assert.equal(
  toAgentSessionItemView(unrelatedJsonUserItem, {
    engineId: 'openai',
    providerBindingId: 'openai',
    providerId: 'openai',
  }).content,
  unrelatedJsonUserItem.content,
  'OpenAI provider context alone must not activate the Codex protocol adapter.',
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
  uri: 'drive://spaces/drive-space-1/nodes/drive-node-plan',
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
  true,
  'unknown non-system Session Item kinds must degrade visibly instead of being silently discarded.',
);
const unknownItemPresentation = resolveAgentSessionItemPresentation({
  ...transientItemView,
  id: 'agent-item-future-provider-event',
  role: 'tool',
  content: '',
  metadata: {
    agentItemKind: 'future_provider_event',
    agentItemStatus: 'completed',
  },
  name: undefined,
  tool_calls: undefined,
});
assert.deepEqual(
  unknownItemPresentation.blocks.map((block) => block.type),
  ['notice'],
  'an unknown empty event must retain a generic visible presentation block.',
);
assert.equal(
  unknownItemPresentation.blocks[0]?.type === 'notice'
    ? unknownItemPresentation.blocks[0].title
    : undefined,
  'Future provider event',
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

const codexNativeCall = {
  type: 'function_call',
  id: 'codex-call-item-1',
  call_id: 'codex-call-1',
  name: 'shell_command',
  arguments: '{"command":"pnpm typecheck"}',
};
const codexNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-native-call',
  kind: 'tool_call',
  status: 'pending',
  toolName: 'shell_command',
  toolCallId: 'codex-call-1',
  toolArguments: codexNativeCall,
  toolResult: undefined,
});
assert.equal(
  (codexNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'function_call',
  'Codex response items must reach the Codex protocol adapter without an arguments wrapper.',
);
assert.equal(
  (codexNativeToolView.tool_calls?.[0] as Record<string, unknown>).arguments,
  codexNativeCall.arguments,
);
const normalizedCodexCall = normalizeAgentSessionItemToolCalls(
  codexNativeToolView.tool_calls,
  { engineId: 'codex' },
)[0];
assert.equal(normalizedCodexCall?.id, 'codex-call-1');
assert.equal(normalizedCodexCall?.name, 'shell_command');
assert.equal(normalizedCodexCall?.command, 'pnpm typecheck');

const codexPlanUpdateView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-plan-update',
  toolName: 'update_plan',
  toolCallId: 'codex-plan-update-1',
  toolResult: {
    method: 'turn/plan/updated',
    params: {
      threadId: 'codex-thread-1',
      turnId: 'codex-turn-1',
      explanation: 'Keep protocol and presentation aligned.',
      plan: [
        { step: 'Inspect Codex protocol', status: 'completed' },
        { step: 'Repair transcript projection', status: 'inProgress' },
        { step: 'Verify provider history', status: 'pending' },
      ],
    },
  },
});
assert.equal(codexPlanUpdateView.role, 'assistant');
assert.equal(codexPlanUpdateView.content, 'Keep protocol and presentation aligned.');
assert.deepEqual(codexPlanUpdateView.taskProgress, {
  completed: 1,
  items: [
    { id: 'task-1', text: 'Inspect Codex protocol', status: 'completed' },
    { id: 'task-2', text: 'Repair transcript projection', status: 'running' },
    { id: 'task-3', text: 'Verify provider history', status: 'pending' },
  ],
  total: 3,
});

const codexFinalPlanView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-final-plan',
  toolName: 'provider_event',
  toolCallId: 'codex-final-plan-1',
  toolResult: {
    method: 'item/completed',
    params: {
      threadId: 'codex-thread-1',
      turnId: 'codex-turn-1',
      item: {
        id: 'codex-final-plan-1',
        type: 'plan',
        text: '1. Inspect protocol\n2. Repair projection\n3. Verify history',
      },
    },
  },
});
assert.match(codexFinalPlanView.content, /Inspect protocol/u);

const codexNativeMcpView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-native-mcp',
  toolName: 'provider_event',
  toolCallId: 'codex-mcp-1',
  toolResult: {
    method: 'item/completed',
    params: {
      item: {
        id: 'codex-mcp-1',
        type: 'mcpToolCall',
        server: 'docs',
        tool: 'search',
        arguments: { query: 'ThreadItem' },
        result: { content: [{ type: 'text', text: 'found' }] },
        status: 'completed',
        durationMs: 42,
      },
    },
  },
});
const normalizedCodexMcp = normalizeAgentSessionItemToolCalls(
  codexNativeMcpView.tool_calls,
  { engineId: 'codex' },
)[0];
assert.equal(normalizedCodexMcp?.serverName, 'docs');
assert.equal(normalizedCodexMcp?.name, 'search');
assert.equal(normalizedCodexMcp?.durationMs, 42);

const claudeNativeResult = {
  type: 'mcp_tool_result',
  tool_use_id: 'claude-call-1',
  content: [{ type: 'text', text: 'found' }],
};
const claudeNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-claude-native-result',
  toolName: 'mcp__docs__search',
  toolCallId: 'claude-call-1',
  toolResult: claudeNativeResult,
});
assert.equal(
  (claudeNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'mcp_tool_result',
  'Claude content blocks must reach the Claude protocol adapter without an output wrapper.',
);
assert.deepEqual(
  (claudeNativeToolView.tool_calls?.[0] as Record<string, unknown>).content,
  claudeNativeResult.content,
);
const normalizedClaudeResult = normalizeAgentSessionItemToolCalls(
  claudeNativeToolView.tool_calls,
  { engineId: 'claude-code' },
)[0];
assert.equal(normalizedClaudeResult?.id, 'claude-call-1');
assert.equal(normalizedClaudeResult?.name, 'search');
assert.equal(normalizedClaudeResult?.serverName, 'docs');
assert.match(normalizedClaudeResult?.output ?? '', /found/);

const claudeHookEvent = {
  type: 'system',
  subtype: 'hook_response',
  tool_use_id: 'claude-call-1',
  hook_name: 'post-tool',
  outcome: 'success',
  output: 'checked',
};
const claudeHookView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-claude-hook',
  kind: 'tool_call',
  toolName: 'post-tool',
  toolCallId: 'claude-call-1',
  toolArguments: claudeHookEvent,
  toolResult: claudeHookEvent,
});
const normalizedClaudeHook = normalizeAgentSessionItemToolCalls(
  claudeHookView.tool_calls,
  { engineId: 'claude-code' },
)[0];
assert.equal(normalizedClaudeHook?.id, 'claude-call-1');
assert.equal(normalizedClaudeHook?.name, 'post-tool');
assert.equal(normalizedClaudeHook?.status, 'success');
assert.match(normalizedClaudeHook?.output ?? '', /checked/);

const openCodeNativeTool = {
  type: 'tool',
  callID: 'opencode-call-1',
  tool: 'mcp__docs__search',
  state: {
    status: 'completed',
    input: { q: 'session items' },
    output: 'found',
  },
};
const openCodeNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-opencode-native-tool',
  kind: 'tool_call',
  toolName: 'mcp__docs__search',
  toolCallId: 'opencode-call-1',
  toolArguments: openCodeNativeTool,
  toolResult: openCodeNativeTool,
});
assert.equal(
  (openCodeNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'tool',
  'OpenCode parts must reach the OpenCode protocol adapter without an arguments wrapper.',
);
assert.deepEqual(
  (openCodeNativeToolView.tool_calls?.[0] as Record<string, unknown>).state,
  openCodeNativeTool.state,
);
const normalizedOpenCodeTool = normalizeAgentSessionItemToolCalls(
  openCodeNativeToolView.tool_calls,
  { engineId: 'opencode' },
)[0];
assert.equal(normalizedOpenCodeTool?.id, 'opencode-call-1');
assert.equal(normalizedOpenCodeTool?.name, 'mcp__docs__search');
assert.equal(normalizedOpenCodeTool?.status, 'success');
assert.equal(normalizedOpenCodeTool?.output, 'found');

const providerContentFixtures = [
  {
    engineId: 'opencode',
    itemId: 'agent-item-opencode-text-part',
    payload: {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'opencode-text-part-1',
          type: 'text',
          text: 'OPENCODE_VISIBLE_SENTINEL',
        },
      },
    },
    visibleText: 'OPENCODE_VISIBLE_SENTINEL',
  },
  {
    engineId: 'codex',
    itemId: 'agent-item-codex-agent-message',
    payload: {
      method: 'item/completed',
      params: {
        item: {
          id: 'codex-agent-message-1',
          type: 'agentMessage',
          text: 'CODEX_VISIBLE_SENTINEL',
        },
      },
    },
    visibleText: 'CODEX_VISIBLE_SENTINEL',
  },
  {
    engineId: 'claude-code',
    itemId: 'agent-item-claude-assistant-message',
    payload: {
      type: 'assistant',
      message: {
        id: 'claude-assistant-message-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'CLAUDE_VISIBLE_SENTINEL' }],
      },
    },
    visibleText: 'CLAUDE_VISIBLE_SENTINEL',
  },
  {
    engineId: 'gemini',
    itemId: 'agent-item-gemini-content-event',
    payload: {
      type: 'content',
      value: 'GEMINI_VISIBLE_SENTINEL',
    },
    visibleText: 'GEMINI_VISIBLE_SENTINEL',
  },
] as const;

for (const fixture of providerContentFixtures) {
  const providerContentView = toAgentSessionItemView({
    ...canonicalToolItem,
    itemId: fixture.itemId,
    toolName: 'provider_event',
    toolCallId: `${fixture.itemId}-call`,
    toolResult: fixture.payload,
  });
  assert.equal(
    providerContentView.role,
    'assistant',
    `${fixture.engineId} native assistant content must project to the assistant role.`,
  );
  assert.equal(providerContentView.content, fixture.visibleText);
  assert.equal(providerContentView.tool_calls, undefined);
  assert.equal(
    resolveAgentSessionItemPresentation(providerContentView, {
      engineId: fixture.engineId,
    }).blocks.some((block) =>
      block.type === 'markdown' && block.content.includes(fixture.visibleText),
    ),
    true,
    `${fixture.engineId} native assistant content must have a visible transcript block.`,
  );
}

const openCodeOrphanDeltaItem = {
  ...canonicalToolItem,
  itemId: 'agent-item-opencode-text-delta',
  toolName: 'provider_event',
  toolCallId: 'agent-item-opencode-text-delta-call',
  toolResult: {
    type: 'message.part.delta',
    properties: {
      sessionID: 'opencode-session-1',
      messageID: 'opencode-message-1',
      partID: 'opencode-text-part-1',
      field: 'text',
      delta: 'OPENCODE_DELTA_SENTINEL',
    },
  },
};
assert.deepEqual(
  toAgentSessionTranscriptItemViews([openCodeOrphanDeltaItem], { engineId: 'opencode' }),
  [],
  'An OpenCode part delta without a loaded snapshot must not create an independent transcript row.',
);

const providerStreamingContentFixtures = [
  {
    engineId: 'codex',
    itemId: 'agent-item-codex-agent-message-delta',
    payload: {
      method: 'item/agentMessage/delta',
      params: {
        threadId: 'codex-thread-1',
        turnId: 'codex-turn-1',
        itemId: 'codex-agent-message-1',
        delta: 'CODEX_DELTA_SENTINEL',
      },
    },
    visibleText: 'CODEX_DELTA_SENTINEL',
  },
  {
    engineId: 'claude-code',
    itemId: 'agent-item-claude-stream-event',
    payload: {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'CLAUDE_DELTA_SENTINEL',
        },
      },
    },
    visibleText: 'CLAUDE_DELTA_SENTINEL',
  },
  {
    engineId: 'gemini',
    itemId: 'agent-item-gemini-jsonl-message',
    payload: {
      type: 'message',
      timestamp: '2026-01-01T00:00:00.000Z',
      role: 'assistant',
      content: 'GEMINI_JSONL_SENTINEL',
      delta: true,
    },
    visibleText: 'GEMINI_JSONL_SENTINEL',
  },
] as const;

for (const fixture of providerStreamingContentFixtures) {
  const providerContentView = toAgentSessionItemView({
    ...canonicalToolItem,
    itemId: fixture.itemId,
    toolName: 'provider_event',
    toolCallId: `${fixture.itemId}-call`,
    toolResult: fixture.payload,
  });
  assert.equal(providerContentView.role, 'assistant');
  assert.equal(providerContentView.content, fixture.visibleText);
  assert.equal(providerContentView.tool_calls, undefined);
  assert.equal(
    resolveAgentSessionItemPresentation(providerContentView, {
      engineId: fixture.engineId,
    }).blocks.some((block) =>
      block.type === 'markdown' && block.content.includes(fixture.visibleText),
    ),
    true,
    `${fixture.engineId} streaming protocol envelopes must remain visible.`,
  );
}

const codexReasoningDeltaView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-reasoning-delta',
  toolName: 'provider_event',
  toolCallId: 'codex-reasoning-delta-1',
  toolResult: {
    method: 'item/reasoning/summaryTextDelta',
    params: {
      threadId: 'codex-thread-1',
      turnId: 'codex-turn-1',
      itemId: 'codex-reasoning-1',
      delta: 'CODEX_REASONING_DELTA_SENTINEL',
      summaryIndex: 0,
    },
  },
});
assert.equal(
  codexReasoningDeltaView.reasoning?.[0]?.summary,
  'CODEX_REASONING_DELTA_SENTINEL',
  'Codex JSON-RPC reasoning deltas must project as structured reasoning.',
);

const providerReasoningFixtures = [
  {
    engineId: 'opencode',
    itemId: 'agent-item-opencode-reasoning-part',
    payload: {
      part: {
        id: 'opencode-reasoning-1',
        type: 'reasoning',
        text: 'OPENCODE_REASONING_SENTINEL',
      },
    },
    summary: 'OPENCODE_REASONING_SENTINEL',
  },
  {
    engineId: 'codex',
    itemId: 'agent-item-codex-reasoning-item',
    payload: {
      item: {
        id: 'codex-reasoning-1',
        type: 'reasoning',
        summary: ['CODEX_REASONING_SENTINEL'],
        content: [],
      },
    },
    summary: 'CODEX_REASONING_SENTINEL',
  },
  {
    engineId: 'claude-code',
    itemId: 'agent-item-claude-thinking-block',
    payload: {
      type: 'assistant',
      message: {
        id: 'claude-thinking-message-1',
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'CLAUDE_REASONING_SENTINEL' }],
      },
    },
    summary: 'CLAUDE_REASONING_SENTINEL',
  },
  {
    engineId: 'gemini',
    itemId: 'agent-item-gemini-thought-event',
    payload: {
      type: 'thought',
      value: {
        subject: 'Gemini plan',
        description: 'GEMINI_REASONING_SENTINEL',
      },
    },
    summary: 'GEMINI_REASONING_SENTINEL',
  },
] as const;

for (const fixture of providerReasoningFixtures) {
  const providerReasoningView = toAgentSessionItemView({
    ...canonicalToolItem,
    itemId: fixture.itemId,
    toolName: 'provider_event',
    toolCallId: `${fixture.itemId}-call`,
    toolResult: fixture.payload,
  });
  assert.equal(providerReasoningView.role, 'assistant');
  assert.equal(providerReasoningView.content, '');
  assert.equal(providerReasoningView.reasoning?.[0]?.summary, fixture.summary);
  assert.equal(
    resolveAgentSessionItemPresentation(providerReasoningView, {
      engineId: fixture.engineId,
    }).blocks.some((block) =>
      block.type === 'reasoning'
      && block.items.some((item) => item.summary === fixture.summary),
    ),
    true,
    `${fixture.engineId} native reasoning must have a visible structured disclosure.`,
  );
}

const claudeMixedContentView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-claude-mixed-content',
  toolName: 'provider_event',
  toolCallId: 'claude-mixed-content-1',
  toolResult: {
    type: 'assistant',
    message: {
      id: 'claude-mixed-content-1',
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'Inspect the requested file.' },
        { type: 'text', text: 'The file is ready.' },
        {
          type: 'tool_use',
          id: 'claude-read-1',
          name: 'Read',
          input: { file_path: 'src/index.ts' },
        },
      ],
    },
  },
});
assert.equal(claudeMixedContentView.content, 'The file is ready.');
assert.equal(claudeMixedContentView.reasoning?.[0]?.summary, 'Inspect the requested file.');
assert.equal(claudeMixedContentView.tool_calls?.length, 1);
assert.equal(
  normalizeAgentSessionItemToolCalls(
    claudeMixedContentView.tool_calls,
    { engineId: 'claude-code' },
  )[0]?.name,
  'Read',
  'Claude mixed assistant blocks must preserve nested tool use beside text and thinking.',
);

const openCodeFilePartView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-opencode-file-part',
  toolName: 'provider_event',
  toolCallId: 'opencode-file-part-1',
  toolResult: {
    part: {
      id: 'opencode-file-part-1',
      type: 'file',
      mime: 'image/png',
      filename: 'opencode-preview.png',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
      source: {
        type: 'file',
        path: 'src/opencode-preview.png',
        text: { value: 'preview', start: 0, end: 7 },
      },
    },
  },
});
assert.equal(openCodeFilePartView.role, 'assistant');
assert.equal(openCodeFilePartView.resources?.[0]?.kind, 'image');
assert.equal(openCodeFilePartView.resources?.[0]?.name, 'opencode-preview.png');
assert.equal(openCodeFilePartView.resources?.[0]?.path, 'src/opencode-preview.png');

const openCodeToolAttachmentView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-opencode-tool-attachment',
  toolName: 'provider_event',
  toolCallId: 'opencode-tool-attachment-1',
  toolResult: {
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'opencode-tool-attachment-1',
        type: 'tool',
        callID: 'opencode-tool-attachment-1',
        tool: 'read',
        state: {
          status: 'completed',
          input: { filePath: 'src/generated.png' },
          output: 'Generated preview.',
          attachments: [{
            id: 'opencode-tool-image-1',
            type: 'file',
            mime: 'image/png',
            filename: 'generated.png',
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
          }],
          time: { start: 1, end: 2 },
        },
      },
    },
  },
});
assert.equal(openCodeToolAttachmentView.tool_calls?.length, 1);
assert.equal(openCodeToolAttachmentView.resources?.[0]?.kind, 'image');
assert.equal(openCodeToolAttachmentView.resources?.[0]?.name, 'generated.png');

const codexImageView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-image-view',
  toolName: 'provider_event',
  toolCallId: 'codex-image-view-1',
  toolResult: {
    method: 'item/completed',
    params: {
      threadId: 'codex-thread-1',
      turnId: 'codex-turn-1',
      item: {
        id: 'codex-image-view-1',
        type: 'imageView',
        path: 'E:\\workspace\\codex-preview.png',
      },
    },
  },
});
assert.equal(codexImageView.resources?.[0]?.kind, 'image');
assert.equal(codexImageView.resources?.[0]?.path, 'E:\\workspace\\codex-preview.png');

const geminiToolRequestView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-gemini-tool-request',
  toolName: 'provider_event',
  toolCallId: 'gemini-tool-request-1',
  toolResult: {
    type: 'tool_call_request',
    value: {
      callId: 'gemini-tool-request-1',
      name: 'read_file',
      args: { path: 'README.md' },
    },
  },
});
assert.equal(geminiToolRequestView.tool_calls?.length, 1);
assert.equal(
  normalizeAgentSessionItemToolCalls(
    geminiToolRequestView.tool_calls,
    { engineId: 'gemini' },
  )[0]?.name,
  'read_file',
  'Gemini tool request events must use the shared structured tool renderer.',
);

const boundedProviderPayloadView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-bounded-provider-payload',
  toolName: 'provider_event',
  toolCallId: 'bounded-provider-payload-1',
  toolResult: {
    part: Array.from({ length: 256 }, (_, index) => ({
      id: `provider-text-${index}`,
      type: 'text',
      text: `provider text ${index}`,
    })),
  },
});
assert.equal(boundedProviderPayloadView.content.split('\n\n').length, 32);
assert.doesNotMatch(
  boundedProviderPayloadView.content,
  /provider text 200/u,
  'provider projection must bound queued values and retained text before React rendering.',
);

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

const codexMultiCommandResult = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-multi-command-result',
  toolName: 'provider_event',
  toolCallId: 'codex-command-execution-1',
  toolResult: {
    id: 'codex-command-execution-1',
    type: 'commandExecution',
    command: 'pnpm typecheck; pnpm test -- --runInBand',
    commandActions: [
      { type: 'unknown', command: 'pnpm typecheck' },
      { type: 'unknown', command: 'pnpm test -- --runInBand' },
    ],
    cwd: 'E:/sdkwork-space/sdkwork-birdcoder',
    processId: 'codex-command-process-1',
    status: 'completed',
    aggregatedOutput: 'TypeScript check passed.\nAll focused tests passed.',
    exitCode: 0,
    durationMs: 42,
  },
});
const codexMultiCommandTranscript = composeAgentSessionTranscriptActivity(
  [codexMultiCommandResult],
  { engineId: 'codex' },
);
const codexMultiCommandActivity = resolveAgentTurnActivityPresentation(
  codexMultiCommandTranscript,
  codexMultiCommandTranscript[0]!,
  { engineId: 'codex' },
);
assert.deepEqual(
  codexMultiCommandActivity?.commands.map(({ command, output, parentExecutionId }) => ({
    command,
    output,
    parentExecutionId,
  })),
  [
    {
      command: 'pnpm typecheck',
      output: 'TypeScript check passed.',
      parentExecutionId: 'codex-command-execution-1',
    },
    {
      command: 'pnpm test -- --runInBand',
      output: 'All focused tests passed.',
      parentExecutionId: 'codex-command-execution-1',
    },
  ],
  'A completed Codex commandExecution must preserve correlated output for every expanded command row.',
);

const openCodeSnapshotDiffView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-opencode-snapshot-diff',
  toolResult: {
    message: {
      summary: {
        diffs: [{
          file: 'src/opencode-message.tsx',
          patch: '@@ -1 +1 @@\n-before\n+after',
          additions: 1,
          deletions: 1,
          status: 'modified',
        }],
      },
    },
  },
});
assert.deepEqual(openCodeSnapshotDiffView.fileChanges, [{
  path: 'src/opencode-message.tsx',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexAppServerFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-file-change',
  toolResult: {
    method: 'item/completed',
    params: {
      threadId: 'thread-codex-1',
      turnId: 'turn-codex-1',
      item: {
        id: 'codex-file-change-1',
        type: 'fileChange',
        status: 'completed',
        changes: [{
          path: 'src/codex-app-server.ts',
          kind: { type: 'update', movePath: null },
          diff: '@@ -1 +1 @@\n-before\n+after',
        }],
      },
    },
  },
});
assert.deepEqual(codexAppServerFileChangeView.fileChanges, [{
  path: 'src/codex-app-server.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexAppServerCreatedFileView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-created-file',
  toolResult: {
    item: {
      id: 'codex-file-change-created-1',
      type: 'fileChange',
      status: 'completed',
      changes: [{
        path: 'src/codex-created-v2.ts',
        kind: { type: 'add' },
        diff: 'export const created = true;\n',
      }],
    },
  },
});
assert.deepEqual(codexAppServerCreatedFileView.fileChanges, [{
  path: 'src/codex-created-v2.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const codexAppServerMovedFileView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-moved-file',
  toolResult: {
    item: {
      id: 'codex-file-change-moved-1',
      type: 'fileChange',
      status: 'completed',
      changes: [{
        path: 'src/codex-before-move.ts',
        kind: { type: 'update', movePath: 'src/codex-after-move.ts' },
        diff: '@@ -1 +1 @@\n-before\n+after',
      }],
    },
  },
});
assert.deepEqual(codexAppServerMovedFileView.fileChanges, [{
  path: 'src/codex-after-move.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'R',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexCoreFileChangeMapView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-core-file-change-map',
  toolResult: {
    type: 'patch',
    changes: {
      'src/codex-created.ts': {
        type: 'add',
        content: 'export const created = true;\n',
      },
    },
  },
});
assert.deepEqual(codexCoreFileChangeMapView.fileChanges, [{
  path: 'src/codex-created.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const geminiCliFileDiffView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-gemini-cli-file-diff',
  toolResult: {
    response: {
      callId: 'gemini-write-file-1',
      display: {
        name: 'WriteFile',
        result: {
          type: 'diff',
          path: 'src/gemini-cli.ts',
          beforeText: 'const state = "before";\n',
          afterText: 'const state = "after";\n',
        },
      },
      resultDisplay: {
        fileDiff: '@@ -1 +1 @@\n-const state = "before";\n+const state = "after";',
        fileName: 'gemini-cli.ts',
        filePath: 'src/gemini-cli.ts',
        originalContent: 'const state = "before";\n',
        newContent: 'const state = "after";\n',
        diffStat: {
          model_added_lines: 1,
          model_removed_lines: 1,
        },
      },
    },
  },
});
assert.deepEqual(geminiCliFileDiffView.fileChanges, [{
  path: 'src/gemini-cli.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-const state = "before";\n+const state = "after";',
  content: 'const state = "after";\n',
  originalContent: 'const state = "before";\n',
}]);

const claudeAgentSdkEditView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-claude-agent-sdk-edit',
  toolResult: {
    type: 'user',
    parent_tool_use_id: null,
    tool_use_result: {
      filePath: 'src/claude-agent-sdk.ts',
      oldString: 'before',
      newString: 'after',
      originalFile: 'export const state = "before";\n',
      structuredPatch: [{
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: ['-export const state = "before";', '+export const state = "after";'],
      }],
      userModified: false,
      replaceAll: false,
      gitDiff: {
        filename: 'src/claude-agent-sdk.ts',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: '@@ -1 +1 @@\n-export const state = "before";\n+export const state = "after";',
      },
    },
  },
});
assert.deepEqual(claudeAgentSdkEditView.fileChanges, [{
  path: 'src/claude-agent-sdk.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-export const state = "before";\n+export const state = "after";',
  content: 'export const state = "after";\n',
  originalContent: 'export const state = "before";\n',
}]);

const claudeAgentSdkWriteView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-claude-agent-sdk-write',
  toolResult: {
    toolUseResult: {
      type: 'create',
      filePath: 'src/claude-created.ts',
      content: 'export const created = true;\n',
      originalFile: null,
      structuredPatch: [{
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: ['+export const created = true;'],
      }],
    },
  },
});
assert.deepEqual(claudeAgentSdkWriteView.fileChanges, [{
  path: 'src/claude-created.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  diff: '@@ -0,0 +1,1 @@\n+export const created = true;',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const snakeCaseFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-snake-case-file-change',
  toolResult: {
    data: {
      file_changes: {
        primary: {
          file_path: 'src/provider-adapter.ts',
          lines_added: 2,
          lines_deleted: 1,
          original_content: 'before\n',
          new_content: '',
          unified_diff: '@@ -1 +0,0 @@\n-before',
          update_status: 'deleted',
        },
      },
    },
  },
});
assert.deepEqual(snakeCaseFileChangeView.fileChanges, [{
  path: 'src/provider-adapter.ts',
  additions: 2,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'D',
  diff: '@@ -1 +0,0 @@\n-before',
  content: '',
  originalContent: 'before\n',
}]);

const beforeAfterFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-before-after-file-change',
  toolResult: {
    changes: [{
      path: 'src/gemini-message.ts',
      before: 'old value',
      after: 'new value',
      status: 'added',
    }],
  },
});
assert.deepEqual(beforeAfterFileChangeView.fileChanges, [{
  path: 'src/gemini-message.ts',
  additions: 0,
  deletions: 0,
  lineImpactKnown: false,
  updateStatus: 'A',
  content: 'new value',
  originalContent: 'old value',
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
const commandActivityItem = commandTranscript.find((item) => item.role === 'tool');
assert.ok(commandActivityItem);
const commandActivityView = resolveAgentSessionItemPresentation(commandActivityItem, {
  activitySummary: commandActivity,
  engineId: 'codex',
});
const commandActivityBlocks = commandActivityView.blocks.filter(
  (block) => block.type === 'activity',
);
assert.equal(
  commandActivityBlocks.length,
  1,
  'A tool lifecycle with commands and file changes must render as one activity disclosure.',
);
assert.equal(commandActivityBlocks[0]?.commands.length, 1);
assert.equal(commandActivityBlocks[0]?.fileChanges.length, 1);

const providerTodoFixtures = [
  {
    engineId: 'codex',
    toolCall: {
      id: 'codex-plan-1',
      type: 'todo_list',
      items: [
        { text: 'Inspect message protocol parts', status: 'completed' },
        { text: 'Align the shared renderer', status: 'in_progress' },
        { text: 'Verify compact layout', status: 'pending' },
      ],
    },
  },
  {
    engineId: 'opencode',
    toolCall: {
      type: 'tool',
      part: {
        id: 'opencode-plan-1',
        type: 'tool',
        tool: 'todowrite',
        state: {
          status: 'completed',
          input: {
            todos: [
              { content: 'Inspect message protocol parts', status: 'completed' },
              { content: 'Align the shared renderer', status: 'in_progress' },
              { content: 'Verify compact layout', status: 'pending' },
            ],
          },
        },
      },
    },
  },
  {
    engineId: 'claude-code',
    toolCall: {
      contentBlock: {
        id: 'claude-plan-1',
        type: 'tool_use',
        name: 'TodoWrite',
        input: {
          todos: [
            { content: 'Inspect message protocol parts', status: 'completed' },
            { content: 'Align the shared renderer', status: 'in_progress' },
            { content: 'Verify compact layout', status: 'pending' },
          ],
        },
      },
    },
  },
  {
    engineId: 'gemini',
    toolCall: {
      id: 'gemini-plan-1',
      type: 'tool_use',
      tool_id: 'gemini-plan-1',
      tool_name: 'write_todos',
      parameters: {
        tasks: [
          { description: 'Inspect message protocol parts', status: 'completed' },
          { description: 'Align the shared renderer', status: 'running' },
          { description: 'Verify compact layout', status: 'pending' },
        ],
      },
      status: 'completed',
    },
  },
] as const;

for (const fixture of providerTodoFixtures) {
  const presentation = resolveAgentSessionItemPresentation({
    ...transientItemView,
    id: `${fixture.engineId}-todo-item`,
    content: '',
    tool_calls: [fixture.toolCall],
  }, { engineId: fixture.engineId });
  const taskProgressBlock = presentation.blocks.find((block) => block.type === 'task-progress');
  assert.ok(
    taskProgressBlock && taskProgressBlock.type === 'task-progress',
    `${fixture.engineId} todo updates must project into the shared task progress block.`,
  );
  assert.deepEqual(
    taskProgressBlock.progress.items.map((item) => ({ status: item.status, text: item.text })),
    [
      { status: 'completed', text: 'Inspect message protocol parts' },
      { status: 'running', text: 'Align the shared renderer' },
      { status: 'pending', text: 'Verify compact layout' },
    ],
  );
  assert.equal(taskProgressBlock.progress.completed, 1);
  assert.equal(taskProgressBlock.progress.total, 3);
  assert.equal(
    presentation.blocks.some((block) =>
      block.type === 'tool-calls'
      && block.calls.some((call) => /todo|plan/u.test(call.name.toLowerCase())),
    ),
    false,
    `${fixture.engineId} todo payloads must not render a duplicate generic tool card.`,
  );
}

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

const exactIdContentUpdate = deduplicateAgentSessionItemViews([
  {
    ...completedUserItem,
    id: 'agent-item-content-update',
    content: 'Original authority content.',
  },
  {
    ...unrelatedProvisionalAssistantItem,
    id: '',
    content: 'Initialize the logical index.',
  },
  {
    ...completedUserItem,
    id: 'agent-item-content-update',
    content: 'Updated authority content.',
  },
  {
    ...provisionalUserItem,
    content: 'Original authority content.',
  },
  {
    ...provisionalUserItem,
    content: 'Updated authority content.',
  },
]);
assert.deepEqual(
  exactIdContentUpdate.map((item) => ({ id: item.id, content: item.content })),
  [
    {
      id: 'agent-item-content-update',
      content: 'Updated authority content.',
    },
    {
      id: '',
      content: 'Initialize the logical index.',
    },
    {
      id: '',
      content: 'Original authority content.',
    },
  ],
  'exact-id updates must refresh logical indexes and provisional items must not erase a canonical id.',
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

const boundedFileChangeCollectionView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-bounded-file-changes',
  toolResult: {
    changes: Array.from(
      { length: MAX_AGENT_SESSION_FILE_CHANGES + 32 },
      (_, index) => ({ path: `src/generated-${index}.ts`, status: 'modified' }),
    ),
  },
});
assert.equal(
  boundedFileChangeCollectionView.fileChanges?.length,
  MAX_AGENT_SESSION_FILE_CHANGES,
  'Provider file-change arrays must be bounded before projection creates retained view models.',
);

const oversizedFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-oversized-file-change',
  toolResult: {
    changes: [{
      path: 'src/oversized.ts',
      status: 'modified',
      before: 'before',
      after: 'x'.repeat(MAX_FILE_CHANGE_TEXT_CHARACTERS + 1),
    }],
  },
});
assert.deepEqual(oversizedFileChangeView.fileChanges, [{
  path: 'src/oversized.ts',
  additions: 0,
  deletions: 0,
  lineImpactKnown: false,
  updateStatus: 'M',
}], 'Oversized before/after content must be dropped atomically so it cannot be rendered or restored.');

console.log('agent session item view contract passed.');
