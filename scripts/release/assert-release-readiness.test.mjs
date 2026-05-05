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
const minimalReleaseProfile = Object.freeze({
  id: 'sdkwork-birdcoder',
  release: Object.freeze({
    manifestFileName: 'release-manifest.json',
    manifestChecksumFileName: 'release-manifest.json.sha256.txt',
    attestationEvidenceFileName: 'release-attestations.json',
    attestationPredicateType: 'https://slsa.dev/provenance/v1',
    attestationSignerWorkflowPath: '.github/workflows/release-reusable.yml',
    globalChecksumsFileName: 'SHA256SUMS.txt',
    enableArtifactAttestations: true,
  }),
  desktop: Object.freeze({
    matrix: Object.freeze([]),
  }),
  server: Object.freeze({
    matrix: Object.freeze([]),
  }),
  container: Object.freeze({
    matrix: Object.freeze([]),
  }),
  kubernetes: Object.freeze({
    matrix: Object.freeze([]),
  }),
});

function resolveMinimalReleaseProfile(profileId = 'sdkwork-birdcoder') {
  assert.equal(profileId, 'sdkwork-birdcoder');
  return minimalReleaseProfile;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeManifestChecksumSidecar(releaseAssetsDir) {
  writeFileSync(
    path.join(releaseAssetsDir, 'release-manifest.json.sha256.txt'),
    `${sha256(readFileSync(path.join(releaseAssetsDir, 'release-manifest.json')))}  release-manifest.json\n`,
    'utf8',
  );
}

function writeReadyReleaseFixture({
  releaseAssetsDir,
  profileId = 'sdkwork-birdcoder',
  releaseCoverage = {
    status: 'complete',
    allowPartialRelease: false,
    requiredTargets: ['web/web/any'],
    presentTargets: ['web/web/any'],
    missingTargets: [],
  },
  checksumFileName = 'SHA256SUMS.txt',
  artifactRelativePath = 'web/sdkwork-birdcoder-web-assets-release-2026-04-12-01.tar.gz',
  artifactContent = 'web-assets',
} = {}) {
  const artifactPath = path.join(releaseAssetsDir, artifactRelativePath);
  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, artifactContent, 'utf8');

  const artifactSha256 = sha256(artifactContent);
  const artifactSize = statSync(artifactPath).size;
  writeFileSync(
    path.join(releaseAssetsDir, checksumFileName),
    `${artifactSha256}  ${artifactRelativePath}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(releaseAssetsDir, 'release-manifest.json'),
    `${JSON.stringify({
      profileId,
      productName: 'SDKWork BirdCoder',
      releaseTag: 'release-2026-04-12-01',
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      generatedAt: '2026-04-12T01:02:03.000Z',
      checksumFileName,
      releaseCoverage,
      artifacts: [
        {
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          relativePath: artifactRelativePath,
          sha256: artifactSha256,
          size: artifactSize,
        },
      ],
    }, null, 2)}\n`,
    'utf8',
  );
  writeManifestChecksumSidecar(releaseAssetsDir);
  writeFileSync(
    path.join(releaseAssetsDir, 'release-attestations.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
      releaseTag: 'release-2026-04-12-01',
      sourceRef: 'refs/tags/release-2026-04-12-01',
      generatedAt: '2026-04-12T02:03:04.000Z',
      predicateType: 'https://slsa.dev/provenance/v1',
      signerWorkflow: '.github/workflows/release-reusable.yml',
      artifacts: [
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
      verificationCommand: `gh attestation verify ${artifactRelativePath}`,
    },
      ],
    }, null, 2)}\n`,
    'utf8',
  );
}

