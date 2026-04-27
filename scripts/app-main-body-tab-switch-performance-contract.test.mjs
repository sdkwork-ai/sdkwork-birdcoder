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
  /const handleActiveTabChange = useCallback\(\(nextTab: AppTab\) => \{[\s\S]*if \(!user && requiresAuthenticatedSession\(nextTab\)\) \{[\s\S]*openAuthenticationSurface\(nextTab\);[\s\S]*return;[\s\S]*startTransition\(\(\) => \{[\s\S]*setActiveTab\(nextTab\);/s,
  'App must route unauthenticated protected tabs through auth, while still transitioning ordinary top-level tab switches so heavy panels stay responsive.',
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
