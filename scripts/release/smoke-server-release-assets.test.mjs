import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';

function formatTarOctal(value, width) {
  return `${value.toString(8).padStart(width - 2, '0')}\0 `;
}

function createTarHeader({
  name,
  size,
  type = '0',
} = {}) {
  const header = Buffer.alloc(512, 0);
  Buffer.from(String(name ?? '').slice(0, 100), 'utf8').copy(header, 0);
  Buffer.from(formatTarOctal(0o755, 8), 'utf8').copy(header, 100);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 108);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 116);
  Buffer.from(formatTarOctal(size, 12), 'utf8').copy(header, 124);
  Buffer.from(formatTarOctal(0, 12), 'utf8').copy(header, 136);
  header.fill(0x20, 148, 156);
  header.write(String(type ?? '0').slice(0, 1), 156, 1, 'utf8');
  Buffer.from('ustar\0', 'utf8').copy(header, 257);
  Buffer.from('00', 'utf8').copy(header, 263);

  let checksum = 0;
  for (const value of header.values()) {
    checksum += value;
  }
  Buffer.from(formatTarOctal(checksum, 8), 'utf8').copy(header, 148);

  return header;
}

function createTarRecord({
  name,
  content = '',
  type = '0',
} = {}) {
  const contentBuffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(String(content ?? ''), 'utf8');
  const paddingSize = (512 - (contentBuffer.length % 512)) % 512;

  return Buffer.concat([
    createTarHeader({
      name,
      size: contentBuffer.length,
      type,
    }),
    contentBuffer,
    Buffer.alloc(paddingSize, 0),
  ]);
}

function writeTarGzArchive(archivePath, records) {
  fs.writeFileSync(
    archivePath,
    zlib.gzipSync(Buffer.concat([
      ...records,
      Buffer.alloc(1024, 0),
    ])),
  );
}

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-server-smoke-'));
const familyDir = path.join(releaseAssetsDir, 'server', 'linux', 'x64');
const bundleRoot = 'sdkwork-birdcoder-server-release-local-linux-x64';
fs.mkdirSync(familyDir, { recursive: true });
writeTarGzArchive(
  path.join(familyDir, `${bundleRoot}.tar.gz`),
  [
    createTarRecord({
      name: `${bundleRoot}/server/bin/sdkwork-birdcoder-server`,
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
