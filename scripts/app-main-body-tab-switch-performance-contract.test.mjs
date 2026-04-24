import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url), 'utf8');

assert.match(
  appSource,
  /import React, \{[\s\S]*startTransition[\s\S]*\} from 'react';/,
  'App must import startTransition so top-level tab switches can avoid monopolizing the main thread with synchronous state updates.',
);

assert.match(
  appSource,
  /const PRIMARY_PERSISTED_APP_TABS = new Set<AppTab>\(\['code', 'studio', 'terminal'\]\);/,
  'App must define the primary persisted tab set so heavy workbench surfaces stay mounted after first activation.',
);

assert.match(
  appSource,
  /const \[mountedPrimaryTabs, setMountedPrimaryTabs\] = useState<Set<AppTab>>\(\(\) => new Set<AppTab>\(\[activeTab\]\)\);/,
  'AppMainBody must track mounted primary tabs so heavy surfaces can remain warm after the first visit.',
);

assert.match(
  appSource,
  /useEffect\(\(\) => \{[\s\S]*if \(!PRIMARY_PERSISTED_APP_TABS\.has\(activeTab\)\) \{[\s\S]*setMountedPrimaryTabs\(\(previousMountedTabs\) => \{/s,
  'AppMainBody must add newly visited primary tabs to the mounted set incrementally instead of remounting them on every switch.',
);

assert.match(
  appSource,
  /const handleActiveTabChange = useCallback\(\(nextTab: AppTab\) => \{\s*startTransition\(\(\) => \{\s*setActiveTab\(nextTab\);/s,
  'App must transition top-level tab switches so click handling stays responsive while heavy panels change activity.',
);

assert.match(
  appSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'code'\}>[\s\S]*<CodePage/s,
  'AppMainBody must render CodePage inside a persistent activity panel instead of conditionally unmounting it on every tab switch.',
);

assert.match(
  appSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'studio'\}>[\s\S]*<StudioPage/s,
  'AppMainBody must render StudioPage inside a persistent activity panel instead of conditionally unmounting it on every tab switch.',
);

assert.match(
  appSource,
  /<PersistentAppTabPanel isActive=\{activeTab === 'terminal'\}>[\s\S]*<TerminalDesktopApp/s,
  'AppMainBody must render sdkwork-terminal DesktopTerminalApp inside a persistent activity panel so the terminal tab uses the shared terminal desktop surface directly.',
);

console.log('app main body tab switch performance contract passed.');
