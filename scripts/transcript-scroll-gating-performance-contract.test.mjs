import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui/src/components/useVirtualizedTranscriptWindow.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  source,
  /const totalTranscriptHeight = prefixHeights\[messages\.length\] \?\? 0;/,
  'useVirtualizedTranscriptWindow should centralize total transcript height so scroll-overflow gating and virtualization stay aligned.',
);

assert.match(
  source,
  /const shouldTrackTranscriptScroll = totalTranscriptHeight > scrollContainer\.clientHeight;/,
  'useVirtualizedTranscriptWindow should only treat transcript scrolling as active work when the measured transcript height actually overflows the scroll container.',
);

assert.match(
  source,
  /if \(shouldTrackTranscriptScroll\) \{\s*scrollContainer\.addEventListener\('scroll', scheduleViewportPublish, \{ passive: true \}\);/s,
  'useVirtualizedTranscriptWindow must only subscribe to transcript scroll events while virtualization has real overflow to track.',
);

console.log('transcript scroll gating performance contract passed.');
