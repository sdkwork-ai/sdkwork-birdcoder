import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
  import.meta.url,
);

const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');

assert.equal(
  sidebarSource.includes('createPortal('),
  true,
  'Sidebar project/session context menus must render through a body portal so they are not trapped under the code view stacking context.',
);

assert.equal(
  sidebarSource.includes('SIDEBAR_CONTEXT_MENU_Z_INDEX'),
  true,
  'Sidebar context menus must use a shared top-layer z-index constant instead of local z-50 styling.',
);

assert.equal(
  sidebarSource.includes('2147483647'),
  true,
  'Sidebar context menus must be promoted to the highest z-index tier so project/session right-click menus are never hidden behind code view content.',
);

assert.match(
  sidebarSource,
  /if \(!hasOpenViewportMenu\) \{\s*return;\s*\}[\s\S]*window\.addEventListener\('resize', handleViewportChange(?:, \{ passive: true \})?\);/s,
  'Sidebar must close floating menus when the viewport changes so maximize and restore never leave context menus pinned to stale coordinates.',
);

assert.match(
  sidebarSource,
  /setContextMenu\(null\);\s*setProjectContextMenu\(null\);\s*setRootContextMenu\(null\);/s,
  'Sidebar viewport-change handling must clear session, project, and root context menus together.',
);

console.log('sidebar context menu layer contract passed.');
