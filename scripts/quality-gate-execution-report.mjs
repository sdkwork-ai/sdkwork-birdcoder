import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { buildToolchainPlatformDiagnostic, QUALITY_GATE_TIERS } from './quality-gate-matrix-report.mjs';
import { runWindowsShellCommandWithOutputCapture } from './windows-shell-command-runner.mjs';

export const DEFAULT_QUALITY_GATE_EXECUTION_REPORT_FILE = 'artifacts/quality/quality-gate-execution-report.json';
export const QUALITY_GATE_COMMAND_RUNNER_DIAGNOSTIC_ID = 'quality-gate-command-runner';

export const QUALITY_GATE_EXECUTION_TIERS = Object.freeze(
  QUALITY_GATE_TIERS.map((tier) => Object.freeze({
    id: tier.id,
    label: tier.label,
    scriptName: tier.scriptName,
    command: `pnpm ${tier.scriptName}`,
  })),
);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== '--output') {
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('Missing value for --output.');
    }

    options.output = value;
    index += 1;
  }

  return options;
}

function trimOutput(value) {
  return String(value ?? '').trim();
}

function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isViteHostToolchainFailureOutput(output) {
  const normalizedOutput = trimOutput(output);
  if (!/spawn EPERM/i.test(normalizedOutput)) {
    return false;
  }

  return /(vite:define|ensureServiceIsRunning|esbuild(?:\.exe|\\lib\\main\.js))/i.test(normalizedOutput);
}

function normalizeTierResult(result = {}) {
  return {
    status: String(result.status ?? '').trim(),
    exitCode: typeof result.exitCode === 'number' ? result.exitCode : 1,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr),
    durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
  };
}

function readQualityGateRootPackageJson(rootDir) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

export function validateQualityGateExecutionTopology({
  tiers = QUALITY_GATE_EXECUTION_TIERS,
  rootDir = process.cwd(),
  rootPackageJson = readQualityGateRootPackageJson(rootDir),
} = {}) {
  const errors = [];

  for (const tier of tiers) {
    if (!rootPackageJson?.scripts?.[tier.scriptName]) {
      errors.push({
        tier,
        message: `Quality gate tier ${tier.id} references missing root package script: ${tier.scriptName}`,
      });
    }
  }

  return errors;
}

function resolveTierInvocation(tier, { platform = process.platform } = {}) {
  if (platform === 'win32') {
    return {
      command: tier.command,
      args: [],
      shell: true,
      diagnosticCommand: 'cmd.exe',
      requiredCapability: 'cmd.exe shell execution',
    };
  }

  return {
    command: 'pnpm',
    args: [tier.scriptName],
    shell: false,
    diagnosticCommand: 'pnpm',
    requiredCapability: 'pnpm child-process execution',
  };
}

export async function executeQualityGateTier(
  tier,
  {
    rootDir = process.cwd(),
    platform = process.platform,
    spawnSyncImpl = spawnSync,
  } = {},
) {
  const startedAt = Date.now();
  const invocation = resolveTierInvocation(tier, { platform });
  const result = invocation.shell === true && platform === 'win32'
    ? runWindowsShellCommandWithOutputCapture(invocation.command, {
        cwd: rootDir,
        runner: (command, options) => spawnSyncImpl(command, options),
      })
    : spawnSyncImpl(invocation.command, invocation.args, {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        shell: invocation.shell === true,
        windowsHide: true,
      });

  const errorText = result.error instanceof Error
    ? result.error.stack || result.error.message
    : trimOutput(result.error);
  const stderr = [trimOutput(result.stderr), trimOutput(errorText)]
    .filter(Boolean)
    .join('\n');

  return {
    status: result.error || result.status !== 0 ? 'failed' : 'passed',
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: trimOutput(result.stdout),
    stderr,
    durationMs: Date.now() - startedAt,
  };
}

function buildSkippedTier(tier, blockedByTierId) {
  return {
    id: tier.id,
    label: tier.label,
    scriptName: tier.scriptName,
    command: tier.command,
    status: 'skipped',
    exitCode: null,
    durationMs: 0,
    stdout: '',
    stderr: '',
    blockedByTierId,
    skipReason: 'upstream-tier-not-passed',
  };
}

