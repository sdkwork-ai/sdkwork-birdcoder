import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { ensureNodeExecPathOnPath } from './runtime-node-path.mjs';

export function createCommandSequencePlan({
  command = '',
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
} = {}) {
  const trimmedCommand = String(command ?? '').trim();
  if (!trimmedCommand) {
    throw new Error('Command sequence items must be non-empty strings.');
  }

  const nextEnv = ensureNodeExecPathOnPath({
    env,
    platform,
    execPath,
  });

  if (platform === 'win32') {
    return {
      command: String(env.ComSpec ?? env.COMSPEC ?? 'cmd.exe').trim() || 'cmd.exe',
      args: ['/d', '/s', '/c', trimmedCommand],
      cwd,
      env: nextEnv,
      shell: false,
    };
  }

  return {
    command: String(env.SHELL ?? '/bin/sh').trim() || '/bin/sh',
    args: ['-lc', trimmedCommand],
    cwd,
    env: nextEnv,
    shell: false,
  };
}

export function runCommandSequence({
  commands = [],
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
  spawnSyncImpl = spawnSync,
} = {}) {
  for (const command of commands) {
    const plan = createCommandSequencePlan({
      command,
      cwd,
      env,
      platform,
      execPath,
    });

    const result = spawnSyncImpl(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      shell: plan.shell,
      stdio: 'inherit',
      windowsHide: true,
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      return typeof result.status === 'number' ? result.status : 1;
    }
  }

  return 0;
}
