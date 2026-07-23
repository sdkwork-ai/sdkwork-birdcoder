import assert from 'node:assert/strict';

import {
  MAX_CHAT_MESSAGE_REASONING_ITEMS,
  MAX_CHAT_MESSAGE_REASONING_SUMMARY_CHARACTERS,
  mergeChatMessageReasoning,
  normalizeChatMessageReasoning,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-reasoning.ts';
import { resolveMessageCopyContent } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-activity-view.ts';
import { deduplicateAgentSessionItemViews } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import { resolveChatMessageView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';

const PRIVATE_THOUGHT_SENTINEL = 'PRIVATE_CHAIN_OF_THOUGHT_SENTINEL_27d912';

const distinctReasoningMessages = deduplicateAgentSessionItemViews([
  {
    id: 'reasoning-only-one',
    sessionId: 'reasoning-dedup-session',
    turnId: 'reasoning-dedup-turn',
    role: 'assistant' as const,
    content: '',
    reasoning: [{ id: 'reasoning-r1', summary: 'First provider summary.' }],
    createdAt: '2026-07-20T01:00:00.000Z',
  },
  {
    id: 'reasoning-only-two',
    sessionId: 'reasoning-dedup-session',
    turnId: 'reasoning-dedup-turn',
    role: 'assistant' as const,
    content: '',
    reasoning: [{ id: 'reasoning-r2', summary: 'Second provider summary.' }],
    createdAt: '2026-07-20T01:00:01.000Z',
  },
]);
assert.deepEqual(
  distinctReasoningMessages.map((message) => message.reasoning?.[0]?.id),
  ['reasoning-r1', 'reasoning-r2'],
  'Distinct reasoning-only records in one provider turn must not overwrite each other.',
);

const updatedReasoningMessage = deduplicateAgentSessionItemViews([
  distinctReasoningMessages[0]!,
  {
    ...distinctReasoningMessages[0]!,
    reasoning: [{ id: 'reasoning-r1', summary: 'Updated first provider summary.' }],
  },
]);
assert.equal(updatedReasoningMessage.length, 1);
assert.equal(
  updatedReasoningMessage[0]?.reasoning?.[0]?.summary,
  'Updated first provider summary.',
  'The same canonical reasoning id must accept an authoritative summary update.',
);

const mergedReasoningMessage = deduplicateAgentSessionItemViews([
  distinctReasoningMessages[0]!,
  {
    ...distinctReasoningMessages[0]!,
    reasoning: [{ id: 'reasoning-r3', summary: 'Additional provider summary.' }],
  },
]);
assert.deepEqual(
  mergedReasoningMessage[0]?.reasoning?.map((item) => item.id),
  ['reasoning-r1', 'reasoning-r3'],
  'Duplicate message records must merge distinct reasoning ids in provider order.',
);

const projected = normalizeChatMessageReasoning([
  {
    id: 'reasoning-1',
    title: 'Planning',
    summary: 'Inspect the provider contracts.',
    createdAt: '2026-07-20T10:00:00+08:00',
    startedAt: '2026-07-20T10:00:00+08:00',
    completedAt: '2026-07-20T10:00:01+08:00',
    durationMs: 1_000.9,
    content: PRIVATE_THOUGHT_SENTINEL,
    signature: PRIVATE_THOUGHT_SENTINEL,
    providerEnvelope: { raw: PRIVATE_THOUGHT_SENTINEL },
  },
]);

assert.deepEqual(projected, [{
  id: 'reasoning-1',
  summary: 'Inspect the provider contracts.',
  title: 'Planning',
  createdAt: '2026-07-20T02:00:00.000Z',
  startedAt: '2026-07-20T02:00:00.000Z',
  completedAt: '2026-07-20T02:00:01.000Z',
  durationMs: 1_000,
}]);
assert.doesNotMatch(
  JSON.stringify(projected),
  new RegExp(PRIVATE_THOUGHT_SENTINEL, 'u'),
  'Private thought bodies, signatures, and provider envelopes must not cross the projector.',
);

const bounded = normalizeChatMessageReasoning([
  {
    id: 'oversized',
    summary: 'x'.repeat(MAX_CHAT_MESSAGE_REASONING_SUMMARY_CHARACTERS + 100),
  },
  ...Array.from({ length: 40 }, (_, index) => ({
    id: `reasoning-${index + 2}`,
    summary: `Summary ${index + 2}`,
  })),
]);
assert.equal(bounded.length, MAX_CHAT_MESSAGE_REASONING_ITEMS);
assert.equal(
  bounded[0]?.summary.length,
  MAX_CHAT_MESSAGE_REASONING_SUMMARY_CHARACTERS,
  'Reasoning summaries must have a fixed per-item character budget.',
);

assert.deepEqual(
  normalizeChatMessageReasoning([
    { id: 'stable', summary: 'First summary' },
    { id: 'second', summary: 'Second summary' },
    { id: 'stable', summary: 'Updated summary' },
    { id: '', summary: 'Missing identity' },
    { id: 'missing-summary', content: PRIVATE_THOUGHT_SENTINEL },
  ]),
  [
    { id: 'stable', summary: 'Updated summary' },
    { id: 'second', summary: 'Second summary' },
  ],
  'Duplicate ids must retain first-seen order while accepting the latest safe summary.',
);

const fullReasoningSet = Array.from({ length: MAX_CHAT_MESSAGE_REASONING_ITEMS }, (_, index) => ({
  id: `full-${index + 1}`,
  summary: `Initial ${index + 1}`,
}));
const mergedAtCapacity = mergeChatMessageReasoning(
  fullReasoningSet,
  [
    { id: 'full-1', summary: 'Updated after capacity' },
    { id: 'new-after-capacity', summary: 'Must remain outside the fixed budget' },
  ],
);
assert.equal(mergedAtCapacity.length, MAX_CHAT_MESSAGE_REASONING_ITEMS);
assert.equal(mergedAtCapacity[0]?.summary, 'Updated after capacity');
assert.equal(mergedAtCapacity.some((item) => item.id === 'new-after-capacity'), false);

const reasoningOnlyMessage = {
  id: 'reasoning-only',
  sessionId: 'reasoning-session',
  role: 'assistant' as const,
  content: '',
  reasoning: projected,
  createdAt: '2026-07-20T02:00:00.000Z',
};
const reasoningOnlyView = resolveChatMessageView(reasoningOnlyMessage);
assert.deepEqual(
  reasoningOnlyView.blocks.map((block) => block.type),
  ['reasoning'],
  'A reasoning-summary-only assistant message must remain visible without empty Markdown.',
);
assert.equal(reasoningOnlyView.layoutHints.hasCollapsibleSections, true);
assert.equal(
  resolveMessageCopyContent(reasoningOnlyMessage),
  '',
  'Message-level copy must remain limited to authored answer content.',
);

const userReasoningView = resolveChatMessageView({
  ...reasoningOnlyMessage,
  id: 'user-provider-envelope',
  role: 'user',
});
assert.equal(
  userReasoningView.blocks.some((block) => block.type === 'reasoning'),
  false,
  'Provider reasoning summaries are valid only on agent-authored message roles.',
);

const publicSurfaceSnapshot = JSON.stringify({
  projected,
  reasoningOnlyView,
  replyCopy: resolveMessageCopyContent(reasoningOnlyMessage),
});
assert.doesNotMatch(publicSurfaceSnapshot, new RegExp(PRIVATE_THOUGHT_SENTINEL, 'u'));

console.log('chat message reasoning contract tests passed');
