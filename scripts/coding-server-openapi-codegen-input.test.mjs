import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readCodingServerOpenApiCodegenInput,
} from './coding-server-openapi-codegen-input.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-openapi-codegen-input-'));
fs.mkdirSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi'), { recursive: true });
fs.writeFileSync(
  path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi', 'coding-server-v1.json'),
  JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: 'v1',
    },
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    releaseTag: 'release-local',
    assets: [
      {
        family: 'server',
        platform: 'windows',
        arch: 'x64',
      },
    ],
    codingServerOpenApiEvidence: {
      canonicalRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
      mirroredRelativePaths: ['server/windows/x64/openapi/coding-server-v1.json'],
      targetCount: 1,
      targets: ['windows/x64'],
      sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      openapi: '3.1.0',
      version: 'v1',
      title: 'SDKWork BirdCoder Coding Server API',
    },
  }, null, 2),
);

const result = readCodingServerOpenApiCodegenInput({
  releaseAssetsDir,
});

assert.equal(result.releaseTag, 'release-local');
assert.equal(result.canonicalRelativePath, 'server/windows/x64/openapi/coding-server-v1.json');
assert.equal(
  result.canonicalSnapshotPath,
  path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi', 'coding-server-v1.json'),
);
assert.deepEqual(result.targets, ['windows/x64']);
assert.equal(result.openapi, '3.1.0');
assert.equal(result.version, 'v1');
assert.equal(result.title, 'SDKWork BirdCoder Coding Server API');

fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    releaseTag: 'release-local',
    assets: [],
  }, null, 2),
);
assert.throws(
  () => readCodingServerOpenApiCodegenInput({
    releaseAssetsDir,
  }),
  /Missing finalized manifest codingServerOpenApiEvidence summary/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('coding server openapi codegen input contract passed.');
