import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

import {
  createDesktopViteServerConfig,
  fetchDesktopCompatibilityProbe,
  isCompatibleRunningDesktopHost,
  parseArgs,
} from './run-desktop-vite-host.mjs';
import {
  createBirdcoderWorkspaceAliasEntries,
  resolveBirdcoderTerminalInfrastructureRuntimePath,
  resolveSdkworkTerminalInfrastructureEntryPath,
} from './create-birdcoder-vite-plugins.mjs';

assert.deepEqual(parseArgs([]), {
  host: undefined,
  port: undefined,
  strictPort: false,
  mode: 'development',
});
assert.throws(() => parseArgs(['--host']), /Missing value for --host/);

assert.deepEqual(parseArgs(['serve', '--host', '127.0.0.1', '--port', '1520', '--strictPort', '--mode', 'test']), {
  host: '127.0.0.1',
  port: 1520,
  strictPort: true,
  mode: 'test',
});

const rootDir = process.cwd();
const desktopRootDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const appbaseWorkspaceRoot = path.resolve(rootDir, '..', 'sdkwork-appbase');
const config = createDesktopViteServerConfig({
  argv: ['--host', '127.0.0.1', '--port', '1520', '--strictPort', '--mode', 'test'],
  env: {
    DISABLE_HMR: 'true',
  },
  desktopRootDir,
  plugins: ['react-plugin', 'tailwind-plugin'],
});

assert.equal(config.configFile, false);
assert.equal(config.root, desktopRootDir);
assert.equal(config.mode, 'test');
assert.equal(config.base, './');
assert.equal(config.esbuild, false);
assert.deepEqual(config.plugins, ['react-plugin', 'tailwind-plugin']);
assert.ok(!('disabled' in config.optimizeDeps));
assert.equal(config.optimizeDeps.noDiscovery, true);
assert.deepEqual(config.optimizeDeps.include, []);
assert.deepEqual(config.resolve.dedupe, [
  'react',
  'react-dom',
  'react-i18next',
  'react-router',
  'react-router-dom',
  'scheduler',
  'use-sync-external-store',
]);
assert.equal('preserveSymlinks' in config.resolve, false);

const normalizePath = (value) => String(value).replace(/\\/g, '/');
const findAlias = (predicate, message) => {
  const aliasEntry = config.resolve.alias.find(predicate);
  assert.ok(aliasEntry, message);
  return aliasEntry;
};

const birdcoderPackageSubpathAlias = findAlias(
  (entry) => entry.find instanceof RegExp
    && entry.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Desktop host config must define a dedicated BirdCoder package-subpath alias.',
);
assert.equal(
  birdcoderPackageSubpathAlias.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src/$2'),
);

const birdcoderPackageRootAlias = findAlias(
  (entry) => entry.find instanceof RegExp && entry.find.test('@sdkwork/birdcoder-chat'),
  'Desktop host config must define a BirdCoder package-root alias.',
);
assert.equal(
  birdcoderPackageRootAlias.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src'),
);

const reactRouterDomAlias = findAlias(
  (entry) => entry.find === 'react-router-dom',
  'Desktop host config must resolve react-router-dom from the shared appbase workspace.',
);
assert.ok(
  normalizePath(reactRouterDomAlias.replacement).startsWith(normalizePath(appbaseWorkspaceRoot)),
  'Desktop host config must source react-router-dom from the shared appbase workspace root.',
);
assert.match(
  normalizePath(reactRouterDomAlias.replacement),
  /\/react-router-dom\/dist\/index\.mjs$/u,
  'Desktop host config must point react-router-dom at the ESM dist entry exported by the shared appbase workspace.',
);

