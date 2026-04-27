import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { resolveHostStudioSimulatorSession } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';
import { buildStudioSimulatorExecutionEvidence } from '../packages/sdkwork-birdcoder-studio/src/simulator/runtime.ts';

const evidenceStoreModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/simulator/evidenceStore.ts',
  import.meta.url,
);

assert.equal(
  existsSync(evidenceStoreModulePath),
  true,
  'Studio simulator evidence store must exist.',
);

const {
  buildStudioSimulatorEvidenceStorageKey,
  listStoredStudioSimulatorExecutionEvidence,
  saveStoredStudioSimulatorExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/simulator/evidenceStore.ts');

assert.equal(
  buildStudioSimulatorEvidenceStorageKey('project-1'),
  'simulator-evidence.project-1.v1',
);
assert.equal(
  buildStudioSimulatorEvidenceStorageKey(null),
  'simulator-evidence.global.v1',
);

const storage = new Map<string, string>();

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    __TAURI__: undefined,
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    },
  },
});

const simulatorSession = resolveHostStudioSimulatorSession({
  platform: 'miniprogram',
  miniProgramPlatform: 'wechat',
  deviceModel: 'iphone-14-pro',
});

const firstEvidence = buildStudioSimulatorExecutionEvidence(
  simulatorSession,
  {
    surface: 'embedded',
    path: '/workspace/demo-project',
    command: 'pnpm simulate:wechat',
    profileId: 'powershell',
    timestamp: 61,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'simulate-wechat',
  },
);

await saveStoredStudioSimulatorExecutionEvidence(firstEvidence);

assert.deepEqual(
  await listStoredStudioSimulatorExecutionEvidence('project-1'),
  [firstEvidence],
);

const updatedEvidence = buildStudioSimulatorExecutionEvidence(
  simulatorSession,
  {
    surface: 'embedded',
    path: '/workspace/demo-project',
    command: 'pnpm simulate:wechat --open',
    profileId: 'powershell',
    timestamp: 62,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'simulate-wechat',
  },
);

await saveStoredStudioSimulatorExecutionEvidence(updatedEvidence);

assert.deepEqual(
  await listStoredStudioSimulatorExecutionEvidence('project-1'),
  [updatedEvidence],
);
assert.deepEqual(
  await listStoredStudioSimulatorExecutionEvidence(null),
  [],
);

const studioIndexSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/index.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioIndexSource.includes("export * from './simulator/evidenceStore';"),
  true,
  'Studio package should export simulator evidence store contracts.',
);

console.log('studio simulator evidence store contract passed.');
