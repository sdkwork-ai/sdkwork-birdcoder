import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const universalChatSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'UniversalChat.tsx',
  ),
  'utf8',
);
const progressiveTranscriptHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
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

console.log('universal chat scroll ownership source contract passed.');
