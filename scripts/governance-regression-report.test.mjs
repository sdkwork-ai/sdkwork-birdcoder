import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  buildGovernanceRegressionCommandEnv,
  DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE,
  executeGovernanceRegressionCheck,
  GOVERNANCE_REGRESSION_CHECKS,
  resolveGovernanceRegressionCommandInvocation,
  runGovernanceRegressionReport,
} from './governance-regression-report.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-governance-regression-'));
const outputPath = path.join(tempDir, 'governance-regression-report.json');
const now = () => new Date('2026-04-08T15:30:00.000Z');
const defaultRunnerScriptPath = path.join(tempDir, 'default-runner-check.mjs');
const commandRunnerScriptPath = path.join(tempDir, 'command-runner-check.mjs');

fs.writeFileSync(defaultRunnerScriptPath, "console.log('default-runner-ok');\n", 'utf8');
fs.writeFileSync(
  commandRunnerScriptPath,
  [
    "import { pathToFileURL } from 'node:url';",
    '',
    "if (import.meta.url !== pathToFileURL(process.argv[1]).href) {",
    "  throw new Error('command-runner-check must execute through the declared command path');",
    '}',
    '',
    "console.log('command-runner-ok');",
    '',
  ].join('\n'),
  'utf8',
);

const defaultRunnerResult = await executeGovernanceRegressionCheck(
  {
    id: 'default-runner',
    label: 'Default runner smoke',
    scriptPath: defaultRunnerScriptPath,
    command: `node ${defaultRunnerScriptPath}`,
  },
  {
    rootDir: process.cwd(),
  },
);

assert.equal(defaultRunnerResult.status, 'passed');
assert.equal(defaultRunnerResult.exitCode, 0);
assert.match(defaultRunnerResult.stdout, /default-runner-ok/);

const commandRunnerResult = await executeGovernanceRegressionCheck(
  {
    id: 'command-runner',
    label: 'Command runner smoke',
    scriptPath: commandRunnerScriptPath,
    command: `node ${commandRunnerScriptPath}`,
    execution: 'command',
  },
  {
    rootDir: process.cwd(),
  },
);

assert.equal(commandRunnerResult.status, 'passed');
assert.equal(commandRunnerResult.exitCode, 0);
assert.match(commandRunnerResult.stdout, /command-runner-ok/);
assert.equal(
  GOVERNANCE_REGRESSION_CHECKS.find((check) => check.id === 'web-bundle-budget')?.execution,
  'command',
);
const windowsPnpmInvocation = resolveGovernanceRegressionCommandInvocation('pnpm run build', {
  platform: 'win32',
});
assert.equal(windowsPnpmInvocation.command, 'pnpm run build');
assert.deepEqual(windowsPnpmInvocation.args, []);
assert.equal(windowsPnpmInvocation.shell, true);
assert.equal(windowsPnpmInvocation.diagnosticCommand, 'cmd.exe');
assert.equal(windowsPnpmInvocation.requiredCapability, 'cmd.exe shell execution');

const fakeNodeDir = path.join(tempDir, 'fake-node-home');
fs.mkdirSync(fakeNodeDir, { recursive: true });
const commandEnv = buildGovernanceRegressionCommandEnv({
  env: {
    Path: 'C:\\existing-tools',
  },
  execPath: path.join(fakeNodeDir, 'node.exe'),
});
assert.equal(commandEnv.Path, `${fakeNodeDir}${path.delimiter}C:\\existing-tools`);

