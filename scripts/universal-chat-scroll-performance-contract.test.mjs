import assert from 'node:assert/strict';
import fs from 'node:fs';

const componentRoot = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/',
  import.meta.url,
);
const readComponent = (relativePath) => fs.readFileSync(
  new URL(relativePath, componentRoot),
  'utf8',
);

const universalChatSource = readComponent('UniversalChat.tsx');
const coordinatorSource = readComponent('useTranscriptScrollCoordinator.ts');
const progressiveTranscriptSource = readComponent('useProgressiveTranscriptWindow.ts');
const virtualizedTranscriptSource = readComponent('useVirtualizedTranscriptWindow.ts');

assert.match(
  universalChatSource,
  /const lastMessage = normalizedMessages\[normalizedMessages\.length - 1\];[\s\S]*latestMessageContentLength: lastMessageContentLength,[\s\S]*latestMessageIdentity: lastMessage[\s\S]*messageCount: normalizedMessages\.length,[\s\S]*scopeKey: normalizedTranscriptScopeKey,/s,
  'UniversalChat must drive following from semantic transcript updates so appended messages and streamed token growth share one coordinator path.',
);

assert.match(
  coordinatorSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*shouldStickToBottomRef\.current[\s\S]*performScrollOperation\(\{[\s\S]*kind: 'bottom',[\s\S]*scopeKey: normalizedScopeKey,[\s\S]*\}\);[\s\S]*\}, \[[\s\S]*latestMessageContentLength,[\s\S]*latestMessageIdentity,[\s\S]*messageCount,[\s\S]*normalizedScopeKey,/s,
  'Initial hydration, appends, and streamed growth must converge on the coordinator layout pass rather than independent effects.',
);

assert.match(
  coordinatorSource,
  /const scheduleOperation = useCallback\([\s\S]*pendingOperationRef\.current = operation;[\s\S]*scrollAnimationFrameRef\.current !== null[\s\S]*requestAnimationFrame\(flushScheduledOperation\)/s,
  'Resize and follow requests must coalesce into one pending operation behind a single animation-frame gate.',
);

assert.match(
  coordinatorSource,
  /resolveOperationPriority\(operation\) >= resolveOperationPriority\(pendingOperation\)/,
  'A queued anchor or explicit navigation request must not be overwritten by lower-priority bottom following.',
);

assert.match(
  coordinatorSource,
  /const resizeObserver = new ResizeObserver\([\s\S]*activeAnchorRef\.current[\s\S]*scheduleOperation\(\{[\s\S]*kind: 'anchor',[\s\S]*requestBottomFollow\(\);[\s\S]*resizeObserver\.observe\(scrollContainer\);[\s\S]*resizeObserver\.observe\(content\);/s,
  'One observer must preserve an active prepend anchor before considering bottom follow, and observe only the viewport plus content root.',
);

assert.match(
  coordinatorSource,
  /const markUserScrollIntent = \(\) => \{[\s\S]*cancelActiveAnchorRepair\(\);[\s\S]*cancelBottomFollow\(\);[\s\S]*clearScrollAnimationFrame\(\);[\s\S]*rebasePendingPrependForScroll\(\);/s,
  'Explicit user input must cancel queued writes and preserve the latest reading position for unfinished history.',
);

assert.match(
  coordinatorSource,
  /readTranscriptScrollClock\(\) - lastProgrammaticScroll\.at < 80[\s\S]*Math\.abs\(scrollContainer\.scrollTop - lastProgrammaticScroll\.top\) <= 1[\s\S]*return;/s,
  'Programmatic scroll events must be recognized so they cannot feed back into user-owned scroll state.',
);

assert.match(
  coordinatorSource,
  /const scheduleAnchorRead = useCallback\([\s\S]*scrollAnchorReadAnimationFrameRef\.current !== null[\s\S]*requestAnimationFrame\([\s\S]*flushScheduledAnchorRead/s,
  'Visual-anchor reads must have their own animation-frame gate so rapid native scroll events cause at most one row scan per frame.',
);
const nativeScrollHandler = coordinatorSource.match(
  /const handleScroll = \(\) => \{([\s\S]*?)\r?\n    \};\r?\n    const handlePointerDown/,
);
assert.ok(
  nativeScrollHandler,
  'The coordinator must keep native scroll handling in one inspectable listener.',
);
assert.match(
  nativeScrollHandler[1] ?? '',
  /rebasePendingPrependForScroll\(\);[\s\S]*updateStickiness\(\);[\s\S]*scheduleAnchorRead\(\);/s,
  'Native scroll events must cheaply rebase pending history before queuing visual-anchor capture.',
);
assert.doesNotMatch(
  nativeScrollHandler[1] ?? '',
  /updateReadingAnchor\(\)|captureTranscriptElementScrollAnchor\(/,
  'Native scroll events must not synchronously scan message rows or force their layout.',
);

const coordinatorWrites = coordinatorSource.match(/scrollContainer\.scrollTop\s*=/gu) ?? [];
assert.equal(
  coordinatorWrites.length,
  1,
  'The coordinator must retain one guarded DOM write site regardless of how many update sources request scrolling.',
);

for (const [name, source] of [
  ['UniversalChat', universalChatSource],
  ['progressive transcript', progressiveTranscriptSource],
  ['virtualized transcript', virtualizedTranscriptSource],
]) {
  assert.doesNotMatch(
    source,
    /scrollContainer\.scrollTop\s*=/u,
    `${name} must not compete with the coordinator for transcript scroll writes.`,
  );
}

assert.doesNotMatch(
  `${universalChatSource}\n${coordinatorSource}`,
  /MutationObserver|scrollIntoView|TRANSCRIPT_SCROLL_SETTLEMENT_FRAME_LIMIT|settleTranscriptBottomScroll/u,
  'Transcript following must not restore subtree mutation scans, sentinel scrolling, or multi-frame settlement loops.',
);

console.log('universal chat scroll performance contract passed.');
