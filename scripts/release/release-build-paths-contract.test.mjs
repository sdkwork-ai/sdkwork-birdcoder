import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  PC_DESKTOP_DIST_REL,
  PC_DESKTOP_TAURI_REL,
  PC_WEB_DIST_REL,
  SERVER_CRATE_BINARY_NAME,
  WORKSPACE_CARGO_TARGET_REL,
} from './release-build-paths.mjs';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const retiredReleasePathPatterns = [
  /packages[\\/]sdkwork-birdcoder-web[\\/]dist/u,
  /packages[\\/]sdkwork-birdcoder-desktop[\\/]dist/u,
  /packages[\\/]sdkwork-birdcoder-server[\\/]src-host/u,
  /path\.join\(rootDir, ['"]deploy['"], ['"]docker['"]\)/u,
];

const releaseScriptPaths = [
  'scripts/release/package-release-assets.mjs',
  'scripts/release/smoke-server-release-assets.mjs',
  'scripts/release/smoke-deployment-release-assets.mjs',
  'scripts/release/release-profiles.mjs',
];

for (const relativePath of releaseScriptPaths) {
  const source = readText(relativePath);
  assert.match(
    source,
    /release-build-paths\.mjs/u,
    `${relativePath} must import canonical release build paths.`,
  );
  for (const pattern of retiredReleasePathPatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} must not reference retired Claw-era release paths.`,
    );
  }
}

assert.equal(SERVER_CRATE_BINARY_NAME, 'sdkwork-birdcoder-api-server');
assert.equal(
  readText('scripts/release/release-profiles.mjs').includes(`binaryName: SERVER_CRATE_BINARY_NAME`),
  true,
  'Release profile must bind server binaryName to the workspace api-server crate.',
);

const pcWebPackageJsonPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/package.json',
);
const pcDesktopPackageJsonPath = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/package.json',
);

assert.equal(fs.existsSync(pcWebPackageJsonPath), true);
assert.equal(fs.existsSync(pcDesktopPackageJsonPath), true);
assert.equal(
  PC_WEB_DIST_REL.startsWith('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/'),
  true,
);
assert.equal(
  PC_DESKTOP_DIST_REL.startsWith('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/'),
  true,
);
assert.equal(
  PC_DESKTOP_TAURI_REL.startsWith('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/'),
  true,
);
assert.equal(WORKSPACE_CARGO_TARGET_REL, 'target');
assert.match(
  readText('scripts/release/package-release-assets.mjs'),
  /path\.join\(rootDir, ['"]deployments['"], ['"]docker['"]\)/u,
  'Container packaging must copy Docker build context from deployments/docker.',
);

console.log('release build paths contract passed.');
