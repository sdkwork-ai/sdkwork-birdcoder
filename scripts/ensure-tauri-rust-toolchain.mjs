#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

function resolvePlatformPathModule(platform = process.platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function resolvePathDelimiter(platform = process.platform) {
  return platform === 'win32' ? ';' : ':';
}

function resolvePathKey(env = process.env, platform = process.platform) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH')
    ?? (platform === 'win32' ? 'Path' : 'PATH');
}

function normalizePathEntry(entry, platform = process.platform) {
  const pathModule = resolvePlatformPathModule(platform);
  const normalized = pathModule.normalize(String(entry ?? '').trim());

  return platform === 'win32'
    ? normalized.replace(/[\\/]+$/, '').toLowerCase()
    : normalized.replace(/\/+$/, '');
}

function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(resolvePathDelimiter(platform))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function commandExecutableName(command, platform = process.platform) {
  return platform === 'win32' ? `${command}.exe` : command;
}

function resolveCommandBinaryPath(command, env = process.env, platform = process.platform, pathExists = existsSync) {
  const pathKey = resolvePathKey(env, platform);
  const pathValue = env[pathKey] ?? env.PATH ?? env.Path ?? '';
  const executableName = commandExecutableName(command, platform);

  for (const entry of splitPathEntries(pathValue, platform)) {
    const candidatePath = resolvePlatformPathModule(platform).join(entry, executableName);
    if (pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function uniquePathEntries(entries, platform = process.platform) {
  const dedupedEntries = [];
  const seen = new Set();

  for (const entry of entries) {
    const normalizedEntry = normalizePathEntry(entry, platform);
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }

    seen.add(normalizedEntry);
    dedupedEntries.push(entry);
  }

  return dedupedEntries;
}

function resolveCargoHomeBinDir(cargoHome, platform = process.platform) {
  const trimmedCargoHome = typeof cargoHome === 'string' ? cargoHome.trim() : '';
  if (!trimmedCargoHome) {
    return null;
  }

  const pathModule = resolvePlatformPathModule(platform);
  return pathModule.basename(trimmedCargoHome).toLowerCase() === 'bin'
    ? trimmedCargoHome
    : pathModule.join(trimmedCargoHome, 'bin');
}

function resolveRustToolchainBinCandidates({
  env = process.env,
  platform = process.platform,
  homeDir = env.HOME ?? os.homedir(),
  userProfileDir = env.USERPROFILE ?? homeDir,
} = {}) {
  const pathModule = resolvePlatformPathModule(platform);
  const candidates = [];
  const cargoHomeBinDir = resolveCargoHomeBinDir(env.CARGO_HOME, platform);

  if (cargoHomeBinDir) {
    candidates.push(cargoHomeBinDir);
  }

  const standardRustHomeDir =
    platform === 'win32'
      ? (typeof userProfileDir === 'string' ? userProfileDir.trim() : '')
      : (typeof homeDir === 'string' ? homeDir.trim() : '');

  if (standardRustHomeDir) {
    candidates.push(pathModule.join(standardRustHomeDir, '.cargo', 'bin'));
  }

  return uniquePathEntries(candidates, platform);
}

function resolveExistingRustToolchainBinDirs({
  env = process.env,
  platform = process.platform,
  requiredCommands = ['cargo', 'rustc'],
  pathExists = existsSync,
} = {}) {
  return resolveRustToolchainBinCandidates({ env, platform }).filter((candidateDir) => {
    return requiredCommands.every((command) => {
      return pathExists(
        resolvePlatformPathModule(platform).join(candidateDir, commandExecutableName(command, platform)),
      );
    });
  });
}

function normalizeOutput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatCommandDisplay(command, args = []) {
  return [command, ...args].join(' ').trim();
}

function formatInspectionFailure(inspection) {
  if (inspection.reason === 'not-found') {
    return `command was not found in PATH${inspection.error ? ` (${inspection.error})` : ''}`;
  }

  if (inspection.reason === 'non-zero-exit') {
    return inspection.error || `${formatCommandDisplay(inspection.command, inspection.args)} exited with a non-zero status`;
  }

  if (inspection.error) {
    return inspection.error;
  }

  return 'command inspection failed for an unknown reason';
}

export function inspectCommandAvailability(command, args = ['--version'], options = {}) {
  const platform = options.platform ?? process.platform;
  const env = withRustToolchainPath(options.env ?? process.env, {
    platform,
    requiredCommands: Array.isArray(options.requiredCommands) && options.requiredCommands.length > 0
      ? options.requiredCommands
      : [command],
  });
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    return {
      available: false,
      command,
      args,
      reason: result.error.code === 'ENOENT' ? 'not-found' : 'spawn-error',
      error: result.error.message,
    };
  }

  const stdout = normalizeOutput(result.stdout);
  const stderr = normalizeOutput(result.stderr);
  if (result.status !== 0) {
    return {
      available: false,
      command,
      args,
      reason: 'non-zero-exit',
      error: stderr || stdout || `${formatCommandDisplay(command, args)} exited with status ${result.status ?? 'unknown'}`,
    };
  }

  return {
    available: true,
    command,
    args,
    stdout,
    stderr,
  };
}

export function buildMissingRustToolchainMessage(inspections) {
  const failedInspections = Array.isArray(inspections)
    ? inspections.filter((inspection) => inspection && inspection.available === false)
    : [];

  const missingCommands = failedInspections.map((inspection) => inspection.command).join(', ') || 'cargo, rustc';
  const detailLines = failedInspections.map((inspection) => {
    return `- ${inspection.command}: ${formatInspectionFailure(inspection)}`;
  });

  return [
    'Rust/Cargo toolchain is required for BirdCoder desktop development and builds.',
    `Missing command(s): ${missingCommands}`,
    ...(detailLines.length > 0 ? ['', 'Detected issue(s):', ...detailLines] : []),
    '',
    'Install Rust via rustup: https://rustup.rs/',
    'Restart the terminal after installation, then verify:',
    '- cargo --version',
    '- rustc --version',
    'If you only need the browser host right now, run: pnpm dev',
  ].join('\n');
}

export function withRustToolchainPath(baseEnv = process.env, options = {}) {
  const platform = options.platform ?? process.platform;
  const requiredCommands =
    Array.isArray(options.requiredCommands) && options.requiredCommands.length > 0
      ? options.requiredCommands
      : ['cargo', 'rustc'];
  const env = { ...baseEnv };
  const pathKey = resolvePathKey(env, platform);
  const existingPathValue = env[pathKey] ?? env.PATH ?? env.Path ?? '';
  const pathEntries = splitPathEntries(existingPathValue, platform);

  for (const candidateDir of [...resolveExistingRustToolchainBinDirs({
    env,
    platform,
    requiredCommands,
    pathExists: options.pathExists,
  })].reverse()) {
    const normalizedCandidateDir = normalizePathEntry(candidateDir, platform);
    const alreadyPresent = pathEntries.some((entry) => {
      return normalizePathEntry(entry, platform) === normalizedCandidateDir;
    });
    if (!alreadyPresent) {
      pathEntries.unshift(candidateDir);
    }
  }

  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete env[key];
    }
  }

  env[pathKey] = uniquePathEntries(pathEntries, platform).join(resolvePathDelimiter(platform));
  return env;
}

