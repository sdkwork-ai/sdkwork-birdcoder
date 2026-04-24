import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const totalVisibleRowHeight = visibleRows\.length \* FILE_EXPLORER_ROW_HEIGHT;/,
  'FileExplorer should centralize total visible row height so scroll overflow and viewport clamping derive from one shared value.',
);

assert.match(
  source,
  /const shouldTrackViewportScroll = viewport\.clientHeight > 0 && totalVisibleRowHeight > viewport\.clientHeight;/,
  'FileExplorer should only treat viewport scrolling as active work when the flattened row set actually overflows the scroll container.',
);

assert.match(
  source,
  /if \(shouldTrackViewportScroll\) \{\s*scrollContainer\.addEventListener\('scroll', scheduleViewportPublish, \{ passive: true \}\);/s,
  'FileExplorer must only subscribe to scroll events while virtualization has real overflow to track.',
);

assert.match(
  source,
  /const maxScrollTop = Math\.max\(0,\s*totalVisibleRowHeight - scrollContainer\.clientHeight\);/s,
  'FileExplorer should clamp oversized scroll positions against the current total row height when the tree shrinks.',
);

assert.match(
  source,
  /if \(scrollContainer\.scrollTop > maxScrollTop\) \{\s*scrollContainer\.scrollTop = maxScrollTop;/s,
  'FileExplorer must repair the DOM scroll position when filtering or collapsing reduces the virtualized content height.',
);

console.log('file explorer viewport gating performance contract passed.');
