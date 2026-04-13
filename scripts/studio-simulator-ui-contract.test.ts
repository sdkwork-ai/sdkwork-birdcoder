import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);

assert.equal(
  studioPageSource.includes("useState<'preview' | 'simulator' | 'code'>('preview')"),
  true,
  'StudioPage should expose a dedicated simulator mode beside preview and code.',
);

assert.equal(
  studioPageSource.includes('resolveHostStudioSimulatorSession('),
  true,
  'StudioPage should resolve simulator sessions through the shared host-studio simulator contract.',
);

assert.equal(
  studioPageSource.includes('resolveStudioSimulatorExecutionLaunch('),
  true,
  'StudioPage should launch simulator tasks through the shared simulator execution contract.',
);

assert.equal(
  studioPageSource.includes('saveStoredStudioSimulatorExecutionEvidence('),
  true,
  'StudioPage should persist simulator execution evidence after launch.',
);

assert.equal(
  studioPageSource.includes("activeTab === 'simulator'"),
  true,
  'StudioPage should render simulator-specific UI state.',
);

console.log('studio simulator ui contract passed.');
