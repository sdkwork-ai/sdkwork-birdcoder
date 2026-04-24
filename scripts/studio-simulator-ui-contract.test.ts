import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioExecutionHookSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioExecutionActions.ts', import.meta.url),
  'utf8',
);

assert.equal(
  studioPageSource.includes("useState<'preview' | 'simulator' | 'code'>('preview')"),
  true,
  'StudioPage should expose a dedicated simulator mode beside preview and code.',
);

assert.equal(
  studioPageSource.includes("from './useStudioExecutionActions';"),
  true,
  'StudioPage should delegate simulator execution orchestration through the shared studio execution hook.',
);

assert.equal(
  studioExecutionHookSource.includes('resolveHostStudioSimulatorSession('),
  true,
  'Studio execution hook should resolve simulator sessions through the shared host-studio simulator contract.',
);

assert.equal(
  studioExecutionHookSource.includes('resolveStudioSimulatorExecutionLaunch('),
  true,
  'Studio execution hook should launch simulator tasks through the shared simulator execution contract.',
);

assert.equal(
  studioExecutionHookSource.includes('saveStoredStudioSimulatorExecutionEvidence('),
  true,
  'Studio execution hook should persist simulator execution evidence after launch.',
);

assert.equal(
  studioPageSource.includes("activeTab === 'simulator'"),
  true,
  'StudioPage should render simulator-specific UI state.',
);

console.log('studio simulator ui contract passed.');
