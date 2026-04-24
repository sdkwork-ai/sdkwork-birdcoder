import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const appbaseRoot = path.resolve(workspaceRoot, '..', 'sdkwork-appbase');

function readText(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${absolutePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

const appbaseSeedContractsSource = readText(
  appbaseRoot,
  'packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/domain/userCenterSeedContracts.ts',
);
const birdcoderUserCenterSource = readText(
  workspaceRoot,
  'packages/sdkwork-birdcoder-server/src-host/src/user_center.rs',
);

for (const canonicalFieldName of [
  'defaultTenant',
  'defaultOwnerUser',
  'defaultProfile',
  'defaultMembership',
  'localProviderMetadata',
  'defaultAccount',
  'defaultEmail',
  'defaultPhone',
  'defaultPassword',
  'fixedVerificationCode',
  'defaultLoginMethod',
]) {
  assert.match(
    appbaseSeedContractsSource,
    new RegExp(`"${canonicalFieldName}"`, 'u'),
    `sdkwork-appbase canonical seed contract must publish ${canonicalFieldName}.`,
  );
}

assert.match(
  birdcoderUserCenterSource,
  /struct UserCenterSeedPolicy/u,
  'BirdCoder Rust user-center must define an explicit seed policy surface.',
);
assert.match(
  birdcoderUserCenterSource,
  /fn resolve_user_center_seed_policy_from_env\(\) -> UserCenterSeedPolicy/u,
  'BirdCoder Rust user-center must resolve seed policy from the governed identity mode.',
);
assert.match(
  birdcoderUserCenterSource,
  /fn resolve_local_fixed_verify_code\(seed_policy: &UserCenterSeedPolicy\) -> Option<String>/u,
  'BirdCoder Rust user-center must gate the fixed verify code through the seed policy.',
);
assert.match(
  birdcoderUserCenterSource,
  /if !seed_policy\.authority_seed_enabled \{\s*return Ok\(\(\)\);\s*\}/u,
  'BirdCoder Rust bootstrap seeding must short-circuit when canonical authority seeding is disabled.',
);

console.log('birdcoder identity seed parity contract passed.');
