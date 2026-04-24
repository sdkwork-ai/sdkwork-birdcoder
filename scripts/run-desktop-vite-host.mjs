#!/usr/bin/env node

import './vite-windows-realpath-patch.mjs';

import path from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDesktopVitePlugins } from '../packages/sdkwork-birdcoder-desktop/vite/createDesktopVitePlugins.mjs';
import {
  BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE,
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  resolveBirdcoderTerminalInfrastructureRuntimePath,
  resolveSdkworkTerminalInfrastructureEntryPath,
} from './create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const desktopRootDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-desktop');
const desktopRequire = createRequire(path.join(desktopRootDir, 'package.json'));
const rootRequire = createRequire(path.join(workspaceRootDir, 'package.json'));
const uiRequire = createRequire(path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-ui', 'package.json'));
const lucideEntryPath = rootRequire.resolve('lucide-react');
const lucidePackageDir = path.resolve(path.dirname(lucideEntryPath), '..');
const lucideIconRequestPath = `/@fs/${path.join(lucidePackageDir, 'esm', 'Icon.js').replace(/\\/g, '/')}`;
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
const birdcoderTerminalRuntimeRequestPath = `/@fs/${path
  .resolve(resolveBirdcoderTerminalInfrastructureRuntimePath(desktopRootDir))
  .replace(/\\/g, '/')}`;
const terminalInfrastructureRequestPath = `/@fs/${path
  .resolve(resolveSdkworkTerminalInfrastructureEntryPath(desktopRootDir))
  .replace(/\\/g, '/')}`;
const rawXtermRequestPaths = [
  `/@fs/${desktopRequire.resolve('@xterm/xterm').replace(/\\/g, '/')}`,
  `/@fs/${desktopRequire.resolve('@xterm/addon-canvas').replace(/\\/g, '/')}`,
  `/@fs/${desktopRequire.resolve('@xterm/addon-fit').replace(/\\/g, '/')}`,
  `/@fs/${desktopRequire.resolve('@xterm/addon-search').replace(/\\/g, '/')}`,
  `/@fs/${desktopRequire.resolve('@xterm/addon-unicode11').replace(/\\/g, '/')}`,
];
const desktopHostCompatibilityProbes = [
  {
    path: '/src/main.tsx',
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import'],
  },
  {
    path: birdcoderTerminalRuntimeRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import'],
  },
  {
    path: lucideIconRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', '/react/index.js', '_container'],
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
  {
    path: terminalInfrastructureRequestPath,
    incompatiblePatterns: ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', ...rawXtermRequestPaths],
  },
];

async function importDesktopDependency(specifier) {
  return import(pathToFileURL(desktopRequire.resolve(specifier)).href);
}

function isCompatibleProbeSource(source, incompatiblePatterns) {
  return incompatiblePatterns.every((pattern) => !String(source).includes(pattern));
}

function isRetryableDesktopProbeError(error) {
  const errorCode = String(error?.code ?? '').trim();
  const causeCode = String(error?.cause?.code ?? '').trim();
  const errorName = String(error?.name ?? '').trim();
  const causeName = String(error?.cause?.name ?? '').trim();
  const errorMessage = String(error?.message ?? '').trim();
  const causeMessage = String(error?.cause?.message ?? '').trim();

  return errorCode === 'ECONNRESET'
    || causeCode === 'ECONNRESET'
    || errorName === 'TimeoutError'
    || causeName === 'TimeoutError'
    || errorMessage.includes('ECONNRESET')
    || causeMessage.includes('ECONNRESET')
    || errorMessage.includes('aborted due to timeout')
    || causeMessage.includes('aborted due to timeout');
}

async function fetchDesktopCompatibilityProbe(
  url,
  {
    fetchImpl = fetch,
    maxAttempts = 3,
    timeoutMs = 10000,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      const source = await response.text();

      return {
        response,
        source,
      };
    } catch (error) {
      lastError = error;

      if (!isRetryableDesktopProbeError(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Desktop compatibility probe failed without an explicit error for ${url}.`);
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
      const { response, source } = await fetchDesktopCompatibilityProbe(`http://${host}:${port}${probe.path}`, {
        fetchImpl,
        maxAttempts: 3,
        timeoutMs: 10000,
      });

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
      include: [...BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE],
    },
    resolve: {
      dedupe: [...BIRDCODER_VITE_DEDUPE_PACKAGES],
      alias: createBirdcoderWorkspaceAliasEntries(resolvedDesktopRootDir),
    },
    server: {
      host,
      port,
      strictPort,
      hmr: env.DISABLE_HMR !== 'true',
      fs: {
        allow: createBirdcoderWorkspaceFsAllowList(resolvedDesktopRootDir),
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

export {
  createDesktopViteServerConfig,
  fetchDesktopCompatibilityProbe,
  isCompatibleRunningDesktopHost,
  parseArgs,
  runDesktopViteHost,
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runDesktopViteHost().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
