import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  listSdkworkAppManifestPaths,
  readSdkworkAppManifest,
} from './lib/sdkwork-app-manifest-paths.mjs';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const operatorReadme = read('docs/guides/operator/README.md');
const publishRunbook = read('docs/guides/operator/first-governed-release.md');
const preLaunchContract = read('scripts/app-manifest-pre-launch-contract.test.mjs');

for (const manifestPath of listSdkworkAppManifestPaths(rootDir)) {
  const relativePath = path.relative(rootDir, manifestPath);
  const appConfig = readSdkworkAppManifest(manifestPath);

  assert.equal(appConfig.publish?.status, 'DRAFT', `${relativePath} must stay DRAFT pre-launch.`);
  assert.equal(appConfig.publish?.preLaunch, true, `${relativePath} must declare publish.preLaunch.`);
  assert.equal(appConfig.metadata?.preLaunch, true, `${relativePath} must declare metadata.preLaunch.`);

  const packages = appConfig.artifacts?.installConfig?.packages ?? [];
  for (const pkg of packages) {
    assert.equal(
      pkg.enabled,
      false,
      `${relativePath} package ${pkg.id} must stay disabled until real release.`,
    );
    assert.equal(
      pkg.checksum,
      undefined,
      `${relativePath} package ${pkg.id} must not carry placeholder checksums.`,
    );
  }
}

assert.match(
  publishRunbook,
  /release:assert-ready/u,
  'First governed release runbook must end with release:assert-ready against real artifacts.',
);
assert.match(
  publishRunbook,
  /Never[\s\S]*synthetic fixture checksums/u,
  'Runbook must forbid promoting synthetic rehearsal checksums.',
);
assert.doesNotMatch(
  publishRunbook,
  /130 operations|client-critical subset/u,
  'Publish runbook must not describe stale OpenAPI subset gaps.',
);

assert.match(
  operatorReadme,
  /first-governed-release\.md/u,
  'Operator README must link the first governed release checklist.',
);

assert.equal(
  packageJson.scripts['release:rehearsal:verify'],
  'node scripts/release/rehearsal-verify.mjs',
  'Root must expose release:rehearsal:verify for rehearsal evidence verification.',
);

assert.match(
  preLaunchContract,
  /listSdkworkAppManifestPaths/u,
  'Pre-launch contract must validate every sdkwork.app.config.json surface manifest.',
);
assert.match(
  preLaunchContract,
  /checksum[\s\S]*undefined/u,
  'Pre-launch contract must forbid placeholder checksums on disabled packages.',
);

console.log('prelaunch publish gate contract passed.');
