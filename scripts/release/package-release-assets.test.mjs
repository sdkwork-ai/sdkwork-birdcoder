import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { packageReleaseAssets } from './package-release-assets.mjs';
import { RELEASE_ASSET_MANIFEST_FILE_NAME } from './release-profiles.mjs';

const SERVER_BINARY_TARGET = 'x86_64-unknown-linux-gnu';
const SERVER_BINARY_NAME = 'sdkwork-birdcoder-server';

function writeFile(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, value);
}

function writeWebDistFixture(rootDir) {
  writeFile(
    path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist', 'index.html'),
    '<!doctype html><script type="module" src="./assets/index.js"></script>\n',
  );
  writeFile(
    path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'dist', 'assets', 'index.js'),
    'export const web = true;\n',
  );
}

function writeDesktopDistFixture(rootDir) {
  writeFile(
    path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'dist', 'index.html'),
    '<!doctype html><script type="module" src="./assets/desktop.js"></script>\n',
  );
  writeFile(
    path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'dist', 'assets', 'desktop.js'),
    'export const desktop = true;\n',
  );
}

function writeDesktopInstallerBundleFixture(rootDir, targetTriple) {
  const releaseRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-desktop',
    'src-tauri',
    'target',
    targetTriple,
    'release',
    'bundle',
  );
  writeFile(
    path.join(releaseRoot, 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'),
    'signed-nsis-installer\n',
  );
  writeFile(
    path.join(releaseRoot, 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi'),
    'signed-msi-installer\n',
  );
  writeFile(
    path.join(releaseRoot, 'nsis', 'BirdCoder Installer.exe'),
    'signed-nsis-colliding-installer\n',
  );
  writeFile(
    path.join(releaseRoot, 'squirrel', 'BirdCoder Installer.exe'),
    'signed-secondary-colliding-installer\n',
  );
}

function writePartialDesktopInstallerBundleFixture(rootDir, targetTriple) {
  const releaseRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-desktop',
    'src-tauri',
    'target',
    targetTriple,
    'release',
    'bundle',
  );
  writeFile(
    path.join(releaseRoot, 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'),
    'signed-nsis-installer\n',
  );
}

function writeMismatchedDesktopInstallerBundleFixture(rootDir, targetTriple) {
  const releaseRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-desktop',
    'src-tauri',
    'target',
    targetTriple,
    'release',
    'bundle',
  );
  writeFile(
    path.join(releaseRoot, 'squirrel', 'SDKWork BirdCoder_0.1.0_x64-setup.exe'),
    'legacy-squirrel-installer\n',
  );
  writeFile(
    path.join(releaseRoot, 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi'),
    'signed-msi-installer\n',
  );
}

function writeMacosDesktopInstallerBundleFixture(rootDir, targetTriple, archSuffix) {
  const releaseRoot = path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-desktop',
    'src-tauri',
    'target',
    targetTriple,
    'release',
    'bundle',
  );
  writeFile(
    path.join(releaseRoot, 'macos', 'SDKWork BirdCoder.app', 'Contents', 'Info.plist'),
    '<plist><dict><key>CFBundleName</key><string>SDKWork BirdCoder</string></dict></plist>\n',
  );
  writeFile(
    path.join(releaseRoot, 'dmg', `SDKWork BirdCoder_0.1.0_${archSuffix}.dmg`),
    'unsigned-macos-dmg\n',
  );
}

function writeDocsDistFixture(rootDir) {
  writeFile(
    path.join(rootDir, 'docs', '.vitepress', 'dist', 'index.html'),
    '<!doctype html><title>BirdCoder Docs</title>\n',
  );
  writeFile(
    path.join(rootDir, 'docs', '.vitepress', 'dist', '404.html'),
    '<!doctype html><title>Not Found</title>\n',
  );
  writeFile(
    path.join(rootDir, 'docs', '.vitepress', 'dist', 'search-index.json'),
    JSON.stringify({ docs: [] }, null, 2) + '\n',
  );
}

