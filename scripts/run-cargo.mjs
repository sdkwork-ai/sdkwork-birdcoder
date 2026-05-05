#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  ensureTauriRustToolchain,
  withRustToolchainPath,
} from './ensure-tauri-rust-toolchain.mjs';

const __filename = fileURLToPath(import.meta.url);
const CARGO_PATH_VALUE_FLAGS = new Set(['--manifest-path', '--target-dir']);
const LOCKED_CARGO_SUBCOMMANDS = new Set([
  'build',
  'check',
  'clippy',
  'doc',
  'run',
  'test',
]);
const CARGO_GLOBAL_FLAGS_WITH_VALUE = new Set([
  '--color',
  '--config',
  '--manifest-path',
  '--message-format',
  '--target-dir',
  '-C',
]);

function normalizeCargoPathValue(value, cwd = process.cwd()) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue || path.isAbsolute(normalizedValue)) {
    return value;
  }

  return path.resolve(cwd, normalizedValue);
}

function findCargoSubcommandIndex(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (typeof arg !== 'string') {
      continue;
    }
    if (arg === '--') {
      break;
    }
    if (index === 0 && arg.startsWith('+')) {
      continue;
    }
    if (arg.startsWith('--') && arg.includes('=')) {
      continue;
    }
    if (CARGO_GLOBAL_FLAGS_WITH_VALUE.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith('-')) {
      continue;
    }

    return index;
  }

  return -1;
}

function ensureLockedCargoSubcommandArgs(cargoArgs) {
  const args = Array.isArray(cargoArgs) ? cargoArgs : [];
  const subcommandIndex = findCargoSubcommandIndex(args);
  const subcommand = subcommandIndex >= 0 ? args[subcommandIndex] : '';
  const shouldInjectLocked =
    LOCKED_CARGO_SUBCOMMANDS.has(subcommand) &&
    !args.includes('--locked') &&
    !args.includes('--frozen');

  if (!shouldInjectLocked) {
    return [...args];
  }

  return [
    ...args.slice(0, subcommandIndex + 1),
    '--locked',
    ...args.slice(subcommandIndex + 1),
  ];
}

export function normalizeCargoInvocationArgs(cargoArgs, {
  cwd = process.cwd(),
} = {}) {
  const normalizedArgs = [];
  const args = ensureLockedCargoSubcommandArgs(cargoArgs);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') {
      normalizedArgs.push(...args.slice(index));
      break;
    }

    if (CARGO_PATH_VALUE_FLAGS.has(arg)) {
      normalizedArgs.push(arg);
      if (index + 1 < args.length) {
        normalizedArgs.push(normalizeCargoPathValue(args[index + 1], cwd));
        index += 1;
      }
      continue;
    }

    const equalsFlag = [...CARGO_PATH_VALUE_FLAGS].find((flag) =>
      arg.startsWith(`${flag}=`),
    );
    if (equalsFlag) {
      normalizedArgs.push(
        `${equalsFlag}=${normalizeCargoPathValue(arg.slice(equalsFlag.length + 1), cwd)}`,
      );
      continue;
    }

    normalizedArgs.push(arg);
  }

  return normalizedArgs;
}

export function buildCargoFailureMessage({
  status,
  signal,
  stderr = '',
} = {}) {
  const normalizedStderr = String(stderr ?? '').trim();
  const lines = [
    `Cargo failed with ${signal ? `signal ${signal}` : `exit code ${status ?? 'unknown'}`}.`,
  ];

  if (
    /failed to (?:get|download)|crates\.io|index\.crates\.io|SSL connect error|SEC_E_NO_CREDENTIALS|certificate|schannel/iu
      .test(normalizedStderr)
  ) {
    lines.push(
      'Cargo dependency retrieval failed.',
      'Use a pre-populated Cargo cache or an approved crates mirror for repeatable commercial builds.',
      'If this is a Windows Schannel environment, fix the runner credentials/certificate store before rerunning native checks.',
    );
  }

  if (/lock file needs to be updated|Cargo\.lock.*out of date|--locked was passed/iu.test(normalizedStderr)) {
    lines.push(
      'Cargo lockfile enforcement failed.',
      'Update the relevant Cargo.lock intentionally, review the dependency diff, and rerun the locked Cargo command.',
    );
  }

  if (normalizedStderr) {
    lines.push('', 'Cargo stderr tail:', normalizedStderr.split(/\r?\n/u).slice(-20).join('\n'));
  }

  return lines.join('\n');
}

function runCargo() {
  const cwd = process.cwd();
  const cargoArgs = normalizeCargoInvocationArgs(process.argv.slice(2), { cwd });

  if (cargoArgs.length === 0) {
    console.error('Usage: node scripts/run-cargo.mjs <cargo-args...>');
    process.exit(1);
  }

  ensureTauriRustToolchain();

  const env = withRustToolchainPath(process.env);
  const result = spawnSync('cargo', cargoArgs, {
    cwd,
    env,
    stdio: ['inherit', 'inherit', 'pipe'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if ((result.status ?? 1) !== 0 || result.signal) {
    console.error(buildCargoFailureMessage({
      status: result.status,
      signal: result.signal,
      stderr: result.stderr,
    }));
  }

  process.exit(result.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCargo();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
