import assert from 'node:assert/strict';
import fs from 'node:fs';

const studioPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioMainContentSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioMainContent.tsx', import.meta.url),
  'utf8',
);

assert.match(
  studioPageSource,
  /import \{[\s\S]*startTransition[\s\S]*\} from 'react';/,
  'StudioPage must import startTransition so stage tab switches do not monopolize the main thread with synchronous state updates.',
);

assert.match(
  studioPageSource,
  /const handleActiveTabChange = useCallback\(\(nextTab: 'preview' \| 'simulator' \| 'code'\) => \{\s*startTransition\(\(\) => \{\s*setActiveTab\(nextTab\);/s,
  'StudioPage must route stage tab changes through a transition-aware callback so preview, simulator, and code switches stay responsive.',
);

assert.match(
  studioMainContentSource,
  /onTabChange=\{handleActiveTabChange\}/,
  'StudioStageHeader must receive the transition-aware tab-change callback instead of the raw setState dispatcher.',
);

assert.match(
  studioPageSource,
  /handleActiveTabChange\('code'\);/,
  'Studio message actions that jump into code view must use the transition-aware tab switch callback.',
);

assert.match(
  studioPageSource,
  /handleActiveTabChange\('simulator'\);[\s\S]*void launchSimulator\(\);/s,
  'Studio simulator launches must transition the active tab before starting the simulator workflow.',
);

console.log('studio tab switch performance contract passed.');
