import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const progressiveTranscriptHookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'useProgressiveTranscriptWindow.ts',
);

const progressiveTranscriptHookSource = fs.readFileSync(progressiveTranscriptHookPath, 'utf8');

assert.match(
  progressiveTranscriptHookSource,
  /import \{[\s\S]*resolveEarlierTranscriptStartIndex,[\s\S]*shouldLoadEarlierTranscriptPage[\s\S]*\} from '\.\/transcriptPagination';/s,
  'Progressive transcript pagination must import the shared top-load pagination helpers instead of open-coding a separate history expansion policy.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const handleTranscriptScroll = \(\) => \{/,
  'Progressive transcript pagination must centralize top-load behavior in a dedicated transcript scroll handler.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const scrollMetrics = readTranscriptScrollMetrics\(messagesEndRef\);[\s\S]*shouldLoadEarlierTranscriptPage\(scrollMetrics, visibleTranscriptStartIndex\)/s,
  'Progressive transcript pagination must gate earlier-history loading behind the shared top-threshold predicate.',
);

assert.match(
  progressiveTranscriptHookSource,
  /setVisibleTranscriptStartIndex\(\(previousVisibleTranscriptStartIndex\) =>[\s\S]*resolveEarlierTranscriptStartIndex\(previousVisibleTranscriptStartIndex\)/s,
  'Progressive transcript pagination must reveal exactly one earlier page for each top-threshold load request.',
);

assert.match(
  progressiveTranscriptHookSource,
  /scrollContainer\.addEventListener\('scroll', handleTranscriptScroll, \{ passive: true \}\);/s,
  'Progressive transcript pagination must listen to transcript scroll events so older history is revealed on demand.',
);

assert.doesNotMatch(
  progressiveTranscriptHookSource,
  /window\.setTimeout\(/,
  'Progressive transcript pagination must not auto-load older history on a timer because that defeats top-triggered paging and destabilizes the scrollbar.',
);

assert.doesNotMatch(
  progressiveTranscriptHookSource,
  /TRANSCRIPT_REPAIR_FRAME_DELAY_MS/,
  'Progressive transcript pagination must not keep a frame-delay constant once older history is user-driven rather than timer-driven.',
);

console.log('transcript top load contract passed.');
