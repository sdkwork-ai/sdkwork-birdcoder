import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { packageReleaseAssets } from './package-release-assets.mjs';

const originalCwd = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-package-assets-'));

try {
  fs.mkdirSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'deploy', 'kubernetes'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src', 'index.ts'),
    'export const web = true;\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri', 'tauri.conf.json'),
    '{}\n',
  );
  fs.mkdirSync(path.join(fixtureRoot, 'artifacts', 'openapi'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'artifacts', 'openapi', 'coding-server-v1.json'),
    JSON.stringify({
      openapi: '3.1.0',
      info: {
        title: 'SDKWork BirdCoder Coding Server API',
        version: 'v1',
      },
    }, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'deploy', 'kubernetes', 'Chart.yaml'),
    'apiVersion: v2\nname: sdkwork-birdcoder\n',
  );

  process.chdir(fixtureRoot);

  const webResult = packageReleaseAssets('web', {
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(webResult.archivePath));
  assert.ok(fs.existsSync(webResult.manifestPath));
  assert.equal(webResult.manifest.family, 'web');

  const desktopResult = packageReleaseAssets('desktop', {
    profile: 'sdkwork-birdcoder',
    platform: 'windows',
    arch: 'x64',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(desktopResult.archivePath));
  assert.equal(desktopResult.manifest.family, 'desktop');
  assert.equal(desktopResult.manifest.releaseTag, '');
  assert.doesNotMatch(desktopResult.archivePath, /release-local/);

  const serverResult = packageReleaseAssets('server', {
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    platform: 'linux',
    arch: 'x64',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(serverResult.archivePath));
  assert.equal(serverResult.manifest.family, 'server');
  assert.ok(fs.existsSync(path.join(path.dirname(serverResult.manifestPath), 'openapi', 'coding-server-v1.json')));
  assert.equal(
    serverResult.manifest.artifacts.some((artifact) => artifact.relativePath.endsWith('/openapi/coding-server-v1.json')),
    true,
  );

  const kubernetesResult = packageReleaseAssets('kubernetes', {
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    platform: 'linux',
    arch: 'x64',
    accelerator: 'cpu',
    'image-repository': 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server',
    'image-tag': 'release-local-linux-x64',
    'image-digest': 'sha256:test',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(kubernetesResult.archivePath));
  assert.ok(fs.existsSync(path.join(path.dirname(kubernetesResult.manifestPath), 'values.release.yaml')));
  assert.ok(fs.existsSync(path.join(path.dirname(kubernetesResult.manifestPath), 'release-metadata.json')));
  assert.match(
    fs.readFileSync(path.join(path.dirname(kubernetesResult.manifestPath), 'values.release.yaml'), 'utf8'),
    /image:\s*\n  repository: ghcr.io\/sdkwork-cloud\/sdkwork-birdcoder-server\n  tag: release-local-linux-x64\n  digest: sha256:test/m,
  );
} finally {
  process.chdir(originalCwd);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('package release assets contract passed.');
