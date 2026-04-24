import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useWorkbenchPreferences.ts', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /function areWorkbenchCodeEngineSettingsEqual\(/,
  'useWorkbenchPreferences should centralize code-engine settings comparison behind a dedicated helper so preference equality can stay explicit without serializing on every effect pass.',
);

assert.doesNotMatch(
  source,
  /JSON\.stringify\(/,
  'useWorkbenchPreferences must not use JSON.stringify on the render/effect path for preference equality because engine settings growth would turn hydration and updates into avoidable main-thread serialization work.',
);

console.log('workbench preferences performance contract passed.');
