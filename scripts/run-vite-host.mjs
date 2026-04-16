#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  formatViteHostPreflightFailure,
  runViteHostBuildPreflight,
} from './vite-host-preflight.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function normalizeViteMode(value, fallback = 'development') {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (normalizedValue === 'dev' || normalizedValue === 'development') {
    return 'development';
  }
  if (normalizedValue === 'prod' || normalizedValue === 'production') {
    return 'production';
  }
  if (normalizedValue === 'test') {
    return 'test';
  }

  return fallback;
}

function resolveDefaultMode(command) {
  return command === 'build' ? 'production' : 'development';
}

function hasOption(args, flag) {
  return args.some((token) => token === flag);
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function stripModeArg(argv) {
  const args = [];
  let explicitMode = '';

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--mode') {
      explicitMode = readOptionValue(argv, index, '--mode');
      index += 1;
      continue;
    }

    args.push(token);
  }

  return {
    args,
    explicitMode,
  };
}

export function resolveWorkspaceRootDir() {
  return path.resolve(__dirname, '..');
}

export function resolveWorkspaceRootPackageJsonPath({
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  return path.join(workspaceRootDir, 'package.json');
}

function isViteHostBuildEnvConflictKey(key) {
  const normalizedKey = String(key ?? '').trim().toUpperCase();
  return normalizedKey === 'GIT_PAGER'
    || normalizedKey === 'PAGER'
    || normalizedKey === 'GIT_CONFIG_COUNT'
    || /^GIT_CONFIG_(KEY|VALUE)_\d+$/u.test(normalizedKey);
}

export function readWorkspaceRootPackageJson({
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const packageJsonPath = resolveWorkspaceRootPackageJsonPath({
    workspaceRootDir,
  });
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

export function buildViteHostChildEnv({
  env = process.env,
  viteCommand = 'serve',
  workspaceRootDir = resolveWorkspaceRootDir(),
  nodeExecPath = process.execPath,
  rootPackageJson = readWorkspaceRootPackageJson({
    workspaceRootDir,
  }),
} = {}) {
  const nextEnv = {
    ...env,
  };
  if (viteCommand !== 'build') {
    return nextEnv;
  }
  for (const key of Object.keys(nextEnv)) {
    if (isViteHostBuildEnvConflictKey(key)) {
      delete nextEnv[key];
    }
  }

  const resolvedWorkspaceRootDir = String(workspaceRootDir ?? '').trim();
  if (resolvedWorkspaceRootDir) {
    nextEnv.INIT_CWD = resolvedWorkspaceRootDir;
    nextEnv.PNPM_SCRIPT_SRC_DIR = resolvedWorkspaceRootDir;
    nextEnv.npm_package_json = resolveWorkspaceRootPackageJsonPath({
      workspaceRootDir: resolvedWorkspaceRootDir,
    });
  }

  const resolvedNodeExecPath = String(nodeExecPath ?? '').trim();
  if (resolvedNodeExecPath) {
    nextEnv.NODE = resolvedNodeExecPath;
    nextEnv.npm_node_execpath = resolvedNodeExecPath;
  }

  const canonicalBuildScript = String(rootPackageJson?.scripts?.build ?? '').trim();
  nextEnv.npm_lifecycle_event = 'build';
  if (canonicalBuildScript) {
    nextEnv.npm_lifecycle_script = canonicalBuildScript;
  }
  if (typeof rootPackageJson?.name === 'string' && rootPackageJson.name.trim()) {
    nextEnv.npm_package_name = rootPackageJson.name.trim();
  }
  if (typeof rootPackageJson?.version === 'string' && rootPackageJson.version.trim()) {
    nextEnv.npm_package_version = rootPackageJson.version.trim();
  }

  return nextEnv;
}

export function applyViteHostBuildRuntimeEnv({
  env = process.env,
  viteCommand = 'serve',
  workspaceRootDir = resolveWorkspaceRootDir(),
  nodeExecPath = process.execPath,
  rootPackageJson = readWorkspaceRootPackageJson({
    workspaceRootDir,
  }),
} = {}) {
  if (!env || viteCommand !== 'build') {
    return env;
  }

  const normalizedEnv = buildViteHostChildEnv({
    env,
    viteCommand,
    workspaceRootDir,
    nodeExecPath,
    rootPackageJson,
  });
  for (const key of Object.keys(env)) {
    if (!(key in normalizedEnv)) {
      delete env[key];
    }
  }
  Object.assign(env, normalizedEnv);

  return env;
}

export function shouldEnforceViteHostBuildPreflight({
  env = process.env,
} = {}) {
  return String(env?.SDKWORK_ENFORCE_VITE_HOST_PREFLIGHT ?? '').trim() === '1';
}

export function resolveViteWindowsRealpathPatchEntry() {
  return pathToFileURL(path.resolve(__dirname, 'vite-windows-realpath-patch.mjs')).href;
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parseViteStoreVersion(storeName) {
  const match = /^vite@(?<version>[^_]+)(?:_|$)/u.exec(String(storeName ?? ''));
  return String(match?.groups?.version ?? '').trim();
}

export function resolveInstalledVitePackageRoot({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const directCandidates = [
    path.join(cwd, 'node_modules', 'vite'),
    path.join(workspaceRootDir, 'node_modules', 'vite'),
  ];

  for (const candidate of directCandidates) {
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  if (!existsSync(pnpmStoreDir)) {
    return null;
  }

  const storeNames = readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vite@'))
    .map((entry) => entry.name)
    .sort((left, right) => compareVersionLike(parseViteStoreVersion(right), parseViteStoreVersion(left)));

  for (const storeName of storeNames) {
    const candidate = path.join(pnpmStoreDir, storeName, 'node_modules', 'vite');
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return null;
}

export function resolveViteCliEntry({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const vitePackageRoot = resolveInstalledVitePackageRoot({
    cwd,
    workspaceRootDir,
  });
  if (!vitePackageRoot) {
    throw new Error(
      `Unable to resolve an installed vite package from ${cwd}. Run pnpm install before invoking run-vite-host.`,
    );
  }

  const packageJson = JSON.parse(readFileSync(path.join(vitePackageRoot, 'package.json'), 'utf8'));
  const binField = packageJson?.bin;
  const viteBinRelativePath =
    typeof binField === 'string'
      ? binField
      : typeof binField?.vite === 'string'
        ? binField.vite
        : null;
  const configuredCliPath = viteBinRelativePath
    ? path.join(vitePackageRoot, viteBinRelativePath)
    : null;
  const fallbackCliPath = path.join(vitePackageRoot, 'dist', 'node', 'cli.js');

  if (configuredCliPath && existsSync(configuredCliPath)) {
    return configuredCliPath;
  }
  if (existsSync(fallbackCliPath)) {
    return fallbackCliPath;
  }

  throw new Error(`Unable to resolve a runnable vite CLI from ${path.join(vitePackageRoot, 'package.json')}`);
}

export function createViteHostPlan({
  argv = [],
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  const inputArgs = Array.isArray(argv) ? [...argv] : [];
  const command =
    inputArgs.length === 0 || String(inputArgs[0]).startsWith('-')
      ? 'serve'
      : String(inputArgs.shift());
  const { args: restArgs, explicitMode } = stripModeArg(inputArgs);
  const mode = normalizeViteMode(
    explicitMode || env.SDKWORK_VITE_MODE,
    resolveDefaultMode(command),
  );
  const workspaceRootDir = resolveWorkspaceRootDir();
  const viteCliPath = resolveViteCliEntry({
    cwd,
    workspaceRootDir,
  });
  const childEnv = buildViteHostChildEnv({
    env,
    viteCommand: command,
    workspaceRootDir,
  });
  const configLoaderArgs =
    process.platform === 'win32' && !hasOption(restArgs, '--configLoader')
      ? ['--configLoader', 'native']
      : [];
  const patchArgs = process.platform === 'win32'
    ? ['--import', resolveViteWindowsRealpathPatchEntry()]
    : [];

  return {
    command: process.execPath,
    args: [...patchArgs, viteCliPath, command, '--mode', mode, ...configLoaderArgs, ...restArgs],
    cwd,
    viteCommand: command,
    env: {
      ...childEnv,
      SDKWORK_VITE_MODE: mode,
    },
  };
}

export async function runCli() {
  const argv = process.argv.slice(2);
  const initialPlan = createViteHostPlan({
    argv,
  });
  applyViteHostBuildRuntimeEnv({
    viteCommand: initialPlan.viteCommand,
  });
  const plan = createViteHostPlan({
    argv,
  });
  if (plan.viteCommand === 'build' && shouldEnforceViteHostBuildPreflight()) {
    const preflightReport = runViteHostBuildPreflight({
      cwd: plan.cwd,
      workspaceRootDir: resolveWorkspaceRootDir(),
    });
    if (!preflightReport.ok) {
      console.error(formatViteHostPreflightFailure(preflightReport));
      process.exit(1);
    }
  }
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    console.error(`[run-vite-host] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-vite-host] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
