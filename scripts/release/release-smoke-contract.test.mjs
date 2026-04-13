import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readReleaseSmokeReport,
  resolveReleaseSmokeReportPath,
  writeReleaseSmokeReport,
} from './release-smoke-contract.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-smoke-contract-'));

const serverReport = writeReleaseSmokeReport({
  releaseAssetsDir,
  family: 'server',
  platform: 'linux',
  arch: 'x64',
  target: 'x86_64-unknown-linux-gnu',
  smokeKind: 'bundle-contract',
  status: 'passed',
  manifestPath: path.join(releaseAssetsDir, 'server', 'linux', 'x64', 'release-asset-manifest.json'),
  artifactRelativePaths: ['server/linux/x64/sdkwork-birdcoder-server-release-local-linux-x64.tar.gz'],
  launcherRelativePath: 'server',
  checks: [
    {
      id: 'archive-present',
      status: 'passed',
      detail: 'server release archive exists and is referenced by the manifest',
    },
  ],
});

assert.ok(fs.existsSync(serverReport.reportPath));
assert.equal(
  resolveReleaseSmokeReportPath({
    releaseAssetsDir,
    family: 'web',
    platform: 'web',
    arch: 'any',
  }).replaceAll('\\', '/'),
  path.join(releaseAssetsDir, 'web', 'release-smoke-report.json').replaceAll('\\', '/'),
);
assert.equal(readReleaseSmokeReport(serverReport.reportPath).family, 'server');

const webReport = writeReleaseSmokeReport({
  releaseAssetsDir,
  family: 'web',
  platform: 'web',
  arch: 'any',
  smokeKind: 'bundle-contract',
  status: 'passed',
  manifestPath: path.join(releaseAssetsDir, 'web', 'release-asset-manifest.json'),
  artifactRelativePaths: ['web/sdkwork-birdcoder-web-release-local.tar.gz'],
  launcherRelativePath: 'app',
});
assert.ok(fs.existsSync(webReport.reportPath));
assert.equal(readReleaseSmokeReport(webReport.reportPath).family, 'web');

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('release smoke contract passed.');
