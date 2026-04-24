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
  /if \(!isActive \|\| typeof ResizeObserver !== 'function'\) \{\s*return undefined;\s*\}/s,
  'useVirtualizedTranscriptWindow must skip transcript row ResizeObserver work while inactive so hidden chat surfaces do not keep measuring message heights.',
);

assert.match(
  source,
  /const isActiveRef = useRef\(isActive\);/,
  'useVirtualizedTranscriptWindow should keep the transcript activity state in a ref so row registration callbacks can avoid measuring hidden surfaces without recreating every callback.',
);

assert.match(
  source,
  /if \(!isActiveRef\.current\) \{\s*return;\s*\}/s,
  'useVirtualizedTranscriptWindow must bail out of row observation and eager DOM measurement when the transcript surface is inactive.',
);

console.log('transcript inactive measurement gating contract passed.');
