#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

export function ensureSharedSdkGitSources({
  env = process.env,
  logger = console,
} = {}) {
  const mode = resolveSharedSdkMode(env);
  if (mode !== 'git') {
    logger.log('[prepare-shared-sdk-git-sources] shared SDK mode is source; skipping git materialization.');
    return {
      mode,
      changed: false,
      status: 'skipped',
    };
  }

  logger.log('[prepare-shared-sdk-git-sources] BirdCoder currently uses workspace-local SDK packages; no external git materialization is required.');
  return {
    mode,
    changed: false,
    status: 'ready',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(ensureSharedSdkGitSources(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

