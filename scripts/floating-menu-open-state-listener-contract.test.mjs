import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const appSource = read('src/App.tsx');
const sidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');
const topBarSource = read('packages/sdkwork-birdcoder-code/src/components/TopBar.tsx');
const universalChatSource = read('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx');
const skillsPageSource = read('packages/sdkwork-birdcoder-skills/src/SkillsPage.tsx');
const fileExplorerSource = read('packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx');
const studioChatSidebarSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx');

assert.match(
  appSource,
  /const hasOpenWorkspaceMenuSurface =[\s\S]*showWorkspaceMenu[\s\S]*projectActionsMenuId !== null;/,
  'App must derive workspace-menu listener activation from actual open surface state instead of keeping a global outside-click listener mounted all the time.',
);

assert.match(
  appSource,
  /if \(!hasOpenWorkspaceMenuSurface\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleWorkspaceMenuClickOutside\);/s,
  'App workspace menu must only subscribe to outside clicks while the workspace menu surface is open.',
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

assert.match(
  topBarSource,
  /if \(!showBranchMenu && !showSubmitMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleClickOutside\);/s,
  'TopBar must only subscribe to outside clicks while the branch or submit menu is open.',
);

assert.match(
  universalChatSource,
  /const hasOpenFloatingMenu = showModelMenu \|\| showAttachmentMenu;/,
  'UniversalChat must derive menu-listener activation from its model and attachment menu state.',
);

assert.match(
  universalChatSource,
  /if \(!hasOpenFloatingMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleFloatingMenuClickOutside\);/s,
  'UniversalChat must only subscribe to outside clicks while the model or attachment menu is open.',
);

assert.match(
  skillsPageSource,
  /if \(!showRegistryMenu\) \{\s*return;\s*\}[\s\S]*document\.addEventListener\('mousedown', handleRegistryMenuClickOutside\);/s,
  'SkillsPage must only subscribe to outside clicks while the registry menu is open.',
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
