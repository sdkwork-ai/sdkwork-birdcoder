import assert from 'node:assert/strict';

import {
  buildLocalStoreKey,
  deserializeStoredValue,
  serializeStoredValue,
} from '../packages/sdkwork-birdcoder-commons/src/storage/localStore.ts';
import { createJsonRecordRepository } from '../packages/sdkwork-birdcoder-commons/src/storage/dataKernel.ts';

assert.equal(buildLocalStoreKey('settings', 'app'), 'sdkwork-birdcoder:settings:app');

const raw = serializeStoredValue({ theme: 'dark', engine: 'codex' });
assert.equal(raw, '{"theme":"dark","engine":"codex"}');
assert.deepEqual(deserializeStoredValue(raw, null), { theme: 'dark', engine: 'codex' });
assert.deepEqual(deserializeStoredValue('{invalid', { ok: true }), { ok: true });

const demoRepository = createJsonRecordRepository({
  binding: {
    entityName: 'workbench_preference',
    preferredProvider: 'sqlite',
    storageKey: 'demo',
    storageMode: 'key-value',
    storageScope: 'tests',
  },
  fallback: { theme: 'dark' },
});

assert.equal(
  demoRepository.definition.entityName,
  'workbench_preference',
  'JSON record repositories should default their lightweight definition entityName from the binding so browser consumers do not need to import the heavier entity-definition registry.',
);

console.log('local store contract passed.');