const scrubbedCommandEnv = buildGovernanceRegressionCommandEnv({
  env: {
    Path: 'C:\\existing-tools',
    PNPM_HOME: 'C:\\pnpm-home',
    PNPM_PACKAGE_NAME: '@sdkwork/birdcoder-workspace',
    PNPM_SCRIPT_SRC_DIR: 'D:\\javasource\\spring-ai-plus\\spring-ai-plus-business\\apps\\sdkwork-birdcoder',
    npm_command: 'run-script',
    npm_config_user_agent: 'pnpm/10.0.0 npm/? node/v22.0.0 win32 x64',
    npm_execpath: 'C:\\pnpm\\pnpm.cjs',
    npm_lifecycle_event: 'check:quality:release',
    npm_lifecycle_script: 'node scripts/run-quality-release-check.mjs',
    npm_node_execpath: 'C:\\nvm4w\\nodejs\\node.exe',
    npm_package_json: 'D:\\javasource\\spring-ai-plus\\spring-ai-plus-business\\apps\\sdkwork-birdcoder\\package.json',
    npm_package_name: '@sdkwork/birdcoder-workspace',
    npm_package_version: '0.1.0',
  },
  execPath: path.join(fakeNodeDir, 'node.exe'),
});
assert.equal(scrubbedCommandEnv.Path, `${fakeNodeDir}${path.delimiter}C:\\existing-tools`);
assert.equal(scrubbedCommandEnv.PNPM_HOME, 'C:\\pnpm-home');
assert.equal(
  scrubbedCommandEnv.npm_config_user_agent,
  'pnpm/10.0.0 npm/? node/v22.0.0 win32 x64',
);
assert.equal(scrubbedCommandEnv.PNPM_PACKAGE_NAME, undefined);
assert.equal(scrubbedCommandEnv.PNPM_SCRIPT_SRC_DIR, undefined);
assert.equal(scrubbedCommandEnv.npm_command, undefined);
assert.equal(scrubbedCommandEnv.npm_execpath, undefined);
assert.equal(scrubbedCommandEnv.npm_lifecycle_event, undefined);
assert.equal(scrubbedCommandEnv.npm_lifecycle_script, undefined);
assert.equal(scrubbedCommandEnv.npm_node_execpath, undefined);
assert.equal(scrubbedCommandEnv.npm_package_json, undefined);
assert.equal(scrubbedCommandEnv.npm_package_name, undefined);
assert.equal(scrubbedCommandEnv.npm_package_version, undefined);

const executedChecks = [];
const passedReport = await runGovernanceRegressionReport({
  outputPath,
  now,
  runner: (check) => {
    executedChecks.push(check.id);
    return {
      status: 'passed',
      exitCode: 0,
      stdout: `${check.id} ok`,
      stderr: '',
      durationMs: 12,
    };
  },
});

