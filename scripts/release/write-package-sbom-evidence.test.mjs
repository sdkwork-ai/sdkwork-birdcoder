import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writePackageSbomEvidence } from './write-package-sbom-evidence.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-package-sbom-'));

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

try {
  writeFile(
    path.join(fixtureRoot, 'package.json'),
    `${JSON.stringify({
      name: '@sdkwork/birdcoder-workspace',
      version: '0.1.0-test',
      dependencies: {
        '@sdkwork/agents-app-sdk': 'workspace:*',
        '@sdkwork/utils': '^1.2.3',
      },
      optionalDependencies: {
        '@sdkwork/native-observability': '~2.0.0',
      },
    }, null, 2)}\n`,
  );

  const outputPath = path.join(fixtureRoot, 'artifacts', 'release', 'sbom', 'server.sbom.json');
  const result = writePackageSbomEvidence({
    appId: 'sdkwork-birdcoder',
    deploymentProfile: 'standalone',
    outputPath,
    packageId: 'linux-x64-standalone-server-tar-gz',
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
  assert.equal(result.sbom.metadata.component.name, 'sdkwork-birdcoder');
  assert.equal(result.sbom.metadata.component.version, 'release-0.1.0');
  assert.deepEqual(
    result.sbom.components.map((component) => component.name),
    [
      '@sdkwork/agents-app-sdk',
      '@sdkwork/native-observability',
      '@sdkwork/utils',
    ],
    'SBOM dependency inventory must be deterministic.',
  );
  assert.equal(
    result.sbom.components.find((component) => component.name === '@sdkwork/agents-app-sdk')?.version,
    '0.1.0-test',
    'workspace dependency versions must resolve to the application version.',
  );
  assert.equal(
    result.sbom.components.find((component) => component.name === '@sdkwork/native-observability')
      ?.properties.some((property) => property.name === 'sdkwork:dependencyScope' && property.value === 'optional'),
    true,
  );
  assert.equal(
    result.sbom.metadata.properties.some(
      (property) => property.name === 'sdkwork:targetArchitecture' && property.value === 'x64',
    ),
    true,
  );

  assert.throws(
    () => writePackageSbomEvidence({
      outputPath: path.join(fixtureRoot, 'missing-package.sbom.json'),
      rootDir: path.join(fixtureRoot, 'missing-root'),
    }),
    /Missing required root package manifest/u,
  );

  const writtenSbom = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.deepEqual(writtenSbom, result.sbom);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('package SBOM ownership contract passed.');
