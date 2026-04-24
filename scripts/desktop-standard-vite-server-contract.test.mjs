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

  const aliasFinders = server.config.resolve.alias.map((entry) => entry.find.toString());
  const birdcoderPackageSubpathAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/birdcoder-([^/]+)\\/(.+)$/u');
  const birdcoderPackageRootAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/birdcoder-([^/]+)$/u');
  const terminalDesktopAliasIndex = aliasFinders.indexOf('@sdkwork/terminal-desktop');
  const terminalPackageSubpathAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/terminal-([^/]+)\\/(.+)$/u');
  const terminalPackageRootAliasIndex = aliasFinders.indexOf('/^@sdkwork\\/terminal-([^/]+)$/u');

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
  assert.notEqual(
    birdcoderPackageSubpathAliasIndex,
    -1,
    'Desktop standard Vite test server must include the BirdCoder package-subpath alias.',
  );
  assert.notEqual(
    birdcoderPackageRootAliasIndex,
    -1,
    'Desktop standard Vite test server must include the BirdCoder package-root alias.',
  );
  assert.ok(
    birdcoderPackageSubpathAliasIndex < birdcoderPackageRootAliasIndex,
    'Desktop standard Vite test server must keep the BirdCoder package-subpath alias ahead of the package-root alias so subpath imports are not shadowed.',
  );
  assert.notEqual(
    terminalDesktopAliasIndex,
    -1,
    'Desktop standard Vite test server must include the terminal desktop alias.',
  );
  assert.notEqual(
    terminalPackageSubpathAliasIndex,
    -1,
    'Desktop standard Vite test server must include the terminal package-subpath alias.',
  );
  assert.notEqual(
    terminalPackageRootAliasIndex,
    -1,
    'Desktop standard Vite test server must include the terminal package-root alias.',
  );
  assert.ok(
    terminalPackageSubpathAliasIndex < terminalPackageRootAliasIndex,
    'Desktop standard Vite test server must keep the terminal package-subpath alias ahead of the package-root alias so subpath imports are not shadowed.',
  );
} finally {
  await server.close();
}

console.log('desktop standard vite server contract passed.');
