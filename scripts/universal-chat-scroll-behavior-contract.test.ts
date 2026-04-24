import assert from 'node:assert/strict';

import {
  CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX,
  computeTranscriptRepairScrollTop,
  isTranscriptNearBottom,
  measureTranscriptDistanceFromBottom,
} from '../packages/sdkwork-birdcoder-ui/src/components/chatScrollBehavior.ts';

assert.equal(
  CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX > 0,
  true,
  'chat transcript sticky scroll threshold must stay positive.',
);

assert.equal(
  measureTranscriptDistanceFromBottom({
    clientHeight: 320,
    scrollHeight: 1000,
    scrollTop: 640,
  }),
  40,
  'distance from bottom must be derived from scrollHeight - scrollTop - clientHeight.',
);

assert.equal(
  isTranscriptNearBottom({
    clientHeight: 320,
    scrollHeight: 1000,
    scrollTop: 1000 - 320 - CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX + 1,
  }),
  true,
  'chat transcript should remain sticky while the viewport is still within the bottom threshold.',
);

assert.equal(
  isTranscriptNearBottom({
    clientHeight: 320,
    scrollHeight: 1000,
    scrollTop: 1000 - 320 - CHAT_TRANSCRIPT_STICKY_SCROLL_THRESHOLD_PX - 24,
  }),
  false,
  'chat transcript must stop auto-following once the user scrolls materially away from the bottom.',
);

assert.equal(
  computeTranscriptRepairScrollTop(
    {
      clientHeight: 480,
      scrollHeight: 1600,
      scrollTop: 520,
    },
    {
      clientHeight: 480,
      scrollHeight: 1960,
      scrollTop: 520,
    },
  ),
  880,
  'transcript repair must preserve the viewport when older content is materialized above the current scroll position.',
);

assert.equal(
  computeTranscriptRepairScrollTop(
    {
      clientHeight: 480,
      scrollHeight: 1600,
      scrollTop: 0,
    },
    {
      clientHeight: 480,
      scrollHeight: 1560,
      scrollTop: 0,
    },
  ),
  0,
  'transcript repair scroll compensation must stay clamped when the next layout is shorter than the previous estimate.',
);

console.log('universal chat scroll behavior contract passed.');
