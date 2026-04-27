#!/usr/bin/env node

import process from 'node:process';

function readOptionValue(argv, index, flag) {
  const nextValue = String(argv[index + 1] ?? '').trim();
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return nextValue;
}

export function parseBirdcoderIdentityCliOptions(
  argv = [],
  {
    allowViteMode = false,
    commandName = 'birdcoder-command',
  } = {},
) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  let identityMode;
  let userCenterProvider;
  let viteMode;
  let demoLogin = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--identity-mode') {
      identityMode = readOptionValue(tokens, index, '--identity-mode');
      index += 1;
      continue;
    }
    if (token === '--user-center-provider') {
      userCenterProvider = readOptionValue(tokens, index, '--user-center-provider');
      index += 1;
      continue;
    }
    if (allowViteMode && token === '--vite-mode') {
      viteMode = readOptionValue(tokens, index, '--vite-mode');
      index += 1;
      continue;
    }
    if (token === '--demo-login') {
      demoLogin = true;
      continue;
    }

    throw new Error(`Unknown argument for ${commandName}: ${token}`);
  }

  return {
    demoLogin,
    identityMode,
    userCenterProvider,
    viteMode,
  };
}

export function resolveBirdcoderCommandEnv({
  env = process.env,
  demoLogin = false,
  userCenterProvider,
} = {}) {
  if (!userCenterProvider && !demoLogin) {
    return env;
  }

  const nextEnv = {
    ...env,
  };
  if (userCenterProvider) {
    nextEnv.BIRDCODER_USER_CENTER_LOGIN_PROVIDER = userCenterProvider;
  }
  if (demoLogin) {
    nextEnv.BIRDCODER_ENABLE_RELEASE_DEMO_LOGIN = 'true';
  }

  return nextEnv;
}

export function createBirdcoderIdentityCliFlags({
  identityMode,
  providerKind,
} = {}) {
  const flags = [];
  const normalizedIdentityMode = String(identityMode ?? '').trim();
  if (normalizedIdentityMode) {
    flags.push('--identity-mode', normalizedIdentityMode);
  }

  if (providerKind === 'external-user-center') {
    flags.push('--user-center-provider', 'external-user-center');
  }

  return flags;
}