const reactRouterDomExportAlias = findAlias(
  (entry) => entry.find === 'react-router/dom',
  'Desktop host config must resolve react-router/dom from the shared appbase workspace.',
);
assert.ok(
  normalizePath(reactRouterDomExportAlias.replacement).startsWith(normalizePath(appbaseWorkspaceRoot)),
  'Desktop host config must source react-router/dom from the shared appbase workspace root.',
);
assert.match(
  normalizePath(reactRouterDomExportAlias.replacement),
  /\/react-router\/dist\/development\/dom-export\.mjs$/u,
  'Desktop host config must point react-router/dom at the shared development DOM export entry.',
);

const reactRouterAlias = findAlias(
  (entry) => entry.find === 'react-router',
  'Desktop host config must resolve react-router from the shared appbase workspace.',
);
assert.ok(
  normalizePath(reactRouterAlias.replacement).startsWith(normalizePath(appbaseWorkspaceRoot)),
  'Desktop host config must source react-router from the shared appbase workspace root.',
);
assert.match(
  normalizePath(reactRouterAlias.replacement),
  /\/react-router\/dist\/development\/index\.mjs$/u,
  'Desktop host config must point react-router at the shared development index entry.',
);

const tempWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-appbase-router-alias-'));
try {
  const fixtureDesktopRootDir = path.join(
    tempWorkspaceRoot,
    'sdkwork-birdcoder',
    'packages',
    'sdkwork-birdcoder-desktop',
  );
  const fixtureAppbaseAuthNodeModulesDir = path.join(
    tempWorkspaceRoot,
    'sdkwork-appbase',
    'packages',
    'pc-react',
    'identity',
    'sdkwork-auth-pc-react',
    'node_modules',
  );

  fs.mkdirSync(path.join(fixtureDesktopRootDir, '..', '..', 'scripts', 'vite-shims'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDesktopRootDir, '..', '..', 'scripts', 'vite-shims', 'qrcode-compat.mjs'),
    'export default {};\n',
  );
  fs.writeFileSync(
    path.join(fixtureDesktopRootDir, '..', '..', 'scripts', 'vite-shims', 'cookie-compat.mjs'),
    'export default {};\n',
  );
  fs.writeFileSync(
    path.join(fixtureDesktopRootDir, '..', '..', 'scripts', 'vite-shims', 'set-cookie-parser-compat.mjs'),
    'export default {};\n',
  );
  const fixtureQrcodePackageRoot = path.join(
    fixtureDesktopRootDir,
    '..',
    '..',
    'node_modules',
    'qrcode',
  );
  fs.mkdirSync(path.join(fixtureQrcodePackageRoot, 'lib'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureQrcodePackageRoot, 'package.json'),
    JSON.stringify({ name: 'qrcode', version: '1.5.4' }, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(fixtureQrcodePackageRoot, 'lib', 'browser.js'),
    'module.exports = {};\n',
  );

  const routerPackages = [
    ['react-router-dom', ['dist', 'index.mjs']],
    ['react-router', ['dist', 'development', 'dom-export.mjs']],
    ['react-router', ['dist', 'development', 'index.mjs']],
  ];
  for (const [packageName, relativeEntryPath] of routerPackages) {
    const packageRoot = path.join(fixtureAppbaseAuthNodeModulesDir, packageName);
    fs.mkdirSync(path.join(packageRoot, ...relativeEntryPath.slice(0, -1)), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: packageName, version: '7.14.0' }, null, 2) + '\n',
    );
    fs.writeFileSync(path.join(packageRoot, ...relativeEntryPath), 'export {};\n');
  }

  const appbaseBridgeAliasEntries = createBirdcoderWorkspaceAliasEntries(fixtureDesktopRootDir);
  const appbaseBridgeRouterDomAlias = appbaseBridgeAliasEntries.find((entry) => entry.find === 'react-router-dom');
  assert.ok(
    appbaseBridgeRouterDomAlias,
    'git-backed release aliases must still resolve react-router-dom when sdkwork-appbase has no root install.',
  );
  assert.match(
    normalizePath(appbaseBridgeRouterDomAlias.replacement),
    /\/sdkwork-appbase\/packages\/pc-react\/identity\/sdkwork-auth-pc-react\/node_modules\/react-router-dom\/dist\/index\.mjs$/u,
    'git-backed release aliases must fall back to the managed appbase package dependency bridge for react-router-dom.',
  );
  const appbaseBridgeRouterAlias = appbaseBridgeAliasEntries.find((entry) => entry.find === 'react-router');
  assert.ok(
    appbaseBridgeRouterAlias,
    'git-backed release aliases must still resolve react-router when sdkwork-appbase has no root install.',
  );
  assert.match(
    normalizePath(appbaseBridgeRouterAlias.replacement),
    /\/sdkwork-appbase\/packages\/pc-react\/identity\/sdkwork-auth-pc-react\/node_modules\/react-router\/dist\/development\/index\.mjs$/u,
    'git-backed release aliases must fall back to the managed appbase package dependency bridge for react-router.',
  );
} finally {
  fs.rmSync(tempWorkspaceRoot, { recursive: true, force: true });
}

