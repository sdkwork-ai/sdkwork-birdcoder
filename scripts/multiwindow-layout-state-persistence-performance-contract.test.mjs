import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/pages/MultiWindowProgrammingPage.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  pageSource,
  /const MULTI_WINDOW_LAYOUT_STATE_PERSIST_DELAY_MS = \d+;/,
  'MultiWindowProgrammingPage must define a bounded persistence delay for layout edits.',
);

assert.match(
  pageSource,
  /const pendingLayoutStatePersistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'MultiWindowProgrammingPage must keep pending layout persistence in a ref so rapid changes coalesce.',
);

assert.match(
  pageSource,
  /const scheduleMultiWindowLayoutStatePersistence = useCallback\(/,
  'MultiWindowProgrammingPage must centralize layout-state persistence scheduling.',
);

assert.match(
  pageSource,
  /setTimeout\(\(\) => \{[\s\S]*pendingLayoutStatePersistenceTimeoutRef\.current = null;[\s\S]*writeMultiWindowLayoutState\(/,
  'Multi-window layout persistence must write from a delayed task instead of the React commit path.',
);

assert.match(
  pageSource,
  /clearTimeout\(pendingLayoutStatePersistenceTimeoutRef\.current\);/,
  'Multi-window layout persistence must cancel stale pending writes before scheduling the next one.',
);

assert.doesNotMatch(
  pageSource,
  /useEffect\(\(\) => \{\s*writeMultiWindowLayoutState\(/,
  'MultiWindowProgrammingPage must not synchronously persist layout state in the panes/windowCount effect.',
);

console.log('multiwindow layout-state persistence performance contract passed.');
