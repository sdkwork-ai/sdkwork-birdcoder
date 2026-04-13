import assert from 'node:assert/strict';

import {
  buildLocalStoreKey,
  deserializeStoredValue,
  serializeStoredValue,
} from '../packages/sdkwork-birdcoder-commons/src/storage/localStore.ts';

assert.equal(buildLocalStoreKey('settings', 'app'), 'sdkwork-birdcoder:settings:app');

const raw = serializeStoredValue({ theme: 'dark', engine: 'codex' });
assert.equal(raw, '{"theme":"dark","engine":"codex"}');
assert.deepEqual(deserializeStoredValue(raw, null), { theme: 'dark', engine: 'codex' });
assert.deepEqual(deserializeStoredValue('{invalid', { ok: true }), { ok: true });

console.log('local store contract passed.');
