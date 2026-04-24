#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  parseBirdcoderIdentityCliOptions,
  resolveBirdcoderCommandEnv,
} from './birdcoder-command-options.mjs';
import {
  BIRDCODER_IDENTITY_DEPLOYMENT_MODES,
  birdcoderIdentityEnvMeta,
  resolveBirdcoderIdentityDeveloperExperience,
  resolveBirdcoderIdentityCommandEnv,
} from './birdcoder-identity-env.mjs';

const __filename = fileURLToPath(import.meta.url);

export const BIRDCODER_IDENTITY_ENV_SUPPORTED_TARGETS = Object.freeze([
  'desktop-build',
  'desktop-dev',
  'server-build',
  'server-dev',
  'web-build',
  'web-dev',
]);

export const DEFAULT_BIRDCODER_IDENTITY_ENV_VITE_MODE_BY_TARGET = Object.freeze({
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

export function parseBirdcoderIdentityEnvCliArgs(argv = []) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const target = String(tokens.shift() ?? 'desktop-dev').trim();
  if (!BIRDCODER_IDENTITY_ENV_SUPPORTED_TARGETS.includes(target)) {
    throw new Error(
      `show-birdcoder-identity-env requires one of: ${BIRDCODER_IDENTITY_ENV_SUPPORTED_TARGETS.join(', ')}.`,
    );
  }

  const {
    identityMode,
    userCenterProvider,
    viteMode,
  } = parseBirdcoderIdentityCliOptions(tokens, {
    allowViteMode: true,
    commandName: 'show-birdcoder-identity-env',
  });

  return {
    identityMode,
    target,
    userCenterProvider,
    viteMode: viteMode ?? DEFAULT_BIRDCODER_IDENTITY_ENV_VITE_MODE_BY_TARGET[target],
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
      .filter(([key]) => key.startsWith('BIRDCODER_') || key.startsWith('VITE_BIRDCODER_'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, maskEnvValue(key, value)]),
  );
}

function resolveSurfaceFromTarget(target) {
  return String(target ?? '').split('-', 1)[0] || 'desktop';
}

export function createBirdcoderIdentityEnvReport({
  env = process.env,
  identityMode,
  target = 'desktop-dev',
  userCenterProvider,
  viteMode = DEFAULT_BIRDCODER_IDENTITY_ENV_VITE_MODE_BY_TARGET[target] ?? 'development',
} = {}) {
  const commandEnv = resolveBirdcoderCommandEnv({
    env,
    userCenterProvider,
  });
  const resolved = resolveBirdcoderIdentityCommandEnv({
    env: commandEnv,
    identityMode,
    target,
    viteMode,
  });
  const providerKind = String(
    resolved.env.BIRDCODER_USER_CENTER_LOGIN_PROVIDER
    ?? resolved.env.VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER
    ?? '',
  ).trim() || undefined;

  return {
    tool: 'show-birdcoder-identity-env',
    scriptMeta: birdcoderIdentityEnvMeta,
    supportedIdentityModes: BIRDCODER_IDENTITY_DEPLOYMENT_MODES,
    target,
    surface: resolveSurfaceFromTarget(target),
    viteMode: resolved.viteMode,
    identityMode: resolved.identityMode,
    providerKind,
    errors: resolved.errors,
    managedEnv: pickManagedEnv(resolved.env),
    developerExperience: resolveBirdcoderIdentityDeveloperExperience({
      env: resolved.env,
      identityMode: resolved.identityMode,
      viteMode: resolved.viteMode,
    }),
  };
}

function showBirdcoderIdentityEnv() {
  const {
    target,
    identityMode,
    userCenterProvider,
    viteMode,
  } = parseBirdcoderIdentityEnvCliArgs(process.argv.slice(2));
  const output = createBirdcoderIdentityEnvReport({
    identityMode,
    target,
    userCenterProvider,
    viteMode,
  });

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.errors.length > 0 ? 1 : 0);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    showBirdcoderIdentityEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
