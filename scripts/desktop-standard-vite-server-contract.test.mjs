import assert from 'node:assert/strict';
import path from 'node:path';

import {
  createDesktopConfiguredViteServer,
  desktopRootDir,
} from './desktop-standard-vite-server.mjs';

const server = await createDesktopConfiguredViteServer({
  port: 1536,
  mode: 'development',
});

try {
  assert.equal(path.normalize(server.config.root), path.normalize(desktopRootDir));
  assert.equal(
    server.config.inlineConfig.configFile,
    false,
    'Desktop standard Vite test server must use the shared programmatic config path instead of reloading vite.config.ts independently.',
  );
  assert.equal(server.config.server.port, 1536);
  assert.equal(server.config.mode, 'development');
  assert.match(
    server.config.plugins.map((plugin) => plugin.name).join('\n'),
    /sdkwork-birdcoder-desktop-cjs-default-compat/u,
    'Desktop standard Vite test server must load the desktop CommonJS default compatibility plugin through the shared desktop Vite config builder.',
  );
  assert.deepEqual(
    server.config.resolve.alias.slice(0, 4).map((entry) => entry.find.toString()),
    [
      '/^@sdkwork\\/birdcoder-([^/]+)\\/(.+)$/u',
      '/^@sdkwork\\/birdcoder-([^/]+)$/u',
      '/^@sdkwork\\/terminal-([^/]+)\\/(.+)$/u',
      '/^@sdkwork\\/terminal-([^/]+)$/u',
    ],
    'Desktop standard Vite test server must share the same package-root and package-subpath alias ordering as the desktop host server.',
  );
} finally {
  await server.close();
}

console.log('desktop standard vite server contract passed.');
