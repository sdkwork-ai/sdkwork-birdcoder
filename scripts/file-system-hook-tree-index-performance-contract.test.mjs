import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

function readCallbackBody(callbackName) {
  const start = source.indexOf(`const ${callbackName} = useCallback`);
  assert.notEqual(start, -1, `${callbackName} must be implemented as a useCallback.`);
  const nextConst = source.indexOf('\n\n  const ', start + 1);
  const nextEffect = source.indexOf('\n\n  useEffect', start + 1);
  const endCandidates = [nextConst, nextEffect].filter((index) => index !== -1);
  assert.ok(
    endCandidates.length > 0,
    `${callbackName} must be followed by another hook-local declaration.`,
  );
  const end = Math.min(...endCandidates);
  return source.slice(start, end);
}

function readFunctionBody(functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist.`);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  assert.notEqual(nextFunction, -1, `${functionName} must be followed by another function.`);
  return source.slice(start, nextFunction);
}

assert.match(
  source,
  /interface FileTreeIndex \{[\s\S]*filePaths: ReadonlySet<string>;[\s\S]*loadedDirectoryPaths: ReadonlySet<string>;[\s\S]*\}/u,
  'useFileSystem must keep a precomputed file-tree index for realtime reconciliation.',
);
assert.match(
  source,
  /function buildFileTreeIndex\(nodes: ReadonlyArray<IFileNode>\): FileTreeIndex/u,
  'useFileSystem must build the file-tree index in one traversal when the tree changes.',
);
assert.match(
  source,
  /const filesIndexRef = useRef<FileTreeIndex>\(createEmptyFileTreeIndex\(\)\);/u,
  'useFileSystem must keep the file-tree index in a ref next to filesRef.',
);
assert.match(
  readCallbackBody('syncFilesAndSelection'),
  /filesIndexRef\.current = buildFileTreeIndex\(nextFiles\);/u,
  'useFileSystem must refresh the file-tree index when committing a new file tree.',
);
assert.match(
  readCallbackBody('reconcileFileChangeEvent'),
  /const refreshDirectoryPaths = resolveFileChangeRefreshDirectoryPaths\(\s*filesIndexRef\.current,\s*event,\s*\);/u,
  'Realtime reconciliation must use the precomputed file-tree index instead of recursively scanning filesRef.',
);
assert.doesNotMatch(
  readCallbackBody('reconcileFileChangeEvent'),
  /resolveFileChangeRefreshDirectoryPaths\(filesRef\.current,\s*event\)/u,
  'Realtime reconciliation must not rescan the loaded file tree for every queued event.',
);
assert.match(
  readCallbackBody('refreshFiles'),
  /const loadedDirectoryPaths = \[\.\.\.filesIndexRef\.current\.loadedDirectoryPaths\];/u,
  'Manual refresh must use the precomputed loaded-directory index instead of walking the tree.',
);
assert.doesNotMatch(
  readCallbackBody('refreshFiles'),
  /collectLoadedDirectoryPaths\(filesRef\.current\)/u,
  'Manual refresh must not recursively scan filesRef for loaded directories.',
);

const refreshPathResolverSource = readFunctionBody('resolveFileChangeRefreshDirectoryPaths');
assert.doesNotMatch(
  refreshPathResolverSource,
  /const fallbackRootPaths = resolveLoadedRootDirectoryPaths\(loadedDirectoryPaths\);[\s\S]*for \(const rawPath of event\.paths\)/u,
  'File-change path resolution must not sort all loaded directories before it knows fallback roots are needed.',
);
assert.match(
  refreshPathResolverSource,
  /return resolveLoadedRootDirectoryPaths\(loadedDirectoryPaths\);/u,
  'File-change path resolution should compute fallback loaded roots lazily only for unmatched non-modify events.',
);

console.log('file-system hook tree index performance contract passed.');
