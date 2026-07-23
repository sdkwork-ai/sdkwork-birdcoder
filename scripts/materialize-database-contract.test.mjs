import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertBaselineOnlyMaterializationIsSafe,
  listBirdCoderForwardMigrations,
} from './materialize-database-contract.mjs';

const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'sdkwork-birdcoder-materialize-guard-'),
);

try {
  const sqliteMigrationDirectory = path.join(
    fixtureRoot,
    'database',
    'migrations',
    'sqlite',
  );
  fs.mkdirSync(sqliteMigrationDirectory, { recursive: true });
  assert.deepEqual(listBirdCoderForwardMigrations(fixtureRoot), []);
  assert.doesNotThrow(() => assertBaselineOnlyMaterializationIsSafe(fixtureRoot));

  const migrationPath = path.join(sqliteMigrationDirectory, '0002_example.up.sql');
  fs.writeFileSync(migrationPath, 'ALTER TABLE studio_project ADD COLUMN example TEXT;\n');

  assert.deepEqual(listBirdCoderForwardMigrations(fixtureRoot), [migrationPath]);
  assert.throws(
    () => assertBaselineOnlyMaterializationIsSafe(fixtureRoot),
    /Refusing baseline-only database contract materialization[\s\S]*0002_example\.up\.sql/u,
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('database contract materialization guard passed.');
