import { createRequire, syncBuiltinESMExports } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const childProcessModule = require('node:child_process');
const patchedExecSymbol = Symbol.for('sdkwork.birdcoder.viteWindowsRealpathPatchedExec');

export function isWindowsNetUseCommand(command) {
  return /^\s*net\s+use(?:\s|$)/iu.test(String(command ?? ''));
}

function createFallbackChildProcess() {
  return {
    stdout: null,
    stderr: null,
    kill() {
      return true;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
  };
}

function resolveExecCallback(args) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (typeof args[index] === 'function') {
      return args[index];
    }
  }
  return null;
}

export function createPatchedExec(originalExec) {
  return function patchedExec(command, ...args) {
    try {
      return originalExec(command, ...args);
    } catch (error) {
      const callback = resolveExecCallback(args);
      if (!isWindowsNetUseCommand(command) || error?.code !== 'EPERM' || typeof callback !== 'function') {
        throw error;
      }

      queueMicrotask(() => {
        callback(error, '', '');
      });

      return createFallbackChildProcess();
    }
  };
}

export function patchChildProcessExecForWindowsSafeRealpath({
  platform = process.platform,
  targetModule = childProcessModule,
  syncBuiltinESMExportsFn = syncBuiltinESMExports,
} = {}) {
  if (platform !== 'win32') {
    return {
      applied: false,
      reason: 'platform-not-win32',
      exec: targetModule.exec,
    };
  }

  if (targetModule[patchedExecSymbol]) {
    return {
      applied: false,
      reason: 'already-patched',
      exec: targetModule.exec,
    };
  }

  const originalExec = targetModule.exec;
  const patchedExec = createPatchedExec(originalExec);
  targetModule.exec = patchedExec;
  targetModule[patchedExecSymbol] = originalExec;
  syncBuiltinESMExportsFn();

  return {
    applied: true,
    reason: 'patched',
    exec: patchedExec,
  };
}

patchChildProcessExecForWindowsSafeRealpath();
