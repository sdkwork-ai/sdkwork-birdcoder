import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');

const stubModuleSources = {
  '@vitejs/plugin-react': `export default function react() { return 'react-plugin'; }\n`,
  '@tailwindcss/vite': `export default function tailwindcss() { return 'tailwindcss-plugin'; }\n`,
  '@rollup/plugin-commonjs': `export default function commonjs(options = {}) { return { name: 'commonjs-plugin', options }; }\n`,
  vite: [
    'export function defineConfig(config) {',
    '  return config;',
    '}',
    'export function loadEnv() {',
    '  return {};',
    '}',
    '',
  ].join('\n'),
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function toDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
}

function rewriteStubImports(sourceText) {
  let rewritten = sourceText;
  for (const [specifier, source] of Object.entries(stubModuleSources)) {
    rewritten = rewritten.replace(
      new RegExp(`(['"])${escapeRegExp(specifier)}\\1`, 'gu'),
      `'${toDataUrl(source)}'`,
    );
  }
  return rewritten;
}

function resolveConfigTempPath(configPath) {
  const configDir = path.dirname(configPath);
  const configBaseName = path.basename(configPath, path.extname(configPath));
  return path.join(configDir, `${configBaseName}.contract-${process.pid}-${Date.now()}.mjs`);
}

function assertLucideRollupWarningFilter(onwarn, label) {
  assert.equal(typeof onwarn, 'function', `${label} must define a Rollup onwarn handler.`);

  const forwardedWarnings = [];
  const lucideWarning = {
    code: 'MODULE_LEVEL_DIRECTIVE',
    id: '/virtual/node_modules/lucide-react/dist/esm/Icon.js',
    message: 'Module level directives cause errors when bundled, "use client" in "lucide-react/dist/esm/Icon.js" was ignored.',
  };
  const genericWarning = {
    code: 'SOURCEMAP_ERROR',
    id: '/virtual/example.js',
    message: 'Example generic warning',
  };

  onwarn(lucideWarning, (warning) => {
    forwardedWarnings.push(warning);
  });
  assert.deepEqual(
    forwardedWarnings,
    [],
    `${label} must suppress known lucide-react module directive warnings so build output stays clean.`,
  );

  onwarn(genericWarning, (warning) => {
    forwardedWarnings.push(warning);
  });
  assert.deepEqual(
    forwardedWarnings,
    [genericWarning],
    `${label} must continue forwarding unrelated Rollup warnings instead of globally silencing them.`,
  );
}

async function loadConfigModule(relativePath) {
  const absolutePath = path.resolve(workspaceRootDir, relativePath);
  const transpiled = ts.transpileModule(readFileSync(absolutePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolutePath,
  }).outputText;
  const tempModulePath = resolveConfigTempPath(absolutePath);
  writeFileSync(tempModulePath, rewriteStubImports(transpiled), 'utf8');

  try {
    const loadedModule = await import(`${pathToFileURL(tempModulePath).href}?t=${Date.now()}`);
    const configExport = loadedModule.default;
    const resolvedConfig =
      typeof configExport === 'function'
        ? await configExport({
            command: 'build',
            mode: 'production',
            isPreview: false,
            isSsrBuild: false,
          })
        : configExport;

    assert.ok(resolvedConfig && typeof resolvedConfig === 'object', `${relativePath} should resolve to a Vite config object.`);
    return resolvedConfig;
  } finally {
    rmSync(tempModulePath, { force: true });
  }
}

