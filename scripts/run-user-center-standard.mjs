import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');

function truncateText(value, maxLength = 4000) {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 12))}...[truncated]`;
}

export function resolveUserCenterStandardTestFile({
  rootDir: resolvedRootDir = rootDir,
} = {}) {
  return path.join(resolvedRootDir, 'scripts', 'user-center-standard.test.mjs');
}

export function createUserCenterStandardTestPlan({
  rootDir: resolvedRootDir = rootDir,
  cwd = resolvedRootDir,
  env = process.env,
  nodeExecutable = process.execPath,
  platform = process.platform,
} = {}) {
  return {
    command: nodeExecutable,
    args: [resolveUserCenterStandardTestFile({ rootDir: resolvedRootDir })],
    cwd,
    env,
    shell: false,
    windowsHide: platform === 'win32',
  };
}

function buildCommandFailure(plan, result) {
  const fragments = [];
  if (result?.error) {
    fragments.push(`error: ${result.error.message}`);
  }
  if (String(result?.stdout ?? '').trim()) {
    fragments.push(`stdout: ${truncateText(result.stdout)}`);
  }
  if (String(result?.stderr ?? '').trim()) {
    fragments.push(`stderr: ${truncateText(result.stderr)}`);
  }

  return new Error(
    `user-center standard test failed with exit code ${result?.status ?? 'unknown'} while executing ${plan.command} ${plan.args.join(' ')}${fragments.length > 0 ? `\n${fragments.join('\n')}` : ''}`,
  );
}

export function runUserCenterStandardTest({
  rootDir: resolvedRootDir = rootDir,
  cwd = resolvedRootDir,
  env = process.env,
  nodeExecutable = process.execPath,
  platform = process.platform,
  spawnSyncImpl = spawnSync,
} = {}) {
  const plan = createUserCenterStandardTestPlan({
    rootDir: resolvedRootDir,
    cwd,
    env,
    nodeExecutable,
    platform,
  });
  const result = spawnSyncImpl(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    shell: plan.shell,
    stdio: 'inherit',
    windowsHide: plan.windowsHide,
  });

  if (result?.error || result?.status !== 0) {
    throw buildCommandFailure(plan, result);
  }

  return result;
}

export function runUserCenterStandardTestCli(options = {}) {
  runUserCenterStandardTest(options);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runUserCenterStandardTestCli());
}
