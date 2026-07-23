import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE =
  'artifacts/governance/governance-regression-report.json';
export const GOVERNANCE_REGRESSION_COMMAND_RUNNER_DIAGNOSTIC_ID =
  'governance-regression-command-runner';

export const RELEASE_GOVERNANCE_CHECKS = Object.freeze([
  Object.freeze({
    id: 'domain-ownership',
    label: 'Domain ownership contract',
    scriptPath: 'scripts/domain-ownership-contract.test.mjs',
    command: 'node scripts/domain-ownership-contract.test.mjs',
  }),
  Object.freeze({
    id: 'persistence-ownership',
    label: 'Persistence ownership contract',
    scriptPath: 'scripts/persistence-ownership-contract.test.mjs',
    command: 'node scripts/persistence-ownership-contract.test.mjs',
  }),
  Object.freeze({
    id: 'app-api-surface',
    label: 'App API surface contract',
    scriptPath: 'scripts/app-sdk-surface-boundary-contract.test.mjs',
    command: 'node scripts/app-sdk-surface-boundary-contract.test.mjs',
  }),
  Object.freeze({
    id: 'sdk-owner-boundary',
    label: 'SDK owner boundary contract',
    scriptPath: 'scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
    command: 'node scripts/birdcoder-sdk-owner-boundary-contract.test.mjs',
  }),
  Object.freeze({
    id: 'app-sdk-composition',
    label: 'App SDK composition contract',
    scriptPath: 'scripts/app-composition-standard-contract.test.mjs',
    command: 'node scripts/app-composition-standard-contract.test.mjs',
  }),
  Object.freeze({
    id: 'agents-owner-boundary',
    label: 'Agents owner boundary contract',
    scriptPath: 'scripts/agents-birdcoder-alignment-contract.test.mjs',
    command: 'node scripts/agents-birdcoder-alignment-contract.test.mjs',
  }),
  Object.freeze({
    id: 'technical-debt',
    label: 'Technical debt contract',
    scriptPath: 'scripts/technical-debt-contract.test.mjs',
    command: 'node scripts/technical-debt-contract.test.mjs',
  }),
  Object.freeze({
    id: 'release-docs-api-sdk',
    label: 'Release documentation API and SDK contract',
    scriptPath: 'scripts/release-docs-api-sdk-standard-contract.test.mjs',
    command: 'node scripts/release-docs-api-sdk-standard-contract.test.mjs',
  }),
  Object.freeze({
    id: 'step-loop-prompt-governance',
    label: 'Prompt owner governance contract',
    scriptPath: 'scripts/prompt-governance-contract.test.mjs',
    command: 'node scripts/prompt-governance-contract.test.mjs',
  }),
  Object.freeze({
    id: 'release-readiness-fixture',
    label: 'Release readiness fixture contract',
    scriptPath: 'scripts/release/write-readiness-fixture.test.mjs',
    command: 'node scripts/release/write-readiness-fixture.test.mjs',
  }),
  Object.freeze({
    id: 'release-candidate-dry-run',
    label: 'Release candidate dry-run contract',
    scriptPath: 'scripts/release/candidate-dry-run.test.mjs',
    command: 'node scripts/release/candidate-dry-run.test.mjs',
  }),
  Object.freeze({
    id: 'release-rollback-plan-command',
    label: 'Release rollback plan command contract',
    scriptPath: 'scripts/release/rollback-plan-command.test.mjs',
    command: 'node scripts/release/rollback-plan-command.test.mjs',
  }),
  Object.freeze({
    id: 'release-closure',
    label: 'Release closure contract',
    scriptPath: 'scripts/check-release-closure.mjs',
    command: 'node scripts/check-release-closure.mjs',
  }),
]);

export const RELEASE_GOVERNANCE_CHECK_IDS = Object.freeze(
  RELEASE_GOVERNANCE_CHECKS.map((check) => check.id),
);
export const GOVERNANCE_REGRESSION_CHECKS = RELEASE_GOVERNANCE_CHECKS;

function parseArgs(argv) {
  const options = { output: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== '--output') {
      throw new Error(`Unknown argument: ${token}`);
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

function prependNodePath(env, execPath, platform) {
  const pathKey = platform === 'win32' ? 'Path' : 'PATH';
  const delimiter = platform === 'win32' ? ';' : ':';
  const currentPath = String(env[pathKey] ?? env.PATH ?? env.Path ?? '');
  const nodeDir = path.dirname(execPath);
  return {
    ...env,
    [pathKey]: [nodeDir, currentPath].filter(Boolean).join(delimiter),
    NODE: execPath,
    npm_node_execpath: execPath,
  };
}

export function resolveGovernanceRegressionCommandInvocation(
  command,
  { env = process.env, platform = process.platform } = {},
) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', command],
    };
  }
  return {
    command: String(env.SHELL ?? '/bin/sh'),
    args: ['-lc', command],
  };
}