function buildFailedTier(tier, stderr) {
  return {
    id: tier.id,
    label: tier.label,
    scriptName: tier.scriptName,
    command: tier.command,
    status: 'failed',
    exitCode: 1,
    durationMs: 0,
    stdout: '',
    stderr: trimOutput(stderr),
  };
}

function shouldTreatAsToolchainBlock({ tier, result, toolchainDiagnostic }) {
  if (
    !toolchainDiagnostic
    || (toolchainDiagnostic.status !== 'blocked' && toolchainDiagnostic.status !== 'warning')
  ) {
    return false;
  }

  if (!toolchainDiagnostic.appliesTo.includes(tier.id)) {
    return false;
  }

  const combinedOutput = `${trimOutput(result.stdout)}\n${trimOutput(result.stderr)}`;
  return isViteHostToolchainFailureOutput(combinedOutput);
}

function resolveTierRerunCommands(startTierId = '') {
  const startIndex = QUALITY_GATE_EXECUTION_TIERS.findIndex((tier) => tier.id === startTierId);
  if (startIndex < 0) {
    return [];
  }

  return QUALITY_GATE_EXECUTION_TIERS
    .slice(startIndex)
    .map((tier) => tier.command);
}

function buildCommandRunnerDiagnostic({
  tier,
  result,
  platform = process.platform,
} = {}) {
  const invocation = resolveTierInvocation(tier, { platform });
  const invocationCommand = String(invocation.diagnosticCommand ?? invocation.command ?? '').trim();
  const requiredCapability = String(
    invocation.requiredCapability ?? `${invocationCommand} child-process execution`,
  ).trim();
  const combinedOutput = `${trimOutput(result.stdout)}\n${trimOutput(result.stderr)}`;
  if (!invocationCommand || !/EPERM/i.test(combinedOutput)) {
    return null;
  }

  const invocationPattern = new RegExp(`spawn(?:Sync)?\\s+.*${escapeRegex(invocationCommand)}\\s+EPERM`, 'i');
  if (!invocationPattern.test(combinedOutput)) {
    return null;
  }

  return {
    id: QUALITY_GATE_COMMAND_RUNNER_DIAGNOSTIC_ID,
    label: 'Quality gate command runner',
    classification: 'toolchain-platform',
    appliesTo: resolveTierRerunCommands(tier.id).map((command) => (
      QUALITY_GATE_EXECUTION_TIERS.find((entry) => entry.command === command)?.id ?? ''
    )).filter(Boolean),
    platform: String(platform ?? '').trim(),
    status: 'blocked',
    summary: `The current host blocks ${requiredCapability} required to run quality gate tiers (${tier.id}; spawn EPERM).`,
    requiredCapabilities: [requiredCapability],
    rerunCommands: resolveTierRerunCommands(tier.id),
    checks: [],
  };
}

function buildExecutedTier({ tier, result, blockingDiagnostic, toolchainDiagnostic }) {
  const normalizedResult = normalizeTierResult(result);
  const baseTier = {
    id: tier.id,
    label: tier.label,
    scriptName: tier.scriptName,
    command: tier.command,
    exitCode: normalizedResult.exitCode,
    durationMs: normalizedResult.durationMs,
    stdout: normalizedResult.stdout,
    stderr: normalizedResult.stderr,
  };

  if (normalizedResult.status === 'passed') {
    return {
      ...baseTier,
      status: 'passed',
    };
  }

  if (blockingDiagnostic?.status === 'blocked') {
    return {
      ...baseTier,
      status: 'blocked',
      failureClassification: blockingDiagnostic.classification || 'toolchain-platform',
      blockingDiagnosticIds: [blockingDiagnostic.id],
      requiredCapabilities: [...(blockingDiagnostic.requiredCapabilities ?? [])],
      rerunCommands: [...(blockingDiagnostic.rerunCommands ?? [])],
    };
  }

  if (shouldTreatAsToolchainBlock({ tier, result: normalizedResult, toolchainDiagnostic })) {
    return {
      ...baseTier,
      status: 'blocked',
      failureClassification: 'toolchain-platform',
      blockingDiagnosticIds: [toolchainDiagnostic.id],
      requiredCapabilities: [...(toolchainDiagnostic.requiredCapabilities ?? [])],
      rerunCommands: [...(toolchainDiagnostic.rerunCommands ?? [])],
    };
  }

  return {
    ...baseTier,
    status: 'failed',
  };
}

