import './vite-windows-realpath-patch.mjs';

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createDesktopVitePlugins } from '../packages/sdkwork-birdcoder-desktop/vite/createDesktopVitePlugins.mjs';
import { createDesktopViteServerConfig } from './run-desktop-vite-host.mjs';

const rootDir = process.cwd();
const desktopRootDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
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
  const argv = [
    '--host',
    host,
    ...(typeof port === 'number' ? ['--port', String(port)] : []),
    ...(strictPort ? ['--strictPort'] : []),
    '--mode',
    mode,
  ];
  const serverConfig = createDesktopViteServerConfig({
    argv,
    desktopRootDir,
    env: process.env,
    mode,
    plugins: createDesktopVitePlugins({
      desktopRootDir,
      mode,
    }),
  });

  return createServer({
    ...serverConfig,
    ...(customLogger ? { customLogger } : {}),
  });
}

export {
  createDesktopConfiguredViteServer,
  desktopRequire,
  desktopRootDir,
  loadDesktopVite,
  rootDir,
};
