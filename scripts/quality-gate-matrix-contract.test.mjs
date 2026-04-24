import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildToolchainPlatformDiagnostic,
  buildQualityGateMatrixReport,
  DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE,
  QUALITY_FAILURE_CLASSIFICATIONS,
  QUALITY_GATE_TIERS,
} from './quality-gate-matrix-report.mjs';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
const releaseWorkflow = fs.readFileSync(
  path.join(rootDir, '.github/workflows/release-reusable.yml'),
  'utf8',
);
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const qualityStandardRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-standard-check.mjs')).href
);
const qualityReleaseRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-release-check.mjs')).href
);

assert.equal(
  DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE,
  'artifacts/quality/quality-gate-matrix-report.json',
);
assert.deepEqual(
  QUALITY_GATE_TIERS.map((tier) => tier.id),
  ['fast', 'standard', 'release'],
);
assert.deepEqual(
  QUALITY_FAILURE_CLASSIFICATIONS.map((classification) => classification.id),
  ['contract-drift', 'toolchain-platform', 'artifact-integrity', 'evidence-gap'],
);

const warningToolchainDiagnostic = buildToolchainPlatformDiagnostic({
  platform: 'win32',
  preflightReport: {
    ok: false,
    status: 'failed',
    checks: [
      {
        id: 'shell-exec',
        label: 'Windows command shell',
        command: 'C:\\Windows\\System32\\cmd.exe',
        args: ['/d', '/s', '/c', 'echo sdkwork-birdcoder-vite-host-preflight'],
        status: 'failed',
        error: {
          code: 'EPERM',
          errno: -4048,
          syscall: 'spawnSync C:\\Windows\\System32\\cmd.exe',
          message: 'spawn EPERM',
        },
        exitCode: null,
        signal: '',
        stdout: '',
        stderr: '',
      },
      {
        id: 'esbuild-binary',
        label: 'Esbuild native binary',
        command: 'D:\\repo\\node_modules\\@esbuild\\win32-x64\\esbuild.exe',
        args: ['--version'],
        status: 'failed',
        error: {
          code: 'EPERM',
          errno: -4048,
          syscall: 'spawnSync D:\\repo\\node_modules\\@esbuild\\win32-x64\\esbuild.exe',
          message: 'spawn EPERM',
        },
        exitCode: null,
        signal: '',
        stdout: '',
        stderr: '',
      },
    ],
  },
});
assert.equal(warningToolchainDiagnostic.classification, 'toolchain-platform');
assert.equal(warningToolchainDiagnostic.status, 'warning');
assert.deepEqual(warningToolchainDiagnostic.appliesTo, ['fast', 'standard', 'release']);
assert.match(warningToolchainDiagnostic.summary, /cmd\.exe/u);
assert.match(warningToolchainDiagnostic.summary, /esbuild\.exe/u);
assert.match(warningToolchainDiagnostic.summary, /spawn EPERM/u);
assert.deepEqual(warningToolchainDiagnostic.requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(warningToolchainDiagnostic.rerunCommands, [
  'pnpm check:quality:fast',
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);

assert.equal(rootPackageJson.scripts.typecheck, 'node scripts/run-local-typescript.mjs --noEmit');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['quality:report'], 'node scripts/quality-gate-matrix-report.mjs');
assert.equal(
  rootPackageJson.scripts['check:desktop-startup-graph'],
  'node scripts/desktop-startup-graph-contract.test.mjs && node scripts/desktop-startup-graph-port-resilience.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:user-center-standard'],
  'node scripts/run-user-center-standard.mjs',
);
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.equal(
  rootPackageJson.scripts['check:desktop'],
  'node scripts/run-local-typescript.mjs --cwd packages/sdkwork-birdcoder-desktop --noEmit && node scripts/release/release-profiles.test.mjs && cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml',
);
assert.equal(
  rootPackageJson.scripts['check:server'],
  'node scripts/runtime-user-center-bridge-contract.test.mjs && node scripts/birdcoder-rust-user-center-validation-contract.test.mjs && node scripts/identity-seed-parity-contract.test.mjs && node scripts/run-local-typescript.mjs --cwd packages/sdkwork-birdcoder-server --noEmit && cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml',
);
assert.equal(rootPackageJson.scripts['check:quality:standard'], 'node scripts/run-quality-standard-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:release'], 'node scripts/run-quality-release-check.mjs');
assert.deepEqual(qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.at(0), 'node scripts/run-workspace-package-script.mjs . typecheck');
assert.deepEqual(qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.at(-1), 'node scripts/run-workspace-package-script.mjs . check:ci-flow');
assert.equal(
  qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.includes(
    'node scripts/run-workspace-package-script.mjs . test:user-center-standard',
  ),
  true,
);
assert.deepEqual(qualityStandardRunnerModule.QUALITY_STANDARD_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:desktop',
  'node scripts/run-workspace-package-script.mjs . check:server',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:web-bundle-budget',
  'node scripts/run-workspace-package-script.mjs . server:build',
  'node scripts/run-workspace-package-script.mjs . docs:build',
]);
assert.deepEqual(qualityReleaseRunnerModule.QUALITY_RELEASE_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:quality:fast',
  'node scripts/run-workspace-package-script.mjs . check:quality:standard',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression',
]);