const rootConfig = await loadConfigModule('vite.config.ts');
assert.equal(rootConfig.resolve?.alias?.[0]?.find, '@');
assert.equal(
  rootConfig.resolve?.alias?.[0]?.replacement,
  path.resolve(workspaceRootDir, 'src'),
  'Root Vite config should resolve @ to the workspace src directory.',
);
assert.equal(rootConfig.resolve?.alias?.[1]?.find instanceof RegExp, true);
assert.equal(
  rootConfig.resolve?.alias?.[1]?.find.test('sdkwork-birdcoder-chat'),
  true,
  'Root Vite config should still resolve bare workspace package aliases.',
);
assert.equal(
  rootConfig.resolve?.alias?.[1]?.find.test('sdkwork-birdcoder-chat/subpath'),
  false,
  'Root Vite config should leave workspace package subpath imports alone instead of rewriting them into /src paths.',
);
assert.equal(
  rootConfig.resolve?.alias?.[1]?.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Root Vite config should resolve workspace package aliases without relying on CommonJS globals.',
);

const webConfig = await loadConfigModule('packages/sdkwork-birdcoder-web/vite.config.ts');
assert.equal(webConfig.esbuild, false);
assert.equal(webConfig.resolve?.alias?.[0]?.find instanceof RegExp, true);
assert.equal(
  webConfig.resolve?.alias?.[0]?.find.test('@sdkwork/birdcoder-infrastructure'),
  true,
  'Web Vite config should still resolve bare workspace package aliases.',
);
assert.equal(
  webConfig.resolve?.alias?.[0]?.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  false,
  'Web Vite config should leave package subpath imports to package exports instead of rewriting them into /src paths.',
);
assert.equal(
  webConfig.resolve?.alias?.[0]?.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Web Vite config should resolve workspace aliases under ESM-native loading.',
);
assert.equal(
  webConfig.build?.minify,
  false,
  'Web Vite build must avoid esbuild minification in the current Windows environment.',
);
assert.equal(
  webConfig.build?.cssMinify,
  false,
  'Web Vite build must avoid esbuild CSS minification in the current Windows environment.',
);
assertLucideRollupWarningFilter(
  webConfig.build?.rollupOptions?.onwarn,
  'Web Vite config',
);
assert.deepEqual(
  webConfig.server?.fs?.allow,
  [workspaceRootDir],
  'Web Vite config should preserve the workspace fs allow-list under ESM-native loading.',
);

const desktopConfig = await loadConfigModule('packages/sdkwork-birdcoder-desktop/vite.config.ts');
assert.equal(desktopConfig.base, './');
assert.equal(desktopConfig.esbuild, false);
assert.equal(desktopConfig.resolve?.preserveSymlinks, undefined);
assert.equal(
  desktopConfig.build?.minify,
  false,
  'Desktop Vite build must avoid esbuild minification in the current Windows environment.',
);
assert.equal(
  desktopConfig.build?.cssMinify,
  false,
  'Desktop Vite build must avoid esbuild CSS minification in the current Windows environment.',
);
assertLucideRollupWarningFilter(
  desktopConfig.build?.rollupOptions?.onwarn,
  'Desktop Vite config',
);
assert.deepEqual(
  desktopConfig.resolve?.dedupe,
  ['react', 'react-dom', 'react-i18next', 'scheduler', 'use-sync-external-store'],
  'Desktop Vite config should dedupe shared runtime packages under ESM-native loading.',
);
assert.equal(desktopConfig.resolve?.alias?.[0]?.find instanceof RegExp, true);
assert.equal(
  desktopConfig.resolve?.alias?.[0]?.find.test('@sdkwork/birdcoder-infrastructure'),
  true,
  'Desktop Vite config should still resolve bare workspace package aliases.',
);
assert.equal(
  desktopConfig.resolve?.alias?.[0]?.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  false,
  'Desktop Vite config should leave package subpath imports to package exports instead of rewriting them into /src paths.',
);
assert.equal(
  desktopConfig.resolve?.alias?.[0]?.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Desktop Vite config should resolve workspace aliases under ESM-native loading.',
);
assert.deepEqual(
  desktopConfig.server?.fs?.allow,
  [workspaceRootDir],
  'Desktop Vite config should preserve the workspace fs allow-list under ESM-native loading.',
);

console.log('vite config ESM contract passed.');