function writeServerFixture(rootDir) {
  writeFile(
    path.join(rootDir, 'packages', 'sdkwork-birdcoder-server', 'src-host', 'src', 'main.rs'),
    'fn main() {}\n',
  );
  writeFile(
    path.join(
      rootDir,
      'packages',
      'sdkwork-birdcoder-server',
      'src-host',
      'target',
      SERVER_BINARY_TARGET,
      'release',
      SERVER_BINARY_NAME,
    ),
    'compiled-birdcoder-server-binary\n',
  );
  writeFile(
    path.join(
      rootDir,
      'packages',
      'sdkwork-birdcoder-server',
      'src-host',
      'target',
      'release',
      `${SERVER_BINARY_NAME}.exe`,
    ),
    'compiled-birdcoder-server-binary.exe\n',
  );
  writeFile(
    path.join(rootDir, 'artifacts', 'openapi', 'coding-server-v1.json'),
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
      'x-sdkwork-api-gateway': {
        routeCatalogPath: '/api/core/v1/routes',
      },
      paths: {
        '/api/core/v1/routes': {
          get: {
            operationId: 'core.listRoutes',
          },
        },
      },
    }, null, 2) + '\n',
  );
}

function writeDeploymentFixtures(rootDir) {
  writeFile(
    path.join(rootDir, 'deploy', 'docker', 'Dockerfile'),
    'FROM ubuntu:24.04\n',
  );
  writeFile(
    path.join(rootDir, 'deploy', 'docker', 'profiles', 'default.env'),
    'BIRDCODER_DATA_DIR=/var/lib/sdkwork-birdcoder\n',
  );
  writeFile(
    path.join(rootDir, 'deploy', 'docker', 'docker-compose.yml'),
    'services:\n  sdkwork-birdcoder:\n    build: .\n',
  );
  writeFile(
    path.join(rootDir, 'deploy', 'kubernetes', 'Chart.yaml'),
    'apiVersion: v2\nname: sdkwork-birdcoder\n',
  );
}

function withFixture(callback) {
  const originalCwd = process.cwd();
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-package-assets-'));

  try {
    process.chdir(fixtureRoot);
    return callback(fixtureRoot);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function assertThrowsWithMessage(callback, expectedMessage) {
  assert.throws(
    callback,
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, expectedMessage);
      return true;
    },
  );
}

function parseTarOctal(buffer) {
  const trimmed = buffer.toString('utf8').replace(/\0.*$/u, '').trim();
  return trimmed ? Number.parseInt(trimmed, 8) : 0;
}

function readTarGzEntryPaths(archivePath) {
  const archiveBuffer = gunzipSync(fs.readFileSync(archivePath));
  const entryPaths = [];
  let offset = 0;

  while (offset + 512 <= archiveBuffer.length) {
    const header = archiveBuffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/u, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/u, '');
    const size = parseTarOctal(header.subarray(124, 136));
    entryPaths.push((prefix ? `${prefix}/${name}` : name).replaceAll('\\', '/'));
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entryPaths;
}

function assertServerRuntimeArchiveShape(result, bundleBaseName) {
  const entries = readTarGzEntryPaths(result.archivePath);
  assert.ok(
    entries.includes(`${bundleBaseName}/server/bin/${SERVER_BINARY_NAME}`),
    `${result.manifest.family} archive must include the compiled server binary`,
  );
  assert.equal(
    entries.some((entryPath) => entryPath.startsWith(`${bundleBaseName}/server/src/`)),
    false,
    `${result.manifest.family} archive must not include Rust source files as the server runtime payload`,
  );
}

