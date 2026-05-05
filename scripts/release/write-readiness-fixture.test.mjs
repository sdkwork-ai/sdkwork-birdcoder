import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReleaseReadiness } from './assert-release-readiness.mjs';
import {
  DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR,
} from './candidate-dry-run.mjs';
import {
  DEFAULT_RELEASE_ASSETS_DIR,
  DEFAULT_RELEASE_TAG,
  DEFAULT_REPOSITORY,
  assertSafeReleaseReadinessFixtureDir,
  parseArgs,
  writeReleaseReadinessFixture,
} from './write-readiness-fixture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-readiness-fixture-'));

try {
  assert.equal(
    DEFAULT_RELEASE_ASSETS_DIR,
    path.join(repoRoot, 'artifacts', 'release-readiness-fixture'),
  );
  assert.equal(DEFAULT_RELEASE_TAG, 'release-fixture');
  assert.equal(DEFAULT_REPOSITORY, 'Sdkwork-Cloud/sdkwork-birdcoder');
  assert.throws(
    () => parseArgs(['--release-assets-dir']),
    /Missing value for --release-assets-dir/,
  );
  assert.throws(
    () => parseArgs(['--unknown']),
    /Unsupported readiness fixture option: --unknown/,
  );
  assert.deepEqual(
    parseArgs([
      '--profile',
      'sdkwork-birdcoder',
      '--release-tag',
      'release-2026.04.12',
      '--repository',
      'Sdkwork-Cloud/sdkwork-birdcoder',
      '--release-assets-dir',
      path.join(fixtureRoot, 'custom-release-readiness-fixture'),
      '--no-assert-ready',
      '--no-clean',
    ]),
    {
      profileId: 'sdkwork-birdcoder',
      releaseTag: 'release-2026.04.12',
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      releaseAssetsDir: path.join(fixtureRoot, 'custom-release-readiness-fixture'),
      assertReady: false,
      clean: false,
      help: false,
    },
  );

  assert.throws(
    () => writeReleaseReadinessFixture({
      releaseAssetsDir: repoRoot,
    }),
    /Refusing to clean unsafe release readiness fixture directory/,
  );
  assert.throws(
    () => writeReleaseReadinessFixture({
      releaseAssetsDir: path.join(repoRoot, 'artifacts'),
    }),
    /Refusing to clean unsafe release readiness fixture directory/,
  );
  assert.doesNotThrow(
    () => assertSafeReleaseReadinessFixtureDir(DEFAULT_RELEASE_CANDIDATE_DRY_RUN_DIR),
  );

  const staleFixtureDir = path.join(fixtureRoot, 'release-readiness-fixture');
  fs.mkdirSync(staleFixtureDir, { recursive: true });
  fs.writeFileSync(path.join(staleFixtureDir, 'stale.txt'), 'stale');

  const result = writeReleaseReadinessFixture({
    releaseAssetsDir: staleFixtureDir,
    releaseTag: 'release-fixture-test',
    repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
  });

  assert.equal(fs.existsSync(path.join(staleFixtureDir, 'stale.txt')), false);
  assert.equal(result.releaseAssetsDir, staleFixtureDir);
  assert.equal(result.artifactCount, 33);
  assert.equal(result.requiredTargetCount, 27);
  assert.equal(result.releasePlanTargetCount, 27);
  assert.equal(result.readiness?.artifactCount, 33);
  assert.equal(result.readiness?.requiredTargetCount, 27);
  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(fs.existsSync(result.checksumsPath), true);
  assert.equal(fs.existsSync(result.attestationEvidencePath), true);

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
  assert.equal(manifest.profileId, 'sdkwork-birdcoder');
  assert.equal(manifest.releaseTag, 'release-fixture-test');
  assert.equal(manifest.repository, 'Sdkwork-Cloud/sdkwork-birdcoder');
  assert.equal(manifest.releaseCoverage.status, 'complete');
  assert.equal(manifest.releaseCoverage.allowPartialRelease, false);
  assert.equal(manifest.releaseCoverage.requiredTargets.length, 27);
  assert.deepEqual(manifest.releaseCoverage.missingTargets, []);
  assert.equal(manifest.artifacts.length, 33);
  assert.equal(
    manifest.artifacts.filter((artifact) => artifact.family === 'desktop' && artifact.kind === 'installer').length,
    12,
  );
  assert.equal(
    manifest.assets.filter((asset) => asset.family === 'desktop').length,
    6,
  );
  assert.equal(
    manifest.assets.every((asset) => (
      asset.family !== 'desktop'
      || asset.desktopInstallerTrust?.status === 'passed'
      || false
    )),
    true,
  );
  assert.equal(
    manifest.assets.every((asset) => (
      asset.family !== 'desktop'
      || asset.desktopStartupReadinessSummary?.ready === true
    )),
    true,
  );

  const desktopInstallerArtifacts = manifest.artifacts.filter((artifact) => (
    artifact.family === 'desktop' && artifact.kind === 'installer'
  ));
  assert.equal(
    desktopInstallerArtifacts.every((artifact) => (
      artifact.signatureEvidence?.status === 'passed'
      && artifact.signatureEvidence?.required === true
      && artifact.signatureEvidence?.verifiedAt === '2026-04-12T00:00:01.000Z'
    )),
    true,
  );
  assert.match(
    desktopInstallerArtifacts.find((artifact) => (
      artifact.platform === 'windows'
      && artifact.arch === 'x64'
      && artifact.bundle === 'nsis'
    ))?.relativePath ?? '',
    /SDKWork-BirdCoder-windows-x64-setup\.exe$/,
  );
  assert.match(
    desktopInstallerArtifacts.find((artifact) => (
      artifact.platform === 'linux'
      && artifact.arch === 'x64'
      && artifact.bundle === 'appimage'
    ))?.relativePath ?? '',
    /SDKWork-BirdCoder-linux-x64\.AppImage$/,
  );

  const attestationEvidence = JSON.parse(fs.readFileSync(result.attestationEvidencePath, 'utf8'));
  assert.equal(attestationEvidence.repository, manifest.repository);
  assert.equal(attestationEvidence.releaseTag, manifest.releaseTag);
  assert.equal(attestationEvidence.predicateType, 'https://slsa.dev/provenance/v1');
  assert.equal(attestationEvidence.signerWorkflow, '.github/workflows/release-reusable.yml');
  assert.equal(attestationEvidence.artifacts.length, manifest.artifacts.length);
  assert.deepEqual(
    attestationEvidence.artifacts.map((artifact) => artifact.relativePath).sort(),
    manifest.artifacts.map((artifact) => artifact.relativePath).sort(),
  );
  assert.equal(
    attestationEvidence.artifacts.every((artifact) => (
      artifact.verified === true
      && artifact.verificationCommand.includes('gh attestation verify')
      && artifact.repository === manifest.repository
      && artifact.releaseTag === manifest.releaseTag
    )),
    true,
  );

  const readiness = assertReleaseReadiness({
    profileId: 'sdkwork-birdcoder',
    releaseAssetsDir: result.releaseAssetsDir,
  });
  assert.equal(readiness.artifactCount, manifest.artifacts.length);
  assert.equal(readiness.requiredTargetCount, 27);

  const noAssertFixtureDir = path.join(fixtureRoot, 'nested', 'release-readiness-fixture');
  const noAssertResult = writeReleaseReadinessFixture({
    releaseAssetsDir: noAssertFixtureDir,
    releaseTag: 'release-fixture-no-assert',
    assertReady: false,
  });
  assert.equal(noAssertResult.readiness, null);
  assert.equal(fs.existsSync(noAssertResult.attestationEvidencePath), true);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('release readiness fixture generator contract passed.');
