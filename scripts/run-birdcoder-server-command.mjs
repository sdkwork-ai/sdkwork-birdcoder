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

const SERVER_ACTIONS = Object.freeze({
  build: {
    scriptName: 'build:base',
    target: 'server-build',
    viteMode: 'production',
  },
  dev: {
    scriptName: 'dev:base',
    target: 'server-dev',
    viteMode: 'development',
  },
});

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const action = String(tokens.shift() ?? '').trim();
  if (!action || !Object.prototype.hasOwnProperty.call(SERVER_ACTIONS, action)) {
    throw new Error(
      `run-birdcoder-server-command requires one of: ${Object.keys(SERVER_ACTIONS).join(', ')}.`,
    );
  }

  const {
    iamMode,
  } = parseBirdcoderIamCliOptions(tokens, {
    commandName: 'run-birdcoder-server-command',
  });

  return {
    action,
    iamMode,
  };
}

function runBirdcoderServerCommand() {
  const { action, iamMode } = parseArgs(process.argv.slice(2));
  const actionConfig = SERVER_ACTIONS[action];
  const commandEnv = resolveBirdcoderCommandEnv({
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
    packageDir: 'packages/sdkwork-birdcoder-server',
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
      `[run-birdcoder-server-command] ${action} exited with signal ${result.signal}.`,
    );
  }

  process.exit(result.status ?? 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runBirdcoderServerCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