const terminalInfrastructureAlias = findAlias(
  (entry) => entry.find === '@sdkwork/terminal-infrastructure',
  'Desktop host config must keep the terminal infrastructure alias.',
);
assert.equal(
  terminalInfrastructureAlias.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts'),
);

const terminalDesktopAlias = findAlias(
  (entry) => entry.find === '@sdkwork/terminal-desktop',
  'Desktop host config must keep the terminal desktop alias.',
);
assert.equal(
  terminalDesktopAlias.replacement,
  path.resolve(desktopRootDir, '../../../sdkwork-terminal/apps/desktop/src/index.ts'),
);

const terminalPackageSubpathAlias = findAlias(
  (entry) => entry.find instanceof RegExp
    && entry.find.test('@sdkwork/terminal-core/runtime/session'),
  'Desktop host config must keep the terminal package-subpath alias.',
);
assert.equal(
  terminalPackageSubpathAlias.replacement,
  path.resolve(desktopRootDir, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src/$2'),
);

const terminalPackageRootAlias = findAlias(
  (entry) => entry.find instanceof RegExp && entry.find.test('@sdkwork/terminal-core'),
  'Desktop host config must keep the terminal package-root alias.',
);
assert.equal(
  terminalPackageRootAlias.replacement,
  path.resolve(desktopRootDir, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src'),
);
assert.notEqual(
  birdcoderPackageSubpathAlias.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src'),
  'Desktop host config must keep a dedicated package-subpath alias before the package-root alias.',
);
assert.equal(config.server.host, '127.0.0.1');
assert.equal(config.server.port, 1520);
assert.equal(config.server.strictPort, true);
assert.equal(config.server.hmr, false);
assert.deepEqual(config.server.fs.allow, [
  path.resolve(desktopRootDir, '../..'),
  path.resolve(rootDir, '..', 'sdkwork-appbase'),
  path.resolve(rootDir, '..', 'sdkwork-core'),
  path.resolve(rootDir, '..', 'sdkwork-ui'),
  path.resolve(rootDir, '..', 'sdkwork-terminal'),
  path.resolve(rootDir, '..', '..', 'spring-ai-plus-app-api'),
  path.resolve(rootDir, '..', '..', 'sdk'),
]);

const uiRequire = createRequire(path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json'));
const rootRequire = createRequire(path.join(rootDir, 'package.json'));
const lucideEntryPath = rootRequire.resolve('lucide-react');
const lucidePackageDir = path.resolve(path.dirname(lucideEntryPath), '..');
const defaultLucideProbePath = `http://127.0.0.1:1520/@fs/${path
  .join(lucidePackageDir, 'esm', 'Icon.js')
  .replace(/\\/g, '/')}`;
const defaultTerminalInfrastructureProbePath = `http://127.0.0.1:1520/@fs/${path
  .resolve(rootDir, '..', 'sdkwork-terminal', 'packages', 'sdkwork-terminal-infrastructure', 'src', 'index.ts')
  .replace(/\\/g, '/')}`;
const defaultBirdcoderTerminalRuntimeProbePath = `http://127.0.0.1:1520/@fs/${path
  .resolve(resolveBirdcoderTerminalInfrastructureRuntimePath(desktopRootDir))
  .replace(/\\/g, '/')}`;
const defaultUnifiedProbePath = `http://127.0.0.1:1520/@fs/${path
  .join(path.dirname(uiRequire.resolve('unified')), 'lib', 'index.js')
  .replace(/\\/g, '/')}`;
const desktopViteHostSource = readFileSync(
  path.join(rootDir, 'scripts', 'run-desktop-vite-host.mjs'),
  'utf8',
);

assert.equal(
  resolveBirdcoderTerminalInfrastructureRuntimePath(desktopRootDir),
  path.resolve(
    desktopRootDir,
    '../sdkwork-birdcoder-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
  ),
  'Shared terminal path resolver must return the canonical BirdCoder terminal runtime entry path.',
);
assert.equal(
  resolveSdkworkTerminalInfrastructureEntryPath(desktopRootDir),
  path.resolve(
    desktopRootDir,
    '../../../sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts',
  ),
  'Shared terminal path resolver must return the canonical sdkwork-terminal infrastructure entry path.',
);
assert.match(
  desktopViteHostSource,
  /resolveBirdcoderTerminalInfrastructureRuntimePath/u,
  'Desktop host reuse logic must import the shared BirdCoder terminal runtime path resolver instead of hardcoding the runtime entry path.',
);
assert.match(
  desktopViteHostSource,
  /resolveSdkworkTerminalInfrastructureEntryPath/u,
  'Desktop host reuse logic must import the shared sdkwork-terminal infrastructure path resolver instead of hardcoding the upstream entry path.',
);

const compatibleFetchLog = [];
const compatibilityProbes = [
  { path: '/src/main.tsx', incompatiblePatterns: ['Internal Server Error'] },
  {
    path: '/@fs/mock/birdcoder-terminal-runtime/src/index.ts',
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import'],
  },
  {
    path: '/@fs/mock/lucide-react/dist/esm/Icon.js',
    incompatiblePatterns: ['/react/index.js', '_container'],
  },
  { path: '/@fs/mock/html-parse-stringify.module.js', incompatiblePatterns: ['/@fs/mock/void-elements/index.js'] },
  { path: '/@fs/mock/hast-util-to-jsx-runtime/lib/index.js', incompatiblePatterns: ['/@fs/mock/style-to-js/cjs/index.js'] },
  {
    path: '/@fs/mock/react-syntax-highlighter/dist/esm/languages/hljs/vue.js',
    incompatiblePatterns: ['/@fs/mock/highlight.js/lib/index.js'],
  },
  {
    path: '/@fs/mock/micromark/lib/create-tokenizer.js',
    incompatiblePatterns: ['/@fs/mock/debug/src/browser.js'],
  },
  {
    path: '/@fs/mock/sdkwork-terminal-infrastructure/src/index.ts',
    incompatiblePatterns: [
      '/@fs/mock/@xterm/xterm/lib/xterm.js',
      '/@fs/mock/@xterm/addon-fit/lib/addon-fit.js',
    ],
  },
];

const defaultProbeFetchLog = [];
assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => {
      defaultProbeFetchLog.push(url);
      return {
        status: 200,
        async text() {
          return 'export default { ok: true };';
        },
      };
    },
  }),
  true,
  'Desktop host reuse check should accept a host when all default compatibility probes succeed.',
);
assert.ok(
  defaultProbeFetchLog.includes(defaultLucideProbePath),
  'Desktop host reuse check must probe lucide-react Icon.js so hosts that still leak the raw React CommonJS entry are rejected before reuse.',
);
assert.ok(
  defaultProbeFetchLog.includes(defaultUnifiedProbePath),
  'Desktop host reuse check must probe unified/lib/index.js so hosts that still leak the raw extend CommonJS entry are rejected before reuse.',
);
assert.ok(
  defaultProbeFetchLog.includes(defaultBirdcoderTerminalRuntimeProbePath),
  'Desktop host reuse check must probe the BirdCoder terminal runtime entry so hosts that fail to transform the local terminal integration layer are rejected before reuse.',
);
assert.ok(
  defaultProbeFetchLog.includes(defaultTerminalInfrastructureProbePath),
  'Desktop host reuse check must probe sdkwork-terminal infrastructure so hosts that still leak raw xterm CommonJS entries are rejected before reuse.',
);

