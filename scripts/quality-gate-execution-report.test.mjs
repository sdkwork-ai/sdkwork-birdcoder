import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  DEFAULT_QUALITY_GATE_EXECUTION_REPORT_FILE,
  QUALITY_GATE_EXECUTION_TIERS,
  executeQualityGateTier,
  runQualityGateExecutionReport,
} from './quality-gate-execution-report.mjs';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

assert.equal(
  DEFAULT_QUALITY_GATE_EXECUTION_REPORT_FILE,
  'artifacts/quality/quality-gate-execution-report.json',
);
assert.deepEqual(
  QUALITY_GATE_EXECUTION_TIERS.map((tier) => tier.id),
  ['fast', 'standard', 'release'],
);
assert.equal(
  rootPackageJson.scripts['quality:execution-report'],
  'node scripts/quality-gate-execution-report.mjs',
);

if (process.platform === 'win32') {
  const tempCommandDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-command-'));
  const fakePnpmPath = path.join(tempCommandDir, 'pnpm.cmd');
  fs.writeFileSync(fakePnpmPath, '@echo off\r\nexit /b 7\r\n', 'utf8');

  const originalPath = process.env.PATH;
  try {
    process.env.PATH = `${tempCommandDir};${originalPath ?? ''}`;
    const failedTierResult = await executeQualityGateTier(
      {
        id: 'fast',
        label: 'Fast quality gate',
        scriptName: 'check:quality:fast',
        command: 'pnpm check:quality:fast',
      },
      {
        rootDir: tempCommandDir,
        platform: 'win32',
      },
    );

    assert.equal(failedTierResult.status, 'failed');
    assert.equal(failedTierResult.exitCode, 7);
  } finally {
    process.env.PATH = originalPath;
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-execution-'));
const passedOutputPath = path.join(tempDir, 'quality-gate-execution-report.passed.json');
const blockedOutputPath = path.join(tempDir, 'quality-gate-execution-report.blocked.json');
const runnerBlockedOutputPath = path.join(tempDir, 'quality-gate-execution-report.runner-blocked.json');
const now = () => new Date('2026-04-09T12:00:00.000Z');

const executedPassedTiers = [];
const passedReport = await runQualityGateExecutionReport({
  rootDir,
  outputPath: passedOutputPath,
  now,
  runner: async (tier) => {
    executedPassedTiers.push(tier.id);
    return {
      status: 'passed',
      exitCode: 0,
      stdout: `${tier.id} ok`,
      stderr: '',
      durationMs: 11,
    };
  },
});

assert.deepEqual(executedPassedTiers, ['fast', 'standard', 'release']);
assert.equal(passedReport.status, 'passed');
assert.equal(passedReport.generatedAt, '2026-04-09T12:00:00.000Z');
assert.equal(passedReport.summary.totalTiers, 3);
assert.equal(passedReport.summary.executedCount, 3);
assert.equal(passedReport.summary.passedCount, 3);
assert.equal(passedReport.summary.blockedCount, 0);
assert.equal(passedReport.summary.failedCount, 0);
assert.equal(passedReport.summary.skippedCount, 0);
assert.equal(passedReport.summary.lastExecutedTierId, 'release');
assert.deepEqual(passedReport.summary.blockingTierIds, []);
assert.deepEqual(
  passedReport.tiers.map((tier) => ({ id: tier.id, status: tier.status, command: tier.command })),
  [
    { id: 'fast', status: 'passed', command: 'pnpm check:quality:fast' },
    { id: 'standard', status: 'passed', command: 'pnpm check:quality:standard' },
    { id: 'release', status: 'passed', command: 'pnpm check:quality:release' },
  ],
);
assert.ok(fs.existsSync(passedOutputPath));

const executedBlockedTiers = [];
const blockedReport = await runQualityGateExecutionReport({
  rootDir,
  outputPath: blockedOutputPath,
  now,
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
  runner: async (tier) => {
    executedBlockedTiers.push(tier.id);
    if (tier.id === 'standard') {
      return {
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: 'cmd.exe spawn EPERM\nesbuild.exe spawn EPERM',
        durationMs: 19,
      };
    }

    return {
      status: 'passed',
      exitCode: 0,
      stdout: `${tier.id} ok`,
      stderr: '',
      durationMs: 7,
    };
  },
});

assert.deepEqual(executedBlockedTiers, ['fast', 'standard']);
assert.equal(blockedReport.status, 'blocked');
assert.equal(blockedReport.summary.executedCount, 2);
assert.equal(blockedReport.summary.passedCount, 1);
assert.equal(blockedReport.summary.blockedCount, 1);
assert.equal(blockedReport.summary.failedCount, 0);
assert.equal(blockedReport.summary.skippedCount, 1);
assert.equal(blockedReport.summary.lastExecutedTierId, 'standard');
assert.deepEqual(blockedReport.summary.blockingTierIds, ['standard']);
assert.deepEqual(blockedReport.summary.failedTierIds, []);
assert.deepEqual(blockedReport.summary.skippedTierIds, ['release']);
assert.deepEqual(blockedReport.summary.blockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(blockedReport.environmentDiagnostics.map((entry) => entry.id), ['vite-host-build-preflight']);

const blockedStandardTier = blockedReport.tiers.find((tier) => tier.id === 'standard');
assert.equal(blockedStandardTier?.status, 'blocked');
assert.equal(blockedStandardTier?.failureClassification, 'toolchain-platform');
assert.deepEqual(blockedStandardTier?.blockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(blockedStandardTier?.requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(blockedStandardTier?.rerunCommands, [
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);

const skippedReleaseTier = blockedReport.tiers.find((tier) => tier.id === 'release');
assert.equal(skippedReleaseTier?.status, 'skipped');
assert.equal(skippedReleaseTier?.blockedByTierId, 'standard');
assert.equal(skippedReleaseTier?.skipReason, 'upstream-tier-not-passed');

const executedRunnerBlockedTiers = [];
const runnerBlockedReport = await runQualityGateExecutionReport({
  rootDir,
  outputPath: runnerBlockedOutputPath,
  now,
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
  runner: async (tier) => {
    executedRunnerBlockedTiers.push(tier.id);
    return {
      status: 'failed',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: spawnSync powershell.exe EPERM',
      durationMs: 3,
    };
  },
});

assert.deepEqual(executedRunnerBlockedTiers, ['fast']);
assert.equal(runnerBlockedReport.status, 'blocked');
assert.equal(runnerBlockedReport.summary.executedCount, 1);
assert.equal(runnerBlockedReport.summary.passedCount, 0);
assert.equal(runnerBlockedReport.summary.blockedCount, 1);
assert.equal(runnerBlockedReport.summary.failedCount, 0);
assert.equal(runnerBlockedReport.summary.skippedCount, 2);
assert.equal(runnerBlockedReport.summary.lastExecutedTierId, 'fast');
assert.deepEqual(runnerBlockedReport.summary.blockingTierIds, ['fast']);
assert.deepEqual(runnerBlockedReport.summary.failedTierIds, []);
assert.deepEqual(runnerBlockedReport.summary.skippedTierIds, ['standard', 'release']);
assert.deepEqual(runnerBlockedReport.summary.blockingDiagnosticIds, ['quality-gate-command-runner']);

const runnerBlockedFastTier = runnerBlockedReport.tiers.find((tier) => tier.id === 'fast');
assert.equal(runnerBlockedFastTier?.status, 'blocked');
assert.equal(runnerBlockedFastTier?.failureClassification, 'toolchain-platform');
assert.deepEqual(runnerBlockedFastTier?.blockingDiagnosticIds, ['quality-gate-command-runner']);
assert.deepEqual(runnerBlockedFastTier?.requiredCapabilities, ['powershell.exe child-process execution']);
assert.deepEqual(runnerBlockedFastTier?.rerunCommands, [
  'pnpm check:quality:fast',
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);

const runnerBlockedDiagnostic = runnerBlockedReport.environmentDiagnostics.find(
  (entry) => entry.id === 'quality-gate-command-runner',
);
assert.equal(runnerBlockedDiagnostic?.status, 'blocked');
assert.equal(runnerBlockedDiagnostic?.classification, 'toolchain-platform');
assert.deepEqual(runnerBlockedDiagnostic?.appliesTo, ['fast', 'standard', 'release']);

console.log('quality gate execution report contract passed.');
