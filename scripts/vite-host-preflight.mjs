import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeError(error) {
  if (!error) {
    return null;
  }

  return {
    code: normalizeText(error.code),
    errno: error.errno ?? null,
    syscall: normalizeText(error.syscall),
    message: normalizeText(error.message),
  };
}

function resolveCheckStatus(result) {
  if (result?.error) {
    return 'failed';
  }
  if (result?.status === 0) {
    return 'passed';
  }
  return 'failed';
}

function createCheck({ id, label, command, args, result }) {
  return {
    id,
    label,
    command,
    args: [...args],
    status: resolveCheckStatus(result),
    error: normalizeError(result?.error),
    exitCode: typeof result?.status === 'number' ? result.status : null,
    signal: normalizeText(result?.signal),
    stdout: normalizeText(result?.stdout),
    stderr: normalizeText(result?.stderr),
  };
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parsePackageVersion(storeName, packageName) {
  const match = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}@(?<version>[^_]+)(?:_|$)`, 'u').exec(
    String(storeName ?? ''),
  );
  return normalizeText(match?.groups?.version);
}

export function resolveWindowsShellPath({
  env = process.env,
} = {}) {
  const comSpec = normalizeText(env.ComSpec);
  if (comSpec) {
    return comSpec;
  }

  const systemRoot = normalizeText(env.SystemRoot || env.windir);
  if (systemRoot) {
    return path.join(systemRoot, 'System32', 'cmd.exe');
  }

  return 'cmd.exe';
}

export function resolveWorkspaceRootDir({
  cwd = process.cwd(),
} = {}) {
  return cwd;
}

export function resolveInstalledEsbuildBinaryPath({
  cwd = process.cwd(),
  workspaceRootDir = cwd,
} = {}) {
  const directCandidates = [
    path.join(cwd, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
    path.join(workspaceRootDir, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
  ];

  for (const candidate of directCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  if (!existsSync(pnpmStoreDir)) {
    return null;
  }

  const storeNames = readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('@esbuild+win32-x64@'))
    .map((entry) => entry.name)
    .sort((left, right) =>
      compareVersionLike(
        parsePackageVersion(right.replace('@esbuild+', '@esbuild/'), '@esbuild/win32-x64'),
        parsePackageVersion(left.replace('@esbuild+', '@esbuild/'), '@esbuild/win32-x64'),
      ),
    );

  for (const storeName of storeNames) {
    const candidate = path.join(
      pnpmStoreDir,
      storeName,
      'node_modules',
      '@esbuild',
      'win32-x64',
      'esbuild.exe',
    );
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function runViteHostBuildPreflight({
  platform = process.platform,
  cwd = process.cwd(),
  workspaceRootDir = cwd,
  shellPath = resolveWindowsShellPath(),
  esbuildBinaryPath = resolveInstalledEsbuildBinaryPath({
    cwd,
    workspaceRootDir,
  }),
  spawnSyncImpl = spawnSync,
} = {}) {
  if (platform !== 'win32') {
    return {
      ok: true,
      status: 'skipped',
      checks: [],
    };
  }

  const checks = [];
  checks.push(
    createCheck({
      id: 'shell-exec',
      label: 'Windows command shell',
      command: shellPath,
      args: ['/d', '/s', '/c', 'echo sdkwork-birdcoder-vite-host-preflight'],
      result: spawnSyncImpl(shellPath, ['/d', '/s', '/c', 'echo sdkwork-birdcoder-vite-host-preflight'], {
        cwd,
        encoding: 'utf8',
      }),
    }),
  );

  if (esbuildBinaryPath) {
    checks.push(
      createCheck({
        id: 'esbuild-binary',
        label: 'Esbuild native binary',
        command: esbuildBinaryPath,
        args: ['--version'],
        result: spawnSyncImpl(esbuildBinaryPath, ['--version'], {
          cwd,
          encoding: 'utf8',
        }),
      }),
    );
  }

  return {
    ok: checks.every((check) => check.status === 'passed'),
    status: checks.every((check) => check.status === 'passed') ? 'passed' : 'failed',
    checks,
  };
}

export function formatViteHostPreflightFailure(report) {
  const failedChecks = report.checks.filter((check) => check.status === 'failed');
  const summary = failedChecks
    .map((check) => {
      const filename = path.basename(check.command || '');
      const code = normalizeText(check.error?.code) || 'UNKNOWN';
      return `${filename || check.command}: spawn ${code}`;
    })
    .join('; ');

  return [
    '[run-vite-host] toolchain-platform preflight failed.',
    'The current Windows host blocks child-process execution required by the Vite build pipeline.',
    `Checks: ${summary}`,
    'Expected capabilities: cmd.exe shell execution and esbuild.exe process launch.',
    'Resolution: run Step 12 standard/release gates on a host where Node child_process spawning is permitted.',
  ].join('\n');
}
