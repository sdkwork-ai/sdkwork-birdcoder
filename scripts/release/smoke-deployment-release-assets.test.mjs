import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { smokeDeploymentReleaseAssets } from './smoke-deployment-release-assets.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-deployment-smoke-'));

const containerDir = path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu');
fs.mkdirSync(containerDir, { recursive: true });
fs.writeFileSync(path.join(containerDir, 'sdkwork-birdcoder-container-release-local-linux-x64-cpu.tar.gz'), 'tar');
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