withFixture((fixtureRoot) => {
  writeWebDistFixture(fixtureRoot);
  writeDocsDistFixture(fixtureRoot);
  writeDesktopDistFixture(fixtureRoot);
  writeDesktopInstallerBundleFixture(fixtureRoot, 'x86_64-pc-windows-msvc');
  writeServerFixture(fixtureRoot);
  writeDeploymentFixtures(fixtureRoot);

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
    target: 'x86_64-pc-windows-msvc',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(desktopResult.archivePath));
  assert.equal(desktopResult.manifest.family, 'desktop');
  assert.equal(desktopResult.manifest.releaseTag, '');
  assert.doesNotMatch(desktopResult.archivePath, /release-local/);
  assert.equal(
    desktopResult.manifest.artifacts.some((artifact) => artifact.relativePath === 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe'),
    true,
    'desktop package manifest must include the native NSIS installer collected from Tauri bundle output',
  );
  assert.equal(
    desktopResult.manifest.artifacts.some((artifact) => artifact.relativePath === 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi'),
    true,
    'desktop package manifest must include the native MSI installer collected from Tauri bundle output',
  );
  assert.deepEqual(
    desktopResult.manifest.artifacts
      .filter((artifact) => artifact.relativePath.includes('/installers/'))
      .map((artifact) => ({
        relativePath: artifact.relativePath,
        kind: artifact.kind,
        bundle: artifact.bundle,
        installerFormat: artifact.installerFormat,
        target: artifact.target,
        signatureEvidence: artifact.signatureEvidence,
      }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    [
      {
        relativePath: 'desktop/windows/x64/installers/msi/SDKWork BirdCoder_0.1.0_x64_en-US.msi',
        kind: 'installer',
        bundle: 'msi',
        installerFormat: 'msi',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
          status: 'pending',
          required: true,
          scheme: 'windows-authenticode',
          verifiedAt: '',
          subject: '',
          issuer: '',
          timestamped: false,
          notarized: false,
          stapled: false,
          packageMetadataVerified: false,
        },
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/BirdCoder Installer.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
          status: 'pending',
          required: true,
          scheme: 'windows-authenticode',
          verifiedAt: '',
          subject: '',
          issuer: '',
          timestamped: false,
          notarized: false,
          stapled: false,
          packageMetadataVerified: false,
        },
      },
      {
        relativePath: 'desktop/windows/x64/installers/nsis/SDKWork BirdCoder_0.1.0_x64-setup.exe',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
          status: 'pending',
          required: true,
          scheme: 'windows-authenticode',
          verifiedAt: '',
          subject: '',
          issuer: '',
          timestamped: false,
          notarized: false,
          stapled: false,
          packageMetadataVerified: false,
        },
      },
      {
        relativePath: 'desktop/windows/x64/installers/squirrel/BirdCoder Installer.exe',
        kind: 'installer',
        bundle: 'squirrel',
        installerFormat: 'squirrel',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: {
          status: 'pending',
          required: true,
          scheme: 'windows-authenticode',
          verifiedAt: '',
          subject: '',
          issuer: '',
          timestamped: false,
          notarized: false,
          stapled: false,
          packageMetadataVerified: false,
        },
      },
    ],
    'desktop installer artifacts must carry explicit bundle, format, target, and trust evidence metadata instead of requiring downstream path inference',
  );
  assert.ok(
    fs.existsSync(path.join(path.dirname(desktopResult.manifestPath), 'installers', 'nsis', 'SDKWork BirdCoder_0.1.0_x64-setup.exe')),
    'desktop package output must publish the native NSIS installer as a release artifact',
  );
  assert.ok(
    fs.existsSync(path.join(path.dirname(desktopResult.manifestPath), 'installers', 'msi', 'SDKWork BirdCoder_0.1.0_x64_en-US.msi')),
    'desktop package output must publish the native MSI installer as a release artifact',
  );
  assert.deepEqual(
    desktopResult.manifest.artifacts
      .map((artifact) => artifact.relativePath)
      .filter((relativePath) => relativePath.endsWith('/BirdCoder Installer.exe'))
      .sort((left, right) => left.localeCompare(right)),
    [
      'desktop/windows/x64/installers/nsis/BirdCoder Installer.exe',
      'desktop/windows/x64/installers/squirrel/BirdCoder Installer.exe',
    ],
    'desktop package output must preserve Tauri bundle subdirectories so same-basename native installers cannot overwrite each other',
  );
  assert.equal(
    fs.readFileSync(path.join(path.dirname(desktopResult.manifestPath), 'installers', 'nsis', 'BirdCoder Installer.exe'), 'utf8'),
    'signed-nsis-colliding-installer\n',
    'desktop package output must preserve the first same-basename native installer contents',
  );
  assert.equal(
    fs.readFileSync(path.join(path.dirname(desktopResult.manifestPath), 'installers', 'squirrel', 'BirdCoder Installer.exe'), 'utf8'),
    'signed-secondary-colliding-installer\n',
    'desktop package output must preserve the second same-basename native installer contents',
  );

  const serverResult = packageReleaseAssets('server', {
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    platform: 'linux',
    arch: 'x64',
    target: SERVER_BINARY_TARGET,
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(serverResult.archivePath));
  assert.equal(serverResult.manifest.family, 'server');
  assertServerRuntimeArchiveShape(serverResult, 'sdkwork-birdcoder-server-release-local-linux-x64');
  assert.ok(fs.existsSync(path.join(path.dirname(serverResult.manifestPath), 'openapi', 'coding-server-v1.json')));
  assert.equal(
    serverResult.manifest.artifacts.some((artifact) => artifact.relativePath.endsWith('/openapi/coding-server-v1.json')),
    true,
  );

  const containerResult = packageReleaseAssets('container', {
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    platform: 'linux',
    arch: 'x64',
    target: SERVER_BINARY_TARGET,
    accelerator: 'cpu',
    'output-dir': 'artifacts/release',
  });
  assert.ok(fs.existsSync(containerResult.archivePath));
  assert.equal(containerResult.manifest.family, 'container');
  assertServerRuntimeArchiveShape(containerResult, 'sdkwork-birdcoder-container-release-local-linux-x64-cpu');
  assert.ok(fs.existsSync(path.join(path.dirname(containerResult.manifestPath), 'release-metadata.json')));
  assert.ok(
    readTarGzEntryPaths(containerResult.archivePath).includes(
      'sdkwork-birdcoder-container-release-local-linux-x64-cpu/deploy/docker/Dockerfile',
    ),
    'container release archive must preserve deploy/docker/Dockerfile for the OCI build context',
  );
  assert.ok(
    readTarGzEntryPaths(containerResult.archivePath).includes(
      'sdkwork-birdcoder-container-release-local-linux-x64-cpu/deploy/docker/profiles/default.env',
    ),
    'container release archive must preserve deploy/docker/profiles/default.env for Docker build context copies',
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
});

withFixture((fixtureRoot) => {
  writeFile(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src', 'index.ts'),
    'export const sourceOnly = true;\n',
  );
  writeFile(
    path.join(fixtureRoot, 'docs', 'index.md'),
    '# Internal docs source\n',
  );

  assertThrowsWithMessage(
    () => packageReleaseAssets('web', {
      profile: 'sdkwork-birdcoder',
      'release-tag': 'release-local',
      'output-dir': 'artifacts/release',
    }),
    /Missing required web app build output.*packages[\\/]sdkwork-birdcoder-web[\\/]dist.*Run `pnpm build` before packaging web release assets/u,
  );

  writeWebDistFixture(fixtureRoot);

  assertThrowsWithMessage(
    () => packageReleaseAssets('web', {
      profile: 'sdkwork-birdcoder',
      'release-tag': 'release-local',
      'output-dir': 'artifacts/release',
    }),
    /Missing required public docs build output.*docs[\\/]\.vitepress[\\/]dist.*Run `pnpm docs:build` before packaging web release assets/u,
  );
});

withFixture((fixtureRoot) => {
  writeWebDistFixture(fixtureRoot);
  writeServerFixture(fixtureRoot);
  fs.rmSync(path.join(fixtureRoot, 'artifacts', 'openapi'), { recursive: true, force: true });

  assertThrowsWithMessage(
    () => packageReleaseAssets('server', {
      profile: 'sdkwork-birdcoder',
      'release-tag': 'release-local',
      platform: 'linux',
      arch: 'x64',
      target: SERVER_BINARY_TARGET,
      'output-dir': 'artifacts/release',
    }),
    /Missing required coding-server OpenAPI snapshot.*artifacts[\\/]openapi[\\/]coding-server-v1\.json.*Run `pnpm generate:openapi:coding-server` before packaging server release assets/u,
  );
});

withFixture((fixtureRoot) => {
  writeWebDistFixture(fixtureRoot);
  writeServerFixture(fixtureRoot);

  fs.mkdirSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-desktop', 'src-tauri'), { recursive: true });
  writeFile(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src', 'index.ts'),
    'export const sourceOnly = true;\n',
  );

  assertThrowsWithMessage(
    () => packageReleaseAssets('desktop', {
      profile: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      'output-dir': 'artifacts/release',
    }),
    /Missing required desktop app build output.*packages[\\/]sdkwork-birdcoder-desktop[\\/]dist.*Run `pnpm tauri:build` before packaging desktop release assets/u,
  );

  fs.rmSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'dist'), { recursive: true, force: true });

  assertThrowsWithMessage(
    () => packageReleaseAssets('server', {
      profile: 'sdkwork-birdcoder',
      'release-tag': 'release-local',
      platform: 'linux',
      arch: 'x64',
      target: SERVER_BINARY_TARGET,
      'output-dir': 'artifacts/release',
    }),
    /Missing required server web build output.*packages[\\/]sdkwork-birdcoder-web[\\/]dist.*Run `pnpm build` before packaging server release assets/u,
  );

  assertThrowsWithMessage(
    () => packageReleaseAssets('container', {
      profile: 'sdkwork-birdcoder',
      'release-tag': 'release-local',
      platform: 'linux',
      arch: 'x64',
      target: SERVER_BINARY_TARGET,
      accelerator: 'cpu',
      'output-dir': 'artifacts/release',
    }),
    /Missing required container web build output.*packages[\\/]sdkwork-birdcoder-web[\\/]dist.*Run `pnpm build` before packaging container release assets/u,
  );
});

