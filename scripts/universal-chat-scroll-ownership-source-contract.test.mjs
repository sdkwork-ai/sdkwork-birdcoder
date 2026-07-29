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
  coordinatorSource,
  /markUserScrollIntent[\s\S]*cancelPrepend\(\);[\s\S]*cancelBottomFollow\(\);[\s\S]*clearScrollAnimationFrame\(\);/s,
  'Explicit user input must cancel stale prepend and bottom-follow work immediately.',
);

assert.match(
  universalChatSource,
  /transcriptScrollCoordinator\.jumpToLatest\(\)[\s\S]*focus\(\{ preventScroll: true \}\)/s,
  'Jump-to-latest must restore following through the coordinator and preserve transcript focus.',
);
assert.match(
  universalChatSource,
  /transcriptScrollCoordinator\.scrollToOffset\(/s,
  'Conversation-map navigation must route through the same scroll writer.',
);
assert.match(
  universalChatSource,
  /previousProps\.hasMoreRemoteMessages !== nextProps\.hasMoreRemoteMessages[\s\S]*previousProps\.isLoadingMoreRemoteMessages !== nextProps\.isLoadingMoreRemoteMessages[\s\S]*previousProps\.onLoadMoreRemoteMessages !== nextProps\.onLoadMoreRemoteMessages/s,
  'Transcript memoization must invalidate for remote pagination state and callback changes.',
);

console.log('universal chat scroll ownership source contract passed.');
