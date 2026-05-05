#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withRustToolchainPath } from './ensure-tauri-rust-toolchain.mjs';
import { normalizeViteMode } from './run-vite-host.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DESKTOP_SQLITE_OVERRIDE_ENV = 'BIRDCODER_CODING_SERVER_SQLITE_FILE';

function resolveFromRequire(requireImpl, specifier) {
  try {
    return requireImpl.resolve(specifier);
  } catch {
    return null;
  }
}

function findFirstExistingPath(candidatePaths, pathExists = existsSync) {
  for (const candidatePath of candidatePaths) {
    if (candidatePath && pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export function resolveWorkspaceTauriCliEntrypoint({
  cwd = process.cwd(),
  pathExists = existsSync,
} = {}) {
  const requireFromCwd = createRequire(path.join(cwd, 'package.json'));
  const packageJsonCandidates = [
    resolveFromRequire(requireFromCwd, '@tauri-apps/cli/package.json'),
    resolveFromRequire(require, '@tauri-apps/cli/package.json'),
  ].filter(Boolean);
  const directEntrypointCandidates = [
    resolveFromRequire(requireFromCwd, '@tauri-apps/cli/tauri.js'),
    resolveFromRequire(require, '@tauri-apps/cli/tauri.js'),
  ];

  return findFirstExistingPath([
    ...directEntrypointCandidates,
    ...packageJsonCandidates.map((packageJsonPath) => path.join(path.dirname(packageJsonPath), 'tauri.js')),
    path.join(rootDir, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
    path.join(cwd, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
  ], pathExists);
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function parseArgs(argv = []) {
  const args = [];
  let viteMode;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--vite-mode') {
      viteMode = readOptionValue(argv, index, '--vite-mode');
      index += 1;
      continue;
    }
    args.push(token);
  }

  return {
    args,
    viteMode,
  };
}

function resolveDesktopDevSqlitePath({
  cwd = process.cwd(),
  args = [],
  platform = process.platform,
} = {}) {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;

  if (pathModule.basename(cwd) !== 'sdkwork-birdcoder-desktop') {
    return undefined;
  }

  if (args[0] !== 'dev') {
    return undefined;
  }

  return pathModule.join(cwd, '.local', 'sdkwork-birdcoder.sqlite3');
}

export function createTauriCliPlan({
  argv = [],
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
  execPath = process.execPath,
  resolveTauriCliEntrypoint = resolveWorkspaceTauriCliEntrypoint,
} = {}) {
  const { args, viteMode } = parseArgs(Array.isArray(argv) ? argv : []);
  if (args.length === 0) {
    throw new Error('run-tauri-cli requires a tauri subcommand such as "dev" or "build".');
  }

  const resolvedMode = normalizeViteMode(viteMode ?? env.SDKWORK_VITE_MODE, 'development');
  const tauriEnv = withRustToolchainPath(env, { platform });
  const tauriCliEntrypoint = typeof resolveTauriCliEntrypoint === 'function'
    ? resolveTauriCliEntrypoint({ cwd })
    : '';
  const explicitDesktopSqlitePath = String(tauriEnv[DESKTOP_SQLITE_OVERRIDE_ENV] ?? '').trim();
  const desktopDevSqlitePath = explicitDesktopSqlitePath
    ? explicitDesktopSqlitePath
    : resolveDesktopDevSqlitePath({ cwd, args, platform });

  if (!tauriCliEntrypoint) {
    throw new Error('Unable to resolve the local @tauri-apps/cli entrypoint.');
  }

  return {
    command: execPath,
    args: [tauriCliEntrypoint, ...args],
    cwd,
    env: {
      ...tauriEnv,
      SDKWORK_VITE_MODE: resolvedMode,
      ...(desktopDevSqlitePath
        ? { [DESKTOP_SQLITE_OVERRIDE_ENV]: desktopDevSqlitePath }
        : {}),
    },
    shell: false,
  };
}

function runCli() {
  const plan = createTauriCliPlan({
    argv: process.argv.slice(2),
  });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
  });

  child.on('error', (error) => {
    console.error(`[run-tauri-cli] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-tauri-cli] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
