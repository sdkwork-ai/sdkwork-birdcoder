import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /function createFileExplorerSearchTask\(/,
  'FileExplorer should centralize search filtering and search-state folder expansion in one cancellable task so large trees are not traversed from render.',
);

assert.match(
  source,
  /const FILE_EXPLORER_SEARCH_CHUNK_SIZE = \d+;/,
  'FileExplorer search must process large repositories in bounded chunks instead of monopolizing the main thread.',
);

assert.match(
  source,
  /const \[searchResult, setSearchResult\] = useState<FileExplorerSearchResult>\(EMPTY_FILE_EXPLORER_SEARCH_RESULT\);/,
  'FileExplorer should store scheduled search output in state instead of computing filtered rows and expanded folders during render.',
);

assert.doesNotMatch(
  source,
  /const currentExpandedFolders = useMemo\(\(\) => \{[\s\S]*const expandAll = \(nodes: readonly FileNode\[\]\) => \{/s,
  'FileExplorer must not recursively expand search matches in a second pass after filtering because that doubles the work for every keystroke on large repositories.',
);

assert.doesNotMatch(
  source,
  /const searchResult = useMemo\(\(\) => \{[\s\S]*resolveFileExplorerSearchResult\(files, normalizedSearchQuery\);[\s\S]*\}, \[deferredSearchQuery, files, isActive\]\);/,
  'FileExplorer must not resolve the full search result inside useMemo during render.',
);

console.log('file explorer search performance contract passed.');
