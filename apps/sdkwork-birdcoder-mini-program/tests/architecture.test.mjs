import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MINI_PROGRAM_ROOT } from '../scripts/lib/build-context.mjs';

const PACKAGE_NAMES = [
  'sdkwork-birdcoder-mp-core',
  'sdkwork-birdcoder-mp-commons',
  'sdkwork-birdcoder-mp-shell',
  'sdkwork-birdcoder-mp-workbench',
  'sdkwork-birdcoder-mp-host',
];

test('required SDKWork mini program source packages and component specs exist', () => {
  for (const packageName of PACKAGE_NAMES) {
    const packageRoot = path.join(MINI_PROGRAM_ROOT, 'packages', packageName);
    assert.ok(fs.existsSync(path.join(packageRoot, 'src', 'index.ts')), packageName);
    assert.ok(fs.existsSync(path.join(packageRoot, 'specs', 'component.spec.json')), packageName);
  }
});

test('root src stays limited to bootstrap and native projection surfaces', () => {
  const allowed = new Set([
    'app.ts',
    'app.json',
    'app.wxss',
    'bootstrap',
    'pages',
    'runtime',
    'routes',
    'shell',
    'sitemap.json',
    'subpackages',
  ]);
  for (const entry of fs.readdirSync(path.join(MINI_PROGRAM_ROOT, 'src'))) {
    assert.ok(allowed.has(entry), `unexpected root source owner: ${entry}`);
  }
});
