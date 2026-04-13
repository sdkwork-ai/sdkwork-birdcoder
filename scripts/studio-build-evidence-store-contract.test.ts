import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const evidenceStoreModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/build/evidenceStore.ts',
  import.meta.url,
);

assert.equal(
  existsSync(evidenceStoreModulePath),
  true,
  'Studio build evidence store must exist.',
);

const {
  resolveStudioBuildProfile,
} = await import('../packages/sdkwork-birdcoder-studio/src/build/profiles.ts');
const {
  buildStudioBuildExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/build/runtime.ts');
const {
  buildStudioBuildEvidenceStorageKey,
  listStoredStudioBuildExecutionEvidence,
  saveStoredStudioBuildExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/build/evidenceStore.ts');

assert.equal(
  buildStudioBuildEvidenceStorageKey('project-1'),
  'build-evidence.project-1.v1',
);
assert.equal(
  buildStudioBuildEvidenceStorageKey(null),
  'build-evidence.global.v1',
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

const buildProfile = resolveStudioBuildProfile({
  platform: 'web',
  webDevice: 'desktop',
});

const firstEvidence = buildStudioBuildExecutionEvidence(
  buildProfile,
  {
    path: '/workspace/demo-project',
    command: 'pnpm build',
    profileId: 'powershell',
    timestamp: 51,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'build-web',
  },
);

await saveStoredStudioBuildExecutionEvidence(firstEvidence);

assert.deepEqual(
  await listStoredStudioBuildExecutionEvidence('project-1'),
  [firstEvidence],
);

const updatedEvidence = buildStudioBuildExecutionEvidence(
  buildProfile,
  {
    path: '/workspace/demo-project',
    command: 'pnpm build --mode production',
    profileId: 'powershell',
    timestamp: 52,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'build-web',
  },
);

await saveStoredStudioBuildExecutionEvidence(updatedEvidence);

assert.deepEqual(
  await listStoredStudioBuildExecutionEvidence('project-1'),
  [updatedEvidence],
);
assert.deepEqual(
  await listStoredStudioBuildExecutionEvidence(null),
  [],
);

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes('saveStoredStudioBuildExecutionEvidence('),
  true,
  'StudioPage should persist studio build execution evidence after launch.',
);

console.log('studio build evidence store contract passed.');
