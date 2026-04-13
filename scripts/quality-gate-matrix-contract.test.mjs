import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

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

const blockedToolchainDiagnostic = buildToolchainPlatformDiagnostic({
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
assert.equal(blockedToolchainDiagnostic.classification, 'toolchain-platform');
assert.equal(blockedToolchainDiagnostic.status, 'blocked');
assert.deepEqual(blockedToolchainDiagnostic.appliesTo, ['standard', 'release']);
assert.match(blockedToolchainDiagnostic.summary, /cmd\.exe/u);
assert.match(blockedToolchainDiagnostic.summary, /esbuild\.exe/u);
assert.match(blockedToolchainDiagnostic.summary, /spawn EPERM/u);
assert.deepEqual(blockedToolchainDiagnostic.requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(blockedToolchainDiagnostic.rerunCommands, [
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);

assert.equal(rootPackageJson.scripts.typecheck, 'pnpm -s exec tsc --noEmit');
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['quality:report'], 'node scripts/quality-gate-matrix-report.mjs');
assert.equal(
  rootPackageJson.scripts['check:desktop-startup-graph'],
  'node scripts/desktop-startup-graph-contract.test.mjs && node scripts/desktop-startup-graph-port-resilience.test.mjs',
);
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.match(rootPackageJson.scripts.lint, /^pnpm exec tsc --noEmit && /);
assert.match(rootPackageJson.scripts.lint, /pnpm --filter @sdkwork\/birdcoder-web exec tsc --noEmit/);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:fast'],
  /^pnpm lint$/,
  'check:quality:fast must avoid reopening a nested pnpm lint wrapper on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:desktop'],
  'pnpm --dir packages/sdkwork-birdcoder-desktop exec tsc --noEmit && node scripts/release/release-profiles.test.mjs && cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:desktop'],
  /--filter @sdkwork\/birdcoder-desktop lint/,
  'check:desktop must avoid reopening a nested package lint wrapper on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:server'],
  'pnpm --dir packages/sdkwork-birdcoder-server exec tsc --noEmit && cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:server'],
  /--filter @sdkwork\/birdcoder-server lint/,
  'check:server must avoid reopening a nested package lint wrapper on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:quality:standard'],
  `${rootPackageJson.scripts['check:desktop']} && ${rootPackageJson.scripts['check:server']} && ${rootPackageJson.scripts['prepare:shared-sdk']} && pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production && ${rootPackageJson.scripts['check:web-bundle-budget']} && ${rootPackageJson.scripts['server:build']} && ${rootPackageJson.scripts['docs:build']}`,
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:standard'],
  /^pnpm check:desktop && pnpm check:server/,
  'check:quality:standard must avoid reopening nested desktop/server gate wrappers on Windows',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:quality:standard'],
  /&& pnpm build && pnpm server:build && pnpm docs:build$/,
  'check:quality:standard must avoid reopening nested root build/server/docs wrappers on Windows',
);
assert.equal(
  rootPackageJson.scripts['check:quality:release'],
  'pnpm check:quality:fast && pnpm check:quality:standard && pnpm check:quality-matrix && pnpm check:release-flow && pnpm check:ci-flow && pnpm check:governance-regression',
);

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
    checks: blockedToolchainDiagnostic.checks,
  },
});

function normalizeReportForComparison(candidate = {}) {
  return {
    summary: candidate.summary,
    tiers: candidate.tiers,
    failureClassifications: candidate.failureClassifications,
    environmentDiagnostics: candidate.environmentDiagnostics,
  };
}

assert.ok(fs.existsSync(outputPath));
assert.equal(report.generatedAt, '2026-04-09T08:00:00.000Z');
assert.equal(report.summary.totalTiers, 3);
assert.equal(report.summary.workflowBoundTiers, 3);
assert.deepEqual(report.summary.missingWorkflowBindings, []);
assert.equal(report.summary.failureClassifications, 4);
assert.equal(report.summary.environmentDiagnostics, 1);
assert.deepEqual(report.summary.blockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(
  report.tiers.map((tier) => ({ id: tier.id, command: tier.command, bound: tier.workflow.bound })),
  [
    { id: 'fast', command: rootPackageJson.scripts['check:quality:fast'], bound: true },
    { id: 'standard', command: rootPackageJson.scripts['check:quality:standard'], bound: true },
    { id: 'release', command: rootPackageJson.scripts['check:quality:release'], bound: true },
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
    'engine-runtime-adapter',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
  ],
);
assert.deepEqual(report.environmentDiagnostics.map((entry) => entry.id), ['vite-host-build-preflight']);
assert.equal(report.environmentDiagnostics[0].classification, 'toolchain-platform');
assert.equal(report.environmentDiagnostics[0].status, 'blocked');
assert.deepEqual(report.environmentDiagnostics[0].appliesTo, ['standard', 'release']);
assert.match(report.environmentDiagnostics[0].summary, /toolchain-platform/u);
assert.deepEqual(report.environmentDiagnostics[0].requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(report.environmentDiagnostics[0].rerunCommands, [
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);
assert.equal(report.environmentDiagnostics[0].checks.length, 2);

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
