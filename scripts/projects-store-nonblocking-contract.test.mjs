import assert from 'node:assert/strict';
import fs from 'node:fs';

const useProjectsPath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts',
  import.meta.url,
);

const useProjectsSource = fs.readFileSync(useProjectsPath, 'utf8');

assert.match(
  useProjectsSource,
  /startTransition,\s*useCallback,\s*useDeferredValue,/,
  'useProjects must import startTransition and useDeferredValue so project inventory refreshes and search filtering can yield to higher-priority UI work.',
);

assert.match(
  useProjectsSource,
  /const deferredSearchQuery = useDeferredValue\(searchQuery\);/,
  'useProjects must defer search filtering so project/session inventories do not block typing on large workspaces.',
);

assert.match(
  useProjectsSource,
  /startTransition\(\(\) => \{\s*setStoreSnapshot\(nextSnapshot\);\s*\}\);/s,
  'useProjects must schedule external store snapshot propagation through startTransition so workspace refreshes do not compete with resize and input responsiveness.',
);

console.log('projects store nonblocking contract passed.');
