#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';
import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptWorkspaceRoot = path.resolve(__dirname, '..');

export function resolveWorkspaceRootDir(currentWorkingDir = process.cwd()) {
  let candidateDir = path.resolve(currentWorkingDir);

  while (true) {
    const packageJsonPath = path.join(candidateDir, 'package.json');
    const workspaceManifestPath = path.join(candidateDir, 'pnpm-workspace.yaml');

    if (fs.existsSync(packageJsonPath) && fs.existsSync(workspaceManifestPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson?.name === '@sdkwork/birdcoder-workspace') {
          return candidateDir;
        }
      } catch {
        // Ignore parse failures and continue walking upward.
      }
    }

    const parentDir = path.dirname(candidateDir);
    if (parentDir === candidateDir) {
      break;
    }

    candidateDir = parentDir;
  }

  return scriptWorkspaceRoot;
}

export function prepareSharedSdkPackages({
  currentWorkingDir = process.cwd(),
  workspaceRootDir,
  env = process.env,
  logger = console,
  syncExistingRepos,
  spawnSyncImpl,
} = {}) {
  const workspaceRoot = workspaceRootDir ?? resolveWorkspaceRootDir(currentWorkingDir);
  const mode = resolveSharedSdkMode(env);

  if (mode === 'git') {
    logger.log('[prepare-shared-sdk-packages] Ensuring git-backed shared SDK sources are available.');
    const result = ensureSharedSdkGitSources({
      workspaceRootDir: workspaceRoot,
      env,
      logger,
      syncExistingRepos,
      spawnSyncImpl,
    });

    return {
      mode,
      prepared: true,
      sources: result.sources,
      workspaceRoot,
    };
  }

  logger.log('[prepare-shared-sdk-packages] shared SDK mode is source; no extra package preparation is required for BirdCoder.');
  return {
    mode,
    prepared: false,
    sources: [],
    workspaceRoot,
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
