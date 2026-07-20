import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const pcServerPackageJsonPath = path.join(
  workspaceRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json',
);
const srcHostCargoPath = path.join(
  workspaceRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/Cargo.toml',
);
const srcHostLibPath = path.join(
  workspaceRoot,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/lib.rs',
);
const rootPackageJsonPath = path.join(workspaceRoot, 'package.json');

const pcServerPackageJson = JSON.parse(fs.readFileSync(pcServerPackageJsonPath, 'utf8'));
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const srcHostCargo = fs.readFileSync(srcHostCargoPath, 'utf8');

assert.match(
  pcServerPackageJson.scripts['start:server'],
  /sdkwork-api-birdcoder-standalone-gateway/u,
  'PC server dev must run the workspace sdkwork-api-birdcoder-standalone-gateway crate.',
);
assert.match(
  pcServerPackageJson.scripts['release:build:server'],
  /run-birdcoder-server-build/u,
  'PC server build must route through the canonical standalone-gateway build script.',
);

assert.match(
  rootPackageJson.scripts['check:server'],
  /sdkwork-api-birdcoder-standalone-gateway/u,
  'check:server must verify sdkwork-api-birdcoder-standalone-gateway instead of the retired src-host monolith.',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:server'],
  /src-host\/Cargo\.toml/u,
  'check:server must not run cargo test against the retired src-host monolith manifest.',
);

const legacyArchiveRoots = [
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/legacy-archive',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src-host/legacy-archive',
];

for (const relativePath of legacyArchiveRoots) {
  assert.equal(
    fs.existsSync(path.join(workspaceRoot, relativePath)),
    false,
    `Retired src-host legacy-archive must be removed; canonical logic lives under crates/: ${relativePath}`,
  );
}

assert.equal(
  fs.existsSync(srcHostLibPath),
  false,
  'src-host must not compile the legacy monolithic lib.rs.',
);
assert.doesNotMatch(
  srcHostCargo,
  /rusqlite/u,
  'src-host shim manifest must not depend on rusqlite after retirement.',
);
assert.match(
  srcHostCargo,
  /sdkwork-api-birdcoder-standalone-gateway/u,
  'src-host shim manifest must depend on sdkwork-api-birdcoder-standalone-gateway.',
);

console.log('legacy src-host retirement contract passed.');
