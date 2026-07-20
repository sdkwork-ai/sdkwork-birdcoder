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
    /sdkwork-birdcoder-pc-desktop-cjs-default-compat/u,
    'Desktop standard Vite test server must load the desktop CommonJS default compatibility plugin through the shared desktop Vite config builder.',
  );

  const aliasFinders = server.config.resolve.alias.map((entry) => entry.find.toString());
  const birdcoderPackageSubpathAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/birdcoder-([^/]+)\\/(.+)$/u');
  const birdcoderPackageRootAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/birdcoder-([^/]+)$/u');
  const terminalDesktopAliasIndex = aliasFinders.indexOf('@sdkwork/terminal-pc-desktop');
  const terminalPackageRootAliasIndex = aliasFinders.indexOf('@sdkwork/terminal-pc-core');

  assert.notEqual(
    aliasFinders.indexOf('/^qrcode$/u'),
    -1,
    'Desktop standard Vite test server must include the shared qrcode browser compatibility alias.',
  );
  assert.notEqual(
    aliasFinders.indexOf('react-router-dom'),
    -1,
    'Desktop standard Vite test server must include the shared react-router-dom compatibility alias.',
  );
  assert.notEqual(
    aliasFinders.indexOf('react-router/dom'),
    -1,
    'Desktop standard Vite test server must include the shared react-router/dom compatibility alias.',
  );
  assert.notEqual(
    aliasFinders.indexOf('react-router'),
    -1,
    'Desktop standard Vite test server must include the shared react-router compatibility alias.',
  );
  assert.equal(
    birdcoderPackageSubpathAliasIndex,
    -1,
    'Desktop standard Vite test server must resolve BirdCoder package subpaths through package exports.',
  );
  assert.equal(
    birdcoderPackageRootAliasIndex,
    -1,
    'Desktop standard Vite test server must resolve BirdCoder package roots through package exports.',
  );
  assert.notEqual(
    terminalDesktopAliasIndex,
    -1,
    'Desktop standard Vite test server must include the terminal desktop alias.',
  );
  assert.notEqual(
    terminalPackageRootAliasIndex,
    -1,
    'Desktop standard Vite test server must include the exact terminal package-root alias used for root and subpath imports.',
  );
} finally {
  await server.close();
}

console.log('desktop standard vite server contract passed.');
