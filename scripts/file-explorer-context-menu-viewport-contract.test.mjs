import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileExplorerPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx',
  import.meta.url,
);

const fileExplorerSource = fs.readFileSync(fileExplorerPath, 'utf8');

assert.match(
  fileExplorerSource,
  /if \(!hasOpenViewportMenu\) \{\s*return;\s*\}[\s\S]*window\.addEventListener\('resize', handleViewportChange(?:, \{ passive: true \})?\);/s,
  'FileExplorer must close floating context menus when the viewport changes so maximize and restore do not leave stale menu coordinates behind.',
);

assert.match(
  fileExplorerSource,
  /setContextMenu\(null\);\s*setRootContextMenu\(null\);/s,
  'FileExplorer viewport-change handling must clear both node and root context menus together.',
);

console.log('file explorer context menu viewport contract passed.');