const compatibleFetch = async (url) => {
  compatibleFetchLog.push(url);
  if (url.endsWith('/src/main.tsx')) {
    return {
      status: 200,
      async text() {
        return 'export const main = true;';
      },
    };
  }

  return {
    status: 200,
    async text() {
      return 'export default { area: true };';
    },
  };
};

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: compatibleFetch,
    probes: compatibilityProbes,
  }),
  true,
  'Desktop host reuse check should accept a host when all compatibility probes succeed.',
);

assert.deepEqual(
  compatibleFetchLog,
  [
    'http://127.0.0.1:1520/src/main.tsx',
    'http://127.0.0.1:1520/@fs/mock/birdcoder-terminal-runtime/src/index.ts',
    'http://127.0.0.1:1520/@fs/mock/lucide-react/dist/esm/Icon.js',
    'http://127.0.0.1:1520/@fs/mock/html-parse-stringify.module.js',
    'http://127.0.0.1:1520/@fs/mock/hast-util-to-jsx-runtime/lib/index.js',
    'http://127.0.0.1:1520/@fs/mock/react-syntax-highlighter/dist/esm/languages/hljs/vue.js',
    'http://127.0.0.1:1520/@fs/mock/micromark/lib/create-tokenizer.js',
    'http://127.0.0.1:1520/@fs/mock/sdkwork-terminal-infrastructure/src/index.ts',
  ],
  'Desktop host reuse check should probe the startup entry and each dependency compatibility path before reusing an existing host.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/lucide-react/dist/esm/Icon.js')) {
          return 'import { createElement } from "/@fs/mock/react/index.js"; export { createElement };';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose lucide-react transform still leaks the raw React CommonJS entry.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/birdcoder-terminal-runtime/src/index.ts')) {
          return 'Internal Server Error: Failed to resolve import "./terminalRuntimeSanitization.ts"';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose BirdCoder terminal runtime entry fails to resolve its local sanitization dependency.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/lucide-react/dist/esm/Icon.js')) {
          return 'export const _container = true;';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose lucide-react transform still leaks an invalid plugin-container marker.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        return url.endsWith('/src/main.tsx')
          ? 'export const main = true;'
          : 'import e from "/@fs/mock/void-elements/index.js"; export default e;';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose html-parse-stringify transform still leaks the raw void-elements CommonJS entry.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/hast-util-to-jsx-runtime/lib/index.js')) {
          return 'import styleToJs from "/@fs/mock/style-to-js/cjs/index.js"; export default styleToJs;';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose hast-util-to-jsx-runtime transform still leaks the raw style-to-js CommonJS entry.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/react-syntax-highlighter/dist/esm/languages/hljs/vue.js')) {
          return 'import hljs from "/@fs/mock/highlight.js/lib/index.js"; export default hljs;';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose react-syntax-highlighter transform still leaks the raw highlight.js CommonJS entry.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/micromark/lib/create-tokenizer.js')) {
          return 'import createDebug from "/@fs/mock/debug/src/browser.js"; export { createDebug };';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose micromark transform still leaks the raw debug browser CommonJS entry.',
);

