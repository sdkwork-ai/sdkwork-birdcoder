import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { sha256File } from '../sdkwork-utils-digest.mjs';
import { writePackageSbomEvidence } from './write-package-sbom-evidence.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-package-sbom-'));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runtimeAsset(runtimeRoot, relativePath, content) {
  const absolutePath = path.join(runtimeRoot, ...relativePath.split('/'));
  writeFile(absolutePath, content);
  return {
    relativePath,
    sha256: sha256File(absolutePath),
    size: fs.statSync(absolutePath).size,
  };
}

try {
  writeFile(
    path.join(fixtureRoot, 'package.json'),
    `${JSON.stringify({
      name: 'sdkwork-birdcoder-fixture',
      version: '0.1.0-test',
      dependencies: {
        '@sdkwork/utils': 'workspace:*',
      },
    }, null, 2)}\n`,
  );

  const runtimeRoot = path.join(
    fixtureRoot,
    'artifacts',
    'release',
    'server',
    'linux',
    'x64',
    'provider-runtime',
  );
  const node = runtimeAsset(runtimeRoot, 'node/bin/node', 'portable node runtime\n');
  const workers = [
    runtimeAsset(runtimeRoot, 'workers/generic-ts-sdk-worker.mjs', 'export const worker = "generic";\n'),
    runtimeAsset(runtimeRoot, 'workers/engine-sdk-live.mjs', 'export const worker = "engine";\n'),
    runtimeAsset(runtimeRoot, 'workers/codex-cli-live.mjs', 'export const worker = "codex";\n'),
    runtimeAsset(runtimeRoot, 'workers/provider-cli-live.mjs', 'export const worker = "provider";\n'),
  ];
  const manifestPath = path.join(runtimeRoot, 'runtime-manifest.json');
  writeFile(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 'sdkwork.birdcoder.provider-runtime',
      target: {
        platform: 'linux',
        architecture: 'x64',
      },
      node: {
        version: '22.20.0-test',
        ...node,
      },
      workers,
      providers: [
        { id: 'codex', bundled: false },
        { id: 'claude-code', bundled: false },
        { id: 'gemini-cli', bundled: false },
        { id: 'opencode', bundled: false },
      ],
      providerExecution: {
        bundledProviderExecutables: false,
        missingBehavior: 'fail-closed',
      },
    }, null, 2)}\n`,
  );

  const outputPath = path.join(fixtureRoot, 'artifacts', 'release', 'sbom', 'server.sbom.json');
  const result = writePackageSbomEvidence({
    appId: 'sdkwork-birdcoder',
    deploymentProfile: 'standalone',
    outputPath,
    packageId: 'linux-x64-standalone-server-tar-gz',
    providerRuntimeManifestPath: manifestPath,
    releaseTag: 'release-0.1.0',
    rootDir: fixtureRoot,
    runtimeTarget: 'server',
    targetArchitecture: 'x64',
    targetFamily: 'server',
    targetId: 'linux-x64-standalone-server-tar-gz',
    targetPlatform: 'linux',
  });

  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(result.sbom.bomFormat, 'CycloneDX');
  assert.equal(result.sbom.specVersion, '1.6');
  assert.equal(
    result.sbom.components.some((component) => component.name === '@sdkwork/utils'),
    true,
    'package SBOM must retain root dependency inventory',
  );

  const manifestComponent = result.sbom.components.find(
    (component) => component.name === 'sdkwork-birdcoder-provider-runtime-manifest',
  );
  assert.equal(manifestComponent.hashes[0].content, sha256File(manifestPath));

  const nodeComponent = result.sbom.components.find(
    (component) => component['bom-ref']?.startsWith('provider-runtime:node:'),
  );
  assert.equal(nodeComponent.version, '22.20.0-test');
  assert.equal(nodeComponent.hashes[0].content, node.sha256);

  const workerComponents = result.sbom.components.filter(
    (component) => component['bom-ref']?.startsWith('provider-runtime:worker:'),
  );
  assert.equal(workerComponents.length, workers.length);
  for (const worker of workers) {
    const component = workerComponents.find(
      (candidate) => candidate['bom-ref'] === `provider-runtime:worker:${worker.relativePath}`,
    );
    assert.equal(component.hashes[0].content, worker.sha256);
    assert.equal(
      component.properties.some(
        (property) => property.name === 'sdkwork:providerRuntimeSize' && property.value === String(worker.size),
      ),
      true,
    );
  }
  assert.equal(
    result.sbom.metadata.properties.some(
      (property) => property.name === 'sdkwork:providerExecutablesBundled' && property.value === 'false',
    ),
    true,
    'SBOM must not claim external Provider CLI executables are bundled',
  );

  assert.throws(
    () => writePackageSbomEvidence({
      outputPath: path.join(fixtureRoot, 'missing-runtime.sbom.json'),
      rootDir: fixtureRoot,
      targetFamily: 'server',
    }),
    /Provider runtime manifest is required/u,
  );

  writeFile(
    path.join(runtimeRoot, ...workers[0].relativePath.split('/')),
    'tampered worker\n',
  );
  assert.throws(
    () => writePackageSbomEvidence({
      outputPath: path.join(fixtureRoot, 'tampered-runtime.sbom.json'),
      providerRuntimeManifestPath: manifestPath,
      rootDir: fixtureRoot,
      targetFamily: 'server',
    }),
    /Provider runtime checksum mismatch/u,
  );

  assert.throws(
    () => writePackageSbomEvidence({
      outputPath: path.join(fixtureRoot, 'wrong-target-runtime.sbom.json'),
      providerRuntimeManifestPath: manifestPath,
      rootDir: fixtureRoot,
      targetArchitecture: 'arm64',
      targetFamily: 'server',
      targetPlatform: 'linux',
    }),
    /Provider runtime target mismatch/u,
  );

  const webOutputPath = path.join(fixtureRoot, 'web.sbom.json');
  const webResult = writePackageSbomEvidence({
    outputPath: webOutputPath,
    rootDir: fixtureRoot,
    targetFamily: 'web',
  });
  assert.equal(
    webResult.sbom.components.some(
      (component) => component['bom-ref']?.startsWith('provider-runtime:'),
    ),
    false,
    'web SBOM must not invent a bundled Provider runtime',
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('package SBOM provider runtime evidence contract passed.');
