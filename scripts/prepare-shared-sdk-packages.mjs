#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';
import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

export function prepareSharedSdkPackages({
  env = process.env,
  logger = console,
} = {}) {
  const mode = resolveSharedSdkMode(env);
  if (mode === 'git') {
    ensureSharedSdkGitSources({
      env,
      logger,
    });
  }

  logger.log(`[prepare-shared-sdk-packages] shared SDK mode is ${mode}; no extra package preparation is required for BirdCoder.`);
  return {
    mode,
    prepared: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(prepareSharedSdkPackages(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