assert.equal(
  await isCompatibleRunningDesktopHost({
    host: '127.0.0.1',
    port: 1520,
    fetchImpl: async (url) => ({
      status: 200,
      async text() {
        if (url.endsWith('/src/main.tsx')) {
          return 'export const main = true;';
        }

        if (url.endsWith('/@fs/mock/sdkwork-terminal-infrastructure/src/index.ts')) {
          return 'const Terminal = () => import("/@fs/mock/@xterm/xterm/lib/xterm.js"); export { Terminal };';
        }

        return 'export default { area: true };';
      },
    }),
    probes: compatibilityProbes,
  }),
  false,
  'Desktop host reuse check must reject a host whose sdkwork-terminal infrastructure transform still leaks the raw xterm CommonJS entry.',
);

const retryableProbeError = new TypeError('fetch failed');
retryableProbeError.cause = Object.assign(new Error('read ECONNRESET'), {
  code: 'ECONNRESET',
});

let retryableProbeAttempts = 0;
const retriedProbeResult = await fetchDesktopCompatibilityProbe('http://127.0.0.1:1520/@id/mock-probe', {
  fetchImpl: async (_url, init) => {
    retryableProbeAttempts += 1;
    assert.ok(init?.signal instanceof AbortSignal, 'Desktop compatibility probe fetches must still enforce a timeout while retrying.');

    if (retryableProbeAttempts === 1) {
      throw retryableProbeError;
    }

    return {
      status: 200,
      async text() {
        return 'export default { recovered: true };';
      },
    };
  },
  maxAttempts: 2,
  timeoutMs: 3000,
});

