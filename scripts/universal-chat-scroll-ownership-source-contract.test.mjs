import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const componentRoot = path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
);
const readComponent = (relativePath) => fs.readFileSync(
  path.join(componentRoot, relativePath),
  'utf8',
);

const universalChatSource = readComponent('UniversalChat.tsx');
const coordinatorSource = readComponent('useTranscriptScrollCoordinator.ts');
const progressiveTranscriptSource = readComponent('useProgressiveTranscriptWindow.ts');
const virtualizedTranscriptSource = readComponent('useVirtualizedTranscriptWindow.ts');
const anchorSource = readComponent('transcriptScrollAnchor.ts');

assert.match(
  universalChatSource,
  /useTranscriptScrollCoordinator\(\{[\s\S]*scrollContainerRef: transcriptScrollContainerRef,[\s\S]*\}\)/s,
  'UniversalChat must delegate transcript scroll state and writes to the shared coordinator.',
);
assert.match(
  universalChatSource,
  /ref=\{transcriptScrollCoordinator\.contentRef\}[\s\S]*data-chat-transcript-content="true"/s,
  'UniversalChat must expose one measurable transcript content root to the coordinator.',
);
assert.match(
  universalChatSource,
  /overflowAnchor: 'none',[\s\S]*overscrollBehavior: 'contain',[\s\S]*scrollbarGutter: 'stable'/s,
  'The transcript viewport must disable native scroll anchoring so the coordinator remains the only scroll owner.',
);

const ownedScrollTopWrites = coordinatorSource.match(/scrollContainer\.scrollTop\s*=/gu) ?? [];
assert.equal(
  ownedScrollTopWrites.length,
  1,
  'The transcript coordinator must have exactly one scrollTop write site.',
);
for (const [name, source] of [
  ['UniversalChat', universalChatSource],
  ['progressive transcript', progressiveTranscriptSource],
  ['virtualized transcript', virtualizedTranscriptSource],
  ['anchor helper', anchorSource],
]) {
  assert.doesNotMatch(
    source,
    /scrollContainer\.scrollTop\s*=/u,
    `${name} must submit scroll intent instead of writing scrollTop directly.`,
  );
}

assert.match(
  coordinatorSource,
  /pendingOperationRef[\s\S]*scrollAnimationFrameRef[\s\S]*requestAnimationFrame\(flushScheduledOperation\)/s,
  'All asynchronous scroll requests must coalesce through one pending operation and one RAF gate.',
);
assert.match(
  coordinatorSource,
  /resolveOperationPriority\(operation\)[\s\S]*resolveOperationPriority\(pendingOperation\)/s,
  'Anchor and explicit navigation requests must take precedence over bottom-follow requests.',
);
assert.match(
  coordinatorSource,
  /!shouldStickToBottomRef\.current[\s\S]*isUserControllingScrollRef\.current[\s\S]*activeAnchorRef\.current[\s\S]*return;/s,
  'Bottom following must stop while the user reads history or a prepend anchor transaction is active.',
);
assert.match(
  coordinatorSource,
  /new ResizeObserver\([\s\S]*resizeObserver\.observe\(scrollContainer\);[\s\S]*resizeObserver\.observe\(content\);/s,
  'One ResizeObserver must cover the viewport and transcript content root.',
);
assert.doesNotMatch(
  `${universalChatSource}\n${coordinatorSource}`,
  /MutationObserver/u,
  'Transcript following must not scan the message subtree with MutationObserver.',
);

assert.match(
  progressiveTranscriptSource,
  /scrollCoordinator\?\.beginPrepend\(\)[\s\S]*scrollCoordinator\?\.completePrepend\(pendingPrepend\)/s,
  'Local progressive history expansion must use the shared prepend transaction.',
);
assert.match(
  universalChatSource,
  /const transaction = beginPrepend\(\);[\s\S]*pendingRemotePrependRef\.current = \{[\s\S]*transaction,/s,
  'Remote history loading must begin and retain a coordinator-owned prepend transaction.',
);
assert.match(
  universalChatSource,
  /const pendingPrepend = pendingRemotePrependRef\.current;[\s\S]*completePrepend\(pendingPrepend\.transaction\);[\s\S]*pendingRemotePrependRef\.current = null;/s,
  'Remote history rendering must complete the retained transaction through the coordinator.',
);
assert.match(
  universalChatSource,
  /firstMessageKey: string;[\s\S]*const firstMessageKey = messages\.length > 0[\s\S]*resolveTranscriptMessageKey\(messages\[0\], 0\)[\s\S]*pendingPrepend\.firstMessageKey === firstMessageKey/s,
  'Remote history completion must be identified by a stable leading-message key.',
);
assert.doesNotMatch(
  universalChatSource,
  /pendingPrepend\.messageCount|pendingPrepend\.firstMessageId/,
  'Tail appends must not be mistaken for completed remote history prepends.',
);
assert.match(
  coordinatorSource,
  /markUserScrollIntent[\s\S]*cancelActiveAnchorRepair\(\);[\s\S]*cancelBottomFollow\(\);[\s\S]*clearScrollAnimationFrame\(\);[\s\S]*rebasePendingPrependForScroll\(\);/s,
  'Explicit user input must stop stale repair writes while rebasing an unfinished prepend transaction.',
);
assert.match(
  coordinatorSource,
  /pendingPrependTransactionRef\.current = transaction;[\s\S]*pendingPrependTransactionRef\.current\?\.token !== transaction\.token[\s\S]*pendingPrependTransactionRef\.current = null;/s,
  'The coordinator must retain one unfinished prepend transaction and consume it exactly once.',
);
assert.doesNotMatch(
  progressiveTranscriptSource,
  /cancelPrependAnchorRepairForUserInput/,
  'Progressive input handlers must not invalidate an unfinished local prepend transaction.',
);

assert.match(
  universalChatSource,
  /transcriptScrollCoordinator\.jumpToLatest\(\)[\s\S]*focus\(\{ preventScroll: true \}\)/s,
  'Jump-to-latest must restore following through the coordinator and preserve transcript focus.',
);
assert.match(
  universalChatSource,
  /setTranscriptNavigationRequest\([\s\S]*navigationRequest=\{transcriptNavigationRequest\}/s,
  'Conversation-map navigation must submit a stable row reveal request to the transcript renderer.',
);
assert.match(
  universalChatSource,
  /const renderedMessage = scrollContainer\.querySelector<[\s\S]*scrollToOffset\(Math\.max\(0, renderedMessage\.offsetTop - 16\)\)/s,
  'Conversation-map navigation must route exact target positioning through the same scroll writer.',
);
assert.doesNotMatch(
  universalChatSource,
  /maxScrollTop \* \(messagePosition/,
  'Conversation-map navigation must not use a one-shot linear position estimate for variable-height or progressively mounted rows.',
);
assert.match(
  universalChatSource,
  /previousProps\.hasMoreRemoteMessages !== nextProps\.hasMoreRemoteMessages[\s\S]*previousProps\.isLoadingMoreRemoteMessages !== nextProps\.isLoadingMoreRemoteMessages[\s\S]*previousProps\.onLoadMoreRemoteMessages !== nextProps\.onLoadMoreRemoteMessages/s,
  'Transcript memoization must invalidate for remote pagination state and callback changes.',
);

console.log('universal chat scroll ownership source contract passed.');