export function buildGovernanceRegressionCommandEnv({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  return prependNodePath(env, execPath, platform);
}

export function validateGovernanceRegressionCheckTopology({
  checks = GOVERNANCE_REGRESSION_CHECKS,
  rootDir = process.cwd(),
} = {}) {
  const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const seenIds = new Set();
  const errors = [];

  for (const check of checks) {
    const messages = [];
    if (!String(check?.id ?? '').trim()) {
      messages.push('check id is required');
    } else if (seenIds.has(check.id)) {
      messages.push(`duplicate check id: ${check.id}`);
    } else {
      seenIds.add(check.id);
    }
    if (!String(check?.label ?? '').trim()) {
      messages.push('check label is required');
    }
    if (!String(check?.command ?? '').trim()) {
      messages.push('check command is required');
    }
    const scriptPath = String(check?.scriptPath ?? '').trim();
    if (!scriptPath || !fs.existsSync(path.join(rootDir, ...scriptPath.split('/')))) {
      messages.push(`missing script path: ${scriptPath || 'unspecified'}`);
    }
    const packageScript = String(check?.command ?? '').match(/^pnpm run ([\w:-]+)$/u)?.[1];
    if (packageScript && !rootPackage.scripts?.[packageScript]) {
      messages.push(`missing package script: ${packageScript}`);
    }
    if (/coding-server|coding-session-projection|kernel-bridge|provider-sdk|run-claw-server/iu.test(check?.command ?? '')) {
      messages.push(`retired authority command: ${check.command}`);
    }
    if (messages.length > 0) {
      errors.push({ check, messages });
    }
  }
  return errors;
}

function normalizeExecutionResult(result, startedAt) {
  const status = Number.isInteger(result?.exitCode) && result.exitCode === 0
    ? 'passed'
    : result?.status === 'blocked'
      ? 'blocked'
      : 'failed';
  return {
    status,
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : status === 'passed' ? 0 : 1,
    stdout: String(result?.stdout ?? '').trim(),
    stderr: String(result?.stderr ?? '').trim(),
    errorCode: String(result?.errorCode ?? '').trim(),
    errorSyscall: String(result?.errorSyscall ?? '').trim(),
    durationMs: Math.max(0, Number(result?.durationMs ?? Date.now() - startedAt)),
  };
}

export async function executeGovernanceRegressionCheck(
  check,
  {
    rootDir = process.cwd(),
    env = process.env,
    execPath = process.execPath,
    platform = process.platform,
    spawnImpl = spawn,
  } = {},
) {
  const startedAt = Date.now();
  const invocation = resolveGovernanceRegressionCommandInvocation(check.command, { env, platform });
  const commandEnv = buildGovernanceRegressionCommandEnv({ env, execPath, platform });

  return new Promise((resolve) => {
    const stdout = [];
    const stderr = [];
    let child;
    try {
      child = spawnImpl(invocation.command, invocation.args, {
        cwd: rootDir,
        env: commandEnv,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve(normalizeExecutionResult({
        exitCode: 1,
        stderr: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof Error ? error.code : '',
        errorSyscall: error instanceof Error ? error.syscall : '',
      }, startedAt));
      return;
    }

    child.stdout?.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));
    child.once('error', (error) => {
      resolve(normalizeExecutionResult({
        exitCode: 1,
        stdout: stdout.join(''),
        stderr: stderr.join('') || error.message,
        errorCode: error.code,
        errorSyscall: error.syscall,
      }, startedAt));
    });
    child.once('close', (exitCode) => {
      resolve(normalizeExecutionResult({
        exitCode: exitCode ?? 1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      }, startedAt));
    });
  });
}

function reportCheck(check, result) {
  return {
    id: check.id,
    label: check.label,
    scriptPath: check.scriptPath,
    command: check.command,
    ...result,
  };
}

function summarize(checks) {
  const idsFor = (status) => checks.filter((check) => check.status === status).map((check) => check.id);
  const passedCheckIds = idsFor('passed');
  const blockedCheckIds = idsFor('blocked');
  const failedCheckIds = idsFor('failed');
  return {
    totalCount: checks.length,
    passedCount: passedCheckIds.length,
    blockedCount: blockedCheckIds.length,
    failedCount: failedCheckIds.length,
    passedCheckIds,
    blockedCheckIds,
    failedCheckIds,
  };
}

export async function runGovernanceRegressionReport({
  outputPath = '',
  rootDir = process.cwd(),
  now = () => new Date(),
  runner = executeGovernanceRegressionCheck,
  checks = GOVERNANCE_REGRESSION_CHECKS,
} = {}) {
  const resolvedOutputPath = path.resolve(
    rootDir,
    outputPath || DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE,
  );
  const topologyErrors = new Map(
    validateGovernanceRegressionCheckTopology({ checks, rootDir })
      .map((entry) => [entry.check.id, entry.messages]),
  );
  const reportChecks = [];

  for (const check of checks) {
    const messages = topologyErrors.get(check.id);
    const result = messages
      ? {
          status: 'failed',
          exitCode: 1,
          stdout: '',
          stderr: messages.join('\n'),
          errorCode: '',
          errorSyscall: '',
          durationMs: 0,
        }
      : normalizeExecutionResult(await runner(check, { rootDir }), Date.now());
    reportChecks.push(reportCheck(check, result));
  }

  const summary = summarize(reportChecks);
  const report = {
    status: summary.failedCount > 0 ? 'failed' : summary.blockedCount > 0 ? 'blocked' : 'passed',
    generatedAt: now().toISOString(),
    reportPath: resolvedOutputPath,
    summary,
    environmentDiagnostics: reportChecks
      .filter((check) => check.status === 'blocked')
      .map((check) => ({
        id: GOVERNANCE_REGRESSION_COMMAND_RUNNER_DIAGNOSTIC_ID,
        status: 'blocked',
        checkIds: [check.id],
        detail: check.stderr || 'Command runner is blocked by the current environment.',
      })),
    checks: reportChecks,
  };

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  void runGovernanceRegressionReport({ outputPath: options.output })
    .then((report) => {
      if (report.status !== 'passed') {
        console.error(
          `Governance regression report ${report.status}: ${[
            ...report.summary.failedCheckIds,
            ...report.summary.blockedCheckIds,
          ].join(', ') || 'unknown'}`,
        );
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack || error.message : String(error));
      process.exitCode = 1;
    });
}
