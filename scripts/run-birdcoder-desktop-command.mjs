#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseBirdcoderIamCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import { resolveBirdcoderIamCommandEnv } from './birdcoder-iam-env.mjs';
import { createWorkspacePackageScriptPlan } from './run-workspace-package-script.mjs';

const __filename = fileURLToPath(import.meta.url);

const DESKTOP_ACTIONS = Object.freeze({
  'build:desktop': {
    scriptName: 'release:build:desktop',
    target: 'desktop-build',
    viteMode: 'production',
  },
  'build:desktop:full': {
    scriptName: 'release:build:desktop:full',
    target: 'desktop-build',
    viteMode: 'production',
  },
  'build:desktop:check': {
    scriptName: 'release:build:desktop:check',
    target: 'desktop-build',
    viteMode: 'test',
  },
  'dev:desktop': {
    scriptName: 'start:desktop',
    target: 'desktop-dev',
    viteMode: 'development',
  },
  'dev:desktop:check': {
    scriptName: 'start:desktop:check',
    target: 'desktop-dev',
    viteMode: 'test',
  },
  'check:desktop:info': {
    scriptName: 'check:desktop:info',
    target: 'desktop-build',
    viteMode: 'development',
  },
});

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const action = String(tokens.shift() ?? '').trim();
  if (!action || !Object.prototype.hasOwnProperty.call(DESKTOP_ACTIONS, action)) {
    throw new Error(
      `run-birdcoder-desktop-command requires one of: ${Object.keys(DESKTOP_ACTIONS).join(', ')}.`,
    );
  }

  const {
    demoLogin,
    iamMode,
  } = parseBirdcoderIamCliOptions(tokens, {
    commandName: 'run-birdcoder-desktop-command',
  });

  return {
    action,
    demoLogin,
    iamMode,
  };
}

function runBirdcoderDesktopCommand() {
  const { action, demoLogin, iamMode } = parseArgs(process.argv.slice(2));
  const actionConfig = DESKTOP_ACTIONS[action];
  const commandEnv = resolveBirdcoderCommandEnv({
    demoLogin,
    env: process.env,
  });
  const resolvedIam = resolveBirdcoderIamCommandEnv({
    env: commandEnv,
    iamMode,
    target: actionConfig.target,
    viteMode: actionConfig.viteMode,
  });

  if (resolvedIam.errors.length > 0) {
    throw new Error(resolvedIam.errors.join('\n'));
  }

  const plan = createWorkspacePackageScriptPlan({
    env: resolvedIam.env,
    packageDir: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop',
    scriptName: actionConfig.scriptName,
  });
  const result = spawnSync(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    shell: plan.shell,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    throw new Error(
      `[run-birdcoder-desktop-command] ${action} exited with signal ${result.signal}.`,
    );
  }

  process.exit(result.status ?? 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runBirdcoderDesktopCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
