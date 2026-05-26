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
  'tauri:build': {
    scriptName: 'tauri:build:base',
    target: 'desktop-build',
    viteMode: 'production',
  },
  'tauri:build:prod': {
    scriptName: 'tauri:build:prod:base',
    target: 'desktop-build',
    viteMode: 'production',
  },
  'tauri:build:test': {
    scriptName: 'tauri:build:test:base',
    target: 'desktop-build',
    viteMode: 'test',
  },
  'tauri:dev': {
    scriptName: 'tauri:dev:base',
    target: 'desktop-dev',
    viteMode: 'development',
  },
  'tauri:dev:test': {
    scriptName: 'tauri:dev:test:base',
    target: 'desktop-dev',
    viteMode: 'test',
  },
  'tauri:info': {
    scriptName: 'tauri:info:base',
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
    packageDir: 'packages/sdkwork-birdcoder-desktop',
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
