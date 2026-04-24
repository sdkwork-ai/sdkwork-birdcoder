import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ensureNodeExecPathOnPath } from './runtime-node-path.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolveWindowsPowerShellExecutablePath({
  env = process.env,
  existsSyncImpl = existsSync,
} = {}) {
  const candidates = [];
  const psHome = String(env.PSHOME ?? '').trim();
  if (psHome) {
    candidates.push(path.join(psHome, 'powershell.exe'));
  }

  const systemRoot = String(env.SystemRoot ?? env.WINDIR ?? '').trim();
  if (systemRoot) {
    candidates.push(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  }

  candidates.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');

  for (const candidate of candidates) {
    if (candidate && existsSyncImpl(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to resolve a Windows PowerShell executable for the tauri dev binary unlock guard.',
  );
}

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  let srcTauriDir = 'src-tauri';
  let binaryName = 'sdkwork-birdcoder-desktop';

  while (tokens.length > 0) {
    const token = String(tokens.shift() ?? '').trim();
    switch (token) {
      case '--src-tauri-dir':
        srcTauriDir = String(tokens.shift() ?? '').trim();
        break;
      case '--binary-name':
        binaryName = String(tokens.shift() ?? '').trim();
        break;
      default:
        throw new Error(`Unknown tauri dev binary unlock option: ${token}`);
    }
  }

  if (!srcTauriDir) {
    throw new Error('Missing required --src-tauri-dir value.');
  }
  if (!binaryName) {
    throw new Error('Missing required --binary-name value.');
  }

  return {
    srcTauriDir,
    binaryName,
  };
}

export function createTauriDevBinaryUnlockPlan({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
} = {}) {
  const options = parseArgs(argv);

  if (platform !== 'win32') {
    return {
      command: null,
      args: [],
      cwd,
      env: ensureNodeExecPathOnPath({
        env,
        platform,
        execPath,
      }),
      shell: false,
      windowsHide: true,
      skipped: true,
      srcTauriDir: options.srcTauriDir,
      binaryName: options.binaryName,
    };
  }

  return {
    command: resolveWindowsPowerShellExecutablePath({ env }),
    args: [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(rootDir, 'scripts', 'ensure-tauri-dev-binary-unlocked.ps1'),
      '-SrcTauriDir',
      options.srcTauriDir,
      '-BinaryName',
      options.binaryName,
    ],
    cwd,
    env: ensureNodeExecPathOnPath({
      env,
      platform,
      execPath,
    }),
    shell: false,
    windowsHide: true,
    skipped: false,
    srcTauriDir: options.srcTauriDir,
    binaryName: options.binaryName,
  };
}

export function runTauriDevBinaryUnlock({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  spawnSyncImpl = spawnSync,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const plan = createTauriDevBinaryUnlockPlan({
    argv,
    cwd,
    env,
    execPath,
    platform,
  });

  if (plan.skipped) {
    stdout('Skipping Tauri dev binary unlock on non-Windows host.');
    return 0;
  }

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
    stderr(`tauri dev binary unlock guard exited with signal ${result.signal}`);
    return 1;
  }

  return result.status ?? 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runTauriDevBinaryUnlock());
}
