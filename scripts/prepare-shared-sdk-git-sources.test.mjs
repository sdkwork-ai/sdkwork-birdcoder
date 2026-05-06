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
  'sdkwork-sdk-app': '5555555555555555555555555555555555555555',
  'sdkwork-sdk-commons': '6666666666666666666666666666666666666666',
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

function createGitCloneSpawn({
  expectedGithubToken,
  requiredPathsByRepoRoot,
}) {
  const repoStates = new Map();
  const cloneCalls = [];

  return {
    cloneCalls,
    spawnSyncImpl(command, args, options = {}) {
      assert.match(String(command), /git(?:\.exe)?$/iu);
      assert.equal(options.encoding, 'utf8');
      assert.equal(options.shell, false);

      if (args[0] === 'clone') {
        const repoUrl = String(args[1]);
        const repoRoot = path.resolve(String(args[2]));
        cloneCalls.push({ repoUrl, repoRoot, env: options.env });

        assert.equal(
          repoUrl.includes(expectedGithubToken),
          false,
          'shared SDK clone URLs must not embed GitHub tokens',
        );
        assert.ok(options.env, 'GitHub HTTPS shared SDK clones must receive a git auth environment');
        assert.notEqual(
          options.env.SDKWORK_SHARED_SDK_GITHUB_TOKEN,
          expectedGithubToken,
          'raw shared SDK GitHub token must not be forwarded into the git child environment',
        );

        const configCount = Number.parseInt(String(options.env.GIT_CONFIG_COUNT ?? ''), 10);
        assert.ok(Number.isInteger(configCount) && configCount > 0, 'git auth env must add an extraheader config entry');
        const authConfigIndex = Array.from({ length: configCount }, (_, index) => index).find(
          (index) => options.env[`GIT_CONFIG_KEY_${index}`] === 'http.https://github.com/.extraheader',
        );
        assert.notEqual(authConfigIndex, undefined, 'git auth env must target github.com extraheader auth');
        const authHeader = String(options.env[`GIT_CONFIG_VALUE_${authConfigIndex}`] ?? '');
        assert.match(authHeader, /^AUTHORIZATION: basic /u);
        assert.equal(
          authHeader.includes(expectedGithubToken),
          false,
          'git auth extraheader must not expose the raw token text',
        );

        fs.mkdirSync(repoRoot, { recursive: true });
        createRequiredFiles(repoRoot, requiredPathsByRepoRoot.get(repoRoot) ?? []);
        repoStates.set(repoRoot, {
          topLevel: repoRoot,
          originUrl: repoUrl,
          head: FAKE_HEADS[path.basename(repoRoot)] ?? '5555555555555555555555555555555555555555',
          branch: 'main',
          dirty: false,
        });

        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      }

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
        case 'checkout\u0000--force\u0000main':
          repoState.branch = 'main';
          return {
            status: 0,
            stdout: '',
            stderr: '',
          };
        case 'rev-parse\u0000--show-toplevel':
          return {
            status: 0,
            stdout: `${repoState.topLevel}\n`,
            stderr: '',
          };
        default:
          throw new Error(`unexpected git command: ${args.join(' ')}`);
      }
    },
  };
}

