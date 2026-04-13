import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { resolveHostStudioPreviewSession } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';
import { buildStudioPreviewExecutionEvidence } from '../packages/sdkwork-birdcoder-studio/src/preview/runtime.ts';

const evidenceStoreModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/preview/evidenceStore.ts',
  import.meta.url,
);

assert.equal(
  existsSync(evidenceStoreModulePath),
  true,
  'Studio preview evidence store must exist.',
);

const {
  buildStudioPreviewEvidenceStorageKey,
  listStoredStudioPreviewExecutionEvidence,
  saveStoredStudioPreviewExecutionEvidence,
} = await import('../packages/sdkwork-birdcoder-studio/src/preview/evidenceStore.ts');

assert.equal(
  buildStudioPreviewEvidenceStorageKey('project-1'),
  'preview-evidence.project-1.v1',
);
assert.equal(
  buildStudioPreviewEvidenceStorageKey(null),
  'preview-evidence.global.v1',
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

const previewSession = resolveHostStudioPreviewSession({
  url: 'http://127.0.0.1:4173',
});

const firstEvidence = buildStudioPreviewExecutionEvidence(
  previewSession,
  {
    path: '/workspace/demo-project',
    command: 'pnpm dev',
    profileId: 'powershell',
    timestamp: 41,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'preview-dev',
  },
);

await saveStoredStudioPreviewExecutionEvidence(firstEvidence);

assert.deepEqual(
  await listStoredStudioPreviewExecutionEvidence('project-1'),
  [firstEvidence],
);

const updatedEvidence = buildStudioPreviewExecutionEvidence(
  previewSession,
  {
    path: '/workspace/demo-project',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    profileId: 'powershell',
    timestamp: 42,
  },
  {
    projectId: 'project-1',
    runConfigurationId: 'preview-dev',
  },
);

await saveStoredStudioPreviewExecutionEvidence(updatedEvidence);

assert.deepEqual(
  await listStoredStudioPreviewExecutionEvidence('project-1'),
  [updatedEvidence],
);
assert.deepEqual(
  await listStoredStudioPreviewExecutionEvidence(null),
  [],
);

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes('saveStoredStudioPreviewExecutionEvidence('),
  true,
  'StudioPage should persist preview execution evidence after launch.',
);

console.log('studio preview evidence store contract passed.');
