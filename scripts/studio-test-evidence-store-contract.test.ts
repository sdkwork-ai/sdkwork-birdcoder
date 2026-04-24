import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const evidenceStoreModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/test/evidenceStore.ts',
  import.meta.url,
);

assert.equal(
  existsSync(evidenceStoreModulePath),
  true,
  'Studio test evidence store must exist.',
);

const {
  buildStudioTestExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/test/runtime.ts');
const {
  buildStudioTestEvidenceStorageKey,
  listStoredStudioTestExecutionEvidence,
  saveStoredStudioTestExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/test/evidenceStore.ts');

assert.equal(
  buildStudioTestEvidenceStorageKey('project-1'),
  'test-evidence.project-1.v1',
);
assert.equal(
  buildStudioTestEvidenceStorageKey(null),
  'test-evidence.global.v1',
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

const firstEvidence = buildStudioTestExecutionEvidence(
  {
    path: '/workspace/demo-project',
    command: 'npm test',
    profileId: 'powershell',
    timestamp: 51,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'test',
  },
);

await saveStoredStudioTestExecutionEvidence(firstEvidence);

assert.deepEqual(
  await listStoredStudioTestExecutionEvidence('project-1'),
  [firstEvidence],
);

const updatedEvidence = buildStudioTestExecutionEvidence(
  {
    path: '/workspace/demo-project',
    command: 'npm test -- --runInBand',
    profileId: 'powershell',
    timestamp: 52,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'test',
  },
);

await saveStoredStudioTestExecutionEvidence(updatedEvidence);

assert.deepEqual(
  await listStoredStudioTestExecutionEvidence('project-1'),
  [updatedEvidence],
);
assert.deepEqual(
  await listStoredStudioTestExecutionEvidence(null),
  [],
);

const studioIndexSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/index.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioIndexSource.includes("export * from './test/evidenceStore';"),
  true,
  'Studio package index should re-export the test evidence store.',
);
assert.equal(
  studioIndexSource.includes("export * from './test/runtime';"),
  true,
  'Studio package index should re-export the test execution runtime.',
);

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioExecutionHookSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioExecutionActions.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes("from './useStudioExecutionActions';"),
  true,
  'StudioPage should delegate test execution orchestration through the shared studio execution hook.',
);
assert.equal(
  studioExecutionHookSource.includes('saveStoredStudioTestExecutionEvidence('),
  true,
  'Studio execution hook should persist studio test execution evidence after launch.',
);

console.log('studio test evidence store contract passed.');