assert.equal(
  DEFAULT_GOVERNANCE_REGRESSION_REPORT_FILE,
  'artifacts/governance/governance-regression-report.json',
);
assert.deepEqual(
  GOVERNANCE_REGRESSION_CHECKS.map((check) => check.id),
  [
    'package-governance',
    'governance-baseline',
    'web-bundle-budget',
    'host-runtime',
    'host-studio-preview',
    'host-studio-simulator',
    'studio-preview-execution',
    'studio-build-execution',
    'studio-test-execution',
    'studio-simulator-execution',
    'studio-preview-evidence-store',
    'studio-build-evidence-store',
    'studio-test-evidence-store',
    'studio-simulator-evidence-store',
    'studio-evidence-viewer',
    'studio-evidence-viewer-ui',
    'studio-simulator-ui',
    'run-config-request',
    'run-config',
    'workbench-preferences',
    'chat-runtime',
    'prompt-service',
    'coding-session-prompt-history-persistence',
    'local-store',
    'gemini-engine',
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
    'codeengine-turn-options-provider',
    'opencode-official-sdk-bridge',
    'engine-conformance',
    'tool-protocol',
    'engine-resume-recovery',
    'local-store-browser-fallback',
    'i18n',
    'desktop-tauri-dev',
    'ui-dependency-resolution',
    'vite-host-toolchain',
    'desktop-vite-host',
    'shared-sdk-mode',
    'shared-sdk-packages',
    'shared-sdk-git-sources',
    'vitepress-toolchain',
    'source-parse',
    'tailwind-source',
    'studio-chat-layout',
    'studio-sidebar-stability',
    'arch-boundaries',
    'sdkwork-birdcoder-structure',
    'release-flow',
    'ci-flow',
    'quality-gate-matrix',
    'claw-release-parity',
    'claw-docs-ia',
    'step-loop-prompt-governance',
    'skill-binding',
    'template-instantiation',
    'prompt-skill-template-runtime-assembly',
    'prompt-skill-template-evidence-repository',
    'prompt-skill-template-evidence-consumer',
    'coding-server-prompt-skill-template-evidence-consumer',
    'postgresql-live-smoke-contract',
    'live-docs-governance-baseline',
    'quality-loop-scoreboard',
    'release-command',
    'release-rollback-plan-command',
    'claw-server-build',
    'birdcoder-server-build',
    'desktop-release-build',
    'release-profiles',
    'release-plan-resolution',
    'release-smoke-contract',
    'release-smoke-router',
    'release-package-assets',
    'release-finalize-assets',
    'release-finalized-assets-smoke',
    'release-studio-evidence-archives',
    'release-notes-render',
    'release-notes-claw-invocation',
    'release-notes-docs-registry',
    'release-desktop-installers',
    'release-desktop-packaged-launch',
    'release-desktop-startup-evidence',
    'release-server-release-assets',
    'release-deployment-release-assets',
    'sdkwork-birdcoder-architecture',
    'birdcoder-identity-standard',
    'user-center-standard',
    'user-center-upstream-sync-payload',
    'user-center-upstream-sync-workflow',
    'release-closure',
  ],
);
assert.deepEqual(executedChecks, GOVERNANCE_REGRESSION_CHECKS.map((check) => check.id));
assert.equal(passedReport.status, 'passed');
assert.equal(passedReport.generatedAt, '2026-04-08T15:30:00.000Z');
assert.equal(passedReport.summary.totalChecks, 101);
assert.equal(passedReport.summary.passedCount, 101);
assert.equal(passedReport.summary.blockedCount, 0);
assert.equal(passedReport.summary.failedCount, 0);
assert.deepEqual(passedReport.summary.blockedCheckIds, []);
assert.deepEqual(passedReport.summary.failedCheckIds, []);
assert.ok(fs.existsSync(outputPath));

