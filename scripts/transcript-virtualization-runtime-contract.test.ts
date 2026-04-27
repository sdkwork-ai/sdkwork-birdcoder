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
  resolveTranscriptMessageKey,
  resolveVirtualizedTranscriptWindow,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const virtualizationSource = readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui/src/components/useVirtualizedTranscriptWindow.ts',
    import.meta.url,
  ),
  'utf8',
);
const universalChatSource = readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx',
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
const assistantMessageKey = resolveTranscriptMessageKey(messages[1], 1);

const prefixHeights = buildTranscriptPrefixHeights(
  messages,
  new Map<string, number>([[assistantMessageKey, 400]]),
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
  invalidatedMessageIds: [assistantMessageKey],
  measuredHeights: new Map<string, number>([[assistantMessageKey, 400]]),
  messages,
  previousCache: initialPrefixCache,
});

assert.equal(
  updatedPrefixCache.entries[0],
  initialPrefixCache.entries[0],
  'transcript prefix cache should preserve unchanged prefix entries when only a later row measurement changes.',
);

const duplicateIdMessages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-duplicates',
    id: 'provider-message',
    role: 'user',
    content: 'short duplicate id message',
    createdAt: '2026-04-21T00:00:00.000Z',
  },
  {
    codingSessionId: 'session-duplicates',
    id: 'provider-message',
    role: 'assistant',
    content: 'longer duplicate id message\nwith multiple lines\nand a separate measured height',
    createdAt: '2026-04-21T00:00:01.000Z',
  },
];
const firstDuplicateKey = resolveTranscriptMessageKey(duplicateIdMessages[0], 0);
const secondDuplicateKey = resolveTranscriptMessageKey(duplicateIdMessages[1], 1);

assert.notEqual(
  firstDuplicateKey,
  secondDuplicateKey,
  'transcript virtualization must include row position in its measurement key so duplicate provider message ids cannot overwrite each other.',
);

assert.deepEqual(
  buildTranscriptPrefixHeights(
    duplicateIdMessages,
    new Map<string, number>([
      [firstDuplicateKey, 120],
      [secondDuplicateKey, 360],
    ]),
  ),
  [0, 120, 480],
  'duplicate provider message ids must keep independent measured heights so spacer padding remains accurate.',
);

const taskProgressMessages: BirdCoderChatMessage[] = [
  {
    codingSessionId: 'session-progress',
    id: 'assistant-progress',
    role: 'assistant',
    content: 'progress',
    taskProgress: {
      total: 4,
      completed: 2,
    },
    createdAt: '2026-04-21T00:00:02.000Z',
  },
];
assert.deepEqual(
  buildTranscriptPrefixHeights(taskProgressMessages, new Map<string, number>()),
  [0, 194],
  'transcript height estimates must reserve vertical space for taskProgress rows so virtualized engine sessions do not overlap progress UI.',
);

assert.match(
  virtualizationSource,
  /const prefixHeightsCacheRef = useRef<TranscriptPrefixHeightsCache \| null>\(null\);/,
  'useVirtualizedTranscriptWindow should keep a reusable transcript prefix-height cache ref.',
);

assert.match(
  virtualizationSource,
  /measurementScopeKey[\s\S]*measurementScopeKeyRef[\s\S]*resizeObserverRef\.current\?\.unobserve[\s\S]*observedElementsRef\.current\.clear\(\);[\s\S]*messageIdByElementRef\.current\.clear\(\);[\s\S]*messageRefCallbackMapRef\.current\.clear\(\);[\s\S]*measuredHeightsRef\.current\.clear\(\);[\s\S]*prefixHeightsCacheRef\.current = null;/s,
  'useVirtualizedTranscriptWindow must fully reset session-scoped measurement refs so reused row keys cannot carry DOM observation state across sessions.',
);

assert.match(
  virtualizationSource,
  /const didResetMeasurementScope = measurementScopeKeyRef\.current !== normalizedMeasurementScopeKey;/,
  'useVirtualizedTranscriptWindow must detect session-scope changes before resolving the visible window so stale scrollTop cannot create a first-frame blank spacer.',
);

assert.match(
  virtualizationSource,
  /const effectiveViewport = didResetMeasurementScope\s*\?\s*\{\s*clientHeight: viewport\.clientHeight,\s*scrollTop: 0,\s*\}\s*: viewport;/s,
  'useVirtualizedTranscriptWindow must clamp the first visible window after a session switch to scrollTop 0 instead of reusing the previous session scroll position.',
);

assert.match(
  virtualizationSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*const scrollContainer = scrollContainerRef\.current;[\s\S]*scrollContainer\.scrollTop = 0;[\s\S]*\}, \[normalizedMeasurementScopeKey, scrollContainerRef\]\);/s,
  'useVirtualizedTranscriptWindow must reset the real transcript scroll container on scope changes so the next viewport publish cannot reintroduce the previous session scrollTop.',
);

assert.match(
  virtualizationSource,
  /viewport: effectiveViewport,/,
  'useVirtualizedTranscriptWindow must resolve the virtualized range from the session-reset viewport.',
);

assert.match(
  universalChatSource,
  /const messageMeasurementKey = resolveTranscriptMessageKey\(msg, messageIndex\);[\s\S]*const messageRenderKey = `\$\{sessionId\}\\u0001\$\{messageMeasurementKey\}`;[\s\S]*registerMessageElement\(messageMeasurementKey\);[\s\S]*messageRenderKey/s,
  'UniversalChat must include the visible session in React transcript row keys while keeping virtualization measurement keys row-scoped, so same-index same-id rows cannot reuse DOM across sessions.',
);

assert.match(
  universalChatSource,
  /sessionScopeKey\?: string;[\s\S]*const normalizedTranscriptScopeKey = sessionScopeKey\?\.trim\(\) \|\| normalizedSessionId;/s,
  'UniversalChat must accept a project/workspace-scoped transcript key so equal session ids from different projects do not reuse transcript virtualization state.',
);

assert.match(
  universalChatSource,
  /sessionId=\{normalizedTranscriptScopeKey\}/,
  'UniversalChat must pass the scoped transcript key into the transcript renderer instead of using the bare session id for row keys and measurement scope.',
);

assert.match(
  universalChatSource,
  /msg\.taskProgress/,
  'UniversalChat must render taskProgress payloads so cross-engine planner and reviewer progress survives all the way to the transcript UI.',
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
