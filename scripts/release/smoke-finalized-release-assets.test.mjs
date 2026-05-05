import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS } from '../governance-regression-report.mjs';
import { smokeFinalizedReleaseAssets } from './smoke-finalized-release-assets.mjs';

const releaseAssetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-finalized-smoke-'));
const passedWindowsSignatureEvidence = {
  status: 'passed',
  required: true,
  scheme: 'windows-authenticode',
  verifiedAt: '2026-04-08T13:04:00.000Z',
  subject: 'CN=SDKWork BirdCoder',
  issuer: 'CN=SDKWork Code Signing CA',
  timestamped: true,
  notarized: false,
  stapled: false,
  packageMetadataVerified: true,
};

fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'build'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'preview'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'desktop', 'windows', 'x64'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'simulator'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'test'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'terminal', 'governance'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'quality'), { recursive: true });
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'build', 'studio-build-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.build.execution',
    generatedAt: '2026-04-08T13:05:00.000Z',
    entries: [
      {
        adapterId: 'studio.build.execution',
        evidenceKey: 'build.app.harmony.launch',
        targetId: 'app.harmony',
        outputKind: 'application',
        projectId: 'project-1',
        launchedAt: 1712577660000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'preview', 'studio-preview-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.preview.execution',
    generatedAt: '2026-04-08T13:00:00.000Z',
    entries: [
      {
        adapterId: 'studio.preview.execution',
        evidenceKey: 'preview.cn.app.harmony.landscape.launch',
        sessionEvidenceKey: 'preview.cn.app.harmony.landscape',
        channel: 'app',
        projectId: 'project-1',
        launchedAt: 1712577600000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'simulator', 'studio-simulator-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.simulator.execution',
    generatedAt: '2026-04-08T13:08:00.000Z',
    entries: [
      {
        adapterId: 'studio.simulator.execution',
        evidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape.launch',
        sessionEvidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape',
        channel: 'app.harmony',
        runtime: 'harmony-emulator',
        projectId: 'project-1',
        launchedAt: 1712577720000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'test', 'studio-test-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.test.execution',
    generatedAt: '2026-04-08T13:12:00.000Z',
    entries: [
      {
        adapterId: 'studio.test.execution',
        evidenceKey: 'test.workspace-suite.launch',
        command: 'pnpm test:workspace',
        projectId: 'project-1',
        runConfigurationId: 'workspace-suite',
        launchedAt: 1712577780000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-setup.exe'),
  'exe',
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-installer-trust-report.json'),
  JSON.stringify({
    status: 'passed',
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    manifestPath: path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'release-asset-manifest.json'),
    verifiedAt: '2026-04-08T13:04:00.000Z',
    installerCount: 1,
    installers: [
      {
        relativePath: 'desktop/windows/x64/desktop-setup.exe',
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: passedWindowsSignatureEvidence,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-startup-evidence.json'),
  JSON.stringify({
    platform: 'windows',
    arch: 'x64',
    status: 'passed',
    phase: 'shell-mounted',
    readinessEvidence: {
      ready: true,
      shellMounted: true,
      workspaceBootstrap: {
        defaultWorkspaceReady: true,
        defaultProjectReady: true,
        recoverySnapshotReady: true,
      },
      localProjectRecovery: {
        autoRemountSupported: true,
        recoveringStateVisible: true,
        failedStateVisible: true,
        retrySupported: true,
        reimportSupported: true,
      },
    },
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'quality', 'quality-gate-matrix-report.json'),
  JSON.stringify({
    generatedAt: '2026-04-08T13:15:00.000Z',
    summary: {
      totalTiers: 3,
      workflowBoundTiers: 3,
      missingWorkflowBindings: [],
      manifestBoundTiers: 3,
      missingManifestBindings: [],
      failureClassifications: 4,
      environmentDiagnostics: 1,
      blockingDiagnosticIds: ['vite-host-build-preflight'],
    },
    tiers: [
      { id: 'fast' },
      { id: 'standard' },
      {
        id: 'release',
        governanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
      },
    ],
    failureClassifications: [
      { id: 'contract-drift' },
      { id: 'toolchain-platform' },
      { id: 'artifact-integrity' },
      { id: 'evidence-gap' },
    ],
    environmentDiagnostics: [
      {
        id: 'vite-host-build-preflight',
        label: 'Vite host build preflight',
        classification: 'toolchain-platform',
        appliesTo: ['standard', 'release'],
        status: 'blocked',
        summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
        requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
        rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'quality', 'quality-gate-execution-report.json'),
  JSON.stringify({
    status: 'blocked',
    generatedAt: '2026-04-08T13:16:00.000Z',
    summary: {
      totalTiers: 3,
      executedCount: 2,
      passedCount: 1,
      blockedCount: 1,
      failedCount: 0,
      skippedCount: 1,
      lastExecutedTierId: 'standard',
      blockingTierIds: ['standard'],
      failedTierIds: [],
      skippedTierIds: ['release'],
      blockingDiagnosticIds: ['vite-host-build-preflight'],
    },
    tiers: [
      { id: 'fast', status: 'passed', command: 'pnpm check:quality:fast' },
      {
        id: 'standard',
        status: 'blocked',
        command: 'pnpm check:quality:standard',
        failureClassification: 'toolchain-platform',
        blockingDiagnosticIds: ['vite-host-build-preflight'],
        requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
        rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
      },
      {
        id: 'release',
        status: 'skipped',
        command: 'pnpm check:quality:release',
        blockedByTierId: 'standard',
        skipReason: 'upstream-tier-not-passed',
      },
    ],
    environmentDiagnostics: [
      {
        id: 'vite-host-build-preflight',
        label: 'Vite host build preflight',
        classification: 'toolchain-platform',
        appliesTo: ['standard', 'release'],
        status: 'blocked',
        summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
        requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
        rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi', 'coding-server-v1.json'),
  JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: 'v1',
    },
  }, null, 2),
);
const codingServerOpenApiSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi', 'coding-server-v1.json')))
  .digest('hex');
const desktopInstallerRelativePath = 'desktop/windows/x64/desktop-setup.exe';
const desktopInstallerSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(releaseAssetsDir, desktopInstallerRelativePath)))
  .digest('hex');
const publishArtifactRelativePath = 'server/windows/x64/openapi/coding-server-v1.json';
fs.writeFileSync(
  path.join(releaseAssetsDir, 'release-manifest.json'),
  JSON.stringify({
    profileId: 'sdkwork-birdcoder',
    releaseTag: 'release-local',
    generatedAt: '2026-04-08T13:10:00.000Z',
    releaseControl: {
      releaseKind: 'canary',
      rolloutStage: 'ring-1',
      monitoringWindowMinutes: 45,
      rollbackRunbookRef: 'docs/runbooks/canary-rollback.md',
      rollbackCommand: '',
    },
    checksumFileName: 'SHA256SUMS.txt',
    assets: [
      {
        family: 'desktop',
        platform: 'windows',
        arch: 'x64',
        desktopStartupSmoke: {
          status: 'passed',
        },
        desktopStartupEvidence: {
          capturedEvidenceRelativePath: 'desktop/windows/x64/desktop-startup-evidence.json',
          status: 'passed',
          phase: 'shell-mounted',
          readinessEvidence: {
            ready: true,
            shellMounted: true,
            workspaceBootstrap: {
              defaultWorkspaceReady: true,
              defaultProjectReady: true,
              recoverySnapshotReady: true,
            },
            localProjectRecovery: {
              autoRemountSupported: true,
              recoveringStateVisible: true,
              failedStateVisible: true,
              retrySupported: true,
              reimportSupported: true,
            },
          },
        },
        desktopStartupReadinessSummary: {
          ready: true,
          shellMounted: true,
          workspaceBootstrapReady: true,
          localProjectRecoveryReady: true,
          workspaceBootstrapChecks: [
            'defaultProjectReady',
            'defaultWorkspaceReady',
            'recoverySnapshotReady',
          ],
          localProjectRecoveryChecks: [
            'autoRemountSupported',
            'failedStateVisible',
            'recoveringStateVisible',
            'reimportSupported',
            'retrySupported',
          ],
        },
        desktopInstallerTrust: {
          reportRelativePath: 'desktop/windows/x64/desktop-installer-trust-report.json',
          manifestRelativePath: 'desktop/windows/x64/release-asset-manifest.json',
          status: 'passed',
          platform: 'windows',
          arch: 'x64',
          target: 'x86_64-pc-windows-msvc',
          verifiedAt: '2026-04-08T13:04:00.000Z',
          installerCount: 1,
          installers: [
            {
              relativePath: desktopInstallerRelativePath,
              bundle: 'nsis',
              installerFormat: 'nsis',
              target: 'x86_64-pc-windows-msvc',
              signatureEvidence: passedWindowsSignatureEvidence,
            },
          ],
        },
        artifacts: [
          {
            relativePath: desktopInstallerRelativePath,
            kind: 'installer',
            bundle: 'nsis',
            installerFormat: 'nsis',
            target: 'x86_64-pc-windows-msvc',
            signatureEvidence: passedWindowsSignatureEvidence,
          },
        ],
      },
      {
        family: 'server',
        platform: 'windows',
        arch: 'x64',
        artifacts: [
          {
            relativePath: publishArtifactRelativePath,
          },
        ],
      },
    ],
    artifacts: [
      {
        family: 'desktop',
        platform: 'windows',
        arch: 'x64',
        target: 'x86_64-pc-windows-msvc',
        accelerator: '',
        kind: 'installer',
        bundle: 'nsis',
        installerFormat: 'nsis',
        relativePath: desktopInstallerRelativePath,
        sha256: desktopInstallerSha256,
        size: fs.statSync(path.join(releaseAssetsDir, desktopInstallerRelativePath)).size,
        signatureEvidence: passedWindowsSignatureEvidence,
      },
      {
        family: 'server',
        platform: 'windows',
        arch: 'x64',
        target: '',
        accelerator: '',
        kind: 'metadata',
        relativePath: publishArtifactRelativePath,
        sha256: codingServerOpenApiSha256,
        size: fs.statSync(path.join(releaseAssetsDir, publishArtifactRelativePath)).size,
      },
    ],
    codingServerOpenApiEvidence: {
      canonicalRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
      mirroredRelativePaths: ['server/windows/x64/openapi/coding-server-v1.json'],
      targetCount: 1,
      targets: ['windows/x64'],
      sha256: codingServerOpenApiSha256,
      openapi: '3.1.0',
      version: 'v1',
      title: 'SDKWork BirdCoder Coding Server API',
    },
    previewEvidence: {
      archiveRelativePath: 'studio/preview/studio-preview-evidence.json',
      entryCount: 1,
      channels: ['app'],
      projectIds: ['project-1'],
      latestLaunchedAt: 1712577600000,
    },
    buildEvidence: {
      archiveRelativePath: 'studio/build/studio-build-evidence.json',
      entryCount: 1,
      targets: ['app.harmony'],
      outputKinds: ['application'],
      projectIds: ['project-1'],
      latestLaunchedAt: 1712577660000,
    },
    simulatorEvidence: {
      archiveRelativePath: 'studio/simulator/studio-simulator-evidence.json',
      entryCount: 1,
      channels: ['app.harmony'],
      runtimes: ['harmony-emulator'],
      projectIds: ['project-1'],
      latestLaunchedAt: 1712577720000,
    },
    testEvidence: {
      archiveRelativePath: 'studio/test/studio-test-evidence.json',
      entryCount: 1,
      commands: ['pnpm test:workspace'],
      projectIds: ['project-1'],
      latestLaunchedAt: 1712577780000,
    },
    qualityEvidence: {
      archiveRelativePath: 'quality/quality-gate-matrix-report.json',
      totalTiers: 3,
      workflowBoundTiers: 3,
      missingWorkflowBindings: [],
      manifestBoundTiers: 3,
      missingManifestBindings: [],
      tierIds: ['fast', 'standard', 'release'],
      failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
      environmentDiagnostics: 1,
      blockingDiagnosticIds: ['vite-host-build-preflight'],
      releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
      blockingDiagnostics: [
        {
          id: 'vite-host-build-preflight',
          label: 'Vite host build preflight',
          classification: 'toolchain-platform',
          appliesTo: ['standard', 'release'],
          summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
          requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
          rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
        },
      ],
      executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
      executionStatus: 'blocked',
      lastExecutedTierId: 'standard',
      executionBlockingTierIds: ['standard'],
      executionFailedTierIds: [],
      executionSkippedTierIds: ['release'],
      executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
      loopScoreboard: {
        architecture_alignment: 100,
        implementation_completeness: 100,
        test_closure: 70,
        commercial_readiness: 60,
        lowest_score_item: 'commercial_readiness',
        next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
      },
    },
    stopShipSignals: [
      'quality blockers `vite-host-build-preflight`',
      'runtime blocked tiers `standard`',
      'runtime blockers `vite-host-build-preflight`',
    ],
    promotionReadiness: {
      currentReleaseKind: 'canary',
      currentRolloutStage: 'ring-1',
      formalOrGaStatus: 'blocked',
      stopShipSignals: [
        'quality blockers `vite-host-build-preflight`',
        'runtime blocked tiers `standard`',
        'runtime blockers `vite-host-build-preflight`',
      ],
    },
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'SHA256SUMS.txt'),
  'stale-digest  release-manifest.json\n',
);

const result = smokeFinalizedReleaseAssets({
  releaseAssetsDir,
});

assert.ok(fs.existsSync(result.reportPath));
assert.deepEqual(result.codingServerOpenApiEvidence, {
  canonicalRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
  mirroredRelativePaths: ['server/windows/x64/openapi/coding-server-v1.json'],
  targetCount: 1,
  targets: ['windows/x64'],
  sha256: result.codingServerOpenApiEvidence.sha256,
  openapi: '3.1.0',
  version: 'v1',
  title: 'SDKWork BirdCoder Coding Server API',
});
assert.match(result.codingServerOpenApiEvidence.sha256, /^[a-f0-9]{64}$/);
assert.deepEqual(result.previewEvidence, {
  archiveRelativePath: 'studio/preview/studio-preview-evidence.json',
  entryCount: 1,
  channels: ['app'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577600000,
});
assert.deepEqual(result.buildEvidence, {
  archiveRelativePath: 'studio/build/studio-build-evidence.json',
  entryCount: 1,
  targets: ['app.harmony'],
  outputKinds: ['application'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577660000,
});
assert.deepEqual(result.simulatorEvidence, {
  archiveRelativePath: 'studio/simulator/studio-simulator-evidence.json',
  entryCount: 1,
  channels: ['app.harmony'],
  runtimes: ['harmony-emulator'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577720000,
});
assert.deepEqual(result.testEvidence, {
  archiveRelativePath: 'studio/test/studio-test-evidence.json',
  entryCount: 1,
  commands: ['pnpm test:workspace'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577780000,
});
assert.deepEqual(result.desktopStartupReadiness, [
  {
    target: 'windows/x64',
    ready: true,
    shellMounted: true,
    workspaceBootstrapReady: true,
    localProjectRecoveryReady: true,
    workspaceBootstrapChecks: [
      'defaultProjectReady',
      'defaultWorkspaceReady',
      'recoverySnapshotReady',
    ],
    localProjectRecoveryChecks: [
      'autoRemountSupported',
      'failedStateVisible',
      'recoveringStateVisible',
      'reimportSupported',
      'retrySupported',
    ],
  },
]);
assert.deepEqual(result.desktopInstallerTrust, [
  {
    target: 'windows/x64',
    reportRelativePath: 'desktop/windows/x64/desktop-installer-trust-report.json',
    manifestRelativePath: 'desktop/windows/x64/release-asset-manifest.json',
    status: 'passed',
    platform: 'windows',
    arch: 'x64',
    targetTriple: 'x86_64-pc-windows-msvc',
    verifiedAt: '2026-04-08T13:04:00.000Z',
    installerCount: 1,
    installers: [
      {
        relativePath: desktopInstallerRelativePath,
        bundle: 'nsis',
        installerFormat: 'nsis',
        target: 'x86_64-pc-windows-msvc',
        signatureEvidence: passedWindowsSignatureEvidence,
      },
    ],
  },
]);
assert.deepEqual(result.stopShipSignals, [
  'quality blockers `vite-host-build-preflight`',
  'runtime blocked tiers `standard`',
  'runtime blockers `vite-host-build-preflight`',
]);
assert.deepEqual(result.promotionReadiness, {
  currentReleaseKind: 'canary',
  currentRolloutStage: 'ring-1',
  formalOrGaStatus: 'blocked',
  stopShipSignals: [
    'quality blockers `vite-host-build-preflight`',
    'runtime blocked tiers `standard`',
    'runtime blockers `vite-host-build-preflight`',
  ],
});
assert.deepEqual(result.qualityEvidence, {
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  missingWorkflowBindings: [],
  manifestBoundTiers: 3,
  missingManifestBindings: [],
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
  environmentDiagnostics: 1,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnostics: [
    {
      id: 'vite-host-build-preflight',
      label: 'Vite host build preflight',
      classification: 'toolchain-platform',
      appliesTo: ['standard', 'release'],
      summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
      requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
      rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
    },
  ],
  executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
  executionStatus: 'blocked',
  lastExecutedTierId: 'standard',
  executionBlockingTierIds: ['standard'],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
  loopScoreboard: {
    architecture_alignment: 100,
    implementation_completeness: 100,
    test_closure: 70,
    commercial_readiness: 60,
    lowest_score_item: 'commercial_readiness',
    next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
  },
});

const report = JSON.parse(fs.readFileSync(result.reportPath, 'utf8'));
assert.equal(report.status, 'passed');
assert.deepEqual(report.stopShipSignals, [
  'quality blockers `vite-host-build-preflight`',
  'runtime blocked tiers `standard`',
  'runtime blockers `vite-host-build-preflight`',
]);
assert.deepEqual(report.promotionReadiness, {
  currentReleaseKind: 'canary',
  currentRolloutStage: 'ring-1',
  formalOrGaStatus: 'blocked',
  stopShipSignals: [
    'quality blockers `vite-host-build-preflight`',
    'runtime blocked tiers `standard`',
    'runtime blockers `vite-host-build-preflight`',
  ],
});
assert.equal(
  report.checks.find((entry) => entry.id === 'coding-server-openapi-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'preview-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'build-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'simulator-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'test-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'quality-evidence-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'desktop-startup-readiness-summary-match')?.status,
  'passed',
);
assert.equal(
  report.checks.find((entry) => entry.id === 'desktop-installer-trust-summary-match')?.status,
  'passed',
);
assert.equal(
  fs.readFileSync(path.join(releaseAssetsDir, 'SHA256SUMS.txt'), 'utf8'),
  `${desktopInstallerSha256}  ${desktopInstallerRelativePath}\n${codingServerOpenApiSha256}  ${publishArtifactRelativePath}\n`,
  'finalized smoke must refresh checksums from release-manifest.json.artifacts without inserting the smoke report',
);

const manifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
const gatedPromotionManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
gatedPromotionManifest.releaseControl = {
  ...gatedPromotionManifest.releaseControl,
  releaseKind: 'formal',
  rolloutStage: 'general-availability',
};
gatedPromotionManifest.promotionReadiness = {
  ...gatedPromotionManifest.promotionReadiness,
  currentReleaseKind: 'formal',
  currentRolloutStage: 'general-availability',
};
fs.writeFileSync(manifestPath, `${JSON.stringify(gatedPromotionManifest, null, 2)}\n`);
assert.throws(
  () => smokeFinalizedReleaseAssets({
    releaseAssetsDir,
  }),
  /Formal or general-availability finalized release manifests require clear stop-ship evidence/,
);
gatedPromotionManifest.releaseControl = {
  releaseKind: 'canary',
  rolloutStage: 'ring-1',
  monitoringWindowMinutes: 45,
  rollbackRunbookRef: 'docs/runbooks/canary-rollback.md',
  rollbackCommand: '',
};
fs.writeFileSync(manifestPath, `${JSON.stringify(gatedPromotionManifest, null, 2)}\n`);

const missingQualityManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
delete missingQualityManifest.qualityEvidence;
fs.writeFileSync(manifestPath, `${JSON.stringify(missingQualityManifest, null, 2)}\n`);
assert.throws(
  () => smokeFinalizedReleaseAssets({
    releaseAssetsDir,
  }),
  /Missing finalized manifest qualityEvidence summary/,
);

const missingStopShipManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
missingStopShipManifest.qualityEvidence = {
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  missingWorkflowBindings: [],
  manifestBoundTiers: 3,
  missingManifestBindings: [],
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
  environmentDiagnostics: 1,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnostics: [
    {
      id: 'vite-host-build-preflight',
      label: 'Vite host build preflight',
      classification: 'toolchain-platform',
      appliesTo: ['standard', 'release'],
      summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
      requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
      rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
    },
  ],
  executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
  executionStatus: 'blocked',
  lastExecutedTierId: 'standard',
  executionBlockingTierIds: ['standard'],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
  loopScoreboard: {
    architecture_alignment: 100,
    implementation_completeness: 100,
    test_closure: 70,
    commercial_readiness: 60,
    lowest_score_item: 'commercial_readiness',
    next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
  },
};
delete missingStopShipManifest.stopShipSignals;
fs.writeFileSync(manifestPath, `${JSON.stringify(missingStopShipManifest, null, 2)}\n`);
assert.throws(
  () => smokeFinalizedReleaseAssets({
    releaseAssetsDir,
  }),
  /Missing finalized manifest stopShipSignals summary/,
);

const missingPromotionReadinessManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
missingPromotionReadinessManifest.stopShipSignals = [
  'quality blockers `vite-host-build-preflight`',
  'runtime blocked tiers `standard`',
  'runtime blockers `vite-host-build-preflight`',
];
delete missingPromotionReadinessManifest.promotionReadiness;
fs.writeFileSync(manifestPath, `${JSON.stringify(missingPromotionReadinessManifest, null, 2)}\n`);
assert.throws(
  () => smokeFinalizedReleaseAssets({
    releaseAssetsDir,
  }),
  /Missing finalized manifest promotionReadiness summary/,
);

const missingOpenApiManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
missingOpenApiManifest.qualityEvidence = {
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: 3,
  workflowBoundTiers: 3,
  missingWorkflowBindings: [],
  manifestBoundTiers: 3,
  missingManifestBindings: [],
  tierIds: ['fast', 'standard', 'release'],
  failureClassificationIds: ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
  environmentDiagnostics: 1,
  blockingDiagnosticIds: ['vite-host-build-preflight'],
  blockingDiagnostics: [
    {
      id: 'vite-host-build-preflight',
      label: 'Vite host build preflight',
      classification: 'toolchain-platform',
      appliesTo: ['standard', 'release'],
      summary: 'Windows host cannot spawn cmd.exe or esbuild.exe (spawn EPERM).',
      requiredCapabilities: ['cmd.exe shell execution', 'esbuild.exe process launch'],
      rerunCommands: ['pnpm check:quality:standard', 'pnpm check:quality:release'],
    },
  ],
  executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
  executionStatus: 'blocked',
  lastExecutedTierId: 'standard',
  executionBlockingTierIds: ['standard'],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
  loopScoreboard: {
    architecture_alignment: 100,
    implementation_completeness: 100,
    test_closure: 70,
    commercial_readiness: 60,
    lowest_score_item: 'commercial_readiness',
    next_focus: 'Clear blocking diagnostics (`vite-host-build-preflight`) and rerun quality gates.',
  },
};
missingOpenApiManifest.stopShipSignals = [
  'quality blockers `vite-host-build-preflight`',
  'runtime blocked tiers `standard`',
  'runtime blockers `vite-host-build-preflight`',
];
missingOpenApiManifest.promotionReadiness = {
  currentReleaseKind: 'canary',
  currentRolloutStage: 'ring-1',
  formalOrGaStatus: 'blocked',
  stopShipSignals: [
    'quality blockers `vite-host-build-preflight`',
    'runtime blocked tiers `standard`',
    'runtime blockers `vite-host-build-preflight`',
  ],
};
delete missingOpenApiManifest.codingServerOpenApiEvidence;
fs.writeFileSync(manifestPath, `${JSON.stringify(missingOpenApiManifest, null, 2)}\n`);
assert.throws(
  () => smokeFinalizedReleaseAssets({
    releaseAssetsDir,
  }),
  /Missing finalized manifest codingServerOpenApiEvidence summary/,
);

fs.rmSync(releaseAssetsDir, { recursive: true, force: true });
console.log('finalized release smoke contract passed.');
