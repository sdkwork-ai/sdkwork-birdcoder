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
  'sdkwork-sdk-app': '5555555555555555555555555555555555555555',
  'sdkwork-sdk-commons': '6666666666666666666666666666666666666666',
});

function createTempWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-shared-sdk-packages-'));
  const workspaceRootDir = path.join(tempRoot, 'apps', 'sdkwork-birdcoder');
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
    const content = path.basename(relativePath) === 'package.json'
      ? JSON.stringify({
        name: `fixture-${path.dirname(relativePath).replace(/[\\/]/gu, '-')}`,
        version: '0.0.0',
      }, null, 2) + '\n'
      : `${relativePath}\n`;
    fs.writeFileSync(absolutePath, content);
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
    specs,
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
    assert.equal(gitResult.sources.length, 6);
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

test('prepareSharedSdkPackages prepares source dependency resolution bridges only in git mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, specs } = createSharedRepos(workspaceRootDir);
    const uiSpec = specs.find((spec) => spec.id === 'sdkwork-ui');
    assert.ok(uiSpec, 'fixture must include sdkwork-ui');
    fs.mkdirSync(path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react', 'package.json'),
      JSON.stringify({
        name: '@sdkwork/ui-pc-react',
        dependencies: {
          '@radix-ui/react-popover': '^1.1.15',
          'class-variance-authority': '^0.7.1',
        },
        peerDependencies: {
          react: '>=18.0.0 <20.0.0',
        },
      }, null, 2) + '\n',
    );
    fs.writeFileSync(
      path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react', 'src', 'index.ts'),
      'export {};\n',
    );

    const pnpmHoistedDependencyDir = path.join(
      workspaceRootDir,
      'node_modules',
      '.pnpm',
      'node_modules',
    );
    const topLevelDependencyDir = path.join(
      workspaceRootDir,
      'node_modules',
    );
    fs.mkdirSync(path.join(topLevelDependencyDir, 'react'), { recursive: true });
    fs.writeFileSync(path.join(topLevelDependencyDir, 'react', 'package.json'), '{"name":"react"}\n');
    fs.mkdirSync(path.join(pnpmHoistedDependencyDir, 'class-variance-authority'), { recursive: true });
    fs.writeFileSync(
      path.join(pnpmHoistedDependencyDir, 'class-variance-authority', 'package.json'),
      '{"name":"class-variance-authority"}\n',
    );
    fs.mkdirSync(path.join(pnpmHoistedDependencyDir, '@radix-ui', 'react-popover'), { recursive: true });
    fs.writeFileSync(
      path.join(pnpmHoistedDependencyDir, '@radix-ui', 'react-popover', 'package.json'),
      '{"name":"@radix-ui/react-popover"}\n',
    );

    const bridgeDir = path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react', 'node_modules');
    assert.equal(fs.existsSync(bridgeDir), false);

    const gitResult = prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log() {},
      },
    });

    assert.equal(gitResult.mode, 'git');
    assert.ok(
      fs.existsSync(path.join(bridgeDir, 'react', 'package.json')),
      'git mode must expose React to the shared UI source package',
    );
    assert.ok(
      fs.existsSync(path.join(bridgeDir, 'class-variance-authority', 'package.json')),
      'git mode must expose shared UI direct dependencies to sibling source resolution',
    );
    assert.ok(
      fs.existsSync(path.join(bridgeDir, '@radix-ui', 'react-popover', 'package.json')),
      'git mode must preserve scoped dependency names when bridging shared UI dependencies',
    );
    assert.ok(
      gitResult.dependencyBridges.some((bridge) => bridge.id === 'sdkwork-ui'),
      'git mode result must describe prepared dependency bridges',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages bridges shared terminal workspace dependencies in git mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, specs } = createSharedRepos(workspaceRootDir);
    const terminalSpec = specs.find((spec) => spec.id === 'sdkwork-terminal');
    assert.ok(terminalSpec, 'fixture must include sdkwork-terminal');

    const packageManifests = [
      [
        'packages/sdkwork-terminal-infrastructure',
        {
          name: '@sdkwork/terminal-infrastructure',
          dependencies: {
            '@sdkwork/terminal-commons': 'workspace:*',
            '@sdkwork/terminal-core': 'workspace:*',
            '@sdkwork/terminal-contracts': 'workspace:*',
            '@sdkwork/terminal-types': 'workspace:*',
            '@xterm/xterm': '^5.5.0',
          },
        },
      ],
      [
        'packages/sdkwork-terminal-commons',
        {
          name: '@sdkwork/terminal-commons',
        },
      ],
      [
        'packages/sdkwork-terminal-core',
        {
          name: '@sdkwork/terminal-core',
          dependencies: {
            '@sdkwork/terminal-types': 'workspace:*',
          },
        },
      ],
      [
        'packages/sdkwork-terminal-contracts',
        {
          name: '@sdkwork/terminal-contracts',
          dependencies: {
            '@sdkwork/terminal-types': 'workspace:*',
          },
        },
      ],
      [
        'packages/sdkwork-terminal-types',
        {
          name: '@sdkwork/terminal-types',
        },
      ],
    ];

    for (const [relativePackageRoot, manifest] of packageManifests) {
      const packageRoot = path.join(terminalSpec.repoRoot, relativePackageRoot);
      fs.mkdirSync(packageRoot, { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({
          version: '0.2.59',
          type: 'module',
          exports: {
            '.': './src/index.ts',
          },
          ...manifest,
        }, null, 2) + '\n',
      );
    }

    prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log() {},
      },
    });

    const bridgeDir = path.join(
      terminalSpec.repoRoot,
      'packages',
      'sdkwork-terminal-infrastructure',
      'node_modules',
    );
    for (const packageName of [
      '@sdkwork/terminal-commons',
      '@sdkwork/terminal-core',
      '@sdkwork/terminal-contracts',
      '@sdkwork/terminal-types',
    ]) {
      assert.ok(
        fs.existsSync(path.join(bridgeDir, ...packageName.split('/'), 'package.json')),
        `git mode must expose ${packageName} through the terminal infrastructure bridge`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages chooses dependency versions that satisfy the shared package manifest', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, specs } = createSharedRepos(workspaceRootDir);
    const uiSpec = specs.find((spec) => spec.id === 'sdkwork-ui');
    assert.ok(uiSpec, 'fixture must include sdkwork-ui');
    const packageRoot = path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react');
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@sdkwork/ui-pc-react',
        dependencies: {
          'lucide-react': '1.7.0',
        },
      }, null, 2) + '\n',
    );

    const topLevelDependencyDir = path.join(workspaceRootDir, 'node_modules', 'lucide-react');
    fs.mkdirSync(topLevelDependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(topLevelDependencyDir, 'package.json'),
      '{"name":"lucide-react","version":"0.546.0"}\n',
    );
    const packageStoreDependencyDir = path.join(
      workspaceRootDir,
      'node_modules',
      '.pnpm',
      'lucide-react@1.7.0_react@19.2.4',
      'node_modules',
      'lucide-react',
    );
    fs.mkdirSync(packageStoreDependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageStoreDependencyDir, 'package.json'),
      '{"name":"lucide-react","version":"1.7.0"}\n',
    );

    prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log() {},
      },
    });

    const bridgedPackageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'node_modules', 'lucide-react', 'package.json'), 'utf8'),
    );
    assert.equal(
      bridgedPackageJson.version,
      '1.7.0',
      'git mode bridge must prefer the installed dependency instance that satisfies the shared package manifest',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages bridges shared appbase router runtime fallbacks in git mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, specs } = createSharedRepos(workspaceRootDir);
    const appbaseSpec = specs.find((spec) => spec.id === 'sdkwork-appbase');
    assert.ok(appbaseSpec, 'fixture must include sdkwork-appbase');
    const authPackageRoot = path.join(
      appbaseSpec.repoRoot,
      'packages',
      'pc-react',
      'identity',
      'sdkwork-auth-pc-react',
    );
    fs.mkdirSync(authPackageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(authPackageRoot, 'package.json'),
      JSON.stringify({
        name: '@sdkwork/auth-pc-react',
        peerDependencies: {
          react: '>=18.2.0 <20.0.0',
        },
      }, null, 2) + '\n',
    );

    const hoistedDependencyRoot = path.join(workspaceRootDir, 'node_modules', '.pnpm', 'node_modules');
    for (const packageName of ['react-router', 'react-router-dom']) {
      const packageRoot = path.join(hoistedDependencyRoot, packageName);
      fs.mkdirSync(packageRoot, { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, 'package.json'),
        JSON.stringify({ name: packageName, version: '7.14.0' }, null, 2) + '\n',
      );
    }

    prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log() {},
      },
    });

    const bridgeDir = path.join(authPackageRoot, 'node_modules');
    assert.ok(
      fs.existsSync(path.join(bridgeDir, 'react-router', 'package.json')),
      'git mode must expose react-router through the appbase package bridge because Vite aliases react-router from shared appbase source.',
    );
    assert.ok(
      fs.existsSync(path.join(bridgeDir, 'react-router-dom', 'package.json')),
      'git mode must expose react-router-dom through the appbase package bridge because Vite aliases react-router-dom from shared appbase source.',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages does not mutate sibling source package node_modules in source mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { specs } = createSharedRepos(workspaceRootDir);
    const uiSpec = specs.find((spec) => spec.id === 'sdkwork-ui');
    assert.ok(uiSpec, 'fixture must include sdkwork-ui');
    const bridgeDir = path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react', 'node_modules');

    const sourceResult = prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {},
      logger: {
        log() {},
      },
    });

    assert.equal(sourceResult.mode, 'source');
    assert.equal(sourceResult.prepared, false);
    assert.equal(fs.existsSync(bridgeDir), false);
    assert.deepEqual(sourceResult.dependencyBridges, []);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('prepareSharedSdkPackages preserves unmanaged local sibling node_modules in git mode', () => {
  const { tempRoot, workspaceRootDir } = createTempWorkspace();

  try {
    const { repoStates, specs } = createSharedRepos(workspaceRootDir);
    const uiSpec = specs.find((spec) => spec.id === 'sdkwork-ui');
    assert.ok(uiSpec, 'fixture must include sdkwork-ui');
    const packageRoot = path.join(uiSpec.repoRoot, 'sdkwork-ui-pc-react');
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@sdkwork/ui-pc-react',
        dependencies: {
          'class-variance-authority': '^0.7.1',
        },
      }, null, 2) + '\n',
    );
    const bridgeDir = path.join(packageRoot, 'node_modules');
    fs.mkdirSync(path.join(bridgeDir, 'local-only'), { recursive: true });
    fs.writeFileSync(path.join(bridgeDir, 'local-only', 'marker.txt'), 'preserve me\n');

    const gitResult = prepareSharedSdkPackages({
      currentWorkingDir: workspaceRootDir,
      env: {
        SDKWORK_SHARED_SDK_MODE: 'git',
      },
      spawnSyncImpl: createGitSpawn(repoStates),
      logger: {
        log() {},
      },
    });

    assert.equal(
      fs.readFileSync(path.join(bridgeDir, 'local-only', 'marker.txt'), 'utf8'),
      'preserve me\n',
    );
    assert.ok(
      gitResult.dependencyBridges.some((bridge) =>
        bridge.id === 'sdkwork-ui' && bridge.preservedExistingNodeModules === true,
      ),
      'git mode must report when it preserves an unmanaged local node_modules directory',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

console.log('prepare shared sdk packages contract passed.');
