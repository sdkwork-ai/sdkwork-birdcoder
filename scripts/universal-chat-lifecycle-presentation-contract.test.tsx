import assert from 'node:assert/strict';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AgentSessionItemRecord } from '@sdkwork/agents-app-sdk';

import {
  composeAgentSessionTranscriptActivity,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-activity-presentation.ts';
import {
  normalizeAgentSessionItemLifecycleEvents,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-lifecycle.ts';
import {
  resolveAgentSessionItemPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import {
  normalizeAgentSessionItemToolCall,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts';
import {
  toAgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';
import {
  ChatLifecycleEvents,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/blocks/ChatLifecycleEvents.tsx';

const protocolFixtures = {
  opencode: {
    type: 'message.part.updated',
    properties: {
      part: {
        id: 'prt-opencode-finish',
        type: 'step-finish',
        reason: 'stop',
        cost: 0.012,
        tokens: {
          input: 1_200,
          output: 340,
          reasoning: 80,
          cache: { read: 500, write: 20 },
        },
      },
    },
  },
  codex: {
    method: 'item/completed',
    params: {
      item: {
        id: 'codex-turn-completed',
        type: 'turn.completed',
        usage: {
          input_tokens: 2_000,
          cached_input_tokens: 1_000,
          output_tokens: 200,
          reasoning_output_tokens: 50,
        },
      },
    },
  },
  claude: {
    id: 'claude-result',
    type: 'result',
    subtype: 'success',
    duration_ms: 3_500,
    total_cost_usd: 0.07,
    usage: { input_tokens: 100, output_tokens: 50 },
  },
  gemini: {
    type: 'chat_compressed',
    value: {
      originalTokenCount: 10_000,
      newTokenCount: 2_200,
      compressionStatus: 1,
    },
  },
} as const;

const normalized = normalizeAgentSessionItemLifecycleEvents(Object.values(protocolFixtures));
assert.deepEqual(
  normalized.map((event) => event.kind),
  ['completed', 'completed', 'completed', 'compacted'],
  'OpenCode, Codex, Claude Code, and Gemini lifecycle records must share one presentation contract.',
);
assert.deepEqual(normalized[0]?.usage, {
  inputTokens: 1_200,
  outputTokens: 340,
  reasoningTokens: 80,
  cacheReadTokens: 500,
  cacheWriteTokens: 20,
});
assert.deepEqual(normalized[1]?.usage, {
  inputTokens: 2_000,
  outputTokens: 200,
  reasoningTokens: 50,
  cacheReadTokens: 1_000,
});
assert.equal(normalized[2]?.durationMs, 3_500);
assert.equal(normalized[2]?.cost, 0.07);
assert.equal(normalized[3]?.detail, '10000 -> 2200 tokens');

const duplicateCodexLifecyclePresentation = resolveAgentSessionItemPresentation({
  id: 'codex-duplicate-lifecycle-item',
  role: 'assistant',
  content: '',
  lifecycleEvents: [{
    id: 'codex-turn-completed',
    kind: 'completed',
    usage: {
      inputTokens: 2_000,
      outputTokens: 200,
      reasoningTokens: 50,
      cacheReadTokens: 1_000,
    },
  }],
  tool_calls: [{
    item: {
      id: 'codex-turn-completed',
      type: 'turn.completed',
      usage: {
        input_tokens: 2_000,
        output_tokens: 200,
        reasoning_output_tokens: 50,
      },
    },
  }],
});
const duplicateCodexLifecycleBlock = duplicateCodexLifecyclePresentation.blocks.find(
  (block) => block.type === 'lifecycle',
);
assert.equal(duplicateCodexLifecycleBlock?.type, 'lifecycle');
assert.equal(
  duplicateCodexLifecycleBlock.events[0]?.usage?.cacheReadTokens,
  1_000,
  'A duplicate tool-call lifecycle record must not discard richer canonical usage fields.',
);

for (const fixture of Object.values(protocolFixtures)) {
  assert.equal(
    normalizeAgentSessionItemToolCall(fixture, 0),
    null,
    'Lifecycle records must not fall through to the generic tool-card renderer.',
  );
}

const geminiBlocked = normalizeAgentSessionItemLifecycleEvents([{
  type: 'agent_execution_blocked',
  value: {
    reason: 'Policy denied the requested action.',
    systemMessage: 'Review the command before continuing.',
  },
}])[0];
assert.equal(geminiBlocked?.kind, 'blocked');
assert.equal(geminiBlocked?.detail, 'Policy denied the requested action.');

const openCodeRetry = normalizeAgentSessionItemLifecycleEvents([{
  type: 'retry',
  attempt: 2,
  message: 'Rate limited by the provider.',
  next: 1_700_000_010_000,
}])[0];
assert.equal(openCodeRetry?.kind, 'retrying');
assert.equal(openCodeRetry?.detail, 'Rate limited by the provider.');
assert.equal(openCodeRetry?.retryAt, '2023-11-14T22:13:30.000Z');
assert.equal(
  normalizeAgentSessionItemLifecycleEvents([{ type: 'result', output: 'ordinary tool result' }]).length,
  0,
  'A generic result tool payload must not be mistaken for a Claude Code lifecycle record.',
);
assert.equal(
  normalizeAgentSessionItemLifecycleEvents([{
    type: 'tool_result',
    output: JSON.stringify(protocolFixtures.claude),
  }])[0]?.kind,
  'completed',
  'Serialized provider output must be structurally decoded through the lifecycle adapter.',
);

const baseItem: AgentSessionItemRecord = {
  tenantId: '1001',
  organizationId: '2001',
  sessionId: 'lifecycle-session',
  itemId: 'lifecycle-item',
  turnId: 'lifecycle-turn',
  kind: 'tool_result',
  content: null,
  contentType: 'application/json',
  status: 'completed',
  sequence: '1',
  toolName: 'provider_event',
  toolCallId: 'provider-event-1',
  toolResult: protocolFixtures.opencode,
  inputTokens: null,
  outputTokens: null,
  modelId: 'auto',
  providerId: 'opencode',
  driveRefs: [],
  createdBy: '3001',
  version: '1',
  createdAt: '2026-07-28T08:00:00.000Z',
  updatedAt: '2026-07-28T08:00:01.000Z',
  completedAt: '2026-07-28T08:00:01.000Z',
};
const itemView = toAgentSessionItemView(baseItem);
assert.equal(itemView.lifecycleEvents?.[0]?.kind, 'completed');
const presentation = resolveAgentSessionItemPresentation(itemView, { engineId: 'opencode' });
const lifecycleBlock = presentation.blocks.find((block) => block.type === 'lifecycle');
assert.equal(lifecycleBlock?.type, 'lifecycle');
assert.equal(
  presentation.blocks.some((block) => block.type === 'tool-calls'),
  false,
  'A provider lifecycle payload must be rendered once, not duplicated as a tool call.',
);

const claudeItemView = toAgentSessionItemView({
  ...baseItem,
  itemId: 'claude-lifecycle-item',
  toolCallId: 'claude-result',
  toolResult: protocolFixtures.claude,
});
assert.equal(claudeItemView.lifecycleEvents?.[0]?.kind, 'completed');
const claudeTaskItemView = toAgentSessionItemView({
  ...baseItem,
  itemId: 'claude-task-item',
  kind: 'tool_call',
  status: 'completed',
  sequence: '0',
  toolName: 'TodoWrite',
  toolCallId: 'claude-task',
  toolArguments: {
    todos: [{ content: 'Preserve lifecycle facts', status: 'in_progress' }],
  },
  toolResult: undefined,
});
const composedClaudeItems = composeAgentSessionTranscriptActivity(
  [claudeTaskItemView, claudeItemView],
  { engineId: 'claude-code' },
);
assert.equal(composedClaudeItems.length, 1);
assert.equal(
  composedClaudeItems[0]?.lifecycleEvents?.[0]?.kind,
  'completed',
  'Lifecycle facts must survive activity folding with an adjacent task tool in the same turn.',
);
const composedClaudePresentation = resolveAgentSessionItemPresentation(
  composedClaudeItems[0]!,
  { allItems: composedClaudeItems, engineId: 'claude-code' },
);
assert.equal(
  composedClaudePresentation.blocks.some((block) => block.type === 'task-progress'),
  true,
);
assert.equal(
  composedClaudePresentation.blocks.some((block) => block.type === 'lifecycle'),
  true,
);
const claudeFallbackPresentation = resolveAgentSessionItemPresentation({
  ...claudeItemView,
  lifecycleEvents: undefined,
  tool_calls: undefined,
}, { engineId: 'claude-code' });
assert.equal(
  claudeFallbackPresentation.blocks.some((block) => block.type === 'lifecycle'),
  true,
  'Provider lifecycle facts preserved in tool_calls must survive an older session projection.',
);
assert.equal(
  claudeFallbackPresentation.blocks.some((block) => block.type === 'tool-calls'),
  false,
  'Recovered lifecycle facts must not also render as a generic provider tool card.',
);

const disclosureScopeKey = 'lifecycle-session\u0001lifecycle-turn\u0001lifecycle';
const expandedKey = `${disclosureScopeKey}\u0001prt-opencode-finish`;
const lifecycleHtml = renderToStaticMarkup(
  <ChatLifecycleEvents
    copyMessageToClipboard={() => undefined}
    disclosureScopeKey={disclosureScopeKey}
    events={normalized.slice(0, 1)}
    expandedDisclosureKeys={new Set([expandedKey])}
    toggleDisclosure={() => undefined}
  />,
);
assert.match(lifecycleHtml, /data-chat-lifecycle-events="true"/u);
assert.match(lifecycleHtml, /data-chat-lifecycle-event="completed"/u);
assert.match(lifecycleHtml, /Turn completed/u);
assert.match(lifecycleHtml, /1\.6k tokens/u);
assert.match(lifecycleHtml, /\$0\.012/u);
assert.match(lifecycleHtml, /data-chat-lifecycle-details="true"/u);
assert.match(lifecycleHtml, /data-chat-lifecycle-usage="true"/u);
assert.match(lifecycleHtml, /Cache read/u);

console.log('Universal chat lifecycle presentation contract passed.');
