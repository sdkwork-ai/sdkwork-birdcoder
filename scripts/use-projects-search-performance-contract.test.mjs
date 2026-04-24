import assert from 'node:assert/strict';
import fs from 'node:fs';

const useProjectsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);

assert.match(
  useProjectsSource,
  /function buildProjectSearchInventory\(/,
  'useProjects must build a reusable project search inventory so every search keystroke does not normalize the full project/session tree again.',
);

assert.match(
  useProjectsSource,
  /const projectSearchInventory = useMemo\(\(\) => buildProjectSearchInventory\(storeSnapshot\.projects\), \[storeSnapshot\.projects\]\);/,
  'useProjects must memoize the reusable project search inventory against the shared store snapshot.',
);

assert.match(
  useProjectsSource,
  /return searchProjectsInventory\(projectSearchInventory, normalizedSearchQuery\);/,
  'useProjects.filteredProjects must delegate search resolution to the memoized inventory helper.',
);

assert.doesNotMatch(
  useProjectsSource,
  /const filteredProjects = useMemo\(\(\) => \{[\s\S]*project\.codingSessions\s*\.map\(\(codingSession\)/s,
  'useProjects.filteredProjects must not rebuild scored coding-session arrays inline on every deferred query.',
);

console.log('useProjects search performance contract passed.');
