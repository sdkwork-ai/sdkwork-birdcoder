import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/fileExplorerVirtualization.ts',
  import.meta.url,
);

const {
  buildVisibleFileExplorerRows,
  resolveVirtualizedFileExplorerWindow,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const fileExplorerSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

const files = [
  {
    name: 'src',
    path: '/src',
    type: 'directory' as const,
    children: [
      {
        name: 'index.ts',
        path: '/src/index.ts',
        type: 'file' as const,
      },
      {
        name: 'components',
        path: '/src/components',
        type: 'directory' as const,
        children: [
          {
            name: 'Button.tsx',
            path: '/src/components/Button.tsx',
            type: 'file' as const,
          },
        ],
      },
    ],
  },
];

const rows = buildVisibleFileExplorerRows({
  creatingNode: {
    parentPath: '/src',
    type: 'file',
  },
  expandedFolders: {
    '/src': true,
    '/src/components': true,
  },
  files,
  loadingDirectoryPaths: {},
});

assert.deepEqual(
  rows.map((row: { depth: number; key: string; kind: string }) => ({
    depth: row.depth,
    key: row.key,
    kind: row.kind,
  })),
  [
    { depth: 0, key: 'node:/src', kind: 'node' },
    { depth: 1, key: 'input:/src:file', kind: 'input' },
    { depth: 1, key: 'node:/src/index.ts', kind: 'node' },
    { depth: 1, key: 'node:/src/components', kind: 'node' },
    { depth: 2, key: 'node:/src/components/Button.tsx', kind: 'node' },
  ],
  'file explorer should flatten visible nodes and inline creation rows before windowing',
);

const windowedRows = resolveVirtualizedFileExplorerWindow({
  overscanRows: 0,
  rowHeight: 32,
  rows,
  viewport: {
    clientHeight: 64,
    scrollTop: 64,
  },
});

assert.equal(windowedRows.visibleStartIndex, 2);
assert.deepEqual(
  windowedRows.visibleRows.map((row: { key: string }) => row.key),
  ['node:/src/index.ts', 'node:/src/components'],
  'file explorer viewport window should only render rows intersecting the current scroll area',
);
assert.equal(windowedRows.paddingTop, 64);
assert.equal(windowedRows.paddingBottom, 32);
assert.equal(windowedRows.totalHeight, 160);

const clampedWindowedRows = resolveVirtualizedFileExplorerWindow({
  overscanRows: 0,
  rowHeight: 32,
  rows,
  viewport: {
    clientHeight: 64,
    scrollTop: 9_999,
  },
});

assert.equal(
  clampedWindowedRows.visibleStartIndex,
  3,
  'file explorer viewport window should clamp oversized scroll positions to the last reachable row window when the tree shrinks.',
);
assert.deepEqual(
  clampedWindowedRows.visibleRows.map((row: { key: string }) => row.key),
  ['node:/src/components', 'node:/src/components/Button.tsx'],
  'file explorer viewport window should still render the trailing rows after clamping an oversized scroll position.',
);
assert.equal(clampedWindowedRows.paddingTop, 96);
assert.equal(clampedWindowedRows.paddingBottom, 0);

assert.match(
  fileExplorerSource,
  /const visibleRows = useMemo\(\s*\(\)\s*=>\s*buildVisibleFileExplorerRows\(/s,
  'FileExplorer should flatten visible rows once before rendering',
);

assert.match(
  fileExplorerSource,
  /const virtualizedRows = useMemo\(\s*\(\)\s*=>\s*resolveVirtualizedFileExplorerWindow\(/s,
  'FileExplorer should compute a windowed row slice for the scroll viewport',
);

assert.doesNotMatch(
  fileExplorerSource,
  /filteredFiles\.map\(\(file\) =>\s*<FileExplorerTreeNode/s,
  'FileExplorer should not render the full filtered tree directly once virtualization is enabled',
);

console.log('file explorer virtualization runtime contract passed.');
