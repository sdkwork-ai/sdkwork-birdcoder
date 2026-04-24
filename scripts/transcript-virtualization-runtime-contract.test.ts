import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts',
  import.meta.url,
);

const {
  buildTranscriptPrefixHeights,
  reconcileTranscriptPrefixHeightsCache,
  resolveVirtualizedTranscriptWindow,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const virtualizationSource = readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui/src/components/useVirtualizedTranscriptWindow.ts',
    import.meta.url,
  ),
  'utf8',
);

const messages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-1',
    id: 'user-1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    codingSessionId: 'session-1',
    id: 'assistant-1',
    role: 'assistant',
    content: 'reply',
    createdAt: '2026-04-21T00:00:01.000Z',
  },
];

const prefixHeights = buildTranscriptPrefixHeights(
  messages,
  new Map<string, number>([['assistant-1', 400]]),
);

assert.deepEqual(
  prefixHeights,
  [0, 102, 502],
  'transcript height prefixes should respect measured heights without recalculating visible scroll state',
);

const windowedTranscript = resolveVirtualizedTranscriptWindow({
  isActive: true,
  messages,
  minVirtualizedMessageCount: 0,
  overscanPx: 0,
  prefixHeights,
  viewport: {
    clientHeight: 120,
    scrollTop: 380,
  },
});

assert.equal(windowedTranscript.visibleStartIndex, 1);
assert.deepEqual(
  windowedTranscript.visibleMessages.map((message: BirdCoderChatMessage) => message.id),
  ['assistant-1'],
  'scroll windowing should slice against precomputed height prefixes',
);
assert.equal(windowedTranscript.paddingTop, 102);
assert.equal(windowedTranscript.paddingBottom, 0);

const initialPrefixCache = reconcileTranscriptPrefixHeightsCache({
  measuredHeights: new Map<string, number>(),
  messages,
});
const updatedPrefixCache = reconcileTranscriptPrefixHeightsCache({
  invalidatedMessageIds: ['assistant-1'],
  measuredHeights: new Map<string, number>([['assistant-1', 400]]),
  messages,
  previousCache: initialPrefixCache,
});

assert.equal(
  updatedPrefixCache.entries[0],
  initialPrefixCache.entries[0],
  'transcript prefix cache should preserve unchanged prefix entries when only a later row measurement changes.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCacheRef = useRef<TranscriptPrefixHeightsCache \| null>\(null\);/,
  'useVirtualizedTranscriptWindow should keep a reusable transcript prefix-height cache ref.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCache = useMemo\(\s*\(\)\s*=>[\s\S]*reconcileTranscriptPrefixHeightsCache\(/s,
  'useVirtualizedTranscriptWindow should reconcile transcript height prefixes through the reusable cache helper.',
);

assert.match(
  virtualizationSource,
  /const windowedTranscript = useMemo\(\s*\(\)\s*=>\s*resolveVirtualizedTranscriptWindow\(/s,
  'useVirtualizedTranscriptWindow should resolve the visible range from the cached prefix heights',
);

assert.doesNotMatch(
  virtualizationSource,
  /const prefixHeights = useMemo\(\s*\(\)\s*=>\s*buildTranscriptPrefixHeights\(/s,
  'useVirtualizedTranscriptWindow must not rebuild full transcript height prefixes inline on every measurement update.',
);

console.log('transcript virtualization runtime contract passed.');
