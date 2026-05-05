import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { smokeReleaseAssets } from './smoke-release-assets.mjs';

function formatTarOctal(value, width) {
  return `${value.toString(8).padStart(width - 2, '0')}\0 `;
}

function createTarRecord(name, content = '') {
  const contentBuffer = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512, 0);
  Buffer.from(name.slice(0, 100), 'utf8').copy(header, 0);
  Buffer.from(formatTarOctal(0o644, 8), 'utf8').copy(header, 100);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 108);
  Buffer.from(formatTarOctal(0, 8), 'utf8').copy(header, 116);
  Buffer.from(formatTarOctal(contentBuffer.length, 12), 'utf8').copy(header, 124);
  Buffer.from(formatTarOctal(0, 12), 'utf8').copy(header, 136);
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'utf8');
  Buffer.from('ustar\0', 'utf8').copy(header, 257);
  Buffer.from('00', 'utf8').copy(header, 263);

  let checksum = 0;
  for (const value of header.values()) {
    checksum += value;
  }
  Buffer.from(formatTarOctal(checksum, 8), 'utf8').copy(header, 148);

  return Buffer.concat([
    header,
    contentBuffer,
    Buffer.alloc((512 - (contentBuffer.length % 512)) % 512, 0),
  ]);
}

await assert.rejects(() => smokeReleaseAssets({}), /A release family is required/);
await assert.rejects(
  () => smokeReleaseAssets({ family: 'web' }),
  /A release assets directory is required/,
);

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-smoke-'));
const webDir = path.join(releaseAssetsDir, 'web');
fs.mkdirSync(webDir, { recursive: true });
const archiveBaseName = 'sdkwork-birdcoder-web-release-local';
const archivePath = path.join(webDir, `${archiveBaseName}.tar.gz`);
fs.writeFileSync(
  archivePath,
  gzipSync(Buffer.concat([
    createTarRecord(
      `${archiveBaseName}/app/index.html`,
      '<html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>\n',
    ),
    createTarRecord(
      `${archiveBaseName}/app/assets/index.js`,
      'console.log("sdkwork birdcoder");\n',
    ),
    createTarRecord(
      `${archiveBaseName}/docs/index.html`,
      '<html><body>Docs</body></html>\n',
    ),
    createTarRecord(
      `${archiveBaseName}/docs/404.html`,
      '<html><body>Not found</body></html>\n',
    ),
    createTarRecord(
      `${archiveBaseName}/docs/search-index.json`,
      '[{"title":"Getting Started","url":"/guide/getting-started"}]\n',
    ),
    Buffer.alloc(1024, 0),
  ])),
);
fs.writeFileSync(
  path.join(webDir, 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'web',
    archiveRelativePath: `web/${archiveBaseName}.tar.gz`,
    arch: '',
    artifacts: [
      {
        relativePath: `web/${archiveBaseName}.tar.gz`,
        size: fs.statSync(archivePath).size,
      },
    ],
    platform: '',
  }, null, 2),
  'utf8',
);

const webResult = await smokeReleaseAssets({
  family: 'web',
  releaseAssetsDir,
});
assert.equal(webResult.family, 'web');
assert.ok(fs.existsSync(webResult.archivePath));
assert.ok(fs.existsSync(webResult.smokeReportPath));

await assert.rejects(
  () =>
    smokeReleaseAssets({
      family: 'unknown',
      releaseAssetsDir,
    }),
  /Unsupported release family: unknown/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });

console.log('smoke release assets contract passed.');
