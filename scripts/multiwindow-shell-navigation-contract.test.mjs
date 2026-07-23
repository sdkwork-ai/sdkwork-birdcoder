import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const appTabSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/workbench-view.ts',
    import.meta.url,
  ),
  'utf8',
);
const shellSource = readBirdcoderAppShellSource();
const authRoutingSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/authAppTabRouting.ts', import.meta.url),
  'utf8',
);
const pageLoadersSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/pageLoaders.ts', import.meta.url),
  'utf8',
);
const shellPackageJson = JSON.parse(
  fs.readFileSync(
    new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json', import.meta.url),
    'utf8',
  ),
);

assert.match(
  appTabSource,
  /\|\s*'multiwindow'/,
  'AppTab must include multiwindow as a first-class application tab.',
);

assert.match(
  shellSource,
  /PanelsTopLeft/,
  'Shell sidebar must use a lucide multi-window icon for the new programming mode.',
);

assert.match(
  shellSource,
  /const MultiWindowProgrammingPage = lazy\(async \(\) => \{[\s\S]*loadMultiWindowProgrammingPage/,
  'Shell must lazy-load the multi-window programming page.',
);

assert.match(
  shellSource,
  /PRIMARY_PERSISTED_APP_TABS = new Set<AppTab>\(\[[^\]]*'multiwindow'[^\]]*\]\)/,
  'Multi-window tab must be persisted like other primary workbench surfaces.',
);

assert.match(
  authRoutingSource,
  /AUTH_REQUIRED_APP_TABS = new Set<AppTab>\(\[[\s\S]*'multiwindow'[\s\S]*\]\)/,
  'Multi-window programming must require an authenticated workbench session.',
);

const studioButtonIndex = shellSource.indexOf("onActiveTabChange('studio')");
const multiwindowButtonIndex = shellSource.indexOf("onActiveTabChange('multiwindow')");
const terminalButtonIndex = shellSource.indexOf("onActiveTabChange('terminal')");

assert.ok(
  studioButtonIndex >= 0 && multiwindowButtonIndex > studioButtonIndex,
  'Sidebar must place 多窗口编�?directly after the Studio entry.',
);
assert.ok(
  terminalButtonIndex > multiwindowButtonIndex,
  'Sidebar must place Terminal after the multi-window programming entry.',
);

assert.match(
  shellSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'multiwindow'\}>[\s\S]*<MultiWindowProgrammingPage/,
  'Shell must render multi-window programming inside a persistent primary tab panel.',
);

assert.match(
  pageLoadersSource,
  /export async function loadMultiWindowProgrammingPage\(\)[\s\S]*import\('@sdkwork\/birdcoder-pc-multiwindow'\)/,
  'Shell page loader must import @sdkwork/birdcoder-pc-multiwindow lazily.',
);

assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-multiwindow'],
  'workspace:*',
  'Shell package must declare a workspace dependency on @sdkwork/birdcoder-pc-multiwindow.',
);

console.log('multi-window shell navigation contract passed.');
