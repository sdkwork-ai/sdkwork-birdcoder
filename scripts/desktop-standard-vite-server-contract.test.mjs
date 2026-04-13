import assert from 'node:assert/strict';
import path from 'node:path';

import {
  createDesktopConfiguredViteServer,
  desktopRootDir,
  desktopViteConfigPath,
} from './desktop-standard-vite-server.mjs';

const server = await createDesktopConfiguredViteServer({
  port: 1536,
  mode: 'development',
});

try {
  assert.equal(path.normalize(server.config.root), path.normalize(desktopRootDir));
  assert.equal(server.config.inlineConfig.configFile, desktopViteConfigPath);
  assert.equal(server.config.inlineConfig.configLoader, 'native');
  assert.equal(server.config.server.port, 1536);
  assert.equal(server.config.mode, 'development');
  assert.match(
    server.config.plugins.map((plugin) => plugin.name).join('\n'),
    /sdkwork-birdcoder-desktop-cjs-default-compat/u,
    'Desktop standard Vite test server must load the desktop CommonJS default compatibility plugin through vite.config.ts.',
  );
  assert.equal(
    path.basename(server.config.inlineConfig.configFile),
    'vite.config.ts',
    'Desktop standard Vite test server must load the desktop package Vite config file.',
  );
} finally {
  await server.close();
}

console.log('desktop standard vite server contract passed.');
