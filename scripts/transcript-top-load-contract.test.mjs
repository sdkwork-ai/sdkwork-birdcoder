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
  /const topLoadAnimationFrameRef = useRef<number \| null>\(null\);/,
  'Progressive transcript pagination must keep a dedicated animation-frame gate for top-load threshold checks.',
);

assert.match(
  progressiveTranscriptHookSource,
  /const scheduleEarlierTranscriptPageRequest = \(\) => \{[\s\S]*topLoadAnimationFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{[\s\S]*requestEarlierTranscriptPage\(\);[\s\S]*\}\);[\s\S]*\}/s,
  'Progressive transcript pagination must batch top-load threshold reads onto animation frames instead of doing layout work inside native scroll events.',
);

const transcriptScrollHandlerMatch = progressiveTranscriptHookSource.match(
  /const handleTranscriptScroll = \(\) => \{([\s\S]*?)\n    \};\n    const handleTranscriptPointerDown/,
);
assert.ok(
  transcriptScrollHandlerMatch,
  'Progressive transcript pagination must keep the transcript scroll listener body inspectable.',
);
const transcriptScrollHandlerBody = transcriptScrollHandlerMatch[1] ?? '';
assert.match(
  transcriptScrollHandlerBody,
  /scheduleEarlierTranscriptPageRequest\(\);/,
  'Progressive transcript pagination scroll events must only schedule top-load checks.',
);
assert.doesNotMatch(
  transcriptScrollHandlerBody,
  /readTranscriptScrollMetrics|shouldLoadEarlierTranscriptPage|requestEarlierTranscriptPage\(\)/,
  'Progressive transcript pagination scroll events must not synchronously read layout or reveal older history.',
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

assert.match(
  progressiveTranscriptHookSource,
  /window\.cancelAnimationFrame\(topLoadAnimationFrameRef\.current\);/,
  'Progressive transcript pagination must cancel pending top-load animation frames during listener cleanup.',
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
