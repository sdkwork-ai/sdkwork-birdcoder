import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MINI_PROGRAM_ROOT } from '../scripts/lib/build-context.mjs';

test('session contract covers every mandatory clearing reason and scope', () => {
  const source = fs.readFileSync(
    path.join(
      MINI_PROGRAM_ROOT,
      'packages',
      'sdkwork-birdcoder-mp-core',
      'src',
      'session',
      'sessionScope.ts',
    ),
    'utf8',
  );
  for (const reason of [
    'logout',
    'refresh-failure',
    'account-switch',
    'tenant-switch',
    'organization-switch',
  ]) {
    assert.match(source, new RegExp(reason, 'u'));
  }
  for (const operation of [
    'storage.remove',
    'tokenManager.clearTokens',
    'contextStore.clear',
    'cache.clear',
    'state.clear',
  ]) {
    assert.match(source, new RegExp(operation.replace('.', '\\.'), 'u'));
  }
});