const persistedPassedReport = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(persistedPassedReport.status, 'passed');
assert.deepEqual(
  persistedPassedReport.checks.map((check) => check.command),
  [
    'node scripts/package-governance-contract.test.mjs',
    'node scripts/governance-baseline-contract.test.ts',
    'pnpm run build',
    'node scripts/host-runtime-contract.test.ts',
    'node scripts/host-studio-preview-contract.test.ts',
    'node scripts/host-studio-simulator-contract.test.ts',
    'node scripts/studio-preview-execution-contract.test.ts',
    'node scripts/studio-build-execution-contract.test.ts',
    'node scripts/studio-test-execution-contract.test.ts',
    'node scripts/studio-simulator-execution-contract.test.ts',
    'node scripts/studio-preview-evidence-store-contract.test.ts',
    'node scripts/studio-build-evidence-store-contract.test.ts',
    'node scripts/studio-test-evidence-store-contract.test.ts',
    'node scripts/studio-simulator-evidence-store-contract.test.ts',
    'node scripts/studio-evidence-viewer-contract.test.ts',
    'node scripts/studio-evidence-viewer-ui-contract.test.ts',
    'node scripts/studio-simulator-ui-contract.test.ts',
    'node scripts/run-config-request-contract.test.ts',
    'node scripts/run-config-contract.test.ts',
    'node scripts/workbench-preferences-contract.test.ts',
    'node scripts/chat-runtime-contract.test.ts',
    'pnpm run test:prompt-service-contract',
    'pnpm run test:coding-session-prompt-history-persistence-contract',
    'node scripts/local-store-contract.test.ts',
    'node scripts/gemini-engine-contract.test.ts',
    'pnpm run test:engine-official-sdk-contract',
    'pnpm run test:engine-official-sdk-runtime-selection-contract',
    'pnpm run test:engine-runtime-adapter',
    'pnpm run test:engine-kernel-contract',
    'pnpm run test:engine-environment-health-contract',
    'pnpm run test:engine-capability-extension-contract',
    'pnpm run test:engine-experimental-capability-gating-contract',
    'pnpm run test:engine-canonical-registry-governance-contract',
    'pnpm run test:provider-sdk-import-governance-contract',
    'pnpm run test:provider-sdk-package-manifest-contract',
    'pnpm run test:provider-adapter-browser-safety-contract',
    'pnpm run test:engine-official-sdk-error-propagation-contract',
    'pnpm run test:provider-official-sdk-bridge-contract',
    'pnpm run test:codeengine-turn-options-provider-contract',
    'pnpm run test:opencode-official-sdk-bridge-contract',
    'pnpm run test:engine-conformance',
    'pnpm run test:tool-protocol-contract',
    'pnpm run test:engine-resume-recovery-contract',
    'node scripts/local-store-browser-fallback.test.mjs',
    'node scripts/i18n-contract.test.mjs',
    'node scripts/desktop-tauri-dev-contract.test.mjs',
    'node scripts/ui-dependency-resolution-contract.test.mjs',
    'node scripts/run-vite-host.test.mjs',
    'node scripts/run-desktop-vite-host.test.mjs',
    'node scripts/shared-sdk-mode.test.mjs',
    'node scripts/prepare-shared-sdk-packages.test.mjs',
    'node scripts/prepare-shared-sdk-git-sources.test.mjs',
    'node scripts/run-vitepress.test.mjs',
    'node scripts/source-parse-contract.test.mjs',
    'node scripts/tailwind-source-contract.test.mjs',
    'node scripts/studio-chat-layout-contract.test.mjs',
    'node scripts/studio-sidebar-stability-contract.test.mjs',
    'node scripts/check-arch-boundaries.mjs',
    'node scripts/check-sdkwork-birdcoder-structure.mjs',
    'node scripts/release-flow-contract.test.mjs',
    'node scripts/ci-flow-contract.test.mjs',
    'node scripts/quality-gate-matrix-contract.test.mjs',
    'node scripts/claw-release-parity-contract.test.mjs',
    'node scripts/claw-docs-ia-contract.test.mjs',
    'node scripts/prompt-governance-contract.test.mjs',
    'pnpm run test:skill-binding-contract',
    'pnpm run test:template-instantiation-contract',
    'pnpm run test:prompt-skill-template-runtime-assembly-contract',
    'pnpm run test:prompt-skill-template-evidence-repository-contract',
    'pnpm run test:prompt-skill-template-evidence-consumer-contract',
    'pnpm run test:coding-server-prompt-skill-template-evidence-consumer-contract',
    'pnpm run test:postgresql-live-smoke-contract',
    'node scripts/live-docs-governance-baseline.test.mjs',
    'node scripts/quality-loop-scoreboard-contract.test.mjs',
    'node scripts/release/local-release-command.test.mjs',
    'node scripts/release/rollback-plan-command.test.mjs',
    'node scripts/run-claw-server-build.test.mjs',
    'node scripts/run-birdcoder-server-build.test.mjs',
    'node scripts/run-desktop-release-build.test.mjs',
    'node scripts/release/release-profiles.test.mjs',
    'node scripts/release/resolve-release-plan.test.mjs',
    'node scripts/release/release-smoke-contract.test.mjs',
    'node scripts/release/smoke-release-assets.test.mjs',
    'node scripts/release/package-release-assets.test.mjs',
    'node scripts/release/finalize-release-assets.test.mjs',
    'node scripts/release/smoke-finalized-release-assets.test.mjs',
    'node scripts/release/studio-evidence-archives.test.mjs',
    'node scripts/release/render-release-notes.test.mjs',
    'node scripts/release/render-release-notes-claw-invocation.test.mjs',
    'node scripts/release/render-release-notes-docs-registry.test.mjs',
    'node scripts/release/smoke-desktop-installers.test.mjs',
    'node scripts/release/smoke-desktop-packaged-launch.test.mjs',
    'node scripts/release/smoke-desktop-startup-evidence.test.mjs',
    'node scripts/release/smoke-server-release-assets.test.mjs',
    'node scripts/release/smoke-deployment-release-assets.test.mjs',
    'node scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
    'node scripts/birdcoder-identity-standard-contract.test.mjs',
    'node scripts/run-user-center-standard.mjs',
    'node scripts/user-center-upstream-sync-payload.test.mjs',
    'node scripts/user-center-upstream-sync-workflow.test.mjs',
    'node scripts/check-release-closure.mjs',
  ],
);