assert.match(ciWorkflow, /Run workspace lint and parity checks/);
assert.match(ciWorkflow, /pnpm lint/);
assert.match(ciWorkflow, /pnpm check:desktop/);
assert.match(ciWorkflow, /pnpm check:server/);
assert.match(ciWorkflow, /pnpm build/);
assert.match(ciWorkflow, /pnpm docs:build/);
assert.match(releaseWorkflow, /Run release verification/);
assert.match(releaseWorkflow, /pnpm lint/);
assert.match(releaseWorkflow, /pnpm check:desktop/);
assert.match(releaseWorkflow, /pnpm check:server/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-report-'));
const outputPath = path.join(tempDir, 'quality-gate-matrix-report.json');
const report = buildQualityGateMatrixReport({
  rootDir,
  outputPath,
  now: () => new Date('2026-04-09T08:00:00.000Z'),
  platform: 'win32',
  preflightReport: {
    ok: false,
    status: 'failed',
    checks: warningToolchainDiagnostic.checks,
  },
});

function normalizeReportForComparison(candidate = {}) {
  const summary = candidate.summary ?? {};
  return {
    summary: {
      totalTiers: summary.totalTiers,
      workflowBoundTiers: summary.workflowBoundTiers,
      missingWorkflowBindings: summary.missingWorkflowBindings,
      manifestBoundTiers: summary.manifestBoundTiers,
      missingManifestBindings: summary.missingManifestBindings,
      failureClassifications: summary.failureClassifications,
    },
    tiers: candidate.tiers,
    failureClassifications: candidate.failureClassifications,
  };
}

const stableTruthReport = {
  summary: {
    totalTiers: 3,
    workflowBoundTiers: 3,
    missingWorkflowBindings: [],
    manifestBoundTiers: 3,
    missingManifestBindings: [],
    failureClassifications: 4,
    environmentDiagnostics: 0,
    blockingDiagnosticIds: [],
  },
  tiers: [
    { id: 'fast', command: 'pnpm check:quality:fast' },
    { id: 'standard', command: 'pnpm check:quality:standard' },
    { id: 'release', command: 'pnpm check:quality:release' },
  ],
  failureClassifications: [
    { id: 'contract-drift' },
    { id: 'toolchain-platform' },
    { id: 'artifact-integrity' },
    { id: 'evidence-gap' },
  ],
  environmentDiagnostics: [],
};

const hostVariantReport = {
  ...stableTruthReport,
  summary: {
    ...stableTruthReport.summary,
    environmentDiagnostics: 1,
    blockingDiagnosticIds: [],
  },
  environmentDiagnostics: [
    {
      id: 'vite-host-build-preflight',
      status: 'warning',
      platform: 'win32',
    },
  ],
};

assert.deepEqual(
  normalizeReportForComparison(hostVariantReport),
  normalizeReportForComparison(stableTruthReport),
  'workspace quality-matrix freshness must ignore host-specific environment diagnostics when tier and workflow truth are unchanged.',
);

assert.ok(fs.existsSync(outputPath));
assert.equal(report.generatedAt, '2026-04-09T08:00:00.000Z');
assert.equal(report.summary.totalTiers, 3);
assert.equal(report.summary.workflowBoundTiers, 3);
assert.deepEqual(report.summary.missingWorkflowBindings, []);
assert.equal(report.summary.manifestBoundTiers, 3);
assert.deepEqual(report.summary.missingManifestBindings, []);
assert.equal(report.summary.failureClassifications, 4);
assert.equal(report.summary.environmentDiagnostics, 1);
assert.deepEqual(report.summary.blockingDiagnosticIds, []);
assert.deepEqual(
  report.tiers.map((tier) => ({
    id: tier.id,
    command: tier.command,
    workflowBound: tier.workflow.bound,
    manifestBound: tier.manifest.bound,
  })),
  [
    {
      id: 'fast',
      command: rootPackageJson.scripts['check:quality:fast'],
      workflowBound: true,
      manifestBound: true,
    },
    {
      id: 'standard',
      command: rootPackageJson.scripts['check:quality:standard'],
      workflowBound: true,
      manifestBound: true,
    },
    {
      id: 'release',
      command: rootPackageJson.scripts['check:quality:release'],
      workflowBound: true,
      manifestBound: true,
    },
  ],
);
assert.equal(
  report.tiers.find((tier) => tier.id === 'release')?.workflow.stepName,
  'Run release verification',
);
assert.match(
  report.tiers.find((tier) => tier.id === 'release')?.focus.join(' ') ?? '',
  /engine-adapter governance and conformance/u,
);
assert.match(
  report.tiers.find((tier) => tier.id === 'release')?.evidence.join(' ') ?? '',
  /engine governance regression checks/u,
);
assert.deepEqual(
  report.tiers.find((tier) => tier.id === 'release')?.governanceCheckIds ?? [],
  [
    'engine-official-sdk',
    'engine-official-sdk-runtime-selection',
    'engine-runtime-adapter',
    'engine-kernel',
    'engine-environment-health',
    'engine-capability-extension',
    'engine-experimental-capability-gating',
    'engine-canonical-registry-governance',
    'provider-sdk-import-governance',
    'provider-sdk-package-manifest',
    'provider-adapter-browser-safety',
    'engine-official-sdk-error-propagation',
    'provider-official-sdk-bridge',
    'opencode-official-sdk-bridge',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
  ],
);
assert.deepEqual(report.environmentDiagnostics.map((entry) => entry.id), ['vite-host-build-preflight']);
assert.equal(report.environmentDiagnostics[0].classification, 'toolchain-platform');
assert.equal(report.environmentDiagnostics[0].status, 'warning');
assert.deepEqual(report.environmentDiagnostics[0].appliesTo, ['fast', 'standard', 'release']);
assert.match(report.environmentDiagnostics[0].summary, /toolchain-platform/u);
assert.deepEqual(report.environmentDiagnostics[0].requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(report.environmentDiagnostics[0].rerunCommands, [
  'pnpm check:quality:fast',
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);
assert.equal(report.environmentDiagnostics[0].checks.length, 2);

const topologyGapRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-topology-gap-'));
fs.mkdirSync(path.join(topologyGapRootDir, '.github', 'workflows'), { recursive: true });
const topologyGapPackageJson = structuredClone(rootPackageJson);
delete topologyGapPackageJson.scripts['check:quality:fast'];
fs.writeFileSync(
  path.join(topologyGapRootDir, 'package.json'),
  `${JSON.stringify(topologyGapPackageJson, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(path.join(topologyGapRootDir, '.github', 'workflows', 'ci.yml'), ciWorkflow, 'utf8');
fs.writeFileSync(
  path.join(topologyGapRootDir, '.github', 'workflows', 'release-reusable.yml'),
  releaseWorkflow,
  'utf8',
);

const topologyGapReport = buildQualityGateMatrixReport({
  rootDir: topologyGapRootDir,
  outputPath: path.join(topologyGapRootDir, 'quality-gate-matrix-report.json'),
  now: () => new Date('2026-04-15T08:00:00.000Z'),
  platform: 'linux',
  preflightReport: {
    ok: true,
    status: 'passed',
    checks: [],
  },
});

assert.equal(topologyGapReport.summary.workflowBoundTiers, 3);
assert.deepEqual(topologyGapReport.summary.missingWorkflowBindings, []);
assert.equal(topologyGapReport.summary.manifestBoundTiers, 2);
assert.deepEqual(topologyGapReport.summary.missingManifestBindings, ['fast']);
assert.deepEqual(
  topologyGapReport.tiers.map((tier) => ({
    id: tier.id,
    command: tier.command,
    workflowBound: tier.workflow.bound,
    manifestBound: tier.manifest.bound,
  })),
  [
    {
      id: 'fast',
      command: '',
      workflowBound: true,
      manifestBound: false,
    },
    {
      id: 'standard',
      command: rootPackageJson.scripts['check:quality:standard'],
      workflowBound: true,
      manifestBound: true,
    },
    {
      id: 'release',
      command: rootPackageJson.scripts['check:quality:release'],
      workflowBound: true,
      manifestBound: true,
    },
  ],
);

const defaultOutputPath = path.join(rootDir, DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE);
if (fs.existsSync(defaultOutputPath)) {
  const workspaceArtifact = JSON.parse(fs.readFileSync(defaultOutputPath, 'utf8'));
  const freshWorkspaceReport = buildQualityGateMatrixReport({
    rootDir,
    outputPath: path.join(tempDir, 'quality-gate-matrix-report-current.json'),
  });

  assert.deepEqual(
    normalizeReportForComparison(workspaceArtifact),
    normalizeReportForComparison(freshWorkspaceReport),
    `${DEFAULT_QUALITY_GATE_MATRIX_REPORT_FILE} must be regenerated after quality-tier command or workflow truth changes.`,
  );
}

console.log('quality gate matrix contract passed.');
