import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /function resolveFileExplorerSearchResult\(/,
  'FileExplorer should centralize search filtering and search-state folder expansion in one helper so large trees are not traversed twice per query change.',
);

assert.match(
  source,
  /const searchResult = useMemo\(\(\) => \{/,
  'FileExplorer should memoize a shared search result object instead of computing filtered rows and expanded folders in separate recursive passes.',
);

assert.doesNotMatch(
  source,
  /const currentExpandedFolders = useMemo\(\(\) => \{[\s\S]*const expandAll = \(nodes: readonly FileNode\[\]\) => \{/s,
  'FileExplorer must not recursively expand search matches in a second pass after filtering because that doubles the work for every keystroke on large repositories.',
);

console.log('file explorer search performance contract passed.');
