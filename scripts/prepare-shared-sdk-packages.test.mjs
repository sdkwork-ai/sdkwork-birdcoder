import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createSharedSdkSourceSpecs,
} from './prepare-shared-sdk-git-sources.mjs';
import {
  prepareSharedSdkPackages,
  resolveWorkspaceRootDir,
} from './prepare-shared-sdk-packages.mjs';

const FAKE_HEADS = Object.freeze({
  'sdkwork-appbase': '1111111111111111111111111111111111111111',
  'sdkwork-core': '2222222222222222222222222222222222222222',
  'sdkwork-ui': '3333333333333333333333333333333333333333',
  'sdkwork-terminal': '4444444444444444444444444444444444444444',
});

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-shared-sdk-packages-'));
  const workspaceRootDir = path.join(tempRoot, 'sdkwork-birdcoder');
  fs.mkdirSync(workspaceRootDir, { recursive: true });
  fs.writeFileSync(
    path.join(workspaceRootDir, 'package.json'),
    JSON.stringify({
      name: '@sdkwork/birdcoder-workspace',
    }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(workspaceRootDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  return {
    tempRoot,
    workspaceRootDir,
  };
}

function createRequiredFiles(repoRoot, requiredPaths) {
  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${relativePath}\n`);
  }
}

function createSharedRepos(workspaceRootDir) {
  const specs = createSharedSdkSourceSpecs(workspaceRootDir);
  const repoStates = new Map();
  const configSources = {};

  for (const spec of specs) {
    fs.mkdirSync(spec.repoRoot, { recursive: true });
    createRequiredFiles(spec.repoRoot, spec.requiredPaths);
    repoStates.set(spec.repoRoot, {
      topLevel: spec.repoRoot,
      originUrl: spec.repoRoot,
      head: FAKE_HEADS[spec.id],
      branch: 'main',
      dirty: false,
    });
    configSources[spec.id] = {
      repoUrl: spec.repoRoot,
      ref: FAKE_HEADS[spec.id],
    };
  }

  const configDir = path.join(workspaceRootDir, 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'shared-sdk-release-sources.json'),
    JSON.stringify({ sources: configSources }, null, 2) + '\n',
  );

  return {
    repoStates,
  };
}

function createGitSpawn(repoStates) {
  return function spawnSyncImpl(command, args, options = {}) {
    assert.match(String(command), /git(?:\.exe)?$/iu);
    assert.equal(options.encoding, 'utf8');
    assert.equal(options.shell, false);

    if (args[0] !== '-C') {
      throw new Error(`unexpected git command: ${args.join(' ')}`);
    }

    const repoRoot = path.resolve(String(args[1]));
    const repoState = repoStates.get(repoRoot);
    if (!repoState) {
      return {
        status: 1,
        stdout: '',
        stderr: `unknown repo: ${repoRoot}`,
      };
    }

    const commandKey = args.slice(2).join('\u0000');
    switch (commandKey) {
      case 'rev-parse\u0000--is-inside-work-tree':
        return {
          status: 0,
          stdout: 'true\n',
          stderr: '',
        };
      case 'rev-parse\u0000--show-toplevel':
        return {
          status: 0,
          stdout: `${repoState.topLevel}\n`,
          stderr: '',
        };
      case 'remote\u0000get-url\u0000origin':
        return {
          status: 0,
          stdout: `${repoState.originUrl}\n`,
          stderr: '',
        };
      case 'status\u0000--porcelain':
        return {
          status: 0,
          stdout: repoState.dirty ? ' M dirty.txt\n' : '',
          stderr: '',
        };
      case 'rev-parse\u0000HEAD':
        return {
          status: 0,
          stdout: `${repoState.head}\n`,
          stderr: '',
        };
      case 'branch\u0000--show-current':
        return {
          status: 0,
          stdout: `${repoState.branch}\n`,
          stderr: '',
        };
      default:
        throw new Error(`unexpected git command: ${args.join(' ')}`);
    }
  };
}

test('resolveWorkspaceRootDir finds the BirdCoder workspace root from a nested cwd', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const nestedDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-web');
    fs.mkdirSync(nestedDir, { recursive: true });

    assert.equal(resolveWorkspaceRootDir(nestedDir), workspaceRootDir);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages skips extra work in source mode', () => {
  const logs = [];
  const sourceResult = prepareSharedSdkPackages({
    env: {},
    logger: {
      log(message) {
        logs.push(String(message));
      },
    },
  });

  assert.equal(sourceResult.mode, 'source');
  assert.equal(sourceResult.prepared, false);
  assert.ok(
    logs.some((message) => message.includes('shared SDK mode is source')),
    'source mode must log the resolved shared SDK mode',
  );
});

test('prepareSharedSdkPackages delegates to governed git-source preparation in git mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates } = createSharedRepos(workspaceRootDir);
    const logs = [];

    const gitResult = prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log(message) {
          logs.push(String(message));
        },
      },
    });

    assert.equal(gitResult.mode, 'git');
    assert.equal(gitResult.prepared, true);
    assert.equal(gitResult.workspaceRoot, workspaceRootDir);
    assert.equal(Array.isArray(gitResult.sources), true);
    assert.equal(gitResult.sources.length, 4);
    assert.ok(
      logs.some((message) => message.includes('Ensuring git-backed shared SDK sources are available')),
      'git mode must announce governed git-source preparation',
    );
    assert.ok(
      logs.some((message) => message.includes('Ready sdkwork-appbase')),
      'git mode must surface shared repository readiness',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

console.log('prepare shared sdk packages contract passed.');
