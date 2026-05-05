import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildMissingRustToolchainMessage,
  ensureTauriRustToolchain,
  withRustToolchainPath,
} from './ensure-tauri-rust-toolchain.mjs';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const successfulChecks = [];
const successResult = ensureTauriRustToolchain({
  inspectCommand(command, args) {
    successfulChecks.push({ command, args });
    return {
      available: true,
      command,
      stdout: `${command} 1.90.0`,
    };
  },
});

assert.deepEqual(
  successfulChecks,
  [
    { command: 'cargo', args: ['--version'] },
    { command: 'rustc', args: ['--version'] },
  ],
  'Rust toolchain guard should verify both cargo and rustc with --version',
);
assert.equal(successResult.length, 2, 'Rust toolchain guard should return successful inspections');

const fakeRustHome = 'C:\\Users\\birdcoder';
const fakeRustBinDir = path.win32.join(fakeRustHome, '.cargo', 'bin');
const fakeRustExecutables = new Set([
  path.win32.join(fakeRustBinDir, 'cargo.exe').toLowerCase(),
  path.win32.join(fakeRustBinDir, 'rustc.exe').toLowerCase(),
]);
const fakeWindowsPathExists = (candidatePath) => {
  return fakeRustExecutables.has(path.win32.normalize(candidatePath).toLowerCase());
};

const fallbackEnv = withRustToolchainPath({
  PATH: 'C:\\Windows\\System32',
  USERPROFILE: fakeRustHome,
}, {
  platform: 'win32',
  pathExists: fakeWindowsPathExists,
});

assert.match(
  fallbackEnv.PATH,
  new RegExp(`^${escapeRegExp(fakeRustBinDir)}(;|$)`),
  'Rust toolchain PATH helper should prepend the standard rustup bin directory on Windows',
);

const fallbackChecks = [];
const fallbackResult = ensureTauriRustToolchain({
  env: {
    PATH: 'C:\\Windows\\System32',
    USERPROFILE: fakeRustHome,
  },
  platform: 'win32',
  pathExists: fakeWindowsPathExists,
  inspectCommand(command, args, options) {
    fallbackChecks.push({ command, args, options });
    return {
      available: true,
      command,
      stdout: `${command} 1.90.0`,
    };
  },
});

assert.equal(fallbackResult.length, 2, 'Rust toolchain guard should still succeed with a standard rustup install path');
assert.equal(fallbackChecks.length, 2, 'Rust toolchain guard should inspect both required commands');
assert.ok(
  fallbackChecks.every(
    ({ options }) => typeof options?.env?.PATH === 'string'
      && options.env.PATH.startsWith(`${fakeRustBinDir};`),
  ),
  'Rust toolchain guard should inspect commands with the augmented PATH',
);

const restrictedResult = ensureTauriRustToolchain({
  env: {
    PATH: 'C:\\Windows\\System32',
    USERPROFILE: fakeRustHome,
  },
  platform: 'win32',
  pathExists: fakeWindowsPathExists,
  inspectCommand(command) {
    return {
      available: false,
      command,
      reason: 'spawn-error',
      error: `spawnSync ${command} EPERM`,
    };
  },
});

assert.equal(restrictedResult.length, 2, 'Rust toolchain guard should still return both inspections when PATH lookup proves the toolchain exists');
assert.ok(
  restrictedResult.every((inspection) => inspection.available === true && inspection.probe === 'path-only'),
  'Rust toolchain guard should fall back to PATH-based verification when the current Windows environment blocks direct child-process spawning',
);

let missingToolError;
try {
  ensureTauriRustToolchain({
    inspectCommand(command) {
      if (command === 'cargo') {
        return {
          available: false,
          command,
          reason: 'not-found',
          error: 'spawnSync cargo ENOENT',
        };
      }

      return {
        available: true,
        command,
        stdout: 'rustc 1.90.0',
      };
    },
  });
} catch (error) {
  missingToolError = error;
}

assert.ok(missingToolError instanceof Error, 'Missing cargo should fail the Rust toolchain guard');
assert.match(
  missingToolError.message,
  /Rust\/Cargo toolchain is required for BirdCoder desktop development and builds\./,
);
assert.match(missingToolError.message, /Missing command\(s\): cargo/);
assert.match(missingToolError.message, /Install Rust via rustup: https:\/\/rustup\.rs\//);
assert.match(missingToolError.message, /cargo --version/);
assert.match(missingToolError.message, /rustc --version/);

const friendlyMessage = buildMissingRustToolchainMessage([
  {
    available: false,
    command: 'cargo',
    reason: 'not-found',
    error: 'spawnSync cargo ENOENT',
  },
  {
    available: false,
    command: 'rustc',
    reason: 'not-found',
    error: 'spawnSync rustc ENOENT',
  },
]);

assert.match(friendlyMessage, /Missing command\(s\): cargo, rustc/);
assert.match(friendlyMessage, /Restart the terminal after installation/);

console.log('ok - tauri rust toolchain guard reports actionable errors and passes when cargo and rustc exist');
