import assert from 'node:assert/strict';

import {
  CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
  computeTranscriptBottomScrollTop,
  shouldDeferTranscriptAutoScrollForUserIntent,
} from '../packages/sdkwork-birdcoder-ui/src/components/chatScrollBehavior.ts';

assert.equal(
  CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS >= 120,
  true,
  'chat transcript user-scroll settle window must be long enough to avoid fighting native scrollbar drags.',
);

assert.equal(
  computeTranscriptBottomScrollTop({
    clientHeight: 480,
    scrollHeight: 1800,
    scrollTop: 0,
  }),
  1320,
  'initial transcript hydration must compute the exact bottom scrollTop from scrollHeight - clientHeight.',
);

assert.equal(
  computeTranscriptBottomScrollTop({
    clientHeight: 640,
    scrollHeight: 420,
    scrollTop: 0,
  }),
  0,
  'bottom scrollTop must clamp to zero when the transcript does not overflow.',
);

assert.equal(
  shouldDeferTranscriptAutoScrollForUserIntent({
    isUserInteracting: true,
    lastUserScrollAt: 1_000,
    now: 2_000,
  }),
  true,
  'transcript autoscroll must never write scrollTop while the user is actively dragging or otherwise controlling the scrollbar.',
);

assert.equal(
  shouldDeferTranscriptAutoScrollForUserIntent({
    isUserInteracting: false,
    lastUserScrollAt: 1_000,
    now: 1_000 + CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS - 1,
  }),
  true,
  'transcript autoscroll must keep a short cooldown after user scroll input so native scrollbar momentum cannot jitter.',
);

assert.equal(
  shouldDeferTranscriptAutoScrollForUserIntent({
    isUserInteracting: false,
    lastUserScrollAt: 1_000,
    now: 1_000 + CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS + 1,
  }),
  false,
  'transcript autoscroll may resume after user scroll input has settled.',
);

console.log('universal chat scroll ownership contract passed.');
