import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR,
  createSharedSdkSourceSpecs,
  ensureSharedSdkGitSources,
  readSharedSdkReleaseConfig,
  resolveSharedSdkReleaseConfigPath,
} from './prepare-shared-sdk-git-sources.mjs';

const FAKE_HEADS = Object.freeze({
  'sdkwork-appbase': '1111111111111111111111111111111111111111',
  'sdkwork-core': '2222222222222222222222222222222222222222',
  'sdkwork-ui': '3333333333333333333333333333333333333333',
  'sdkwork-terminal': '4444444444444444444444444444444444444444',
});

function createRequiredFiles(repoRoot, requiredPaths) {
  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${relativePath}\n`);
  }
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

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-shared-sdk-'));
  const workspaceRootDir = path.join(tempRoot, 'sdkwork-birdcoder');
  fs.mkdirSync(workspaceRootDir, { recursive: true });
  return {
    tempRoot,
    workspaceRootDir,
  };
}

function createReleaseConfig(workspaceRootDir, sourceEntries) {
  const configDir = path.join(workspaceRootDir, 'config');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'shared-sdk-release-sources.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        sources: sourceEntries,
      },
      null,
      2,
    ) + '\n',
  );
  return configPath;
}

function createBirdCoderSharedRepos(workspaceRootDir) {
  const specs = createSharedSdkSourceSpecs(workspaceRootDir);
  const repoStates = new Map();
  const sharedRepos = {};

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
    sharedRepos[spec.id] = {
      root: spec.repoRoot,
      head: FAKE_HEADS[spec.id],
    };
  }

  return {
    repoStates,
    sharedRepos,
  };
}

function createDefaultSourceEntries(sharedRepos) {
  return {
    'sdkwork-appbase': {
      repoUrl: sharedRepos['sdkwork-appbase'].root,
      ref: sharedRepos['sdkwork-appbase'].head,
    },
    'sdkwork-core': {
      repoUrl: sharedRepos['sdkwork-core'].root,
      ref: sharedRepos['sdkwork-core'].head,
    },
    'sdkwork-ui': {
      repoUrl: sharedRepos['sdkwork-ui'].root,
      ref: sharedRepos['sdkwork-ui'].head,
    },
    'sdkwork-terminal': {
      repoUrl: sharedRepos['sdkwork-terminal'].root,
      ref: sharedRepos['sdkwork-terminal'].head,
    },
  };
}

test('source mode skips shared SDK git materialization', () => {
  const sourceLogs = [];
  const sourceResult = ensureSharedSdkGitSources({
    env: {},
    logger: {
      log(message) {
        sourceLogs.push(String(message));
      },
    },
  });

  assert.equal(sourceResult.mode, 'source');
  assert.equal(sourceResult.changed, false);
  assert.equal(sourceResult.status, 'skipped');
  assert.ok(
    sourceLogs.some((message) => message.includes('shared SDK mode is source')),
    'source mode must log source-mode skipping',
  );
});

test('release config and source specs cover the governed BirdCoder sibling repositories', () => {
  const workspaceRootDir = process.cwd();
  const config = readSharedSdkReleaseConfig(workspaceRootDir);
  const configPath = resolveSharedSdkReleaseConfigPath(workspaceRootDir);
  const specs = createSharedSdkSourceSpecs(workspaceRootDir);

  assert.equal(
    configPath,
    path.join(workspaceRootDir, 'config', 'shared-sdk-release-sources.json'),
  );
  assert.deepEqual(
    Object.keys(config.sources).sort(),
    ['sdkwork-appbase', 'sdkwork-core', 'sdkwork-terminal', 'sdkwork-ui'],
  );
  assert.deepEqual(
    specs.map((spec) => spec.id),
    ['sdkwork-appbase', 'sdkwork-core', 'sdkwork-ui', 'sdkwork-terminal'],
  );
  assert.deepEqual(
    specs.map((spec) => path.relative(workspaceRootDir, spec.repoRoot).replaceAll('\\', '/')),
    ['../sdkwork-appbase', '../sdkwork-core', '../sdkwork-ui', '../sdkwork-terminal'],
  );
});

test('git mode requires a shared SDK release config', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    assert.throws(
      () => ensureSharedSdkGitSources({
        workspaceRootDir,
        env: {
          SDKWORK_SHARED_SDK_MODE: 'git',
        },
      }),
      /missing shared SDK release config/i,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode accepts clean sibling repositories pinned to the configured refs', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, sharedRepos } = createBirdCoderSharedRepos(workspaceRootDir);
    createReleaseConfig(workspaceRootDir, createDefaultSourceEntries(sharedRepos));
    const logs = [];

    const result = ensureSharedSdkGitSources({
      workspaceRootDir,
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

    assert.equal(result.mode, 'git');
    assert.equal(result.status, 'ready');
    assert.equal(result.changed, false);
    assert.equal(Array.isArray(result.sources), true);
    assert.equal(result.sources.length, 4);
    assert.ok(
      result.sources.every((source) => source.status === 'ready'),
      'all governed shared repositories must report ready',
    );
    assert.ok(
      logs.some((message) => message.includes('Ready sdkwork-appbase')),
      'git mode must report governed shared repository readiness',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode rejects dirty sibling repositories', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, sharedRepos } = createBirdCoderSharedRepos(workspaceRootDir);
    createReleaseConfig(workspaceRootDir, createDefaultSourceEntries(sharedRepos));
    repoStates.get(sharedRepos['sdkwork-ui'].root).dirty = true;

    assert.throws(
      () => ensureSharedSdkGitSources({
        workspaceRootDir,
        env: {
          SDKWORK_SHARED_SDK_MODE: 'git',
        },
        spawnSyncImpl: createGitSpawn(repoStates),
      }),
      /uncommitted changes/i,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode rejects sibling repositories that drift away from the configured ref', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, sharedRepos } = createBirdCoderSharedRepos(workspaceRootDir);
    const pinnedSources = createDefaultSourceEntries(sharedRepos);
    repoStates.get(sharedRepos['sdkwork-appbase'].root).head =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    createReleaseConfig(workspaceRootDir, pinnedSources);

    assert.throws(
      () => ensureSharedSdkGitSources({
        workspaceRootDir,
        env: {
          SDKWORK_SHARED_SDK_MODE: 'git',
        },
        spawnSyncImpl: createGitSpawn(repoStates),
      }),
      /pinned ref/i,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode can read an explicitly configured release config path', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { sharedRepos } = createBirdCoderSharedRepos(workspaceRootDir);
    const explicitConfigPath = createReleaseConfig(
      workspaceRootDir,
      createDefaultSourceEntries(sharedRepos),
    );

    const config = readSharedSdkReleaseConfig(workspaceRootDir, {
      [SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR]: path.relative(workspaceRootDir, explicitConfigPath),
    });

    assert.deepEqual(
      Object.keys(config.sources).sort(),
      ['sdkwork-appbase', 'sdkwork-core', 'sdkwork-terminal', 'sdkwork-ui'],
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode rejects sibling repositories whose remote URL drifts away from the configured repository', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, sharedRepos } = createBirdCoderSharedRepos(workspaceRootDir);
    createReleaseConfig(workspaceRootDir, createDefaultSourceEntries(sharedRepos));
    repoStates.get(sharedRepos['sdkwork-core'].root).originUrl =
      'git@github.com:Sdkwork-Cloud/spring-ai-plus2.git';

    assert.throws(
      () => ensureSharedSdkGitSources({
        workspaceRootDir,
        env: {
          SDKWORK_SHARED_SDK_MODE: 'git',
        },
        spawnSyncImpl: createGitSpawn(repoStates),
      }),
      /does not match configured repo/i,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

console.log('prepare shared sdk git sources contract passed.');
