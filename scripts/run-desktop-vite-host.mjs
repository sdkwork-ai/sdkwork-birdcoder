#!/usr/bin/env node

import './vite-windows-realpath-patch.mjs';

import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDesktopVitePlugins } from '../packages/sdkwork-birdcoder-desktop/vite/createDesktopVitePlugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const desktopRootDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-desktop');
const desktopRequire = createRequire(path.join(desktopRootDir, 'package.json'));
const uiRequire = createRequire(path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json'));
const desktopDedupePackages = ['react', 'react-dom', 'react-i18next', 'scheduler', 'use-sync-external-store'];
const rawVoidElementsRequestPath = `/@fs/${desktopRequire.resolve('void-elements').replace(/\\/g, '/')}`;
const htmlParseStringifyRequestPath = `/@fs/${desktopRequire.resolve('html-parse-stringify/dist/html-parse-stringify.module.js').replace(/\\/g, '/')}`;
const rawStyleToJsRequestPath = `/@fs/${uiRequire.resolve('style-to-js').replace(/\\/g, '/')}`;
const hastUtilToJsxRuntimeRequestPath = `/@fs/${path.join(path.dirname(uiRequire.resolve('hast-util-to-jsx-runtime')), 'index.js').replace(/\\/g, '/')}`;
const rawHighlightJsRequestPath = `/@fs/${uiRequire.resolve('highlight.js').replace(/\\/g, '/')}`;
const reactSyntaxHighlighterVueRequestPath = `/@fs/${path
  .join(path.resolve(path.dirname(uiRequire.resolve('react-syntax-highlighter')), '..', '..'), 'dist', 'esm', 'languages', 'hljs', 'vue.js')
  .replace(/\\/g, '/')}`;
const micromarkCreateTokenizerRequestPath = `/@fs/${path.join(path.dirname(uiRequire.resolve('micromark')), 'lib', 'create-tokenizer.js').replace(/\\/g, '/')}`;
const rawDebugBrowserRequestPath = `/@fs/${path
  .join(path.dirname(uiRequire.resolve('micromark')), '..', 'debug', 'src', 'browser.js')
  .replace(/\\/g, '/')}`;
const unifiedLibIndexRequestPath = `/@fs/${path
  .join(path.dirname(uiRequire.resolve('unified')), 'lib', 'index.js')
  .replace(/\\/g, '/')}`;
const rawExtendRequestPath = `/@fs/${uiRequire.resolve('extend').replace(/\\/g, '/')}`;
const desktopHostCompatibilityProbes = [
  {
    path: '/src/main.tsx',
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import'],
  },
  {
    path: htmlParseStringifyRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', rawVoidElementsRequestPath],
  },
  {
    path: hastUtilToJsxRuntimeRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', rawStyleToJsRequestPath],
  },
  {
    path: reactSyntaxHighlighterVueRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', rawHighlightJsRequestPath],
  },
  {
    path: micromarkCreateTokenizerRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', rawDebugBrowserRequestPath],
  },
  {
    path: unifiedLibIndexRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', rawExtendRequestPath],
  },
];

async function importDesktopDependency(specifier) {
  return import(pathToFileURL(desktopRequire.resolve(specifier)).href);
}

function isCompatibleProbeSource(source, incompatiblePatterns) {
  return incompatiblePatterns.every((pattern) => !String(source).includes(pattern));
}

async function isCompatibleRunningDesktopHost({
  host = '127.0.0.1',
  port,
  fetchImpl = fetch,
  probes = desktopHostCompatibilityProbes,
} = {}) {
  if (!port) {
    return false;
  }

  try {
    for (const probe of probes) {
      const response = await fetchImpl(`http://${host}:${port}${probe.path}`, {
        signal: AbortSignal.timeout(3000),
      });
      const source = await response.text();

      if (response.status !== 200 || !isCompatibleProbeSource(source, probe.incompatiblePatterns)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function parseArgs(argv) {
  const options = {
    host: undefined,
    port: undefined,
    strictPort: false,
    mode: 'development',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] ?? '').trim();
    if (!token || token === 'serve') {
      continue;
    }

    if (token === '--host') {
      options.host = readOptionValue(argv, index, '--host');
      index += 1;
      continue;
    }

    if (token === '--port') {
      options.port = Number(readOptionValue(argv, index, '--port'));
      index += 1;
      continue;
    }

    if (token === '--mode') {
      options.mode = readOptionValue(argv, index, '--mode');
      index += 1;
      continue;
    }

    if (token === '--strictPort') {
      options.strictPort = true;
      continue;
    }
  }

  return options;
}

function createDesktopViteServerConfig({
  argv = [],
  env = process.env,
  desktopRootDir: resolvedDesktopRootDir = desktopRootDir,
  mode: explicitMode,
  plugins = [],
} = {}) {
  const { host, port, strictPort, mode } = parseArgs(argv);
  const resolvedMode = explicitMode ?? mode;

  return {
    configFile: false,
    root: resolvedDesktopRootDir,
    mode: resolvedMode,
    base: './',
    esbuild: false,
    plugins,
    optimizeDeps: {
      noDiscovery: true,
      include: [],
    },
    resolve: {
      dedupe: [...desktopDedupePackages],
      alias: [
        {
          find: /^@sdkwork\/birdcoder-([^/]+)$/u,
          replacement: path.resolve(resolvedDesktopRootDir, '../sdkwork-birdcoder-$1/src'),
        },
        {
          find: /^sdkwork-birdcoder-([^/]+)$/u,
          replacement: path.resolve(resolvedDesktopRootDir, '../sdkwork-birdcoder-$1/src'),
        },
      ],
    },
    server: {
      host,
      port,
      strictPort,
      hmr: env.DISABLE_HMR !== 'true',
      fs: {
        allow: [path.resolve(resolvedDesktopRootDir, '../..')],
      },
    },
  };
}

async function runDesktopViteHost(argv = process.argv.slice(2)) {
  const [{ createServer }] = await Promise.all([
    importDesktopDependency('vite'),
  ]);
  const { mode } = parseArgs(argv);

  const server = await createServer(
    createDesktopViteServerConfig({
      argv,
      env: process.env,
      desktopRootDir,
      mode,
      plugins: createDesktopVitePlugins({
        desktopRootDir,
        mode,
      }),
    }),
  );

  const shutdown = async (exitCode = 0) => {
    await server.close();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    void shutdown(0);
  });
  process.on('SIGTERM', () => {
    void shutdown(0);
  });

  try {
    await server.listen();
    server.printUrls();
  } catch (error) {
    const reuseExistingHost = await isCompatibleRunningDesktopHost({
      host: parseArgs(argv).host ?? '127.0.0.1',
      port: parseArgs(argv).port,
    });

    if (!reuseExistingHost) {
      throw error;
    }

    await server.close();
    console.log(
      `[run-desktop-vite-host] reusing existing desktop host on http://${parseArgs(argv).host ?? '127.0.0.1'}:${parseArgs(argv).port}`,
    );
  }

  await new Promise(() => {});
}

export { createDesktopViteServerConfig, isCompatibleRunningDesktopHost, parseArgs, runDesktopViteHost };

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runDesktopViteHost().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