withFixture((fixtureRoot) => {
  writeDesktopDistFixture(fixtureRoot);
  writeMacosDesktopInstallerBundleFixture(fixtureRoot, 'aarch64-apple-darwin', 'aarch64');

  const desktopResult = packageReleaseAssets('desktop', {
    profile: 'sdkwork-birdcoder',
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    'output-dir': 'artifacts/release',
  });

  assert.equal(desktopResult.manifest.family, 'desktop');
  assert.ok(
    fs.existsSync(path.join(path.dirname(desktopResult.manifestPath), 'installers', 'app', 'SDKWork BirdCoder.app.tar.gz')),
    'macOS desktop packaging must publish the Tauri .app bundle as a file artifact, not leave it as an uncollected directory',
  );
  assert.ok(
    desktopResult.manifest.artifacts.some((artifact) => artifact.relativePath === 'desktop/macos/arm64/installers/app/SDKWork BirdCoder.app.tar.gz'),
    'macOS desktop manifest must include the archived .app bundle artifact for required app coverage',
  );
  assert.ok(
    desktopResult.manifest.artifacts.some((artifact) => artifact.relativePath === 'desktop/macos/arm64/installers/dmg/SDKWork BirdCoder_0.1.0_aarch64.dmg'),
    'macOS desktop manifest must keep the native dmg installer artifact alongside the archived .app bundle',
  );
});

