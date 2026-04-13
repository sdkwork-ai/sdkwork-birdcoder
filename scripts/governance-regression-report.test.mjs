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
assert.equal(windowsPnpmInvocation.command, 'powershell.exe');
assert.deepEqual(windowsPnpmInvocation.args.slice(0, 2), ['-NoProfile', '-Command']);
assert.match(windowsPnpmInvocation.args[2], /'pnpm\.cmd' 'run' 'build'/);

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
    npm_lifecycle_script: 'pnpm check:quality:fast && pnpm check:quality:standard && pnpm check:governance-regression',
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
    'terminal-governance',
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
    'terminal-cli-registry',
    'run-config-request',
    'run-config',
    'terminal-runtime',
    'terminal-session',
    'terminal-host-runtime',
    'workbench-preferences',
    'chat-runtime',
    'local-store',
    'gemini-engine',
    'engine-runtime-adapter',
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
    'release-terminal-governance-evidence-archive',
    'release-notes-render',
    'release-notes-claw-invocation',
    'release-notes-docs-registry',
    'release-desktop-installers',
    'release-desktop-packaged-launch',
    'release-desktop-startup-evidence',
    'release-server-release-assets',
    'release-deployment-release-assets',
    'sdkwork-birdcoder-architecture',
    'sdkwork-appbase-parity',
    'release-closure',
  ],
);
assert.deepEqual(executedChecks, GOVERNANCE_REGRESSION_CHECKS.map((check) => check.id));
assert.equal(passedReport.status, 'passed');
assert.equal(passedReport.generatedAt, '2026-04-08T15:30:00.000Z');
assert.equal(passedReport.summary.totalChecks, 88);
assert.equal(passedReport.summary.passedCount, 88);
assert.equal(passedReport.summary.failedCount, 0);
assert.ok(fs.existsSync(outputPath));

const persistedPassedReport = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
assert.equal(persistedPassedReport.status, 'passed');
assert.deepEqual(
  persistedPassedReport.checks.map((check) => check.command),
  [
    'node scripts/package-governance-contract.test.mjs',
    'node scripts/governance-baseline-contract.test.ts',
    'node scripts/terminal-governance-contract.test.ts',
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
    'node scripts/terminal-cli-registry-contract.test.ts',
    'node scripts/run-config-request-contract.test.ts',
    'node scripts/run-config-contract.test.ts',
    'node scripts/terminal-runtime-contract.test.ts',
    'node scripts/terminal-session-contract.test.ts',
    'node scripts/terminal-host-runtime-contract.test.ts',
    'node scripts/workbench-preferences-contract.test.ts',
    'node scripts/chat-runtime-contract.test.ts',
    'node scripts/local-store-contract.test.ts',
    'node scripts/gemini-engine-contract.test.ts',
    'pnpm run test:engine-runtime-adapter',
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
    'node scripts/release/terminal-governance-evidence-archive.test.mjs',
    'node scripts/release/render-release-notes.test.mjs',
    'node scripts/release/render-release-notes-claw-invocation.test.mjs',
    'node scripts/release/render-release-notes-docs-registry.test.mjs',
    'node scripts/release/smoke-desktop-installers.test.mjs',
    'node scripts/release/smoke-desktop-packaged-launch.test.mjs',
    'node scripts/release/smoke-desktop-startup-evidence.test.mjs',
    'node scripts/release/smoke-server-release-assets.test.mjs',
    'node scripts/release/smoke-deployment-release-assets.test.mjs',
    'node scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
    'node scripts/sdkwork-appbase-parity-contract.test.mjs',
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
assert.equal(failedReport.summary.failedCount, 1);
assert.ok(fs.existsSync(failedOutputPath));
assert.equal(
  failedReport.checks.find((check) => check.id === 'release-closure')?.status,
  'failed',
);

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
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

console.log('governance regression report contract passed.');
