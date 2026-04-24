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

function findAliasEntry(aliases, predicate, label) {
  const aliasEntry = (aliases ?? []).find((candidate) => predicate(candidate));
  assert.ok(aliasEntry, label);
  return aliasEntry;
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
const rootAuthSurfaceAlias = findAliasEntry(
  rootConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/auth-pc-react',
  'Root Vite config should expose the shared auth root alias so root-hosted Vite sessions can resolve the appbase auth UI.',
);
assert.equal(
  rootAuthSurfaceAlias.replacement,
  path.resolve(
    workspaceRootDir,
    '../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/index.ts',
  ),
  'Root Vite config should resolve @sdkwork/auth-pc-react from the canonical sdkwork-appbase source tree.',
);
const rootBirdcoderBareAlias = findAliasEntry(
  rootConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/birdcoder-infrastructure')
    && !candidate.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Root Vite config should expose a bare scoped BirdCoder workspace alias.',
);
assert.equal(
  rootBirdcoderBareAlias.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Root Vite config should resolve bare scoped BirdCoder workspace aliases without relying on local node_modules package builds.',
);
assert.deepEqual(
  rootConfig.server?.fs?.allow,
  [
    workspaceRootDir,
    path.resolve(workspaceRootDir, '../sdkwork-appbase'),
    path.resolve(workspaceRootDir, '../sdkwork-core'),
    path.resolve(workspaceRootDir, '../sdkwork-ui'),
    path.resolve(workspaceRootDir, '../sdkwork-terminal'),
    path.resolve(workspaceRootDir, '../../spring-ai-plus-app-api'),
    path.resolve(workspaceRootDir, '../../sdk'),
  ],
  'Root Vite config should preserve the BirdCoder, sdkwork-appbase, sdkwork-core, sdkwork-ui, sdkwork-terminal, spring-ai-plus-app-api, and sdk workspace fs allow-list under ESM-native loading.',
);

const webConfig = await loadConfigModule('packages/sdkwork-birdcoder-web/vite.config.ts');
assert.equal(webConfig.esbuild, false);
const webBirdcoderBareAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/birdcoder-infrastructure')
    && !candidate.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Web Vite config should expose a bare workspace package alias.',
);
assert.equal(
  webBirdcoderBareAlias.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Web Vite config should resolve bare workspace aliases under ESM-native loading.',
);
const webBirdcoderSubpathAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && !candidate.find.test('@sdkwork/birdcoder-infrastructure')
    && candidate.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Web Vite config should expose a workspace package subpath alias.',
);
assert.equal(
  webBirdcoderSubpathAlias.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src', '$2'),
  'Web Vite config should resolve workspace package subpath aliases under ESM-native loading.',
);
const webTerminalBareAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/terminal-shell')
    && !candidate.find.test('@sdkwork/terminal-shell/runtime'),
  'Web Vite config should expose a bare sdkwork-terminal package alias.',
);
assert.equal(
  webTerminalBareAlias.replacement,
  path.resolve(workspaceRootDir, '../sdkwork-terminal/packages/sdkwork-terminal-$1/src'),
  'Web Vite config should resolve bare sdkwork-terminal aliases from the sibling workspace.',
);
const webTerminalSubpathAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && !candidate.find.test('@sdkwork/terminal-shell')
    && candidate.find.test('@sdkwork/terminal-shell/runtime'),
  'Web Vite config should expose a sdkwork-terminal package subpath alias.',
);
assert.equal(
  webTerminalSubpathAlias.replacement,
  path.resolve(workspaceRootDir, '../sdkwork-terminal/packages/sdkwork-terminal-$1/src', '$2'),
  'Web Vite config should resolve sdkwork-terminal subpath aliases from the sibling workspace.',
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
  [
    workspaceRootDir,
    path.resolve(workspaceRootDir, '../sdkwork-appbase'),
    path.resolve(workspaceRootDir, '../sdkwork-core'),
    path.resolve(workspaceRootDir, '../sdkwork-ui'),
    path.resolve(workspaceRootDir, '../sdkwork-terminal'),
    path.resolve(workspaceRootDir, '../../spring-ai-plus-app-api'),
    path.resolve(workspaceRootDir, '../../sdk'),
  ],
  'Web Vite config should preserve the BirdCoder, sdkwork-appbase, sdkwork-core, sdkwork-ui, sdkwork-terminal, spring-ai-plus-app-api, and sdk workspace fs allow-list under ESM-native loading.',
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
  [
    'react',
    'react-dom',
    'react-i18next',
    'react-router',
    'react-router-dom',
    'scheduler',
    'use-sync-external-store',
  ],
  'Desktop Vite config should dedupe shared runtime packages, including shared router dependencies, under ESM-native loading.',
);
const desktopBirdcoderBareAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/birdcoder-infrastructure')
    && !candidate.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Desktop Vite config should expose a bare workspace package alias.',
);
assert.equal(
  desktopBirdcoderBareAlias.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src'),
  'Desktop Vite config should resolve bare workspace aliases under ESM-native loading.',
);
const desktopBirdcoderSubpathAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && !candidate.find.test('@sdkwork/birdcoder-infrastructure')
    && candidate.find.test('@sdkwork/birdcoder-infrastructure/storage/dataKernel'),
  'Desktop Vite config should expose a workspace package subpath alias.',
);
assert.equal(
  desktopBirdcoderSubpathAlias.replacement,
  path.resolve(workspaceRootDir, 'packages', 'sdkwork-birdcoder-$1', 'src', '$2'),
  'Desktop Vite config should resolve workspace package subpath aliases under ESM-native loading.',
);
const desktopTerminalBareAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/terminal-shell')
    && !candidate.find.test('@sdkwork/terminal-shell/runtime'),
  'Desktop Vite config should expose a bare sdkwork-terminal package alias.',
);
assert.equal(
  desktopTerminalBareAlias.replacement,
  path.resolve(workspaceRootDir, '../sdkwork-terminal/packages/sdkwork-terminal-$1/src'),
  'Desktop Vite config should resolve bare sdkwork-terminal aliases from the sibling workspace.',
);
const desktopTerminalSubpathAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) =>
    candidate?.find instanceof RegExp
    && !candidate.find.test('@sdkwork/terminal-shell')
    && candidate.find.test('@sdkwork/terminal-shell/runtime'),
  'Desktop Vite config should expose a sdkwork-terminal package subpath alias.',
);
assert.equal(
  desktopTerminalSubpathAlias.replacement,
  path.resolve(workspaceRootDir, '../sdkwork-terminal/packages/sdkwork-terminal-$1/src', '$2'),
  'Desktop Vite config should resolve sdkwork-terminal subpath aliases from the sibling workspace.',
);
assert.deepEqual(
  desktopConfig.server?.fs?.allow,
  [
    workspaceRootDir,
    path.resolve(workspaceRootDir, '../sdkwork-appbase'),
    path.resolve(workspaceRootDir, '../sdkwork-core'),
    path.resolve(workspaceRootDir, '../sdkwork-ui'),
    path.resolve(workspaceRootDir, '../sdkwork-terminal'),
    path.resolve(workspaceRootDir, '../../spring-ai-plus-app-api'),
    path.resolve(workspaceRootDir, '../../sdk'),
  ],
  'Desktop Vite config should preserve the BirdCoder, sdkwork-appbase, sdkwork-core, sdkwork-ui, sdkwork-terminal, spring-ai-plus-app-api, and sdk workspace fs allow-list under ESM-native loading.',
);

console.log('vite config ESM contract passed.');
