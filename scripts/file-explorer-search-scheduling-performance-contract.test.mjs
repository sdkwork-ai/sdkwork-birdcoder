import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /const FILE_EXPLORER_SEARCH_CHUNK_SIZE = \d+;/,
  'FileExplorer search must define a bounded chunk size so large repository searches cannot monopolize the main thread.',
);

assert.match(
  source,
  /function createFileExplorerSearchTask\(/,
  'FileExplorer search must run through a cancellable search task instead of recursively searching the full tree during render.',
);

assert.match(
  source,
  /const FILE_EXPLORER_SEARCH_IDLE_TIMEOUT_MS = \d+;/,
  'FileExplorer search must define a bounded idle timeout so large searches progress without monopolizing the main thread.',
);

assert.match(
  source,
  /window\.requestIdleCallback\(runNextSearchChunk,\s*\{\s*timeout: FILE_EXPLORER_SEARCH_IDLE_TIMEOUT_MS,\s*\}\)/,
  'FileExplorer search must prefer idle callbacks between chunks so input, resize, and scroll work can run first.',
);

assert.match(
  source,
  /setTimeout\(runNextSearchChunk, 0\)/,
  'FileExplorer search must keep a timer fallback for environments without requestIdleCallback.',
);

assert.match(
  source,
  /window\.cancelIdleCallback\(searchIdleCallbackId\);/,
  'FileExplorer search cancellation must cancel pending idle callbacks as well as timer fallback work.',
);

assert.match(
  source,
  /const \[searchResult, setSearchResult\] = useState<FileExplorerSearchResult>\(EMPTY_FILE_EXPLORER_SEARCH_RESULT\);/,
  'FileExplorer search results must be state-driven so expensive search work happens outside the render path.',
);

assert.match(
  source,
  /useEffect\(\(\) => \{[\s\S]*const searchTask = createFileExplorerSearchTask\(/,
  'FileExplorer must start cancellable chunked search work from an effect after React has committed the input update.',
);

assert.doesNotMatch(
  source,
  /const searchResult = useMemo\(\(\) => \{[\s\S]*resolveFileExplorerSearchResult\(files, normalizedSearchQuery\);[\s\S]*\}, \[deferredSearchQuery, files, isActive\]\);/,
  'FileExplorer must not recursively resolve the full search result inside useMemo during render.',
);

console.log('file explorer search scheduling performance contract passed.');
