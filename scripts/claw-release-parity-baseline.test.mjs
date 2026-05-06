import assert from 'node:assert/strict';
import path from 'node:path';

import {
  DEFAULT_CLAW_PARITY_REF,
  DEFAULT_CLAW_REPOSITORY_URL,
  readGitHeadFile,
  resolveClawParityBaseline,
} from './claw-release-parity-baseline.mjs';

{
  const calls = [];
  const baseline = resolveClawParityBaseline({
    candidateRootDir: '/workspace/claw-studio',
    existsSyncImpl(candidatePath) {
      return candidatePath === path.join('/workspace/claw-studio', '.git');
    },
    execFileSyncImpl(command, args, options) {
      calls.push({ command, args, options });
      assert.deepEqual(args, [
        '-C',
        '/workspace/claw-studio',
        'rev-parse',
        '--verify',
        `${DEFAULT_CLAW_PARITY_REF}^{commit}`,
      ]);
      return '5f350bbaef50cbd4ae05c98bbbb6566d17eced84\n';
    },
  });

  assert.deepEqual(baseline, {
    rootDir: '/workspace/claw-studio',
    ref: DEFAULT_CLAW_PARITY_REF,
    source: 'local',
  });
  assert.equal(calls.length, 1);
}

{
  const calls = [];
  const baseline = resolveClawParityBaseline({
    candidateRootDir: '/workspace/missing-claw-studio',
    repositoryUrl: 'git@github.com:Sdkwork-Cloud/claw-studio.git',
    ref: 'release-2026-05-05-179',
    tempRootDir: '/tmp',
    existsSyncImpl() {
      return false;
    },
    mkdtempSyncImpl(prefix) {
      assert.equal(prefix, path.join('/tmp', 'sdkwork-birdcoder-claw-parity-'));
      return '/tmp/sdkwork-birdcoder-claw-parity-abc123';
    },
    execFileSyncImpl(command, args, options) {
      calls.push({ command, args, options });
      assert.equal(command, 'git');
      assert.deepEqual(args, [
        'clone',
        '--filter=blob:none',
        '--no-checkout',
        '--branch',
        'release-2026-05-05-179',
        'git@github.com:Sdkwork-Cloud/claw-studio.git',
        '/tmp/sdkwork-birdcoder-claw-parity-abc123',
      ]);
      assert.equal(options.windowsHide, true);
      return '';
    },
  });

  assert.deepEqual(baseline, {
    rootDir: '/tmp/sdkwork-birdcoder-claw-parity-abc123',
    ref: 'HEAD',
    source: 'remote',
  });
  assert.equal(calls.length, 1);
}

{
  const content = readGitHeadFile({
    rootDir: '/workspace/claw-studio',
    ref: 'release-2026-05-05-179',
    relativePath: '.github/workflows/ci.yml',
    execFileSyncImpl(command, args, options) {
      assert.equal(command, 'git');
      assert.deepEqual(args, [
        '-C',
        '/workspace/claw-studio',
        'show',
        'release-2026-05-05-179:.github/workflows/ci.yml',
      ]);
      assert.equal(options.encoding, 'utf8');
      return 'name: ci\r\n';
    },
  });

  assert.equal(content, 'name: ci\n');
}

assert.equal(DEFAULT_CLAW_REPOSITORY_URL, 'git@github.com:Sdkwork-Cloud/claw-studio.git');

console.log('claw release parity baseline contract passed.');
