import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
  import.meta.url,
);
const studioSidebarPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx',
  import.meta.url,
);

const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');
const studioSidebarSource = fs.readFileSync(studioSidebarPath, 'utf8');

assert.match(
  sidebarSource,
  /function areSidebarPropsEqual\(/,
  'Sidebar must define a custom memo comparator so transcript payload updates do not rerender the entire inventory tree.',
);

assert.match(
  sidebarSource,
  /React\.memo\(function Sidebar\([\s\S]*,\s*areSidebarPropsEqual\)/,
  'Sidebar must be wrapped with the custom inventory-aware memo comparator.',
);

assert.match(
  studioSidebarSource,
  /function areStudioChatSidebarPropsEqual\(/,
  'StudioChatSidebar must define a custom memo comparator so project inventory and transcript updates can be separated.',
);

assert.match(
  studioSidebarSource,
  /memo\(function StudioChatSidebar\([\s\S]*,\s*areStudioChatSidebarPropsEqual\)/,
  'StudioChatSidebar must be wrapped with the custom inventory-aware memo comparator.',
);

console.log('sidebar inventory memo contract passed.');
