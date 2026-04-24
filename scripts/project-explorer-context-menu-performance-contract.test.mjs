import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);

assert.match(
  sidebarSource,
  /function clampSidebarContextMenuCoordinates\(/,
  'Sidebar must centralize context-menu viewport clamping instead of repeating hardcoded viewport math across each menu handler.',
);

assert.match(
  sidebarSource,
  /const projectLookup = useMemo\(/,
  'Sidebar must memoize project lookup data so project context menu rendering does not repeatedly scan the project list.',
);

assert.doesNotMatch(
  sidebarSource,
  /projects\.find\(/,
  'Sidebar project context menu rendering must not repeatedly linearly scan projects because a memoized lookup is available.',
);

console.log('project explorer context menu performance contract passed.');