test('release readiness assertion accepts only complete finalized manifests with checksum-backed artifacts', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  assert.equal(existsSync(readinessPath), true, 'missing scripts/release/assert-release-readiness.mjs');

  const readiness = await import(pathToFileURL(readinessPath).href);
  assert.equal(typeof readiness.parseArgs, 'function');
  assert.equal(typeof readiness.assertReleaseReadiness, 'function');
  assert.throws(
    () => readiness.parseArgs(['--release-assets-dir']),
    /Missing value for --release-assets-dir/,
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({ releaseAssetsDir });

    const result = readiness.assertReleaseReadiness({
      releaseAssetsDir,
      resolveReleaseProfileFn: resolveMinimalReleaseProfile,
    });

    assert.equal(result.releaseAssetsDir, releaseAssetsDir);
    assert.equal(result.manifestPath, path.join(releaseAssetsDir, 'release-manifest.json'));
    assert.equal(
      result.manifestChecksumPath,
      path.join(releaseAssetsDir, 'release-manifest.json.sha256.txt'),
    );
    assert.equal(result.attestationEvidencePath, path.join(releaseAssetsDir, 'release-attestations.json'));
    assert.equal(result.checksumPath, path.join(releaseAssetsDir, 'SHA256SUMS.txt'));
    assert.equal(result.artifactCount, 1);
    assert.equal(result.requiredTargetCount, 1);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects missing, malformed, partial, or explicitly partial finalized manifests', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-reject-'));

  try {
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir: path.join(tempRoot, 'missing-assets'),
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Missing release assets directory/,
    );

    const releaseAssetsDir = path.join(tempRoot, 'release-assets');
    mkdirSync(releaseAssetsDir, { recursive: true });
    assert.throws(
      () => readiness.assertReleaseReadiness({ releaseAssetsDir }),
      /Missing finalized release manifest/,
    );

    writeFileSync(path.join(releaseAssetsDir, 'release-manifest.json'), '{not-json', 'utf8');
    writeManifestChecksumSidecar(releaseAssetsDir);
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Unable to parse finalized release manifest/,
    );

    rmSync(releaseAssetsDir, { recursive: true, force: true });
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({
      releaseAssetsDir,
      releaseCoverage: {
        status: 'partial',
        allowPartialRelease: true,
        requiredTargets: ['web/web/any'],
        presentTargets: [],
        missingTargets: ['web/web/any'],
      },
    });
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release manifest is not publish-ready/,
    );

    writeReadyReleaseFixture({
      releaseAssetsDir,
      releaseCoverage: {
        status: 'complete',
        allowPartialRelease: true,
        requiredTargets: ['web/web/any'],
        presentTargets: ['web/web/any'],
        missingTargets: [],
      },
    });
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /was finalized with --allow-partial-release/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects checksum and artifact drift in finalized manifests', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-checksum-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({ releaseAssetsDir });

    writeFileSync(
      path.join(releaseAssetsDir, 'SHA256SUMS.txt'),
      `${'0'.repeat(64)}  web/sdkwork-birdcoder-web-assets-release-2026-04-12-01.tar.gz\n`,
      'utf8',
    );
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Checksum manifest mismatch/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.artifacts[0].sha256 = 'f'.repeat(64);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    writeManifestChecksumSidecar(releaseAssetsDir);
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Artifact checksum mismatch/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    rmSync(
      path.join(releaseAssetsDir, 'web', 'sdkwork-birdcoder-web-assets-release-2026-04-12-01.tar.gz'),
      { force: true },
    );
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Missing release artifact/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects manifest checksum sidecar and attestation evidence drift', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-attestation-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({ releaseAssetsDir });

    rmSync(path.join(releaseAssetsDir, 'release-manifest.json.sha256.txt'), { force: true });
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Missing finalized release manifest checksum sidecar/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    writeFileSync(
      path.join(releaseAssetsDir, 'release-manifest.json.sha256.txt'),
      `${'0'.repeat(64)}  release-manifest.json\n`,
      'utf8',
    );
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release manifest checksum sidecar mismatch/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    rmSync(path.join(releaseAssetsDir, 'release-attestations.json'), { force: true });
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Missing release attestation evidence/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    const evidencePath = path.join(releaseAssetsDir, 'release-attestations.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    evidence.artifacts[0].sha256 = 'f'.repeat(64);
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release attestation evidence digest mismatch/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    const missingArtifactEvidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    missingArtifactEvidence.artifacts = [];
    writeFileSync(evidencePath, `${JSON.stringify(missingArtifactEvidence, null, 2)}\n`, 'utf8');
    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release attestation evidence is missing artifact verification/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects unsafe artifact paths on every host platform', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-paths-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    const artifactContent = 'unsafe-artifact';
    const unsafeArtifactRelativePath = 'C:/absolute/windows/path.tar.gz';
    const artifactSha256 = sha256(artifactContent);
    writeFileSync(path.join(releaseAssetsDir, 'SHA256SUMS.txt'), `${artifactSha256}  ${unsafeArtifactRelativePath}\n`, 'utf8');
    writeFileSync(
      path.join(releaseAssetsDir, 'release-manifest.json'),
      `${JSON.stringify({
        profileId: 'sdkwork-birdcoder',
        productName: 'SDKWork BirdCoder',
        releaseTag: 'release-2026-04-12-01',
        repository: 'Sdkwork-Cloud/sdkwork-birdcoder',
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
            relativePath: unsafeArtifactRelativePath,
            sha256: artifactSha256,
            size: artifactContent.length,
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    writeManifestChecksumSidecar(releaseAssetsDir);

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /unsafe artifact path/,
    );

    writeReadyReleaseFixture({
      releaseAssetsDir,
      artifactRelativePath: '../escape.tar.gz',
    });

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /unsafe artifact path/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects manifests for the wrong release profile or checksum contract', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-profile-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({
      releaseAssetsDir,
      profileId: 'another-profile',
    });

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        profileId: 'sdkwork-birdcoder',
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release manifest profile mismatch/,
    );

    writeReadyReleaseFixture({
      releaseAssetsDir,
      checksumFileName: 'checksums.txt',
    });

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        profileId: 'sdkwork-birdcoder',
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release manifest checksum file mismatch/,
    );

    writeReadyReleaseFixture({ releaseAssetsDir });
    const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    delete manifest.checksumFileName;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    writeManifestChecksumSidecar(releaseAssetsDir);

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        profileId: 'sdkwork-birdcoder',
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Release manifest checksum file mismatch/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion verifies coverage against the release profile, not the manifest self-claim', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-profile-coverage-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({
      releaseAssetsDir,
      releaseCoverage: {
        status: 'complete',
        allowPartialRelease: false,
        requiredTargets: ['web/web/any'],
        presentTargets: ['web/web/any'],
        missingTargets: [],
      },
    });

    assert.throws(
      () => readiness.assertReleaseReadiness({ releaseAssetsDir, profileId: 'sdkwork-birdcoder' }),
      /Release manifest coverage does not match profile/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release readiness assertion rejects formal manifests with pending desktop installer trust evidence', async () => {
  const readinessPath = path.join(rootDir, 'scripts', 'release', 'assert-release-readiness.mjs');
  const readiness = await import(pathToFileURL(readinessPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'birdcoder-release-ready-trust-'));
  const releaseAssetsDir = path.join(tempRoot, 'release-assets');

  try {
    mkdirSync(releaseAssetsDir, { recursive: true });
    writeReadyReleaseFixture({
      releaseAssetsDir,
      artifactRelativePath: 'desktop/windows/x64/desktop-setup.exe',
      artifactContent: 'exe',
    });
    const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const installerArtifact = {
      ...manifest.artifacts[0],
      family: 'desktop',
      platform: 'windows',
      arch: 'x64',
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
    };
    manifest.releaseControl = {
      releaseKind: 'formal',
      rolloutStage: 'general-availability',
      monitoringWindowMinutes: 120,
      rollbackRunbookRef: 'docs/runbooks/release-rollback.md',
      rollbackCommand: '',
    };
    manifest.artifacts = [installerArtifact];
    manifest.assets = [
      {
        family: 'desktop',
        platform: 'windows',
        arch: 'x64',
        artifacts: [installerArtifact],
        desktopStartupReadinessSummary: {
          ready: true,
          shellMounted: true,
          workspaceBootstrapReady: true,
          localProjectRecoveryReady: true,
          workspaceBootstrapChecks: [
            'defaultWorkspaceReady',
            'defaultProjectReady',
            'recoverySnapshotReady',
          ],
          localProjectRecoveryChecks: [
            'autoRemountSupported',
            'recoveringStateVisible',
            'failedStateVisible',
            'retrySupported',
            'reimportSupported',
          ],
        },
      },
    ];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    writeManifestChecksumSidecar(releaseAssetsDir);

    assert.throws(
      () => readiness.assertReleaseReadiness({
        releaseAssetsDir,
        resolveReleaseProfileFn: resolveMinimalReleaseProfile,
      }),
      /Formal or general-availability release readiness requires clear stop-ship evidence: desktop installer trust report `windows\/x64` is missing; desktop installer trust evidence `desktop\/windows\/x64\/desktop-setup\.exe` is `pending`/,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
