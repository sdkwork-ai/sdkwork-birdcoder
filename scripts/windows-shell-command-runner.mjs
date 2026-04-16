import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function trimOutput(value) {
  return String(value ?? '').trim();
}

function quoteWindowsRedirectPath(filePath) {
  return `"${String(filePath ?? '').replace(/"/g, '""')}"`;
}

export function runWindowsShellCommandWithOutputCapture(
  command,
  {
    cwd,
    env = process.env,
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-shell-command-')),
    cleanup = true,
    runner = spawnSync,
  } = {},
) {
  fs.mkdirSync(tempDir, { recursive: true });
  const stdoutPath = path.join(tempDir, 'stdout.log');
  const stderrPath = path.join(tempDir, 'stderr.log');
  const wrappedCommand = `(${String(command ?? '').trim()}) 1>${quoteWindowsRedirectPath(stdoutPath)} 2>${quoteWindowsRedirectPath(stderrPath)}`;

  try {
    const result = runner(wrappedCommand, {
      cwd,
      env,
      shell: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    return {
      status: typeof result?.status === 'number' ? result.status : null,
      stdout: fs.existsSync(stdoutPath) ? trimOutput(fs.readFileSync(stdoutPath, 'utf8')) : '',
      stderr: fs.existsSync(stderrPath) ? trimOutput(fs.readFileSync(stderrPath, 'utf8')) : '',
      error: result?.error instanceof Error ? result.error : null,
    };
  } finally {
    if (cleanup) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
