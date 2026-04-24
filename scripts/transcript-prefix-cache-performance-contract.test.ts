import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/transcriptVirtualization.ts',
  import.meta.url,
);

const {
  reconcileTranscriptPrefixHeightsCache,
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

const initialCache = reconcileTranscriptPrefixHeightsCache({
  messages,
  measuredHeights: new Map<string, number>(),
});

const updatedCache = reconcileTranscriptPrefixHeightsCache({
  invalidatedMessageIds: ['assistant-1'],
  measuredHeights: new Map<string, number>([['assistant-1', 400]]),
  messages,
  previousCache: initialCache,
});

assert.equal(
  updatedCache.entries[0],
  initialCache.entries[0],
  'transcript prefix cache must preserve unchanged prefix entries when only later measured rows change.',
);

assert.deepEqual(
  updatedCache.prefixHeights,
  [0, 102, 502],
  'transcript prefix cache should only recompute the affected suffix while keeping the accumulated prefix correct.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCacheRef = useRef<TranscriptPrefixHeightsCache \| null>\(null\);/,
  'useVirtualizedTranscriptWindow must keep a reusable prefix-height cache ref across measurement updates.',
);

assert.match(
  virtualizationSource,
  /reconcileTranscriptPrefixHeightsCache\(\{/,
  'useVirtualizedTranscriptWindow must reconcile transcript prefix heights through the reusable cache helper.',
);

assert.doesNotMatch(
  virtualizationSource,
  /const prefixHeights = useMemo\(\s*\(\)\s*=>\s*buildTranscriptPrefixHeights\(/s,
  'useVirtualizedTranscriptWindow must not rebuild the full prefix-height array inline on every measurement update.',
);

console.log('transcript prefix cache performance contract passed.');