const failedOutputPath = path.join(tempDir, 'governance-regression-report.failed.json');
const failedReport = await runGovernanceRegressionReport({
  outputPath: failedOutputPath,
  now,
  runner: (check) => ({
    status: check.id === 'release-closure' ? 'failed' : 'passed',
    exitCode: check.id === 'release-closure' ? 1 : 0,
    stdout: '',
    stderr: check.id === 'release-closure' ? 'closure failed' : '',
    durationMs: 7,
  }),
});

assert.equal(failedReport.status, 'failed');
assert.equal(failedReport.summary.blockedCount, 0);
assert.equal(failedReport.summary.failedCount, 1);
assert.deepEqual(failedReport.summary.blockedCheckIds, []);
assert.deepEqual(failedReport.summary.failedCheckIds, ['release-closure']);
assert.ok(fs.existsSync(failedOutputPath));
assert.equal(
  failedReport.checks.find((check) => check.id === 'release-closure')?.status,
  'failed',
);

const blockedOutputPath = path.join(tempDir, 'governance-regression-report.blocked.json');
const blockedReport = await runGovernanceRegressionReport({
  outputPath: blockedOutputPath,
  now,
  platform: 'win32',
  runner: (check) => ({
    status: check.id === 'web-bundle-budget' ? 'failed' : 'passed',
    exitCode: check.id === 'web-bundle-budget' ? 1 : 0,
    stdout: check.id === 'web-bundle-budget'
      ? [
          '> @sdkwork/birdcoder-workspace@0.1.0 build D:\\repo',
          '> node scripts/prepare-shared-sdk-packages.mjs && node scripts/run-vite-host.mjs --cwd packages/sdkwork-birdcoder-web build --mode production && node scripts/web-bundle-budget.test.mjs',
        ].join('\n')
      : '',
    stderr: check.id === 'web-bundle-budget'
      ? [
          '[vite:define] spawn EPERM',
          'at ensureServiceIsRunning (D:\\repo\\node_modules\\esbuild\\lib\\main.js:1978:29)',
        ].join('\n')
      : '',
    errorCode: '',
    errorSyscall: '',
    durationMs: 5,
  }),
});

assert.equal(blockedReport.status, 'blocked');
assert.equal(blockedReport.summary.passedCount, 100);
assert.equal(blockedReport.summary.blockedCount, 1);
assert.equal(blockedReport.summary.failedCount, 0);
assert.deepEqual(blockedReport.summary.blockedCheckIds, ['web-bundle-budget']);
assert.deepEqual(blockedReport.summary.failedCheckIds, []);
assert.deepEqual(
  blockedReport.summary.blockingDiagnosticIds,
  ['vite-host-build-preflight'],
);
assert.deepEqual(
  blockedReport.environmentDiagnostics.map((entry) => entry.id),
  ['vite-host-build-preflight'],
);

const blockedWebBundleCheck = blockedReport.checks.find((check) => check.id === 'web-bundle-budget');
assert.equal(blockedWebBundleCheck?.status, 'blocked');
assert.equal(blockedWebBundleCheck?.failureClassification, 'toolchain-platform');
assert.deepEqual(
  blockedWebBundleCheck?.blockingDiagnosticIds,
  ['vite-host-build-preflight'],
);
assert.deepEqual(
  blockedWebBundleCheck?.requiredCapabilities,
  ['cmd.exe shell execution', 'esbuild.exe process launch'],
);
assert.deepEqual(
  blockedWebBundleCheck?.rerunCommands,
  ['pnpm run build'],
);

