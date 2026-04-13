import './vite-windows-realpath-patch.mjs';

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const desktopRootDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const desktopViteConfigPath = path.join(desktopRootDir, 'vite.config.ts');
const desktopRequire = createRequire(path.join(desktopRootDir, 'package.json'));

async function loadDesktopVite() {
  return import(pathToFileURL(desktopRequire.resolve('vite')).href);
}

async function createDesktopConfiguredViteServer({
  host = '127.0.0.1',
  port,
  strictPort = true,
  mode = 'development',
  customLogger,
} = {}) {
  const { createServer } = await loadDesktopVite();

  return createServer({
    configFile: desktopViteConfigPath,
    configLoader: 'native',
    root: desktopRootDir,
    mode,
    ...(customLogger ? { customLogger } : {}),
    server: {
      host,
      port,
      strictPort,
    },
  });
}

export {
  createDesktopConfiguredViteServer,
  desktopRequire,
  desktopRootDir,
  desktopViteConfigPath,
  loadDesktopVite,
  rootDir,
};
