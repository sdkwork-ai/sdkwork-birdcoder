import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import type {
  AgentSessionItemView,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  deduplicateAgentSessionItemViews,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  mergeAgentSessionProjectionForStore,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts';

const contractsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts',
    import.meta.url,
  ),
  'utf8',
);
const storeSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.doesNotMatch(
  contractsSource,
  /deduplicated\.findIndex/u,
  'Session Item deduplication must not scan the growing result for every item.',
);
assert.doesNotMatch(
  contractsSource,
  /indexesByKey\.set\(key, new Set\(\[index\]\)\)/u,
  'Unique Session Item match keys must not allocate one Set object per key.',
);
assert.match(
  contractsSource,
  /private logicalIndexesByKey:[\s\S]*?\| null = null;/u,
  'Content-bearing logical indexes must remain lazy for canonical authority windows.',
);
assert.doesNotMatch(
  storeSource,
  /latestMergedItems\.find|orderedIncomingItems\.some/u,
  'Ordered transcript merging must not use nested full-window scans.',
);
assert.match(
  storeSource,
  /buildAgentSessionItemMatchIndex\(latestMergedItems\)[\s\S]*buildAgentSessionItemMatchIndex\(orderedIncomingItems\)/u,
  'Ordered transcript merging must use indexed identity reconciliation in both directions.',
);

const ITEM_COUNT = 10_000;
const MAX_LINEAR_MERGE_DURATION_MS = 5_000;

function item(
  sequence: number,
  overrides: Partial<AgentSessionItemView> = {},
): AgentSessionItemView {
  return {
    id: `item-${sequence}`,
    sessionId: 'session.performance',
    turnId: `turn-${sequence}`,
    role: sequence % 2 === 0 ? 'assistant' : 'user',
    content: `Message ${sequence}`,
    createdAt: new Date(1_700_000_000_000 + sequence).toISOString(),
    ...overrides,
  };
}

function session(items: readonly AgentSessionItemView[]): AgentSessionView {
  return {
    id: 'session.performance',
    agentId: 'agent.performance',
    projectId: 'project.performance',
    title: 'Performance Session',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'codex-default',
    providerId: 'provider.openai',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    displayTime: 'Just now',
    items: [...items],
  };
}

const canonicalItems = Array.from({ length: ITEM_COUNT }, (_, index) => item(index));
const duplicateUpdates = Array.from({ length: 100 }, (_, index) => item(
  ITEM_COUNT - 100 + index,
  { content: `Updated message ${ITEM_COUNT - 100 + index}` },
));
const deduplicationStartedAt = performance.now();
const deduplicatedItems = deduplicateAgentSessionItemViews([
  ...canonicalItems,
  ...duplicateUpdates,
]);
const deduplicationDurationMs = performance.now() - deduplicationStartedAt;

assert.equal(deduplicatedItems.length, ITEM_COUNT);
assert.equal(deduplicatedItems.at(-1)?.content, `Updated message ${ITEM_COUNT - 1}`);
assert.ok(
  deduplicationDurationMs < MAX_LINEAR_MERGE_DURATION_MS,
  `Deduplicating ${ITEM_COUNT} canonical messages took ${deduplicationDurationMs.toFixed(1)}ms; expected an indexed linear path under ${MAX_LINEAR_MERGE_DURATION_MS}ms.`,
);

const existingItems = [
  ...canonicalItems.slice(ITEM_COUNT / 2),
  item(ITEM_COUNT, { content: 'Concurrent latest item' }),
];
const incomingItems = canonicalItems.map((candidate, index) =>
  index === ITEM_COUNT - 1
    ? { ...candidate, content: 'Authority-updated latest item' }
    : candidate,
);
const orderedMergeStartedAt = performance.now();
const mergedSession = mergeAgentSessionProjectionForStore(
  session(existingItems),
  session(incomingItems),
  { itemMergeMode: 'ordered-window' },
);
const orderedMergeDurationMs = performance.now() - orderedMergeStartedAt;

assert.equal(mergedSession.items.length, ITEM_COUNT + 1);
assert.equal(mergedSession.items[0]?.id, 'item-0');
assert.equal(
  mergedSession.items[ITEM_COUNT - 1]?.content,
  'Authority-updated latest item',
);
assert.equal(mergedSession.items.at(-1)?.content, 'Concurrent latest item');
assert.ok(
  orderedMergeDurationMs < MAX_LINEAR_MERGE_DURATION_MS,
  `Merging a ${ITEM_COUNT}-message ordered window took ${orderedMergeDurationMs.toFixed(1)}ms; expected an indexed linear path under ${MAX_LINEAR_MERGE_DURATION_MS}ms.`,
);

console.log(
  `agent Session Item merge performance contract passed (${deduplicationDurationMs.toFixed(1)}ms deduplicate, ${orderedMergeDurationMs.toFixed(1)}ms ordered merge).`,
);