const blockedToolchainDiagnostic = blockedReport.environmentDiagnostics.find(
  (entry) => entry.id === 'vite-host-build-preflight',
);
assert.equal(blockedToolchainDiagnostic?.status, 'blocked');
assert.equal(blockedToolchainDiagnostic?.classification, 'toolchain-platform');
assert.deepEqual(blockedToolchainDiagnostic?.appliesTo, ['web-bundle-budget']);
assert.deepEqual(
  blockedToolchainDiagnostic?.requiredCapabilities,
  ['cmd.exe shell execution', 'esbuild.exe process launch'],
);
assert.deepEqual(blockedToolchainDiagnostic?.rerunCommands, ['pnpm run build']);

const runnerBlockedOutputPath = path.join(tempDir, 'governance-regression-report.runner-blocked.json');
const runnerBlockedReport = await runGovernanceRegressionReport({
  outputPath: runnerBlockedOutputPath,
  now,
  platform: 'win32',
  runner: (check) => ({
    status: check.id === 'web-bundle-budget' ? 'failed' : 'passed',
    exitCode: check.id === 'web-bundle-budget' ? 1 : 0,
    stdout: '',
    stderr: check.id === 'web-bundle-budget' ? 'Error: spawnSync C:\\Windows\\System32\\cmd.exe EPERM' : '',
    errorCode: check.id === 'web-bundle-budget' ? 'EPERM' : '',
    errorSyscall: check.id === 'web-bundle-budget' ? 'spawnSync C:\\Windows\\System32\\cmd.exe' : '',
    durationMs: 5,
  }),
});

assert.equal(runnerBlockedReport.status, 'blocked');
assert.equal(runnerBlockedReport.summary.passedCount, 100);
assert.equal(runnerBlockedReport.summary.blockedCount, 1);
assert.equal(runnerBlockedReport.summary.failedCount, 0);
assert.deepEqual(runnerBlockedReport.summary.blockedCheckIds, ['web-bundle-budget']);
assert.deepEqual(runnerBlockedReport.summary.failedCheckIds, []);
assert.deepEqual(
  runnerBlockedReport.summary.blockingDiagnosticIds,
  ['governance-regression-command-runner'],
);
assert.deepEqual(
  runnerBlockedReport.environmentDiagnostics.map((entry) => entry.id),
  ['governance-regression-command-runner'],
);

const runnerBlockedWebBundleCheck = runnerBlockedReport.checks.find((check) => check.id === 'web-bundle-budget');
assert.equal(runnerBlockedWebBundleCheck?.status, 'blocked');
assert.equal(runnerBlockedWebBundleCheck?.failureClassification, 'toolchain-platform');
assert.deepEqual(
  runnerBlockedWebBundleCheck?.blockingDiagnosticIds,
  ['governance-regression-command-runner'],
);
assert.deepEqual(
  runnerBlockedWebBundleCheck?.requiredCapabilities,
  ['cmd.exe shell execution'],
);
assert.deepEqual(
  runnerBlockedWebBundleCheck?.rerunCommands,
  ['pnpm run build'],
);

const blockedRunnerDiagnostic = runnerBlockedReport.environmentDiagnostics.find(
  (entry) => entry.id === 'governance-regression-command-runner',
);
assert.equal(blockedRunnerDiagnostic?.status, 'blocked');
assert.equal(blockedRunnerDiagnostic?.classification, 'toolchain-platform');
assert.deepEqual(blockedRunnerDiagnostic?.appliesTo, ['web-bundle-budget']);

const invalidTopologyRootDir = fs.mkdtempSync(path.join(tempDir, 'invalid-topology-root-'));
fs.mkdirSync(path.join(invalidTopologyRootDir, 'scripts'), { recursive: true });
fs.writeFileSync(
  path.join(invalidTopologyRootDir, 'package.json'),
  JSON.stringify(
    {
      name: '@sdkwork/birdcoder-workspace',
      private: true,
      scripts: {
        build: 'node scripts/present-check.mjs',
      },
    },
    null,
    2,
  ),
  'utf8',
);
fs.writeFileSync(
  path.join(invalidTopologyRootDir, 'scripts', 'present-check.mjs'),
  "console.log('present-topology-check');\n",
  'utf8',
);

