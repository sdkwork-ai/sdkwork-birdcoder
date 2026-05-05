import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

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
  Buffer.from(formatTarOctal(0o644, 8), 'utf8').copy(header, 100);
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

function writeWebReleaseFixture({
  releaseAssetsDir,
  releaseTag = 'release-2026-04-11-01',
  records = [],
} = {}) {
  const webDir = path.join(releaseAssetsDir, 'web');
  const archiveBaseName = `sdkwork-birdcoder-web-${releaseTag}`;
  const archiveRelativePath = `web/${archiveBaseName}.tar.gz`;
  const archivePath = path.join(releaseAssetsDir, archiveRelativePath);

  mkdirSync(webDir, { recursive: true });
  writeFileSync(
    archivePath,
    gzipSync(Buffer.concat([
      ...records,
      Buffer.alloc(1024, 0),
    ])),
  );
  writeFileSync(
    path.join(webDir, 'release-asset-manifest.json'),
    `${JSON.stringify({
      accelerator: '',
      archiveFormat: 'tar.gz',
      archiveRelativePath,
      arch: '',
      artifacts: [
        {
          relativePath: archiveRelativePath,
          size: readFileSync(archivePath).length,
        },
      ],
      family: 'web',
      platform: '',
      productName: 'SDKWork BirdCoder',
      profileId: 'sdkwork-birdcoder',
      releaseTag,
      target: '',
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    archiveBaseName,
    archivePath,
    archiveRelativePath,
    manifestPath: path.join(webDir, 'release-asset-manifest.json'),
  };
}

function buildPassingArchiveRecords(bundleRoot) {
  return [
    createTarRecord({
      name: `${bundleRoot}/app/index.html`,
      content: '<html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/app/assets/index.js`,
      content: 'console.log("sdkwork birdcoder");\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/index.html`,
      content: '<html><body>Docs</body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/404.html`,
      content: '<html><body>Not found</body></html>\n',
    }),
    createTarRecord({
      name: `${bundleRoot}/docs/search-index.json`,
      content: `${JSON.stringify([
        {
          title: 'Getting Started',
          url: '/guide/getting-started',
          text: 'Start with SDKWork BirdCoder',
        },
      ])}\n`,
    }),
  ];
}

test('web release smoke validates the packaged archive and records release evidence', async () => {
  const smokePath = path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs');
  assert.equal(existsSync(smokePath), true, 'missing scripts/release/smoke-web-release-assets.mjs');

  const smoke = await import(pathToFileURL(smokePath).href);
  assert.equal(typeof smoke.parseArgs, 'function');
  assert.equal(typeof smoke.smokeWebReleaseAssets, 'function');
  assert.equal(typeof smoke.readTarGzEntries, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-web-smoke-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-01';
  const archiveBaseName = `sdkwork-birdcoder-web-${releaseTag}`;

  try {
    const fixture = writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: buildPassingArchiveRecords(archiveBaseName),
    });

    const result = await smoke.smokeWebReleaseAssets({
      releaseAssetsDir,
    });

    assert.equal(result.platform, 'web');
    assert.equal(result.arch, 'any');
    assert.equal(result.manifestPath.replaceAll('\\', '/'), fixture.manifestPath.replaceAll('\\', '/'));
    assert.equal(result.archivePath.replaceAll('\\', '/'), fixture.archivePath.replaceAll('\\', '/'));
    assert.equal(result.report.report.status, 'passed');
    assert.equal(result.report.report.family, 'web');
    assert.equal(result.report.report.smokeKind, 'web-archive-content');
    assert.deepEqual(result.report.report.artifactRelativePaths, [fixture.archiveRelativePath]);
    assert.deepEqual(
      result.report.report.checks.map((check) => check.id),
      [
        'artifact-integrity',
        'app-index',
        'app-assets',
        'docs-index',
        'docs-404',
        'docs-search-index',
        'public-doc-boundary',
      ],
    );
    assert.equal(existsSync(result.report.reportPath), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects archives that leak docs source into public release assets', async () => {
  const smoke = await import(
    pathToFileURL(path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs')).href
  );
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-web-smoke-docs-source-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-02';
  const archiveBaseName = `sdkwork-birdcoder-web-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName),
        createTarRecord({
          name: `${archiveBaseName}/docs-source/reports/private.md`,
          content: '# internal report\n',
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /must not include docs source payloads/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects internal documentation URLs in the public search index', async () => {
  const smoke = await import(
    pathToFileURL(path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs')).href
  );
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-web-smoke-internal-search-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-03';
  const archiveBaseName = `sdkwork-birdcoder-web-${releaseTag}`;

  try {
    writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: [
        ...buildPassingArchiveRecords(archiveBaseName).filter(
          (record) => !record.includes(Buffer.from(`${archiveBaseName}/docs/search-index.json`)),
        ),
        createTarRecord({
          name: `${archiveBaseName}/docs/search-index.json`,
          content: `${JSON.stringify([
            {
              title: 'Internal',
              url: '/reports/private',
            },
          ])}\n`,
        }),
      ],
    });

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /must not include internal documentation URL/i,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('web release smoke rejects stale manifest sizes before recording evidence', async () => {
  const smoke = await import(
    pathToFileURL(path.join(rootDir, 'scripts', 'release', 'smoke-web-release-assets.mjs')).href
  );
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-web-smoke-size-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');
  const releaseTag = 'release-2026-04-11-04';
  const archiveBaseName = `sdkwork-birdcoder-web-${releaseTag}`;

  try {
    const fixture = writeWebReleaseFixture({
      releaseAssetsDir,
      releaseTag,
      records: buildPassingArchiveRecords(archiveBaseName),
    });
    const manifest = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'));
    manifest.artifacts[0].size += 1;
    writeFileSync(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await assert.rejects(
      () => smoke.smokeWebReleaseAssets({
        releaseAssetsDir,
      }),
      /size mismatch/i,
    );
    assert.equal(
      existsSync(path.join(releaseAssetsDir, 'web', 'release-smoke-report.json')),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
