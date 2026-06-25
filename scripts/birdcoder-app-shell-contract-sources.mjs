import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BIRDCODER_APP_SHELL_SOURCE_RELATIVE_PATHS = Object.freeze([
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/BirdcoderApp.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppMainBody.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/BirdcoderAppHeader.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppErrorBoundary.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppLazyPages.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/workbenchStartupSelection.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/workbenchRecoveryPersistence.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppWindowControlIcons.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppSurfaceLoader.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppConstants.ts',
]);

export function readBirdcoderAppShellSource(rootDir = process.cwd()) {
  return BIRDCODER_APP_SHELL_SOURCE_RELATIVE_PATHS
    .map((relativePath) => path.join(rootDir, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) => fs.readFileSync(absolutePath, 'utf8'))
    .join('\n');
}

export function readBirdcoderAppShellSourceFromImportMeta(importMetaUrl, rootDir = process.cwd()) {
  void importMetaUrl;
  return readBirdcoderAppShellSource(rootDir);
}

export function resolveBirdcoderAppShellSourcePath(importMetaUrl, relativePath = 'BirdcoderApp.tsx') {
  const scriptsDir = path.dirname(fileURLToPath(importMetaUrl));
  const rootDir = path.resolve(scriptsDir, '..');
  return path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app',
    relativePath,
  );
}