export function ensureTauriRustToolchain({
  inspectCommand = inspectCommandAvailability,
  requiredCommands = ['cargo', 'rustc'],
  env = process.env,
  platform = process.platform,
  pathExists = existsSync,
} = {}) {
  const resolvedEnv = withRustToolchainPath(env, {
    platform,
    requiredCommands,
  });
  const commandPaths = new Map(requiredCommands.map((command) => {
    return [command, resolveCommandBinaryPath(command, resolvedEnv, platform, pathExists)];
  }));
  const inspections = requiredCommands.map((command) => {
    const inspection = inspectCommand(command, ['--version'], {
      env: resolvedEnv,
      platform,
      requiredCommands,
    });
    const resolvedCommandPath = commandPaths.get(command);

    if (
      inspection?.available === false
      && inspection.reason === 'spawn-error'
      && typeof resolvedCommandPath === 'string'
      && resolvedCommandPath.trim().length > 0
    ) {
      return {
        available: true,
        command,
        args: ['--version'],
        path: resolvedCommandPath,
        probe: 'path-only',
        stdout: '',
        stderr: '',
      };
    }

    return inspection;
  });
  const failedInspections = inspections.filter((inspection) => inspection?.available === false);

  if (failedInspections.length > 0) {
    throw new Error(buildMissingRustToolchainMessage(failedInspections));
  }

  return inspections;
}

function main() {
  ensureTauriRustToolchain();
  console.log('ok - tauri rust toolchain available');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
