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
assert.equal(
  serializeStoredValue({
    id: 101777208078558047n,
    workspaceId: 1001,
    ids: [1002n],
    nested: {
      pointBalance: 4097n,
    },
  }),
  '{"id":"101777208078558047","workspaceId":"1001","ids":["1002"],"nested":{"pointBalance":"4097"}}',
  'local store serialization must use the shared BirdCoder JSON codec so Long ids and BIGINT fields are written as exact strings.',
);
assert.deepEqual(deserializeStoredValue(raw, null), { theme: 'dark', engine: 'codex' });
assert.deepEqual(deserializeStoredValue('{invalid', { ok: true }), { ok: true });
assert.deepEqual(
  deserializeStoredValue(
    '{"sessionId":101777208078558047,"nested":{"messageId":101777208078558049}}',
    null,
  ),
  {
    sessionId: '101777208078558047',
    nested: {
      messageId: '101777208078558049',
    },
  },
  'local store deserialization must preserve unsafe Long identifiers as strings.',
);

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