const invalidTopologyOutputPath = path.join(tempDir, 'governance-regression-report.invalid-topology.json');
const executedValidTopologyChecks = [];
const invalidTopologyReport = await runGovernanceRegressionReport({
  rootDir: invalidTopologyRootDir,
  outputPath: invalidTopologyOutputPath,
  now,
  checks: [
    {
      id: 'missing-script-file',
      label: 'Missing script file check',
      scriptPath: 'scripts/missing-check.mjs',
      command: 'node scripts/missing-check.mjs',
    },
    {
      id: 'missing-pnpm-script',
      label: 'Missing pnpm script check',
      scriptPath: 'scripts/present-check.mjs',
      command: 'pnpm run test:missing-governance-topology',
    },
    {
      id: 'present-topology-check',
      label: 'Present topology check',
      scriptPath: 'scripts/present-check.mjs',
      command: 'node scripts/present-check.mjs',
    },
  ],
  runner: (check) => {
    executedValidTopologyChecks.push(check.id);
    return {
      status: 'passed',
      exitCode: 0,
      stdout: `${check.id} ok`,
      stderr: '',
      durationMs: 3,
    };
  },
});

assert.equal(invalidTopologyReport.status, 'failed');
assert.equal(invalidTopologyReport.summary.totalChecks, 3);
assert.equal(invalidTopologyReport.summary.passedCount, 1);
assert.equal(invalidTopologyReport.summary.blockedCount, 0);
assert.equal(invalidTopologyReport.summary.failedCount, 2);
assert.deepEqual(
  invalidTopologyReport.summary.failedCheckIds,
  ['missing-script-file', 'missing-pnpm-script'],
);
assert.deepEqual(
  executedValidTopologyChecks,
  ['present-topology-check'],
  'governance regression report must skip executing checks whose declared topology is already invalid.',
);

const invalidMissingScriptCheck = invalidTopologyReport.checks.find((check) => check.id === 'missing-script-file');
assert.equal(invalidMissingScriptCheck?.status, 'failed');
assert.equal(invalidMissingScriptCheck?.exitCode, 1);
assert.match(
  invalidMissingScriptCheck?.stderr ?? '',
  /Governance regression check missing-script-file references missing repo file: scripts\/missing-check\.mjs/,
);

const invalidMissingPnpmCheck = invalidTopologyReport.checks.find((check) => check.id === 'missing-pnpm-script');
assert.equal(invalidMissingPnpmCheck?.status, 'failed');
assert.equal(invalidMissingPnpmCheck?.exitCode, 1);
assert.match(
  invalidMissingPnpmCheck?.stderr ?? '',
  /Governance regression check missing-pnpm-script references missing root package script: test:missing-governance-topology/,
);

const validTopologyCheck = invalidTopologyReport.checks.find((check) => check.id === 'present-topology-check');
assert.equal(validTopologyCheck?.status, 'passed');
assert.ok(fs.existsSync(invalidTopologyOutputPath));

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
);
const governanceRegressionReportSource = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'governance-regression-report.mjs'),
  'utf8',
);
assert.equal(
  rootPackageJson.scripts['check:governance-regression'],
  'node scripts/governance-regression-report.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:governance-regression-contract'],
  'node scripts/governance-regression-report.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:live-docs-governance-baseline'],
  'node scripts/live-docs-governance-baseline.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:quality-loop-scoreboard'],
  'node scripts/quality-loop-scoreboard-contract.test.mjs',
);

assert.doesNotMatch(
  governanceRegressionReportSource,
  /const report = await runGovernanceRegressionReport\(/,
  'governance regression CLI must not block module evaluation behind a top-level await on runGovernanceRegressionReport.',
);
assert.match(
  governanceRegressionReportSource,
  /void runGovernanceRegressionReport\(/,
  'governance regression CLI must launch the async report runner without turning the module itself into a top-level-await dependency.',
);

console.log('governance regression report contract passed.');
