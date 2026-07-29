import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);
const progressiveTranscriptHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    'sdkwork-birdcoder-pc',
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'useProgressiveTranscriptWindow.ts',
  ),
  'utf8',
);

assert.match(
  universalChatSource,
  /const scrollTranscriptToBottom = useCallback\(\(\) => \{/,
  'UniversalChat must centralize all programmatic transcript bottom alignment in one scroll owner.',
);

assert.match(
  universalChatSource,
  /shouldShowTranscriptJumpToLatest\(scrollMetrics\)[\s\S]*shouldStickTranscriptToBottomRef\.current = !shouldShowJumpAffordance;[\s\S]*syncTranscriptJumpAffordance\(shouldShowJumpAffordance\);/s,
  'UniversalChat must derive the jump-to-latest affordance from the same metrics that own sticky scrolling.',
);

assert.match(
  universalChatSource,
  /const scrollTranscriptToTurn = useCallback[\s\S]*shouldStickTranscriptToBottomRef\.current = false;[\s\S]*syncTranscriptJumpAffordance\(true\);[\s\S]*behavior: 'auto'/s,
  'Conversation-map navigation must relinquish sticky bottom ownership and avoid a smooth-scroll first-frame bottom misclassification.',
);

assert.match(
  universalChatSource,
  /<ChatTranscriptJumpToLatestButton[\s\S]*onClick=\{handleJumpToLatestMessage\}[\s\S]*visible=\{isTranscriptJumpToLatestVisible\}/s,
  'UniversalChat must expose a keyboard-operable route back to the latest message.',
);

assert.match(
  universalChatSource,
  /const handleJumpToLatestMessage = useCallback\(\(\) => \{[\s\S]*window\.clearTimeout\(userTranscriptScrollSettleTimerRef\.current\);[\s\S]*window\.cancelAnimationFrame\(userTranscriptScrollAnimationFrameRef\.current\);[\s\S]*scrollTranscriptToBottom\(\);/s,
  'Jumping to the latest message must cancel stale user-scroll settlement work before restoring sticky-bottom ownership.',
);

assert.match(
  universalChatSource,
  /computeTranscriptBottomScrollTop\(\{[\s\S]*clientHeight:\s*scrollContainer\.clientHeight,[\s\S]*scrollHeight:\s*scrollContainer\.scrollHeight,[\s\S]*scrollTop:\s*scrollContainer\.scrollTop,[\s\S]*\}\)/s,
  'UniversalChat must align initial hydration by writing the scroll container bottom scrollTop directly.',
);

assert.match(
  universalChatSource,
  /shouldDeferTranscriptAutoScrollForUserIntent\(\{[\s\S]*isUserInteracting:\s*isUserControllingTranscriptScrollRef\.current,[\s\S]*lastUserScrollAt:\s*lastUserTranscriptScrollAtRef\.current,[\s\S]*now:\s*readTranscriptScrollClock\(\),[\s\S]*\}\)/s,
  'UniversalChat must gate autoscroll while native user scroll input is active or settling.',
);

assert.match(
  universalChatSource,
  /activeTranscriptSessionIdRef\.current !== normalizedTranscriptScopeKey[\s\S]*lastScrollSnapshotRef\.current = null;[\s\S]*shouldStickTranscriptToBottomRef\.current = true;/s,
  'UniversalChat must reset transcript scroll runtime state during the layout autoscroll pass when the visible transcript scope changes, so a previous session scroll position cannot block the new session from opening at the latest message.',
);

assert.match(
  universalChatSource,
  /scrollContainer\.addEventListener\('pointerdown',\s*markTranscriptPointerScrollIntent,\s*\{\s*passive:\s*true\s*\}\);/s,
  'UniversalChat must treat scrollbar pointer drags as explicit user scroll ownership.',
);

assert.match(
  universalChatSource,
  /const isTranscriptPointerScrollActiveRef = useRef\(false\);/,
  'UniversalChat must track active transcript scrollbar pointer drags separately from the settle timer.',
);

assert.match(
  universalChatSource,
  /if \(isTranscriptPointerScrollActiveRef\.current\) \{[\s\S]*userTranscriptScrollSettleTimerRef\.current = window\.setTimeout\([\s\S]*releaseUserTranscriptScrollControl,[\s\S]*CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,[\s\S]*\);[\s\S]*return;[\s\S]*\}/s,
  'UniversalChat must not release transcript scroll ownership while the pointer is still dragging the scrollbar.',
);

assert.match(
  universalChatSource,
  /window\.addEventListener\('pointerup',\s*releaseTranscriptPointerScrollIntent,\s*\{\s*passive:\s*true\s*\}\);[\s\S]*window\.addEventListener\('pointercancel',\s*releaseTranscriptPointerScrollIntent,\s*\{\s*passive:\s*true\s*\}\);/s,
  'UniversalChat must release active transcript pointer scroll ownership from global pointerup and pointercancel events.',
);

assert.match(
  universalChatSource,
  /const resizeObserver = new ResizeObserver\(\(\) => \{[\s\S]*shouldStickTranscriptToBottomRef\.current[\s\S]*!isUserControllingTranscriptScrollRef\.current[\s\S]*scrollTranscriptToBottom\(\);[\s\S]*updateTranscriptStickiness\(\);[\s\S]*resizeObserver\.observe\(scrollContainer\);/s,
  'Transcript container resizing must preserve sticky-bottom ownership without overriding a user who is reading history.',
);

assert.doesNotMatch(
  universalChatSource,
  /messagesEndRef\.current\?\.scrollIntoView\(/,
  'UniversalChat must not use scrollIntoView for transcript following because it can fight native scrollbar dragging and parent scroll containers.',
);

assert.match(
  progressiveTranscriptHookSource,
  /isTranscriptPointerDragActiveRef/,
  'Progressive transcript pagination must know when a pointer drag is active so older-page materialization does not move the scrollbar thumb mid-drag.',
);

assert.match(
  progressiveTranscriptHookSource,
  /pendingTopLoadAfterPointerReleaseRef/,
  'Progressive transcript pagination must defer top-load requests until after an active scrollbar pointer drag releases.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const cancelPrependAnchorRepairForUserInput = \(\) => \{[\s\S]*pendingPrependedScrollMetricsRef\.current = null;[\s\S]*window\.cancelAnimationFrame\(prependAnchorRepairAnimationFrameRef\.current\);[\s\S]*\};[\s\S]*const markPendingTopLoadIntent = \(event\?: Event\) => \{[\s\S]*cancelPrependAnchorRepairForUserInput\(\);/s,
  'Explicit scroll input must cancel local prepend anchor settlement so it cannot override the user after history appears.',
);

assert.match(
  universalChatSource,
  /const \{[\s\S]*measurementVersion,[\s\S]*\} = useVirtualizedTranscriptWindow\(/s,
  'UniversalChat must consume transcript row measurement changes so asynchronous message layout can finish bottom alignment.',
);

assert.match(
  universalChatSource,
  /useLayoutEffect\(\(\) => \{[\s\S]*shouldStickToBottomRef\.current[\s\S]*scrollTranscriptToBottom\(\);[\s\S]*\}, \[[\s\S]*measurementVersion,/s,
  'UniversalChat must rerun sticky bottom alignment after transcript row measurements change without overriding user-owned scroll.',
);

console.log('universal chat scroll ownership source contract passed.');
