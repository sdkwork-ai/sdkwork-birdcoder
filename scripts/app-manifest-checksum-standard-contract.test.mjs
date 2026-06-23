import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PLACEHOLDER_CHECKSUM_PATTERNS = [
  /^([0-9a-f]{8})\1{7}$/u,
  /^0{64}$/u,
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRootDir, relativePath), 'utf8'));
}

function isPlaceholderChecksum(checksum) {
  if (typeof checksum !== 'string' || checksum.length !== 64) {
    return true;
  }

  return PLACEHOLDER_CHECKSUM_PATTERNS.some((pattern) => pattern.test(checksum));
}

function assertManifestChecksumPolicy(manifestPath) {
  const manifest = readJson(manifestPath);
  const security = manifest.security ?? {};
  const packages = manifest.artifacts?.installConfig?.packages ?? [];

  if (!security.checksumRequired) {
    return;
  }

  for (const pkg of packages) {
    if (pkg.enabled === false) {
      continue;
    }

    assert.ok(
      !isPlaceholderChecksum(pkg.checksum),
      `${manifestPath} package ${pkg.id} must not ship repeating or zero placeholder checksums when checksumRequired is true.`,
    );
  }
}

assertManifestChecksumPolicy('sdkwork.app.config.json');

const h5Manifest = readJson('apps/sdkwork-birdcoder-h5/sdkwork.app.config.json');
const flutterManifest = readJson('apps/sdkwork-birdcoder-flutter-mobile/sdkwork.app.config.json');

assert.equal(
  h5Manifest.security?.checksumRequired,
  false,
  'H5 scaffold manifest must keep checksumRequired disabled until real release artifacts exist.',
);
assert.equal(
  flutterManifest.security?.checksumRequired,
  false,
  'Flutter scaffold manifest must keep checksumRequired disabled until real release artifacts exist.',
);

console.log('app manifest checksum standard contract passed.');
