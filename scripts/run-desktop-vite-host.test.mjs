import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  createDesktopViteServerConfig,
  fetchDesktopCompatibilityProbe,
  isCompatibleRunningDesktopHost,
  parseArgs,
} from './run-desktop-vite-host.mjs';

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

const desktopRootDir = path.join('C:', 'repo', 'packages', 'sdkwork-birdcoder-desktop');
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
assert.deepEqual(config.optimizeDeps.include, ['@xterm/addon-unicode11']);
assert.deepEqual(config.resolve.dedupe, ['react', 'react-dom', 'react-i18next', 'scheduler', 'use-sync-external-store']);
assert.equal('preserveSymlinks' in config.resolve, false);
assert.equal(config.resolve.alias[0]?.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'), true);
assert.equal(
  config.resolve.alias[0]?.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src/$2'),
);
assert.equal(config.resolve.alias[1]?.find.test('@sdkwork/birdcoder-chat'), true);
assert.equal(
  config.resolve.alias[1]?.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src'),
);
assert.equal(config.resolve.alias[2]?.find.test('@sdkwork/terminal-core/runtime/session'), true);
assert.equal(
  config.resolve.alias[2]?.replacement,
  path.resolve(desktopRootDir, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src/$2'),
);
assert.equal(config.resolve.alias[3]?.find.test('@sdkwork/terminal-core'), true);
assert.equal(
  config.resolve.alias[3]?.replacement,
  path.resolve(desktopRootDir, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src'),
);
assert.equal(config.resolve.alias[4]?.find.test('@xterm/xterm'), true);
assert.equal(
  config.resolve.alias[4]?.replacement,
  path.resolve(desktopRootDir, '../../node_modules/@xterm/$1'),
);
assert.notEqual(
  config.resolve.alias[0]?.replacement,
  path.resolve(desktopRootDir, '../sdkwork-birdcoder-$1/src'),
  'Desktop host config must keep a dedicated package-subpath alias before the package-root alias.',
);
assert.equal(config.server.host, '127.0.0.1');
assert.equal(config.server.port, 1520);
assert.equal(config.server.strictPort, true);
assert.equal(config.server.hmr, false);
assert.deepEqual(config.server.fs.allow, [
  path.resolve(desktopRootDir, '../..'),
  path.join('C:', 'sdkwork-terminal'),
]);

const rootDir = process.cwd();
const uiRequire = createRequire(path.join(rootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json'));
const rootRequire = createRequire(path.join(rootDir, 'package.json'));
const lucideEntryPath = rootRequire.resolve('lucide-react');
const lucidePackageDir = path.resolve(path.dirname(lucideEntryPath), '..');
const defaultLucideProbePath = `http://127.0.0.1:1520/@fs/${path
  .join(lucidePackageDir, 'esm', 'Icon.js')
  .replace(/\\/g, '/')}`;
const defaultUnifiedProbePath = `http://127.0.0.1:1520/@fs/${path
  .join(path.dirname(uiRequire.resolve('unified')), 'lib', 'index.js')
  .replace(/\\/g, '/')}`;

const compatibleFetchLog = [];
const compatibilityProbes = [
  { path: '/src/main.tsx', incompatiblePatterns: ['Internal Server Error'] },
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
    'http://127.0.0.1:1520/@fs/mock/lucide-react/dist/esm/Icon.js',
    'http://127.0.0.1:1520/@fs/mock/html-parse-stringify.module.js',
    'http://127.0.0.1:1520/@fs/mock/hast-util-to-jsx-runtime/lib/index.js',
    'http://127.0.0.1:1520/@fs/mock/react-syntax-highlighter/dist/esm/languages/hljs/vue.js',
    'http://127.0.0.1:1520/@fs/mock/micromark/lib/create-tokenizer.js',
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
