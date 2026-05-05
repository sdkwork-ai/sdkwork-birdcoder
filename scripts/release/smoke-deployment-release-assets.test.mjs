import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { smokeDeploymentReleaseAssets } from './smoke-deployment-release-assets.mjs';

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

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-deployment-smoke-'));

const containerDir = path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu');
const containerBundleRoot = 'sdkwork-birdcoder-container-release-local-linux-x64-cpu';
fs.mkdirSync(containerDir, { recursive: true });
writeTarGzArchive(
  path.join(containerDir, `${containerBundleRoot}.tar.gz`),
  [
    createTarRecord({
      name: `${containerBundleRoot}/server/bin/sdkwork-birdcoder-server`,
      content: 'compiled server binary\n',
    }),
    createTarRecord({
      name: `${containerBundleRoot}/deploy/docker/Dockerfile`,
      content: 'FROM ubuntu:24.04\n',
    }),
  ],
);
fs.writeFileSync(
  path.join(containerDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'container',
    archiveRelativePath: 'container/linux/x64/cpu/sdkwork-birdcoder-container-release-local-linux-x64-cpu.tar.gz',
  }, null, 2),
);
fs.writeFileSync(
  path.join(containerDir, 'release-metadata.json'),
  JSON.stringify({ family: 'container', accelerator: 'cpu' }, null, 2),
);

const kubernetesDir = path.join(releaseAssetsDir, 'kubernetes', 'linux', 'x64', 'cpu');
fs.mkdirSync(kubernetesDir, { recursive: true });
fs.writeFileSync(path.join(kubernetesDir, 'sdkwork-birdcoder-kubernetes-release-local-linux-x64-cpu.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(kubernetesDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'kubernetes',
    archiveRelativePath: 'kubernetes/linux/x64/cpu/sdkwork-birdcoder-kubernetes-release-local-linux-x64-cpu.tar.gz',
  }, null, 2),
);
fs.writeFileSync(
  path.join(kubernetesDir, 'release-metadata.json'),
  JSON.stringify({ family: 'kubernetes', accelerator: 'cpu' }, null, 2),
);
fs.writeFileSync(path.join(kubernetesDir, 'values.release.yaml'), 'targetArchitecture: x64\n');

const containerResult = smokeDeploymentReleaseAssets({
  family: 'container',
  releaseAssetsDir,
  platform: 'linux',
  arch: 'x64',
  target: 'x86_64-unknown-linux-gnu',
  accelerator: 'cpu',
});
assert.equal(containerResult.family, 'container');
assert.ok(fs.existsSync(containerResult.smokeReportPath));

const missingBinaryReleaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-container-smoke-missing-binary-'));
try {
  const missingBinaryContainerDir = path.join(missingBinaryReleaseAssetsDir, 'container', 'linux', 'x64', 'cpu');
  fs.mkdirSync(missingBinaryContainerDir, { recursive: true });
  writeTarGzArchive(
    path.join(missingBinaryContainerDir, `${containerBundleRoot}.tar.gz`),
    [
      createTarRecord({
        name: `${containerBundleRoot}/deploy/docker/Dockerfile`,
        content: 'FROM ubuntu:24.04\n',
      }),
    ],
  );
  fs.writeFileSync(
    path.join(missingBinaryContainerDir, 'release-asset-manifest.json'),
    fs.readFileSync(path.join(containerDir, 'release-asset-manifest.json'), 'utf8'),
  );
  fs.writeFileSync(
    path.join(missingBinaryContainerDir, 'release-metadata.json'),
    JSON.stringify({ family: 'container', accelerator: 'cpu' }, null, 2),
  );

  assert.throws(
    () => smokeDeploymentReleaseAssets({
      family: 'container',
      releaseAssetsDir: missingBinaryReleaseAssetsDir,
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'cpu',
    }),
    /missing compiled server binary/i,
  );
} finally {
  fs.rmSync(missingBinaryReleaseAssetsDir, { recursive: true, force: true });
}

const kubernetesResult = smokeDeploymentReleaseAssets({
  family: 'kubernetes',
  releaseAssetsDir,
  platform: 'linux',
  arch: 'x64',
  target: 'x86_64-unknown-linux-gnu',
  accelerator: 'cpu',
});
assert.equal(kubernetesResult.family, 'kubernetes');
assert.ok(fs.existsSync(kubernetesResult.valuesPath));
assert.ok(fs.existsSync(kubernetesResult.smokeReportPath));

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('deployment release smoke contract passed.');
