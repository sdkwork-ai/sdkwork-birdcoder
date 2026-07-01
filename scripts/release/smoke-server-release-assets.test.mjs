import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';
import { SERVER_CRATE_BINARY_NAME } from './release-build-paths.mjs';
import { createTarRecord, writeTarGzArchive } from './release-tar-test-fixtures.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-server-smoke-'));
const familyDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
const bundleRoot = 'sdkwork-birdcoder-server-release-local-linux-x64';
fs.mkdirSync(familyDir, { recursive: true });
writeTarGzArchive(
  path.join(familyDir, `${bundleRoot}.tar.gz`),
  [
    createTarRecord({
      name: `${bundleRoot}/server/bin/${SERVER_CRATE_BINARY_NAME}`,
      content: 'compiled server binary\n',
    }),
  ],
);
fs.mkdirSync(path.join(familyDir, 'openapi'), { recursive: true });
fs.writeFileSync(
  path.join(familyDir, 'openapi', 'coding-server-v1.json'),
  JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: 'v1',
    },
    servers: [
      {
        url: '/',
      },
    ],
    paths: {
      '/app/v3/api/system/routes': {
        get: {
          operationId: 'routes.list',
        },
      },
    },
    'x-sdkwork-api-cloud-gateway': {
      routeCatalogPath: '/app/v3/api/system/routes',
    },
  }, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(familyDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'server',
    platform: 'linux',
    arch: 'x64',
    archiveRelativePath: 'server/linux/x64/sdkwork-birdcoder-server-release-local-linux-x64.tar.gz',
    artifacts: [
      {
        relativePath: 'server/linux/x64/openapi/coding-server-v1.json',
      },
    ],
  }, null, 2),
);

const result = smokeServerReleaseAssets({
  releaseAssetsDir,
  platform: 'linux',
  arch: 'x64',
  target: 'x86_64-unknown-linux-gnu',
});
assert.equal(result.family, 'server');
assert.ok(fs.existsSync(result.archivePath));
assert.ok(fs.existsSync(result.smokeReportPath));

const missingBinaryReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-server-smoke-missing-binary-'));
try {
  const missingBinaryFamilyDir = path.join(missingBinaryReleaseAssetsDir, 'server', 'linux', 'x64');
  fs.mkdirSync(missingBinaryFamilyDir, { recursive: true });
  writeTarGzArchive(
    path.join(missingBinaryFamilyDir, `${bundleRoot}.tar.gz`),
    [
      createTarRecord({
        name: `${bundleRoot}/server/README.md`,
        content: 'no binary here\n',
      }),
    ],
  );
  fs.mkdirSync(path.join(missingBinaryFamilyDir, 'openapi'), { recursive: true });
  fs.copyFileSync(
    path.join(familyDir, 'openapi', 'coding-server-v1.json'),
    path.join(missingBinaryFamilyDir, 'openapi', 'coding-server-v1.json'),
  );
  fs.writeFileSync(
    path.join(missingBinaryFamilyDir, 'release-asset-manifest.json'),
    fs.readFileSync(path.join(familyDir, 'release-asset-manifest.json'), 'utf8'),
  );

  assert.throws(
    () => smokeServerReleaseAssets({
      releaseAssetsDir: missingBinaryReleaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
    }),
    /missing compiled server binary/i,
  );
} finally {
  fs.rmSync(missingBinaryReleaseAssetsDir, { recursive: true, force: true });
}

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('server release smoke contract passed.');
