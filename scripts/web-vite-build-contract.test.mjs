import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rmSync } from 'node:fs';

await import('./vite-windows-realpath-patch.mjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const webRootDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-web');
const webDistDir = path.join(webRootDir, 'dist');

async function loadWebViteConfig() {
  const configModule = await import(pathToFileURL(path.join(webRootDir, 'vite.config.ts')).href);
  const configExport = configModule.default;

  return typeof configExport === 'function'
    ? configExport({
        command: 'build',
        mode: 'test',
        isPreview: false,
        isSsrBuild: false,
      })
    : configExport;
}

try {
  const { build, createLogger } = await import('vite');
  const config = await loadWebViteConfig();
  const warnings = [];
  const baseLogger = createLogger('warn', {
    allowClearScreen: false,
  });
  const customLogger = {
    ...baseLogger,
    warn(message, options) {
      warnings.push(String(message));
      baseLogger.warn(message, options);
    },
    warnOnce(message, options) {
      warnings.push(String(message));
      baseLogger.warnOnce(message, options);
    },
  };

  await build({
    ...config,
    configFile: false,
    root: webRootDir,
    mode: 'test',
    customLogger,
  });

  assert.ok(
    warnings.every(
      (warning) =>
        !warning.includes('lucide-react/dist/esm/')
        && !warning.includes('Module level directives cause errors when bundled')
        && !warning.includes('"use client"'),
    ),
    `Web Vite builds must not emit lucide-react module directive warnings. Received warnings:\n${warnings.join('\n')}`,
  );

  console.log('web vite build contract passed.');
} finally {
  rmSync(webDistDir, {
    recursive: true,
    force: true,
  });
}
