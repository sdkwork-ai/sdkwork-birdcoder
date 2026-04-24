import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-ui-shell/src/components/useFixedSizeWindowedRange.ts',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  source,
  /const totalContentHeight = itemCount \* itemHeight;/,
  'Fixed-size windowed range should centralize total content height so overflow gating and range derivation stay aligned.',
);

assert.match(
  source,
  /const shouldTrackScroll = totalContentHeight > container\.clientHeight;/,
  'Fixed-size windowed range should only treat scrolling as active work when the virtualized content actually overflows the container.',
);

assert.match(
  source,
  /const nextRange = shouldTrackScroll\s*\?\s*resolveWindowedRange\(\s*containerRef\.current,\s*itemCount,\s*itemHeight,\s*overscan,\s*\)\s*:\s*fullRange;/s,
  'Fixed-size windowed range must return the full range when content fits so short lists do not keep recalculating synthetic window padding.',
);

assert.match(
  source,
  /if \(shouldTrackScroll\) \{\s*container\.addEventListener\('scroll', scheduleRangeUpdate, \{ passive: true \}\);/s,
  'Fixed-size windowed range must only subscribe to scroll events while overflow exists.',
);

assert.doesNotMatch(
  source,
  /window\.addEventListener\('resize', scheduleRangeUpdate, \{ passive: true \}\);[\s\S]*if \(typeof ResizeObserver !== 'undefined'\)/s,
  'Fixed-size windowed range should not keep both global resize listeners and ResizeObserver active at the same time.',
);

assert.match(
  source,
  /if \(typeof ResizeObserver !== 'undefined'\) \{[\s\S]*resizeObserver\.observe\(container\);[\s\S]*\} else \{\s*window\.addEventListener\('resize', scheduleRangeUpdate, \{ passive: true \}\);/s,
  'Fixed-size windowed range should prefer ResizeObserver and only fall back to window resize events when ResizeObserver is unavailable.',
);

console.log('fixed size windowed range overflow gating performance contract passed.');
