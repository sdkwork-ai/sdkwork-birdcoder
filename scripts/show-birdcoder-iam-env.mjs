#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseBirdcoderIamCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import {
  BIRDCODER_IAM_DEPLOYMENT_MODES,
  birdcoderIamEnvMeta,
  resolveBirdcoderIamDeveloperExperience,
  resolveBirdcoderIamCommandEnv,
} from './birdcoder-iam-env.mjs';

const __filename = fileURLToPath(import.meta.url);

export const BIRDCODER_IAM_ENV_SUPPORTED_TARGETS = Object.freeze([
  'desktop-build',
  'desktop-dev',
  'server-build',
  'server-dev',
  'web-build',
  'web-dev',
]);

export const DEFAULT_BIRDCODER_IAM_ENV_VITE_MODE_BY_TARGET = Object.freeze({
  'desktop-build': 'production',
  'desktop-dev': 'development',
  'server-build': 'production',
  'server-dev': 'development',
  'web-build': 'production',
  'web-dev': 'development',
});

const MASKED_ENV_NAME_TOKENS = Object.freeze([
  'PASSWORD',
  'SECRET',
  'TOKEN',
]);
const MANAGED_ENV_PREFIXES = Object.freeze([
  'BIRDCODER_',
  'SDKWORK_USER_CENTER_',
  'VITE_BIRDCODER_',
  'VITE_SDKWORK_USER_CENTER_',
]);

export function parseBirdcoderIamEnvCliArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const target = String(tokens.shift() ?? 'desktop-dev').trim();
  if (!BIRDCODER_IAM_ENV_SUPPORTED_TARGETS.includes(target)) {
    throw new Error(
      `show-birdcoder-iam-env requires one of: ${BIRDCODER_IAM_ENV_SUPPORTED_TARGETS.join(', ')}.`,
    );
  }

  const {
    iamMode,
    userCenterProvider,
    viteMode,
  } = parseBirdcoderIamCliOptions(tokens, {
    allowViteMode: true,
    commandName: 'show-birdcoder-iam-env',
  });

  return {
    iamMode,
    target,
    userCenterProvider,
    viteMode: viteMode ?? DEFAULT_BIRDCODER_IAM_ENV_VITE_MODE_BY_TARGET[target],
  };
}

function shouldMaskEnvValue(key) {
  const normalizedKey = String(key ?? '').trim().toUpperCase();
  return MASKED_ENV_NAME_TOKENS.some((token) => normalizedKey.includes(token));
}

function maskEnvValue(key, value) {
  if (!shouldMaskEnvValue(key)) {
    return value;
  }

  return '***';
}

export function pickManagedEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => MANAGED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, maskEnvValue(key, value)]),
  );
}

function resolveSurfaceFromTarget(target) {
  return String(target ?? '').split('-', 1)[0] || 'desktop';
}

export function createBirdcoderIamEnvReport({
  env = process.env,
  iamMode,
  target = 'desktop-dev',
  userCenterProvider,
  viteMode = DEFAULT_BIRDCODER_IAM_ENV_VITE_MODE_BY_TARGET[target] ?? 'development',
} = {}) {
  const commandEnv = resolveBirdcoderCommandEnv({
    env,
    userCenterProvider,
  });
  const resolved = resolveBirdcoderIamCommandEnv({
    env: commandEnv,
    iamMode,
    target,
    viteMode,
  });
  const providerKind = String(
    resolved.env.SDKWORK_USER_CENTER_MODE
    ?? resolved.env.VITE_SDKWORK_USER_CENTER_MODE
    ?? '',
  ).trim() || undefined;

  return {
    tool: 'show-birdcoder-iam-env',
    scriptMeta: birdcoderIamEnvMeta,
    supportedIamModes: BIRDCODER_IAM_DEPLOYMENT_MODES,
    target,
    surface: resolveSurfaceFromTarget(target),
    viteMode: resolved.viteMode,
    iamMode: resolved.iamMode,
    providerKind,
    errors: resolved.errors,
    managedEnv: pickManagedEnv(resolved.env),
    developerExperience: resolveBirdcoderIamDeveloperExperience({
      env: resolved.env,
      iamMode: resolved.iamMode,
      viteMode: resolved.viteMode,
    }),
  };
}

function showBirdcoderIamEnv() {
  const {
    target,
    iamMode,
    userCenterProvider,
    viteMode,
  } = parseBirdcoderIamEnvCliArgs(process.argv.slice(2));
  const output = createBirdcoderIamEnvReport({
    iamMode,
    target,
    userCenterProvider,
    viteMode,
  });

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.errors.length > 0 ? 1 : 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    showBirdcoderIamEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
