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
import { runWindowsShellCommandWithOutputCapture } from './windows-shell-command-runner.mjs';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const qualityGateExecutionReportSource = fs.readFileSync(
  path.join(rootDir, 'scripts', 'quality-gate-execution-report.mjs'),
  'utf8',
);

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
assert.doesNotMatch(
  qualityGateExecutionReportSource,
  /const report = await runQualityGateExecutionReport\(/,
  'quality gate execution CLI must not block module evaluation behind a top-level await on runQualityGateExecutionReport.',
);
assert.match(
  qualityGateExecutionReportSource,
  /void runQualityGateExecutionReport\(/,
  'quality gate execution CLI must launch the async report runner without turning the module itself into a top-level-await dependency.',
);

if (process.platform === 'win32') {
  const tempCommandDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-command-'));
  const invocations = [];
  const helperInvocations = [];
  const helperOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-quality-gate-shell-helper-'));
  const helperResult = runWindowsShellCommandWithOutputCapture(
    'pnpm check:quality:fast',
    {
      cwd: tempCommandDir,
      tempDir: helperOutputDir,
      cleanup: false,
      runner(command, options) {
        helperInvocations.push({ command, options });
        const match = /1>"([^"]+)" 2>"([^"]+)"/.exec(command);
        assert.ok(match, 'windows shell capture runner must redirect stdout and stderr to files.');
        fs.writeFileSync(match[1], 'fast ok\n', 'utf8');
        fs.writeFileSync(match[2], 'fast warn\n', 'utf8');
        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      },
    },
  );

  assert.equal(helperResult.status, 0);
  assert.equal(helperResult.error, null);
  assert.equal(helperResult.stdout, 'fast ok');
  assert.equal(helperResult.stderr, 'fast warn');
  assert.equal(helperInvocations.length, 1);
  assert.match(helperInvocations[0]?.command ?? '', /^\(pnpm check:quality:fast\) 1>"/);
  assert.equal(helperInvocations[0]?.options.cwd, tempCommandDir);
  assert.equal(helperInvocations[0]?.options.shell, true);
  assert.equal(helperInvocations[0]?.options.stdio, 'ignore');
  assert.equal(helperInvocations[0]?.options.windowsHide, true);
  fs.rmSync(helperOutputDir, { recursive: true, force: true });

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
      spawnSyncImpl(command, args, options) {
        invocations.push({ command, args, options });
        return {
          status: 7,
          stdout: '',
          stderr: 'tier failed',
        };
      },
    },
  );

  assert.equal(failedTierResult.status, 'failed');
  assert.equal(failedTierResult.exitCode, 7);
  assert.equal(invocations.length, 1);
  assert.match(invocations[0]?.command ?? '', /^\(pnpm check:quality:fast\) 1>"/);
  assert.equal(invocations[0]?.options, undefined);
  assert.equal(invocations[0]?.args.cwd, tempCommandDir);
  assert.equal(invocations[0]?.args.shell, true);
  assert.equal(invocations[0]?.args.stdio, 'ignore');
  assert.equal(invocations[0]?.args.windowsHide, true);
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

const warningOnlyOutputPath = path.join(tempDir, 'quality-gate-execution-report.warning-only.json');
const executedWarningOnlyTiers = [];
const warningOnlyReport = await runQualityGateExecutionReport({
  rootDir,
  outputPath: warningOnlyOutputPath,
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
    executedWarningOnlyTiers.push(tier.id);
    return {
      status: 'passed',
      exitCode: 0,
      stdout: `${tier.id} ok`,
      stderr: '',
      durationMs: 9,
    };
  },
});

assert.deepEqual(executedWarningOnlyTiers, ['fast', 'standard', 'release']);
assert.equal(warningOnlyReport.status, 'passed');
assert.equal(warningOnlyReport.summary.executedCount, 3);
assert.equal(warningOnlyReport.summary.passedCount, 3);
assert.equal(warningOnlyReport.summary.blockedCount, 0);
assert.equal(warningOnlyReport.summary.failedCount, 0);
assert.equal(warningOnlyReport.summary.skippedCount, 0);
assert.deepEqual(warningOnlyReport.summary.blockingTierIds, []);
assert.deepEqual(warningOnlyReport.summary.blockingDiagnosticIds, []);
assert.deepEqual(warningOnlyReport.environmentDiagnostics, []);
assert.ok(fs.existsSync(warningOnlyOutputPath));

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
    if (tier.id === 'fast') {
      return {
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: [
          '[vite:define] spawn EPERM',
          'at ensureServiceIsRunning (D:\\repo\\node_modules\\esbuild\\lib\\main.js:1978:29)',
        ].join('\n'),
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

assert.deepEqual(executedBlockedTiers, ['fast']);
assert.equal(blockedReport.status, 'blocked');
assert.equal(blockedReport.summary.executedCount, 1);
assert.equal(blockedReport.summary.passedCount, 0);
assert.equal(blockedReport.summary.blockedCount, 1);
assert.equal(blockedReport.summary.failedCount, 0);
assert.equal(blockedReport.summary.skippedCount, 2);
assert.equal(blockedReport.summary.lastExecutedTierId, 'fast');
assert.deepEqual(blockedReport.summary.blockingTierIds, ['fast']);
assert.deepEqual(blockedReport.summary.failedTierIds, []);
assert.deepEqual(blockedReport.summary.skippedTierIds, ['standard', 'release']);
assert.deepEqual(blockedReport.summary.blockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(blockedReport.environmentDiagnostics.map((entry) => entry.id), ['vite-host-build-preflight']);

const blockedFastTier = blockedReport.tiers.find((tier) => tier.id === 'fast');
assert.equal(blockedFastTier?.status, 'blocked');
assert.equal(blockedFastTier?.failureClassification, 'toolchain-platform');
assert.deepEqual(blockedFastTier?.blockingDiagnosticIds, ['vite-host-build-preflight']);
assert.deepEqual(blockedFastTier?.requiredCapabilities, [
  'cmd.exe shell execution',
  'esbuild.exe process launch',
]);
assert.deepEqual(blockedFastTier?.rerunCommands, [
  'pnpm check:quality:fast',
  'pnpm check:quality:standard',
  'pnpm check:quality:release',
]);

const skippedStandardTier = blockedReport.tiers.find((tier) => tier.id === 'standard');
assert.equal(skippedStandardTier?.status, 'skipped');
assert.equal(skippedStandardTier?.blockedByTierId, 'fast');
assert.equal(skippedStandardTier?.skipReason, 'upstream-tier-not-passed');

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
      stderr: 'Error: spawnSync cmd.exe EPERM',
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
assert.deepEqual(runnerBlockedFastTier?.requiredCapabilities, ['cmd.exe shell execution']);
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

const invalidTopologyRootDir = fs.mkdtempSync(path.join(tempDir, 'quality-gate-invalid-topology-'));
fs.writeFileSync(
  path.join(invalidTopologyRootDir, 'package.json'),
  JSON.stringify(
    {
      name: '@sdkwork/birdcoder-workspace',
      private: true,
      scripts: {
        'check:quality:standard': 'echo present',
        'check:quality:release': 'echo present',
      },
    },
    null,
    2,
  ),
  'utf8',
);

const invalidTopologyOutputPath = path.join(tempDir, 'quality-gate-execution-report.invalid-topology.json');
const executedInvalidTopologyTiers = [];
const invalidTopologyReport = await runQualityGateExecutionReport({
  rootDir: invalidTopologyRootDir,
  outputPath: invalidTopologyOutputPath,
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
    executedInvalidTopologyTiers.push(tier.id);
    return {
      status: 'failed',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: spawnSync cmd.exe EPERM',
      durationMs: 2,
    };
  },
});

assert.equal(invalidTopologyReport.status, 'failed');
assert.equal(invalidTopologyReport.summary.executedCount, 1);
assert.equal(invalidTopologyReport.summary.passedCount, 0);
assert.equal(invalidTopologyReport.summary.blockedCount, 0);
assert.equal(invalidTopologyReport.summary.failedCount, 1);
assert.equal(invalidTopologyReport.summary.skippedCount, 2);
assert.equal(invalidTopologyReport.summary.lastExecutedTierId, 'fast');
assert.deepEqual(invalidTopologyReport.summary.blockingTierIds, []);
assert.deepEqual(invalidTopologyReport.summary.failedTierIds, ['fast']);
assert.deepEqual(invalidTopologyReport.summary.skippedTierIds, ['standard', 'release']);
assert.deepEqual(executedInvalidTopologyTiers, []);

const invalidFastTier = invalidTopologyReport.tiers.find((tier) => tier.id === 'fast');
assert.equal(invalidFastTier?.status, 'failed');
assert.equal(invalidFastTier?.exitCode, 1);
assert.match(
  invalidFastTier?.stderr ?? '',
  /Quality gate tier fast references missing root package script: check:quality:fast/,
);

const invalidSkippedStandardTier = invalidTopologyReport.tiers.find((tier) => tier.id === 'standard');
assert.equal(invalidSkippedStandardTier?.status, 'skipped');
assert.equal(invalidSkippedStandardTier?.blockedByTierId, 'fast');
assert.equal(invalidSkippedStandardTier?.skipReason, 'upstream-tier-not-passed');

assert.ok(fs.existsSync(invalidTopologyOutputPath));

console.log('quality gate execution report contract passed.');
