import assert from 'node:assert/strict';

import {
  buildLocalStoreKey,
  deserializeStoredValue,
  serializeStoredValue,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/storage/localStore.ts';

assert.equal(
  buildLocalStoreKey('settings', 'app'),
  'sdkwork-birdcoder.ui.v1:settings:app',
  'Workbench local settings must use the versioned UI-only namespace.',
);

const raw = serializeStoredValue({ theme: 'dark', density: 'compact' });
assert.equal(raw, '{"theme":"dark","density":"compact"}');
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
assert.deepEqual(deserializeStoredValue(raw, null), { theme: 'dark', density: 'compact' });
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

assert.throws(
  () => serializeStoredValue({ unsafeId: Number.MAX_SAFE_INTEGER + 1 }),
  /unsafe JavaScript number/u,
  'UI settings must reject unsafe numeric identifiers instead of silently losing precision.',
);

console.log('local store contract passed.');
