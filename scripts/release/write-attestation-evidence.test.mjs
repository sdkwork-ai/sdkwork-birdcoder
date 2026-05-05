import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeManifestFixture({
  releaseAssetsDir,
  releaseTag = 'release-2026-04-12-01',
  repository = 'Sdkwork-Cloud/sdkwork-birdcoder',
  artifactRelativePath = 'web/sdkwork-birdcoder-web-assets-release-2026-04-12-01.tar.gz',
  artifactContent = 'web-assets',
} = {}) {
  const artifactPath = path.join(releaseAssetsDir, artifactRelativePath);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, artifactContent, 'utf8');
  const artifactSha256 = sha256(artifactContent);
  writeFileSync(
    path.join(releaseAssetsDir, 'release-manifest.json'),
    `${JSON.stringify({
      profileId: 'sdkwork-birdcoder',
      productName: 'SDKWork BirdCoder',
      releaseTag,
      repository,
      generatedAt: '2026-04-12T01:02:03.000Z',
      checksumFileName: 'SHA256SUMS.txt',
      releaseCoverage: {
        status: 'complete',
        allowPartialRelease: false,
        requiredTargets: ['web/web/any'],
        presentTargets: ['web/web/any'],
        missingTargets: [],
      },
      artifacts: [
        {
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          relativePath: artifactRelativePath,
          sha256: artifactSha256,
          size: statSync(artifactPath).size,
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );

  return {
    artifactRelativePath,
    artifactSha256,
  };
}

test('attestation evidence writer verifies finalized artifacts and writes machine-readable evidence', async () => {
  const evidencePath = path.join(rootDir, 'scripts', 'release', 'write-attestation-evidence.mjs');
  assert.equal(existsSync(evidencePath), true, 'missing scripts/release/write-attestation-evidence.mjs');

  const evidence = await import(pathToFileURL(evidencePath).href);
  assert.equal(typeof evidence.parseArgs, 'function');
  assert.equal(typeof evidence.writeAttestationEvidence, 'function');
  assert.throws(
    () => evidence.parseArgs(['--release-assets-dir']),
    /Missing value for --release-assets-dir/,
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-attestation-evidence-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    const { artifactRelativePath, artifactSha256 } = writeManifestFixture({ releaseAssetsDir });
    const ghCalls = [];

    const result = evidence.writeAttestationEvidence({
      profileId: 'sdkwork-birdcoder',
      releaseAssetsDir,
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      releaseTag: 'release-2026-04-12-01',
      now: () => '2026-04-12T02:03:04.000Z',
      execFileSyncImpl(command, args) {
        ghCalls.push({ command, args });
        assert.equal(command, 'gh');
        assert.match(args.join(' '), /attestation verify/);
        assert.match(args.join(' '), /--format json/);
        return JSON.stringify([
          {
            verificationResult: 'success',
            predicateType: 'https://slsa.dev/provenance/v1',
            subject: [
              {
                name: artifactRelativePath,
                digest: {
                  sha256: artifactSha256,
                },
              },
            ],
          },
        ]);
      },
    });

    assert.equal(ghCalls.length, 1);
    assert.equal(result.evidencePath, path.join(releaseAssetsDir, 'release-attestations.json'));
    assert.equal(result.artifactCount, 1);

    const written = JSON.parse(readFileSync(result.evidencePath, 'utf8'));
    assert.equal(written.schemaVersion, 1);
    assert.equal(written.repository, 'Sdkwork-Cloud/sdkwork-birdcoder');
    assert.equal(written.releaseTag, 'release-2026-04-12-01');
    assert.equal(written.predicateType, 'https://slsa.dev/provenance/v1');
    assert.equal(written.signerWorkflow, '.github/workflows/release-reusable.yml');
    assert.equal(written.artifacts.length, 1);
    assert.deepEqual(
      {
        relativePath: written.artifacts[0].relativePath,
        sha256: written.artifacts[0].sha256,
        repository: written.artifacts[0].repository,
        releaseTag: written.artifacts[0].releaseTag,
        sourceRef: written.artifacts[0].sourceRef,
        predicateType: written.artifacts[0].predicateType,
        signerWorkflow: written.artifacts[0].signerWorkflow,
        verified: written.artifacts[0].verified,
        verifiedAt: written.artifacts[0].verifiedAt,
      },
      {
        relativePath: artifactRelativePath,
        sha256: artifactSha256,
        repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
        releaseTag: 'release-2026-04-12-01',
        sourceRef: 'refs/tags/release-2026-04-12-01',
        predicateType: 'https://slsa.dev/provenance/v1',
        signerWorkflow: '.github/workflows/release-reusable.yml',
        verified: true,
        verifiedAt: '2026-04-12T02:03:04.000Z',
      },
    );
    assert.match(written.artifacts[0].verificationCommand, /gh attestation verify/);
    assert.match(written.artifacts[0].verificationCommand, /--source-ref refs\/tags\/release-2026-04-12-01/);
    assert.match(written.artifacts[0].verificationCommand, /--predicate-type https:\/\/slsa\.dev\/provenance\/v1/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('attestation evidence writer rejects verification output that does not bind the expected digest', async () => {
  const evidencePath = path.join(rootDir, 'scripts', 'release', 'write-attestation-evidence.mjs');
  const evidence = await import(pathToFileURL(evidencePath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-attestation-evidence-mismatch-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeManifestFixture({ releaseAssetsDir });

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'sdkwork-birdcoder',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          return JSON.stringify([
            {
              verificationResult: 'success',
              predicateType: 'https://slsa.dev/provenance/v1',
              subject: [
                {
                  name: 'web/sdkwork-birdcoder-web-assets-release-2026-04-12-01.tar.gz',
                  digest: {
                    sha256: '0'.repeat(64),
                  },
                },
              ],
            },
          ]);
        },
      }),
      /Attestation verification did not bind expected digest/,
    );

    assert.throws(
      () => evidence.writeAttestationEvidence({
        profileId: 'sdkwork-birdcoder',
        releaseAssetsDir,
        repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
        releaseTag: 'release-2026-04-12-01',
        execFileSyncImpl() {
          return '{not-json';
        },
      }),
      /Unable to parse gh attestation verification output/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
