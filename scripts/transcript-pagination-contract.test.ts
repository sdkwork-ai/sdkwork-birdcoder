import assert from 'node:assert/strict';

import {
  INITIAL_TRANSCRIPT_RENDER_COUNT,
  TRANSCRIPT_LOAD_MORE_THRESHOLD_PX,
  resolveEarlierTranscriptStartIndex,
  resolveInitialVisibleTranscriptStartIndex,
  shouldLoadEarlierTranscriptPage,
} from '../packages/sdkwork-birdcoder-ui/src/components/transcriptPagination.ts';

assert.equal(
  resolveInitialVisibleTranscriptStartIndex(INITIAL_TRANSCRIPT_RENDER_COUNT - 1),
  0,
  'short transcripts must render in full.',
);

assert.equal(
  resolveInitialVisibleTranscriptStartIndex(INITIAL_TRANSCRIPT_RENDER_COUNT + 37),
  37,
  'initial transcript window must start from the latest page instead of rendering the full history.',
);

assert.equal(
  resolveEarlierTranscriptStartIndex(INITIAL_TRANSCRIPT_RENDER_COUNT),
  0,
  'loading an earlier page must clamp to the transcript head when one page remains.',
);

assert.equal(
  resolveEarlierTranscriptStartIndex(INITIAL_TRANSCRIPT_RENDER_COUNT + 21),
  21,
  'loading an earlier page must reveal exactly one additional page of history.',
);

assert.equal(
  shouldLoadEarlierTranscriptPage(
    {
      clientHeight: 640,
      scrollHeight: 2400,
      scrollTop: TRANSCRIPT_LOAD_MORE_THRESHOLD_PX - 1,
    },
    INITIAL_TRANSCRIPT_RENDER_COUNT,
  ),
  true,
  'scrolling to the top threshold must request one earlier transcript page when older history exists.',
);

assert.equal(
  shouldLoadEarlierTranscriptPage(
    {
      clientHeight: 640,
      scrollHeight: 2400,
      scrollTop: TRANSCRIPT_LOAD_MORE_THRESHOLD_PX + 1,
    },
    INITIAL_TRANSCRIPT_RENDER_COUNT,
  ),
  false,
  'transcript pagination must not load earlier history while the viewport is still away from the top threshold.',
);

assert.equal(
  shouldLoadEarlierTranscriptPage(
    {
      clientHeight: 640,
      scrollHeight: 2400,
      scrollTop: 0,
    },
    0,
  ),
  false,
  'transcript pagination must stop requesting earlier history once the full transcript is already visible.',
);

console.log('transcript pagination contract passed.');
