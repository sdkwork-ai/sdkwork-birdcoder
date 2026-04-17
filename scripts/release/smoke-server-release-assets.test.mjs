import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-server-smoke-'));
const familyDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
fs.mkdirSync(familyDir, { recursive: true });
fs.writeFileSync(path.join(familyDir, 'sdkwork-birdcoder-server-release-local-linux-x64.tar.gz'), 'tar');
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
      '/api/core/v1/routes': {
        get: {
          operationId: 'core.listRoutes',
        },
      },
    },
    'x-sdkwork-api-gateway': {
      routeCatalogPath: '/api/core/v1/routes',
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

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('server release smoke contract passed.');
