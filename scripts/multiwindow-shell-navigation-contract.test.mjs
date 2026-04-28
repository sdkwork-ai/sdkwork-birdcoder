import assert from 'node:assert/strict';
import fs from 'node:fs';

const appTabSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-types/src/index.ts', import.meta.url),
  'utf8',
);
const shellSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);
const pageLoadersSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/pageLoaders.ts', import.meta.url),
  'utf8',
);
const shellPackageJson = JSON.parse(
  fs.readFileSync(
    new URL('../packages/sdkwork-birdcoder-shell/package.json', import.meta.url),
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
  shellSource,
  /AUTH_REQUIRED_APP_TABS = new Set<AppTab>\(\[[\s\S]*'multiwindow'[\s\S]*\]\)/,
  'Multi-window programming must require an authenticated workbench session.',
);

const studioButtonIndex = shellSource.indexOf("onActiveTabChange('studio')");
const multiwindowButtonIndex = shellSource.indexOf("onActiveTabChange('multiwindow')");
const terminalButtonIndex = shellSource.indexOf("onActiveTabChange('terminal')");

assert.ok(
  studioButtonIndex >= 0 && multiwindowButtonIndex > studioButtonIndex,
  'Sidebar must place 多窗口编程 directly after the Studio entry.',
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
  /export async function loadMultiWindowProgrammingPage\(\)[\s\S]*import\('@sdkwork\/birdcoder-multiwindow'\)/,
  'Shell page loader must import @sdkwork/birdcoder-multiwindow lazily.',
);

assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-multiwindow'],
  'workspace:*',
  'Shell package must declare a workspace dependency on @sdkwork/birdcoder-multiwindow.',
);

console.log('multi-window shell navigation contract passed.');
