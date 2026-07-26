import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const appSource = readBirdcoderAppShellSource();
const sidebarSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx');
const topBarSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx');
const universalChatSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx');
const fileExplorerSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx');
const studioChatSidebarSource = read('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx');

assert.match(
  appSource,
  /const hasOpenHeaderSelectionSurface =/,
  'App must define a shared open-state boundary for the unified Header selection surface.',
);
assert.match(
  appSource,
  /showWorkspaceProjectPopover \|\|[\s\S]*projectActionsMenuId !== null/,
  'App must derive unified Header Popover listener activation from the Popover and its nested action states.',
);

assert.match(
  appSource,
  /if \(!hasOpenHeaderSelectionSurface\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleWorkspaceProjectPopoverClickOutside\);/s,
  'App Workspace and Project Popover must only subscribe to outside clicks while the unified Header selection surface is open.',
);

assert.match(
  sidebarSource,
  /const hasOpenViewportMenu =[\s\S]*showFilterMenu[\s\S]*rootContextMenu !== null;/,
  'Sidebar must derive floating-menu listener activation from actual open menu state.',
);

assert.match(
  sidebarSource,
  /if \(!hasOpenViewportMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleClickOutside\);/s,
  'Sidebar outside-click handling must only subscribe while one of its floating menus is open.',
);

assert.match(
  sidebarSource,
  /window\.addEventListener\('resize', handleViewportChange, \{ passive: true \}\);/,
  'Sidebar viewport listener must stay passive while floating menus are open.',
);

assert.doesNotMatch(
  topBarSource,
  /document\.addEventListener\('mousedown'/,
  'TopBar must not own a global menu listener after Git branch, worktree, and submit controls move into their focused components.',
);

assert.match(
  universalChatSource,
  /const hasOpenFloatingMenu = showAttachmentMenu;/,
  'UniversalChat must limit its shared outside-click listener to the attachment menu; the model picker owns its focused listener lifecycle.',
);

assert.match(
  universalChatSource,
  /if \(!hasOpenFloatingMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleFloatingMenuClickOutside\);/s,
  'UniversalChat must only subscribe to outside clicks while its attachment menu is open.',
);

assert.match(
  fileExplorerSource,
  /const hasOpenViewportMenu = contextMenu !== null \|\| rootContextMenu !== null;/,
  'FileExplorer must derive floating-menu listener activation from actual open menu state.',
);

assert.match(
  fileExplorerSource,
  /if \(!hasOpenViewportMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('click', handleClickOutside\);/s,
  'FileExplorer must only subscribe to outside clicks while one of its floating menus is open.',
);

assert.match(
  studioChatSidebarSource,
  /if \(!showProjectMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleProjectMenuClickOutside\);/s,
  'StudioChatSidebar must only subscribe to outside clicks while the project menu is open.',
);

console.log('floating menu open-state listener contract passed.');
