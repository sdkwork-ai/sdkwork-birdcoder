import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  compareReference,
  discoverRendererEntries,
  readAsarEntry,
  readAsarIndex,
} from './codex-desktop-reference-audit.mjs';

function buildAsarFixture(fileEntries) {
  const files = {};
  let offset = 0;
  const data = [];
  for (const [entryPath, content] of Object.entries(fileEntries)) {
    const buffer = Buffer.from(content);
    const segments = entryPath.split('/');
    let current = files;
    for (const segment of segments.slice(0, -1)) {
      current[segment] ??= { files: {} };
      current = current[segment].files;
    }
    current[segments.at(-1)] = { offset: String(offset), size: buffer.length };
    offset += buffer.length;
    data.push(buffer);
  }
  const header = Buffer.from(JSON.stringify({ files }));
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(header.length + 8, 4);
  prefix.writeUInt32LE(header.length, 12);
  return Buffer.concat([prefix, header, ...data]);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-asar-test-'));
try {
  const archivePath = path.join(temporaryRoot, 'app.asar');
  fs.writeFileSync(
    archivePath,
    buildAsarFixture({
      '.vite/build/main-fixture.js': 'main',
      '.vite/build/src-fixture.js': 'bridge',
      'package.json': '{"version":"1.0.0"}',
      'webview/assets/app-fixture.css': '@media(max-width: 640px){}',
      'webview/assets/app-initial-fixture.css': '.multilineSurface{}',
      'webview/assets/app-initial-fixture.js': 'agentMessage',
      'webview/assets/automations-page-fixture.js': 'automations',
      'webview/assets/browser-fixture.js': 'browser',
      'webview/assets/browser-sidebar-hidden-background-webview-host-fixture.js': 'background',
      'webview/assets/browser-sidebar-hidden-browser-use-webview-host-fixture.js': 'browser-use',
      'webview/assets/browser-use-settings-fixture.js': 'settings',
      'webview/assets/remote-connections-settings-fixture.js': 'connections',
      'webview/assets/remote-conversation-page-fixture.js': 'remote',
      'webview/assets/thread-browser-panel-tabs-fixture.js': 'tabs',
    }),
  );
  const index = readAsarIndex(archivePath);
  const renderer = discoverRendererEntries(index.entries);
  assert.equal(renderer.appInitial.path, 'webview/assets/app-initial-fixture.js');
  assert.equal(
    renderer.appInitialStylesheet.path,
    'webview/assets/app-initial-fixture.css',
  );
  assert.equal(readAsarEntry(index, renderer.packageJson).toString('utf8'), '{"version":"1.0.0"}');

  const expected = {
    artifacts: [{ path: 'artifact', sha256: 'old', sizeBytes: 1 }],
    browserRuntime: { nodeVersion: '1', pluginVersion: '1' },
    build: '1',
    installationVerification: { packageFullName: 'old', packageVersion: '1' },
    packageBuildNumber: '1',
    providerHost: { version: '1' },
    rendererPackageVersion: '1',
    runtimeArchiveSha256: 'old-runtime',
    semanticEvidence: { marker: true },
  };
  const observed = {
    artifacts: [{ path: 'artifact', sha256: 'new', sizeBytes: 1 }],
    browserRuntime: {
      nodeVersion: '1',
      pluginVersion: '1',
      runtimeArchiveVersion: '2',
    },
    build: '2',
    installationVerification: { packageFullName: 'new', packageVersion: '2' },
    packageBuildNumber: '2',
    providerHost: { version: '1' },
    rendererPackageVersion: '1',
    runtimeArchiveSha256: 'new-runtime',
    semanticEvidence: { marker: false },
  };
  assert.deepEqual(
    compareReference(expected, observed).map((item) => item.field),
    [
      'reference.build',
      'reference.packageBuildNumber',
      'reference.browserRuntime.runtimeArchiveVersion',
      'reference.installationVerification.packageFullName',
      'reference.installationVerification.packageVersion',
      'reference.runtimeArchiveSha256',
      'reference.semanticEvidence',
      'artifact.sha256',
    ],
  );
} finally {
  fs.rmSync(temporaryRoot, { force: true, recursive: true });
}

console.log('codex desktop reference audit tests passed.');