function summarizeExecutionReport(tiers) {
  const executedTiers = tiers.filter((tier) => tier.status !== 'skipped');
  const passedTiers = tiers.filter((tier) => tier.status === 'passed');
  const blockedTiers = tiers.filter((tier) => tier.status === 'blocked');
  const failedTiers = tiers.filter((tier) => tier.status === 'failed');
  const skippedTiers = tiers.filter((tier) => tier.status === 'skipped');
  const blockingDiagnosticIds = Array.from(new Set(
    blockedTiers.flatMap((tier) => tier.blockingDiagnosticIds ?? []),
  ));

  return {
    totalTiers: tiers.length,
    executedCount: executedTiers.length,
    passedCount: passedTiers.length,
    blockedCount: blockedTiers.length,
    failedCount: failedTiers.length,
    skippedCount: skippedTiers.length,
    lastExecutedTierId: executedTiers.at(-1)?.id ?? '',
    blockingTierIds: blockedTiers.map((tier) => tier.id),
    failedTierIds: failedTiers.map((tier) => tier.id),
    skippedTierIds: skippedTiers.map((tier) => tier.id),
    blockingDiagnosticIds,
  };
}

export async function runQualityGateExecutionReport({
  rootDir = process.cwd(),
  outputPath = '',
  now = () => new Date(),
  platform = process.platform,
  preflightReport,
  runner = executeQualityGateTier,
  tierDefinitions = QUALITY_GATE_EXECUTION_TIERS,
} = {}) {
  const reportPath = path.resolve(rootDir, outputPath || DEFAULT_QUALITY_GATE_EXECUTION_REPORT_FILE);
  const toolchainDiagnostic = buildToolchainPlatformDiagnostic({
    rootDir,
    platform,
    preflightReport,
  });
  const environmentDiagnostics = [];

  const tiers = [];
  let haltedTierId = '';
  const topologyErrorsByTierId = new Map(
    validateQualityGateExecutionTopology({
      tiers: tierDefinitions,
      rootDir,
    }).map((entry) => [entry.tier.id, entry]),
  );

  for (const tier of tierDefinitions) {
    if (haltedTierId) {
      tiers.push(buildSkippedTier(tier, haltedTierId));
      continue;
    }

    const topologyError = topologyErrorsByTierId.get(tier.id);
    if (topologyError) {
      tiers.push(buildFailedTier(tier, topologyError.message));
      haltedTierId = tier.id;
      continue;
    }

    const result = await runner(tier, { rootDir, platform });
    const blockingDiagnostic = buildCommandRunnerDiagnostic({
      tier,
      result,
      platform,
    });
    if (
      blockingDiagnostic
      && !environmentDiagnostics.some((diagnostic) => diagnostic.id === blockingDiagnostic.id)
    ) {
      environmentDiagnostics.push(blockingDiagnostic);
    }
    const executedTier = buildExecutedTier({
      tier,
      result,
      blockingDiagnostic,
      toolchainDiagnostic,
    });
    if (
      executedTier.status === 'blocked'
      && Array.isArray(executedTier.blockingDiagnosticIds)
      && executedTier.blockingDiagnosticIds.includes(toolchainDiagnostic.id)
      && !environmentDiagnostics.some((diagnostic) => diagnostic.id === toolchainDiagnostic.id)
    ) {
      environmentDiagnostics.push(toolchainDiagnostic);
    }
    tiers.push(executedTier);

    if (executedTier.status !== 'passed') {
      haltedTierId = executedTier.id;
    }
  }

  const summary = summarizeExecutionReport(tiers);
  const report = {
    status: summary.failedCount > 0
      ? 'failed'
      : summary.blockedCount > 0
        ? 'blocked'
        : 'passed',
    generatedAt: now().toISOString(),
    reportPath,
    summary,
    environmentDiagnostics,
    tiers,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  void runQualityGateExecutionReport({
    outputPath: options.output,
  })
    .then((report) => {
      if (report.status !== 'passed') {
        console.error(
          `Quality gate execution report finished with ${report.status}: ${report.summary.lastExecutedTierId || 'unknown'}`,
        );
        process.exit(1);
        return;
      }

      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
