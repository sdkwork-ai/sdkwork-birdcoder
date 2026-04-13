import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBirdcoderCommonJsDefaultCompatPlugin,
  createBirdcoderReactCompatPlugin,
  createBirdcoderTypeScriptTransformPlugin,
  createBirdcoderVitePlugins,
} from '../../../scripts/create-birdcoder-vite-plugins.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDesktopRootDir = path.resolve(__dirname, '..');
const desktopNamespace = 'sdkwork-birdcoder-desktop';

function createDesktopCommonJsDefaultCompatPlugin({
  desktopRootDir = defaultDesktopRootDir,
  mode = 'development',
} = {}) {
  return createBirdcoderCommonJsDefaultCompatPlugin({
    appRootDir: desktopRootDir,
    mode,
    namespace: desktopNamespace,
  });
}

function createDesktopReactCompatPlugin({
  desktopRootDir = defaultDesktopRootDir,
  mode = 'development',
} = {}) {
  return createBirdcoderReactCompatPlugin({
    appRootDir: desktopRootDir,
    mode,
    namespace: desktopNamespace,
  });
}

function createDesktopTypeScriptTransformPlugin({
  desktopRootDir = defaultDesktopRootDir,
} = {}) {
  return createBirdcoderTypeScriptTransformPlugin({
    toolingRootDir: desktopRootDir,
    namespace: desktopNamespace,
  });
}

function createDesktopVitePlugins({
  desktopRootDir = defaultDesktopRootDir,
  mode = 'development',
} = {}) {
  return createBirdcoderVitePlugins({
    appRootDir: desktopRootDir,
    toolingRootDir: desktopRootDir,
    mode,
    namespace: desktopNamespace,
  });
}

export {
  createDesktopCommonJsDefaultCompatPlugin,
  createDesktopReactCompatPlugin,
  createDesktopTypeScriptTransformPlugin,
  createDesktopVitePlugins,
};
