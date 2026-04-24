import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settingsPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-settings/src/pages/SettingsPage.tsx', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  settingsPageSource,
  /import\s+\{\s*SkillsPage\s*\}\s+from '@sdkwork\/birdcoder-skills';/,
  'SettingsPage should not eagerly import SkillsPage at module scope.',
);

assert.match(
  settingsPageSource,
  /const LazySkillsPage = lazy\(async \(\) => \{\s*const module = await import\('@sdkwork\/birdcoder-skills'\);/s,
  'SettingsPage should lazy load the skills module only when the skills tab is activated.',
);

assert.match(
  settingsPageSource,
  /<Suspense[\s\S]*?<LazySkillsPage \/>[\s\S]*?<\/Suspense>/s,
  'SettingsPage should wrap the lazy skills screen with Suspense.',
);

console.log('settings skills lazy-load contract passed.');