withFixture((fixtureRoot) => {
  writeDesktopDistFixture(fixtureRoot);
  writePartialDesktopInstallerBundleFixture(fixtureRoot, 'x86_64-pc-windows-msvc');
  const outputFamilyDir = path.join(fixtureRoot, 'artifacts', 'release', 'desktop', 'windows', 'x64');

  assertThrowsWithMessage(
    () => packageReleaseAssets('desktop', {
      profile: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      'output-dir': 'artifacts/release',
    }),
    /Missing required desktop installer bundle artifacts.*profile sdkwork-birdcoder.*windows\/x64\/x86_64-pc-windows-msvc.*missing: msi.*Run `pnpm tauri:build` before packaging desktop release assets/u,
  );
  assert.equal(
    fs.existsSync(path.join(outputFamilyDir, RELEASE_ASSET_MANIFEST_FILE_NAME)),
    false,
    'desktop packaging must not write a manifest when required installer bundles are missing',
  );
  assert.deepEqual(
    fs.existsSync(outputFamilyDir)
      ? fs.readdirSync(outputFamilyDir).sort((left, right) => left.localeCompare(right))
      : [],
    [],
    'desktop packaging must fail before writing partial release artifacts when required installer bundles are missing',
  );
});

withFixture((fixtureRoot) => {
  writeDesktopDistFixture(fixtureRoot);
  writeMismatchedDesktopInstallerBundleFixture(fixtureRoot, 'x86_64-pc-windows-msvc');

  assertThrowsWithMessage(
    () => packageReleaseAssets('desktop', {
      profile: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-msvc',
      'output-dir': 'artifacts/release',
    }),
    /Missing required desktop installer bundle artifacts.*profile sdkwork-birdcoder.*windows\/x64\/x86_64-pc-windows-msvc.*missing: nsis/u,
  );
});

withFixture((fixtureRoot) => {
  writeDesktopDistFixture(fixtureRoot);
  writeDesktopInstallerBundleFixture(fixtureRoot, 'x86_64-pc-windows-gnu');

  assertThrowsWithMessage(
    () => packageReleaseAssets('desktop', {
      profile: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-gnu',
      'output-dir': 'artifacts/release',
    }),
    /Unsupported desktop release target for profile sdkwork-birdcoder: windows\/x64\/x86_64-pc-windows-gnu/u,
  );
});

withFixture(() => {
  assertThrowsWithMessage(
    () => packageReleaseAssets('desktop', {
      profile: 'sdkwork-birdcoder',
      platform: 'windows',
      arch: 'x64',
      target: 'x86_64-pc-windows-gnu',
      'output-dir': 'artifacts/release',
    }),
    /Unsupported desktop release target for profile sdkwork-birdcoder: windows\/x64\/x86_64-pc-windows-gnu/u,
  );
});

console.log('package release assets contract passed.');
