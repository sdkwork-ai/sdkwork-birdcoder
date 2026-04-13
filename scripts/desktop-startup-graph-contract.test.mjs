import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { stripVTControlCharacters } from 'node:util';
import { pathToFileURL } from 'node:url';

import { createDesktopConfiguredViteServer } from './desktop-standard-vite-server.mjs';

const rootDir = process.cwd();
const desktopRootDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const desktopRequire = createRequire(path.join(desktopRootDir, 'package.json'));
const { createLogger } = await import(pathToFileURL(desktopRequire.resolve('vite')).href);
const host = '127.0.0.1';
let activePort = 0;

function getServerOrigin() {
  assert.ok(activePort > 0, 'Desktop startup graph contract must resolve a live loopback port before collecting imports.');
  return `http://${host}:${activePort}`;
}

function resolveListeningPort(server) {
  const address = server.httpServer?.address();
  assert.ok(address && typeof address === 'object' && typeof address.port === 'number' && address.port > 0, 'Desktop startup graph contract must listen on a concrete loopback port.');
  return address.port;
}

const viteErrors = [];
const baseLogger = createLogger('info', {
  allowClearScreen: false,
});

const customLogger = {
  ...baseLogger,
  error(message, options) {
    viteErrors.push(stripVTControlCharacters(String(message ?? '')).trim());
    return baseLogger.error(message, options);
  },
};

function normalizeRequestPath(specifier, importerPath) {
  if (!specifier || specifier.startsWith('data:') || specifier.startsWith('http://') || specifier.startsWith('https://')) {
    return null;
  }

  if (specifier.startsWith('/')) {
    return specifier;
  }

  if (!importerPath) {
    return specifier;
  }

  const importerUrl = new URL(`${getServerOrigin()}${importerPath}`);
  const resolvedUrl = new URL(specifier, importerUrl);

  return `${resolvedUrl.pathname}${resolvedUrl.search}`;
}

function collectImports(code, importerPath) {
  const imports = new Set();
  const patterns = [
    /import\s+(?:[^'"()]+?\s+from\s+)?["']([^"']+)["']/g,
    /export\s+(?:[^'"()]+?\s+from\s+)?["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const normalizedPath = normalizeRequestPath(match[1], importerPath);
      if (normalizedPath) {
        imports.add(normalizedPath);
      }
    }
  }

  return [...imports];
}

const server = await createDesktopConfiguredViteServer({
  host,
  port: 0,
  strictPort: false,
  mode: 'development',
  customLogger,
});

const queue = ['/', '/src/main.tsx'];
const visited = new Set();
const failures = [];

try {
  await server.listen();
  activePort = resolveListeningPort(server);

  while (queue.length > 0 && visited.size < 250) {
    const requestPath = queue.shift();
    if (!requestPath || visited.has(requestPath)) {
      continue;
    }

    visited.add(requestPath);

    const response = await fetch(`${getServerOrigin()}${requestPath}`);
    const source = await response.text();

    if (response.status !== 200) {
      failures.push({
        path: requestPath,
        status: response.status,
        snippet: source.slice(0, 500),
      });
      continue;
    }

    if ((source.includes('<title>Error</title>') || source.includes('Internal Server Error')) && source.includes('<!DOCTYPE html>')) {
      failures.push({
        path: requestPath,
        status: response.status,
        snippet: source.slice(0, 500),
      });
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !contentType.includes('javascript') &&
      !requestPath.endsWith('.ts') &&
      !requestPath.endsWith('.tsx') &&
      !requestPath.includes('/@fs/') &&
      !requestPath.includes('/@id/')
    ) {
      continue;
    }

    for (const dependencyPath of collectImports(source, requestPath)) {
      if (!visited.has(dependencyPath)) {
        queue.push(dependencyPath);
      }
    }
  }
} finally {
  await server.close();
}

assert.deepEqual(
  failures,
  [],
  `Desktop startup module graph must load without Vite transform errors. Failures:\n${JSON.stringify(failures, null, 2)}`,
);

assert.deepEqual(
  viteErrors.filter((message) => message.length > 0),
  [],
  `Desktop startup module graph must not emit Vite logger errors during module traversal. Errors:\n${viteErrors.join('\n\n')}`,
);

console.log(`desktop startup graph contract passed for ${visited.size} requested modules.`);
