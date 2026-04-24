import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url);
const topMenuPath = new URL(
  '../packages/sdkwork-birdcoder-ui-shell/src/components/TopMenu.tsx',
  import.meta.url,
);
const appWorkspaceMenuPath = new URL(
  '../packages/sdkwork-birdcoder-shell/src/application/app/AppWorkspaceMenu.tsx',
  import.meta.url,
);
const headerLoadingPath = new URL(
  '../packages/sdkwork-birdcoder-shell/src/application/app/HeaderLoadingStatus.tsx',
  import.meta.url,
);

const appSource = fs.readFileSync(appPath, 'utf8');
const topMenuSource = fs.readFileSync(topMenuPath, 'utf8');
const appWorkspaceMenuSource = fs.readFileSync(appWorkspaceMenuPath, 'utf8');
const headerLoadingSource = fs.readFileSync(headerLoadingPath, 'utf8');

assert.match(
  appSource,
  /const fileMenuItems = useMemo<TopMenuItem\[]>/,
  'App header must memoize file menu items so window frame state changes do not recreate the full menu model on every render.',
);

assert.match(
  appSource,
  /const helpMenuItems = useMemo<TopMenuItem\[]>/,
  'App header must memoize help menu items so recording state is the only reason that menu changes.',
);

assert.doesNotMatch(
  appSource,
  /<TopMenu label=\{t\('app\.menu\.file'\)\} items=\[/,
  'App header must not rebuild TopMenu item arrays inline during render.',
);

assert.match(
  appSource,
  /const handleSelectMenuProject = useCallback\([\s\S]*latestCodingSessionIdByProjectId\.get\(nextProjectId\)/,
  'Workspace menu project selection must resolve the next session through the prebuilt project/session index instead of scanning project arrays inline.',
);

assert.doesNotMatch(
  appSource,
  /resolveLatestCodingSessionIdForProject/,
  'App header project selection must not fall back to per-click array scans for latest coding session lookup.',
);

assert.match(
  appWorkspaceMenuSource,
  /import \{ HeaderLoadingStatus \} from '\.\/HeaderLoadingStatus\.tsx';/,
  'App header loading must be isolated into a dedicated workspace-menu child component so recovery timers do not rerender the entire shell.',
);

assert.match(
  appSource,
  /import \{ AppWorkspaceMenu \} from '\.\/AppWorkspaceMenu\.tsx';/,
  'BirdcoderApp must delegate workspace header rendering into AppWorkspaceMenu so the shell header stays modular and easier to contain.',
);

assert.doesNotMatch(
  appSource,
  /const \[projectMountRecoveryTick,\s*setProjectMountRecoveryTick\]/,
  'AppContent must not keep a recovery tick state at the top level because it forces whole-shell rerenders during project mount recovery.',
);

assert.match(
  headerLoadingSource,
  /React\.memo\(function HeaderLoadingStatus\(/,
  'Header loading status must be memoized so recovery progress updates stay scoped to the header loading subtree.',
);

assert.match(
  topMenuSource,
  /memo\(function TopMenu\(/,
  'TopMenu must be memoized so unrelated App shell renders do not rerender every closed menu.',
);

assert.match(
  topMenuSource,
  /if \(!isOpen\) \{\s*return;\s*\}/,
  'TopMenu must only subscribe to outside-click listeners while it is open.',
);

assert.match(
  topMenuSource,
  /useEffect\(\(\) => \{[\s\S]*document\.addEventListener\('mousedown', handleClickOutside\)[\s\S]*\}, \[handleClickOutside, isOpen\]\)/,
  'TopMenu outside-click subscription must be scoped to open-state changes instead of being always on.',
);

console.log('app header menu performance contract passed.');
