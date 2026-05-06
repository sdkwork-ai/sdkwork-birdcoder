import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_CLAW_REPOSITORY_URL = 'git@github.com:Sdkwork-Cloud/claw-studio.git';
export const DEFAULT_CLAW_PARITY_REF = 'release-2026-05-05-179';

export function resolveClawParityBaseline({
  candidateRootDir,
  repositoryUrl = DEFAULT_CLAW_REPOSITORY_URL,
  ref = DEFAULT_CLAW_PARITY_REF,
  tempRootDir = os.tmpdir(),
  existsSyncImpl = fs.existsSync,
  mkdtempSyncImpl = fs.mkdtempSync,
  execFileSyncImpl = execFileSync,
} = {}) {
  const localRootDir = String(candidateRootDir ?? '').trim();
  const normalizedRef = String(ref ?? '').trim() || DEFAULT_CLAW_PARITY_REF;
  if (localRootDir && existsSyncImpl(path.join(localRootDir, '.git'))) {
    execFileSyncImpl('git', [
      '-C',
      localRootDir,
      'rev-parse',
      '--verify',
      `${normalizedRef}^{commit}`,
    ], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return {
      rootDir: localRootDir,
      ref: normalizedRef,
      source: 'local',
    };
  }

  const cloneRootDir = mkdtempSyncImpl(path.join(tempRootDir, 'sdkwork-birdcoder-claw-parity-'));
  execFileSyncImpl('git', [
    'clone',
    '--filter=blob:none',
    '--no-checkout',
    '--branch',
    normalizedRef,
    repositoryUrl,
    cloneRootDir,
  ], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return {
    rootDir: cloneRootDir,
    ref: 'HEAD',
    source: 'remote',
  };
}

export function readGitHeadFile({
  rootDir,
  ref = 'HEAD',
  relativePath,
  execFileSyncImpl = execFileSync,
} = {}) {
  return execFileSyncImpl('git', ['-C', rootDir, 'show', `${ref}:${relativePath}`], {
    encoding: 'utf8',
    windowsHide: true,
  }).replaceAll('\r\n', '\n');
}