assert.equal(
  retriedProbeResult.response.status,
  200,
  'Desktop compatibility probe fetches should return the eventual successful response after a single retryable connection reset.',
);
assert.equal(
  retriedProbeResult.source,
  'export default { recovered: true };',
  'Desktop compatibility probe fetches should preserve the response body from the retry that succeeds.',
);
assert.equal(
  retryableProbeAttempts,
  2,
  'Desktop compatibility probe fetches should retry exactly once when the dev server resets the connection with ECONNRESET.',
);

const retryableTimeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
const retryableFollowupResetError = new TypeError('fetch failed');
retryableFollowupResetError.cause = Object.assign(new Error('read ECONNRESET'), {
  code: 'ECONNRESET',
});

let mixedRetryableProbeAttempts = 0;
const mixedRetryableProbeResult = await fetchDesktopCompatibilityProbe('http://127.0.0.1:1520/@id/mock-probe', {
  fetchImpl: async () => {
    mixedRetryableProbeAttempts += 1;

    if (mixedRetryableProbeAttempts === 1) {
      throw retryableTimeoutError;
    }

    if (mixedRetryableProbeAttempts === 2) {
      throw retryableFollowupResetError;
    }

    return {
      status: 200,
      async text() {
        return 'export default { warmedUp: true };';
      },
    };
  },
  maxAttempts: 3,
  timeoutMs: 3000,
});

assert.equal(
  mixedRetryableProbeResult.source,
  'export default { warmedUp: true };',
  'Desktop compatibility probe fetches should recover from a cold-start timeout followed by a connection reset when the next retry succeeds.',
);
assert.equal(
  mixedRetryableProbeAttempts,
  3,
  'Desktop compatibility probe fetches should allow a timeout retry and a follow-up ECONNRESET retry before surfacing failure.',
);

let nonRetryableProbeAttempts = 0;
await assert.rejects(
  () => fetchDesktopCompatibilityProbe('http://127.0.0.1:1520/@id/mock-probe', {
    fetchImpl: async () => {
      nonRetryableProbeAttempts += 1;
      throw new Error('boom');
    },
    maxAttempts: 2,
    timeoutMs: 3000,
  }),
  /boom/u,
  'Desktop compatibility probe fetches should still fail fast for non-retryable errors.',
);
assert.equal(
  nonRetryableProbeAttempts,
  1,
  'Desktop compatibility probe fetches must not retry errors that are not explicit connection resets.',
);

console.log('desktop vite host contract passed.');
