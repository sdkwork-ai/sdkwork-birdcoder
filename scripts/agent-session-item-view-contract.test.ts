import assert from 'node:assert/strict';

import type { AgentSessionItemRecord } from '@sdkwork/agents-app-sdk';
import {
  areAgentSessionItemsLogicallyMatched,
  deduplicateAgentSessionItemViews,
  type AgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import { resolveAgentSessionItemPresentation } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import { toAgentSessionItemView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';

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