function createGitSshCloneSpawn({
  requiredPathsByRepoRoot,
}) {
  const repoStates = new Map();
  const cloneCalls = [];

  return {
    cloneCalls,
    spawnSyncImpl(command, args, options = {}) {
      assert.match(String(command), /git(?:\.exe)?$/iu);
      assert.equal(options.encoding, 'utf8');
      assert.equal(options.shell, false);

      if (args[0] === 'clone') {
        const repoUrl = String(args[1]);
        const repoRoot = path.resolve(String(args[2]));
        cloneCalls.push({ repoUrl, repoRoot, env: options.env });

        assert.match(
          repoUrl,
          /^git@github\.com:Sdkwork-Cloud\/(?:sdkwork-(?:appbase|core|ui|terminal)|sdkwork-sdk-(?:app|commons))\.git$/u,
          'shared SDK SSH mode must clone governed GitHub sources through the passwordless SSH remote.',
        );
        assert.equal(
          repoUrl.startsWith('https://'),
          false,
          'shared SDK SSH mode must not fall back to HTTPS for private sibling repositories.',
        );
        assert.equal(
          options.env?.SDKWORK_SHARED_SDK_GITHUB_TOKEN,
          undefined,
          'shared SDK SSH clones must not forward raw GitHub tokens into the git child environment.',
        );
        assert.ok(
          options.env?.GIT_CONFIG_GLOBAL,
          'shared SDK SSH clones must ignore runner-level git URL rewrites that can force git@github.com remotes back to HTTPS.',
        );
        if (process.platform === 'win32') {
          assert.notEqual(
            path.normalize(String(options.env.GIT_CONFIG_GLOBAL)),
            path.normalize(os.devNull),
            'Windows Git cannot use the device null path as GIT_CONFIG_GLOBAL when cloning SSH shared SDK repositories.',
          );
          assert.equal(
            fs.statSync(String(options.env.GIT_CONFIG_GLOBAL)).isFile(),
            true,
            'Windows SSH shared SDK clones must use a real empty gitconfig file to bypass runner-level URL rewrites.',
          );
        }
        assert.match(
          String(options.env?.GIT_SSH_COMMAND ?? ''),
          /StrictHostKeyChecking=accept-new/u,
          'shared SDK SSH clones must be able to trust the GitHub host key on fresh hosted runners.',
        );

        fs.mkdirSync(repoRoot, { recursive: true });
        createRequiredFiles(repoRoot, requiredPathsByRepoRoot.get(repoRoot) ?? []);
        repoStates.set(repoRoot, {
          topLevel: repoRoot,
          originUrl: repoUrl,
          head: FAKE_HEADS[path.basename(repoRoot)] ?? '5555555555555555555555555555555555555555',
          branch: 'main',
          dirty: false,
        });

        return {
          status: 0,
          stdout: '',
          stderr: '',
        };
      }

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
        case 'checkout\u0000--force\u0000main':
          repoState.branch = 'main';
          return {
            status: 0,
            stdout: '',
            stderr: '',
          };
        case 'rev-parse\u0000--show-toplevel':
          return {
            status: 0,
            stdout: `${repoState.topLevel}\n`,
            stderr: '',
          };
        default:
          throw new Error(`unexpected git command: ${args.join(' ')}`);
      }
    },
  };
}

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-shared-sdk-'));
  const workspaceRootDir = path.join(tempRoot, 'apps', 'sdkwork-birdcoder');
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
  return Object.fromEntries(
    Object.entries(sharedRepos).map(([id, sharedRepo]) => [
      id,
      {
        repoUrl: sharedRepo.root,
        ref: sharedRepo.head,
      },
    ]),
  );
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
    [
      'sdkwork-appbase',
      'sdkwork-core',
      'sdkwork-sdk-app',
      'sdkwork-sdk-commons',
      'sdkwork-terminal',
      'sdkwork-ui',
    ],
  );
  assert.deepEqual(
    specs.map((spec) => spec.id),
    [
      'sdkwork-appbase',
      'sdkwork-core',
      'sdkwork-ui',
      'sdkwork-terminal',
      'sdkwork-sdk-app',
      'sdkwork-sdk-commons',
    ],
  );
  assert.deepEqual(
    specs.map((spec) => path.relative(workspaceRootDir, spec.repoRoot).replaceAll('\\', '/')),
    [
      '../sdkwork-appbase',
      '../sdkwork-core',
      '../sdkwork-ui',
      '../sdkwork-terminal',
      '../../spring-ai-plus-app-api/sdkwork-sdk-app',
      '../../sdk/sdkwork-sdk-commons',
    ],
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
    assert.equal(result.sources.length, 6);
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

test('git mode authenticates GitHub HTTPS clones without embedding tokens in clone URLs', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const specs = createSharedSdkSourceSpecs(workspaceRootDir);
    const requiredPathsByRepoRoot = new Map(
      specs.map((spec) => [spec.repoRoot, spec.requiredPaths]),
    );
    createReleaseConfig(workspaceRootDir, Object.fromEntries(
      specs.map((spec) => [
        spec.id,
        {
          repoUrl: `https://github.com/Sdkwork-Cloud/${spec.id}.git`,
          ref: 'main',
        },
      ]),
    ));
    const githubToken = 'github-token-for-private-shared-sdk-repos';
    const { cloneCalls, spawnSyncImpl } = createGitCloneSpawn({
      expectedGithubToken: githubToken,
      requiredPathsByRepoRoot,
    });

    const result = ensureSharedSdkGitSources({
      workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
        SDKWORK_SHARED_SDK_GITHUB_TOKEN: githubToken,
      },
      spawnSyncImpl,
    });

    assert.equal(result.status, 'ready');
    assert.equal(result.changed, true);
    assert.equal(cloneCalls.length, 6);
    assert.ok(
      cloneCalls.every((call) => call.repoUrl.startsWith('https://github.com/Sdkwork-Cloud/')),
      'all governed shared SDK repositories should clone from configured GitHub HTTPS URLs',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git mode can materialize GitHub release sources over SSH without rewriting release config', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const specs = createSharedSdkSourceSpecs(workspaceRootDir);
    const requiredPathsByRepoRoot = new Map(
      specs.map((spec) => [spec.repoRoot, spec.requiredPaths]),
    );
    createReleaseConfig(workspaceRootDir, Object.fromEntries(
      specs.map((spec) => [
        spec.id,
        {
          repoUrl: `https://github.com/Sdkwork-Cloud/${spec.id}.git`,
          ref: 'main',
        },
      ]),
    ));
    const { cloneCalls, spawnSyncImpl } = createGitSshCloneSpawn({
      requiredPathsByRepoRoot,
    });

    const result = ensureSharedSdkGitSources({
      workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
        SDKWORK_SHARED_SDK_GIT_PROTOCOL: 'ssh',
      },
      spawnSyncImpl,
    });

    assert.equal(result.status, 'ready');
    assert.equal(result.changed, true);
    assert.equal(cloneCalls.length, 6);
    assert.ok(
      cloneCalls.every((call) => call.repoUrl.startsWith('git@github.com:Sdkwork-Cloud/')),
      'all governed shared SDK repositories should clone from GitHub over SSH when SSH transport is requested.',
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
      [
        'sdkwork-appbase',
        'sdkwork-core',
        'sdkwork-sdk-app',
        'sdkwork-sdk-commons',
        'sdkwork-terminal',
        'sdkwork-ui',
      ],
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
