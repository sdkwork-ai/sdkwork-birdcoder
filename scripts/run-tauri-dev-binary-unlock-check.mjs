import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ensureNodeExecPathOnPath } from './runtime-node-path.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function resolveWindowsPowerShellExecutablePath({
  env = process.env,
  existsSyncImpl = existsSync,
} = {}) {
  const candidates = [];
  const psHome = String(env.PSHOME ?? '').trim();
  if (psHome) {
    candidates.push(path.win32.join(psHome, 'powershell.exe'));
  }

  const systemRoot = String(env.SystemRoot ?? env.WINDIR ?? '').trim();
  if (systemRoot) {
    candidates.push(path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  }

  candidates.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');

  for (const candidate of candidates) {
    if (candidate && existsSyncImpl(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to resolve a Windows PowerShell executable for the tauri dev binary unlock check.',
  );
}

export function createTauriDevBinaryUnlockCheckPlan({
  rootDir: workspaceRootDir = rootDir,
  env = process.env,
  execPath = process.execPath,
  existsSyncImpl = existsSync,
  platform = process.platform,
} = {}) {
  if (platform !== 'win32') {
    throw new Error('Tauri dev binary unlock check plan is only available on Windows hosts.');
  }

  const command = resolveWindowsPowerShellExecutablePath({ env, existsSyncImpl });
  return {
    command,
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.win32.join(workspaceRootDir, 'scripts', 'ensure-tauri-dev-binary-unlocked.test.ps1'),
    ],
    cwd: workspaceRootDir,
    env: ensureNodeExecPathOnPath({
      env,
      platform,
      execPath,
    }),
    shell: false,
    windowsHide: true,
  };
}

export function runTauriDevBinaryUnlockCheck({
  rootDir: workspaceRootDir = rootDir,
  env = process.env,
  execPath = process.execPath,
  existsSyncImpl = existsSync,
  platform = process.platform,
  spawnSyncImpl = spawnSync,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  if (platform !== 'win32') {
    stdout('ok - tauri dev binary unlock guard is only required on Windows.');
    return 0;
  }

  const plan = createTauriDevBinaryUnlockCheckPlan({
    rootDir: workspaceRootDir,
    env,
    execPath,
    existsSyncImpl,
    platform,
  });
  const result = spawnSyncImpl(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
    windowsHide: plan.windowsHide,
  });

  if (result.error) {
    stderr(result.error instanceof Error ? result.error.message : String(result.error));
    return 1;
  }
  if (result.signal) {
    stderr(`tauri dev binary unlock check exited with signal ${result.signal}`);
    return 1;
  }

  return result.status ?? 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runTauriDevBinaryUnlockCheck());
}
