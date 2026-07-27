import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MINI_PROGRAM_ROOT } from '../scripts/lib/build-context.mjs';

test('production build evidence records the canonical profile identity', () => {
  const file = path.join(MINI_PROGRAM_ROOT, 'dist', 'build-manifest.json');
  assert.ok(fs.existsSync(file), 'run pnpm build before validating build evidence');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(manifest.deploymentProfile, 'cloud');
  assert.equal(manifest.environment, 'production');
  assert.equal(manifest.profileId, 'cloud.production');
  assert.equal(manifest.runtimeTarget, 'mini-program');
});
