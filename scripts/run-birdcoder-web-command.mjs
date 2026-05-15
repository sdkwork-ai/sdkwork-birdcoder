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

const WEB_ACTIONS = Object.freeze({
  build: {
    scriptName: 'build:base',
    target: 'web-build',
    viteMode: 'production',
  },
  'build:dev': {
    scriptName: 'build:dev:base',
    target: 'web-build',
    viteMode: 'development',
  },
  'build:prod': {
    scriptName: 'build:prod:base',
    target: 'web-build',
    viteMode: 'production',
  },
  'build:test': {
    scriptName: 'build:test:base',
    target: 'web-build',
    viteMode: 'test',
  },
  dev: {
    scriptName: 'dev:base',
    target: 'web-dev',
    viteMode: 'development',
  },
  'dev:test': {
    scriptName: 'dev:test:base',
    target: 'web-dev',
    viteMode: 'test',
  },
});

function parseArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const action = String(tokens.shift() ?? '').trim();
  if (!action || !Object.prototype.hasOwnProperty.call(WEB_ACTIONS, action)) {
    throw new Error(
      `run-birdcoder-web-command requires one of: ${Object.keys(WEB_ACTIONS).join(', ')}.`,
    );
  }

  const {
    iamMode,
    userCenterProvider,
  } = parseBirdcoderIamCliOptions(tokens, {
    commandName: 'run-birdcoder-web-command',
  });

  return {
    action,
    iamMode,
    userCenterProvider,
  };
}

function runBirdcoderWebCommand() {
  const { action, iamMode, userCenterProvider } = parseArgs(process.argv.slice(2));
  const actionConfig = WEB_ACTIONS[action];
  const commandEnv = resolveBirdcoderCommandEnv({
    env: process.env,
    userCenterProvider,
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
    packageDir: 'packages/sdkwork-birdcoder-web',
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
      `[run-birdcoder-web-command] ${action} exited with signal ${result.signal}.`,
    );
  }

  process.exit(result.status ?? 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runBirdcoderWebCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
