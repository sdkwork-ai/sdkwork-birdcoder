import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(import.meta.dirname, '..');
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const runnerScriptPath = path.join(rootDir, 'scripts', 'run-user-center-standard.mjs');

assert.equal(
  rootPackageJson.scripts['test:user-center-standard'],
  'node scripts/run-user-center-standard.mjs',
  'BirdCoder must expose a canonical root user-center standard runner.',
);
assert.ok(
  fs.existsSync(runnerScriptPath),
  'BirdCoder must keep the canonical run-user-center-standard runner in the repository.',
);
assert.equal(
  rootPackageJson.scripts['test:rust-user-center-validation-contract'],
  'node scripts/birdcoder-rust-user-center-validation-contract.test.mjs',
  'BirdCoder must expose the Rust-side validation contract as a first-class root script.',
);
assert.equal(
  rootPackageJson.scripts['test:identity-seed-parity-contract'],
  'node scripts/identity-seed-parity-contract.test.mjs',
  'BirdCoder must expose the seed parity contract as a first-class root script.',
);
assert.match(
  rootPackageJson.scripts['check:identity-standard'] ?? '',
  /birdcoder-identity-standard-contract\.test\.mjs/,
  'BirdCoder identity standard must keep the shared identity contract in the standard lane.',
);
assert.match(
  rootPackageJson.scripts['check:identity-standard'] ?? '',
  /identity-command-matrix-contract\.test\.mjs/,
  'BirdCoder identity standard must keep the identity command matrix contract in the standard lane.',
);
assert.match(
  rootPackageJson.scripts['check:identity-standard'] ?? '',
  /user-center-plus-entity-standard-contract\.test\.mjs/,
  'BirdCoder identity standard must keep the user-center plus entity contract in the standard lane.',
);
assert.match(
  rootPackageJson.scripts['check:identity-standard'] ?? '',
  /user-center-plugin-contract\.test\.ts/,
  'BirdCoder identity standard must keep the user-center plugin contract in the standard lane.',
);

const governedSubchecks = [
  {
    label: 'runtime user-center bridge contract',
    args: ['scripts/runtime-user-center-bridge-contract.test.mjs'],
  },
  {
    label: 'birdcoder identity standard contract',
    args: ['scripts/birdcoder-identity-standard-contract.test.mjs'],
  },
  {
    label: 'user-center plus entity standard contract',
    args: ['scripts/user-center-plus-entity-standard-contract.test.mjs'],
  },
  {
    label: 'user-center plugin contract',
    args: ['--experimental-strip-types', 'scripts/user-center-plugin-contract.test.ts'],
  },
  {
    label: 'identity command matrix contract',
    args: ['scripts/identity-command-matrix-contract.test.mjs'],
  },
  {
    label: 'rust user-center validation contract',
    args: ['scripts/birdcoder-rust-user-center-validation-contract.test.mjs'],
  },
  {
    label: 'identity seed parity contract',
    args: ['scripts/identity-seed-parity-contract.test.mjs'],
  },
];

for (const subcheck of governedSubchecks) {
  const result = spawnSync(process.execPath, subcheck.args, {
    cwd: rootDir,
    shell: false,
    stdio: 'inherit',
    windowsHide: process.platform === 'win32',
  });

  assert.equal(
    result.status,
    0,
    `BirdCoder user-center standard must pass the governed ${subcheck.label} lane.`,
  );
}

console.log('birdcoder user-center standard contract passed.');
