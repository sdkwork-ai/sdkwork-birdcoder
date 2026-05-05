import assert from 'node:assert/strict';
import fs from 'node:fs';

const pageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-multiwindow/src/pages/MultiWindowProgrammingPage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  pageSource,
  /const MULTI_WINDOW_WORKSPACE_STATE_PERSIST_DELAY_MS = \d+;/,
  'MultiWindowProgrammingPage must define a bounded persistence delay so pane-setting edits do not serialize and write workspace state on every keystroke.',
);

assert.match(
  pageSource,
  /const pendingWorkspaceStatePersistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
  'MultiWindowProgrammingPage must keep pending workspace-state persistence in a ref so rapid pane changes can coalesce into one write.',
);

assert.match(
  pageSource,
  /const scheduleMultiWindowWorkspaceStatePersistence = useCallback\(/,
  'MultiWindowProgrammingPage must centralize workspace-state persistence scheduling behind a stable callback.',
);

assert.match(
  pageSource,
  /setTimeout\(\(\) => \{\s*pendingWorkspaceStatePersistenceTimeoutRef\.current = null;[\s\S]*writeMultiWindowWorkspaceState\(/,
  'MultiWindow workspace-state persistence must write from a delayed task instead of the React commit path.',
);

assert.match(
  pageSource,
  /clearTimeout\(pendingWorkspaceStatePersistenceTimeoutRef\.current\);/,
  'MultiWindow workspace-state persistence must cancel stale pending writes before scheduling the next one.',
);

assert.doesNotMatch(
  pageSource,
  /useEffect\(\(\) => \{\s*writeMultiWindowWorkspaceState\(/,
  'MultiWindowProgrammingPage must not synchronously persist workspace state directly inside the panes/windowCount effect.',
);

console.log('multiwindow workspace-state persistence performance contract passed.');
