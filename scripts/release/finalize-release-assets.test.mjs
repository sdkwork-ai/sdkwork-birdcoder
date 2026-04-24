import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS } from '../governance-regression-report.mjs';
import { finalizeReleaseAssets } from './finalize-release-assets.mjs';
import { summarizeQualityLoopScoreboard } from './quality-gate-release-evidence.mjs';
import {
  buildPromotionReadinessSummary,
  collectReleaseStopShipSignals,
} from './release-stop-ship-governance.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-finalize-'));
const releaseAssetsDir = path.join(fixtureRoot, 'assets');
const qualityExecutionReportSourcePath = path.join(fixtureRoot, 'quality-gate-execution-report.json');
fs.mkdirSync(path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'desktop', 'windows', 'x64'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'openapi'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'build'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'preview'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'simulator'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'studio', 'test'), { recursive: true });
fs.mkdirSync(path.join(releaseAssetsDir, 'terminal', 'governance'), { recursive: true });

fs.writeFileSync(
  path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu', 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'container',
    profileId: 'sdkwork-birdcoder',
    platform: 'linux',
    arch: 'x64',
    accelerator: 'cpu',
    archiveRelativePath: 'container/linux/x64/cpu/sample.txt',
    artifacts: [
      { relativePath: 'container/linux/x64/cpu/sample.txt', size: 17 },
    ],
  }, null, 2),
);
fs.writeFileSync(path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu', 'sample.txt'), 'container payload');
fs.writeFileSync(
  path.join(releaseAssetsDir, 'container', 'linux', 'x64', 'cpu', 'release-smoke-report.json'),
  JSON.stringify({
    family: 'container',
    platform: 'linux',
    arch: 'x64',
    accelerator: 'cpu',
    status: 'passed',
    smokeKind: 'bundle-contract',
  }, null, 2),
);

fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'desktop',
    profileId: 'sdkwork-birdcoder',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'desktop/windows/x64/desktop.tar.gz',
    artifacts: [
      { relativePath: 'desktop/windows/x64/desktop.tar.gz', size: 3 },
    ],
  }, null, 2),
);
fs.writeFileSync(path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-installer-smoke-report.json'),
  JSON.stringify({
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    status: 'passed',
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
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-startup-smoke-report.json'),
  JSON.stringify({
    platform: 'windows',
    arch: 'x64',
    status: 'passed',
    phase: 'shell-mounted',
    capturedEvidenceRelativePath: 'desktop/windows/x64/desktop-startup-evidence.json',
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'release-asset-manifest.json'),
  JSON.stringify({
    family: 'server',
    profileId: 'sdkwork-birdcoder',
    platform: 'windows',
    arch: 'x64',
    archiveRelativePath: 'server/windows/x64/sdkwork-birdcoder-server-release-local-windows-x64.tar.gz',
    artifacts: [
      { relativePath: 'server/windows/x64/openapi/coding-server-v1.json', size: 181 },
      { relativePath: 'server/windows/x64/sdkwork-birdcoder-server-release-local-windows-x64.tar.gz', size: 3 },
    ],
  }, null, 2),
);
fs.writeFileSync(path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'sdkwork-birdcoder-server-release-local-windows-x64.tar.gz'), 'tar');
fs.writeFileSync(
  path.join(releaseAssetsDir, 'server', 'windows', 'x64', 'release-smoke-report.json'),
  JSON.stringify({
    family: 'server',
    platform: 'windows',
    arch: 'x64',
    status: 'passed',
    smokeKind: 'bundle-contract',
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
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'build', 'studio-build-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.build.execution',
    generatedAt: '2026-04-08T12:05:00.000Z',
    entries: [
      {
        adapterId: 'studio.build.execution',
        evidenceKey: 'build.app.harmony.launch',
        buildProfileId: 'app.harmony',
        targetId: 'app.harmony',
        outputKind: 'application',
        command: 'pnpm build:app',
        cwd: 'D:/workspace/app',
        profileId: 'powershell',
        projectId: 'project-1',
        runConfigurationId: 'build-app',
        launchedAt: 1712577660000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'preview', 'studio-preview-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.preview.execution',
    generatedAt: '2026-04-08T12:00:00.000Z',
    entries: [
      {
        adapterId: 'studio.preview.execution',
        evidenceKey: 'preview.cn.app.harmony.landscape.launch',
        sessionEvidenceKey: 'preview.cn.app.harmony.landscape',
        host: {
          mode: 'desktop',
          appId: 'cn.app',
          appName: 'BirdCoder CN',
          distributionId: 'birdcoder-cn',
          apiBaseUrl: 'https://api-cn.example.com',
        },
        channel: 'app',
        orientation: 'landscape',
        previewUrl: 'http://127.0.0.1:4173/app',
        command: 'pnpm dev:app',
        cwd: 'D:/workspace/app',
        profileId: 'powershell',
        projectId: 'project-1',
        runConfigurationId: 'preview-dev',
        launchedAt: 1712577600000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'simulator', 'studio-simulator-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.simulator.execution',
    generatedAt: '2026-04-08T12:10:00.000Z',
    entries: [
      {
        adapterId: 'studio.simulator.execution',
        evidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape.launch',
        sessionEvidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape',
        host: {
          mode: 'desktop',
          appId: 'cn.app',
          appName: 'BirdCoder CN',
          distributionId: 'birdcoder-cn',
          apiBaseUrl: 'https://api-cn.example.com',
        },
        channel: 'app.harmony',
        runtime: 'harmony-emulator',
        orientation: 'landscape',
        command: 'pnpm simulate:harmony',
        cwd: 'D:/workspace/app',
        profileId: 'powershell',
        projectId: 'project-1',
        runConfigurationId: 'simulate-harmony',
        launchedAt: 1712577720000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  path.join(releaseAssetsDir, 'studio', 'test', 'studio-test-evidence.json'),
  JSON.stringify({
    adapterId: 'studio.test.execution',
    generatedAt: '2026-04-08T12:12:00.000Z',
    entries: [
      {
        adapterId: 'studio.test.execution',
        evidenceKey: 'test.workspace-suite.launch',
        command: 'pnpm test:workspace',
        cwd: 'D:/workspace/app',
        profileId: 'powershell',
        projectId: 'project-1',
        runConfigurationId: 'workspace-suite',
        launchedAt: 1712577780000,
      },
    ],
  }, null, 2),
);
fs.writeFileSync(
  qualityExecutionReportSourcePath,
  JSON.stringify({
    status: 'blocked',
    generatedAt: '2026-04-08T12:20:00.000Z',
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

const result = finalizeReleaseAssets({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  'release-kind': 'canary',
  'rollout-stage': 'ring-1',
  'monitoring-window-minutes': '45',
  'rollback-runbook-ref': 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  'rollback-command': 'gh workflow run rollback.yml --ref main',
  'release-assets-dir': releaseAssetsDir,
  'quality-execution-report-path': qualityExecutionReportSourcePath,
});

assert.ok(fs.existsSync(result.manifestPath));
assert.ok(fs.existsSync(result.checksumsPath));

const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
assert.equal(manifest.profileId, 'sdkwork-birdcoder');
assert.deepEqual(manifest.releaseControl, {
  releaseKind: 'canary',
  rolloutStage: 'ring-1',
  monitoringWindowMinutes: 45,
  rollbackRunbookRef: 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  rollbackCommand: 'gh workflow run rollback.yml --ref main',
});
assert.equal(manifest.assets.length, 3);
assert.equal(manifest.assets[0].family, 'container');
assert.equal(manifest.assets[1].family, 'desktop');
assert.equal(manifest.assets[2].family, 'server');
assert.equal(manifest.assets[0].releaseSmoke.status, 'passed');
assert.equal(manifest.assets[1].desktopStartupSmoke.status, 'passed');
assert.equal(manifest.assets[2].releaseSmoke.status, 'passed');
assert.deepEqual(manifest.assets[1].desktopStartupReadinessSummary, {
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
});
assert.deepEqual(manifest.assets[1].desktopStartupEvidence.readinessEvidence, {
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
});
assert.deepEqual(manifest.codingServerOpenApiEvidence, {
  canonicalRelativePath: 'server/windows/x64/openapi/coding-server-v1.json',
  mirroredRelativePaths: ['server/windows/x64/openapi/coding-server-v1.json'],
  targetCount: 1,
  targets: ['windows/x64'],
  sha256: manifest.codingServerOpenApiEvidence.sha256,
  openapi: '3.1.0',
  version: 'v1',
  title: 'SDKWork BirdCoder Coding Server API',
});
assert.match(manifest.codingServerOpenApiEvidence.sha256, /^[a-f0-9]{64}$/);
assert.deepEqual(manifest.previewEvidence, {
  archiveRelativePath: 'studio/preview/studio-preview-evidence.json',
  entryCount: 1,
  channels: ['app'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577600000,
});
assert.deepEqual(manifest.buildEvidence, {
  archiveRelativePath: 'studio/build/studio-build-evidence.json',
  entryCount: 1,
  targets: ['app.harmony'],
  outputKinds: ['application'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577660000,
});
assert.deepEqual(manifest.simulatorEvidence, {
  archiveRelativePath: 'studio/simulator/studio-simulator-evidence.json',
  entryCount: 1,
  channels: ['app.harmony'],
  runtimes: ['harmony-emulator'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577720000,
});
assert.deepEqual(manifest.testEvidence, {
  archiveRelativePath: 'studio/test/studio-test-evidence.json',
  entryCount: 1,
  commands: ['pnpm test:workspace'],
  projectIds: ['project-1'],
  latestLaunchedAt: 1712577780000,
});
const qualityReportPath = path.join(releaseAssetsDir, manifest.qualityEvidence.archiveRelativePath);
assert.ok(fs.existsSync(qualityReportPath));
const qualityReport = JSON.parse(fs.readFileSync(qualityReportPath, 'utf8'));
const expectedLoopScoreboard = summarizeQualityLoopScoreboard({
  totalTiers: qualityReport.summary.totalTiers,
  workflowBoundTiers: qualityReport.summary.workflowBoundTiers,
  manifestBoundTiers: qualityReport.summary.manifestBoundTiers,
  tierIds: qualityReport.tiers.map((tier) => tier.id),
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnosticIds: qualityReport.summary.blockingDiagnosticIds,
  executionStatus: 'blocked',
  executionBlockingTierIds: ['standard'],
  executionFailedTierIds: [],
  executionSkippedTierIds: ['release'],
});
assert.deepEqual(manifest.qualityEvidence, {
  archiveRelativePath: 'quality/quality-gate-matrix-report.json',
  totalTiers: qualityReport.summary.totalTiers,
  workflowBoundTiers: qualityReport.summary.workflowBoundTiers,
  missingWorkflowBindings: qualityReport.summary.missingWorkflowBindings,
  manifestBoundTiers: qualityReport.summary.manifestBoundTiers,
  missingManifestBindings: qualityReport.summary.missingManifestBindings,
  tierIds: qualityReport.tiers.map((tier) => tier.id),
  failureClassificationIds: qualityReport.failureClassifications.map((classification) => classification.id),
  environmentDiagnostics: qualityReport.summary.environmentDiagnostics,
  blockingDiagnosticIds: qualityReport.summary.blockingDiagnosticIds,
  releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
  blockingDiagnostics: qualityReport.environmentDiagnostics
    .filter((diagnostic) => diagnostic.status === 'blocked')
    .map((diagnostic) => ({
      id: diagnostic.id,
      label: diagnostic.label,
      classification: diagnostic.classification,
      appliesTo: diagnostic.appliesTo,
      summary: diagnostic.summary,
      requiredCapabilities: diagnostic.requiredCapabilities,
      rerunCommands: diagnostic.rerunCommands,
    })),
  executionArchiveRelativePath: 'quality/quality-gate-execution-report.json',
  executionStatus: 'blocked',
  lastExecutedTierId: 'standard',
  executionBlockingTierIds: ['standard'],
  executionSkippedTierIds: ['release'],
  executionBlockingDiagnosticIds: ['vite-host-build-preflight'],
  loopScoreboard: expectedLoopScoreboard,
});
const expectedManifestStopShipSignals = collectReleaseStopShipSignals({
  qualityEvidence: manifest.qualityEvidence,
  assets: manifest.assets,
});
assert.deepEqual(manifest.stopShipSignals, expectedManifestStopShipSignals);
assert.deepEqual(manifest.promotionReadiness, buildPromotionReadinessSummary({
  releaseControl: manifest.releaseControl,
  stopShipSignals: expectedManifestStopShipSignals,
}));
assert.ok(fs.existsSync(path.join(releaseAssetsDir, 'quality', 'quality-gate-execution-report.json')));

const rerunResult = finalizeReleaseAssets({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  'release-kind': 'canary',
  'rollout-stage': 'ring-1',
  'monitoring-window-minutes': '45',
  'rollback-runbook-ref': 'docs/step/13-é™æˆç«·çè¾©åŽ-github-flow-éæ¿å®³é¥ç‚´ç²´é—‚î… å¹†.md',
  'rollback-command': 'gh workflow run rollback.yml --ref main',
  'release-assets-dir': releaseAssetsDir,
});

assert.ok(fs.existsSync(rerunResult.manifestPath));
const rerunManifest = JSON.parse(fs.readFileSync(rerunResult.manifestPath, 'utf8'));
assert.equal(rerunManifest.qualityEvidence.executionArchiveRelativePath, 'quality/quality-gate-execution-report.json');
assert.equal(rerunManifest.qualityEvidence.executionStatus, 'blocked');
assert.equal(rerunManifest.qualityEvidence.lastExecutedTierId, 'standard');
assert.deepEqual(rerunManifest.qualityEvidence.executionBlockingTierIds, ['standard']);
assert.deepEqual(rerunManifest.qualityEvidence.executionFailedTierIds ?? [], []);
assert.deepEqual(rerunManifest.qualityEvidence.executionSkippedTierIds, ['release']);
assert.deepEqual(rerunManifest.qualityEvidence.executionBlockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(rerunManifest.qualityEvidence.loopScoreboard, expectedLoopScoreboard);
const expectedRerunStopShipSignals = collectReleaseStopShipSignals({
  qualityEvidence: rerunManifest.qualityEvidence,
  assets: rerunManifest.assets,
});
assert.deepEqual(rerunManifest.stopShipSignals, expectedRerunStopShipSignals);
assert.deepEqual(rerunManifest.promotionReadiness, buildPromotionReadinessSummary({
  releaseControl: rerunManifest.releaseControl,
  stopShipSignals: expectedRerunStopShipSignals,
}));

fs.writeFileSync(
  path.join(releaseAssetsDir, 'desktop', 'windows', 'x64', 'desktop-startup-evidence.json'),
  JSON.stringify({
    platform: 'windows',
    arch: 'x64',
    status: 'passed',
    phase: 'shell-mounted',
    readinessEvidence: {
      ready: false,
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
        retrySupported: false,
        reimportSupported: false,
      },
    },
  }, null, 2),
);
const degradedResult = finalizeReleaseAssets({
  profile: 'sdkwork-birdcoder',
  'release-tag': 'release-local',
  'release-kind': 'canary',
  'rollout-stage': 'ring-1',
  'monitoring-window-minutes': '45',
  'rollback-runbook-ref': 'docs/step/13-é™æˆç«·çè¾©åŽ-github-flow-éæ¿å®³é¥ç‚´ç²´é—‚î… å¹†.md',
  'rollback-command': 'gh workflow run rollback.yml --ref main',
  'release-assets-dir': releaseAssetsDir,
});
assert.ok(fs.existsSync(degradedResult.manifestPath));
const degradedManifest = JSON.parse(fs.readFileSync(degradedResult.manifestPath, 'utf8'));
assert.deepEqual(degradedManifest.qualityEvidence.releaseReadinessSignals, [
  'desktop local project recovery `windows/x64` is `not-ready`',
]);
const expectedDegradedStopShipSignals = collectReleaseStopShipSignals({
  qualityEvidence: degradedManifest.qualityEvidence,
  assets: degradedManifest.assets,
});
assert.deepEqual(degradedManifest.stopShipSignals, expectedDegradedStopShipSignals);
assert.deepEqual(degradedManifest.promotionReadiness, buildPromotionReadinessSummary({
  releaseControl: degradedManifest.releaseControl,
  stopShipSignals: expectedDegradedStopShipSignals,
}));
assert.deepEqual(
  degradedManifest.qualityEvidence.loopScoreboard,
  summarizeQualityLoopScoreboard({
    totalTiers: qualityReport.summary.totalTiers,
    workflowBoundTiers: qualityReport.summary.workflowBoundTiers,
    manifestBoundTiers: qualityReport.summary.manifestBoundTiers,
    tierIds: qualityReport.tiers.map((tier) => tier.id),
    releaseGovernanceCheckIds: ENGINE_GOVERNANCE_REGRESSION_CHECK_IDS,
    blockingDiagnosticIds: qualityReport.summary.blockingDiagnosticIds,
    executionStatus: 'blocked',
    executionBlockingTierIds: ['standard'],
    executionFailedTierIds: [],
    executionSkippedTierIds: ['release'],
    releaseReadinessSignals: ['desktop local project recovery `windows/x64` is `not-ready`'],
  }),
);
assert.throws(
  () => finalizeReleaseAssets({
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    'release-kind': 'formal',
    'release-assets-dir': releaseAssetsDir,
  }),
  /Formal or general-availability release finalization requires clear stop-ship evidence/,
);
assert.throws(
  () => finalizeReleaseAssets({
    profile: 'sdkwork-birdcoder',
    'release-tag': 'release-local',
    'release-kind': 'canary',
    'rollout-stage': 'general-availability',
    'release-assets-dir': releaseAssetsDir,
  }),
  /Formal or general-availability release finalization requires clear stop-ship evidence/,
);

console.log('finalize release assets contract passed.');
