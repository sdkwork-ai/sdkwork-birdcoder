import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const rootTsconfigPath = path.resolve(workspaceRootDir, 'tsconfig.json');
const sharedCoreBrowserFacadePath = path.resolve(
  workspaceRootDir,
  'scripts',
  'vite-shims',
  'sdkwork-core-pc-react-browser-facade.mjs',
);

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

  assert.throws(
    () => {
      onwarn(genericWarning, (warning) => {
        forwardedWarnings.push(warning);
      });
    },
    /BirdCoder Rollup warning is not governed/u,
    `${label} must fail loudly for unrelated Rollup warnings instead of letting release builds pass with warning debt.`,
  );
}

function assertSharedCoreBrowserFacadeAlias(aliases, label) {
  const sharedCoreAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === '@sdkwork/core-pc-react',
    `${label} must expose the shared core root alias.`,
  );

  assert.equal(
    sharedCoreAlias.replacement,
    sharedCoreBrowserFacadePath,
    `${label} must route @sdkwork/core-pc-react through the BirdCoder browser facade instead of the shared root barrel so unused IM exports do not pull unresolved IM SDK packages into production builds.`,
  );
}

assert.ok(
  existsSync(sharedCoreBrowserFacadePath),
  'BirdCoder must provide a Vite browser facade for @sdkwork/core-pc-react so the app can consume shared core runtime exports without bundling the unused IM SDK barrel.',
);
const sharedCoreBrowserFacadeSource = readFileSync(sharedCoreBrowserFacadePath, 'utf8');
const rootTsconfig = JSON.parse(readFileSync(rootTsconfigPath, 'utf8'));
assert.ok(
  rootTsconfig.exclude?.includes('scripts/vite-shims/sdkwork-core-pc-react-browser-facade.mjs'),
  'The root TypeScript project must exclude the Vite-only shared core facade so tsc does not recurse into sibling sdkwork-core source and its external SDK workspace dependencies.',
);
assert.deepEqual(
  rootTsconfig.compilerOptions?.paths?.['@sdkwork/terminal-resources/model'],
  ['../sdkwork-terminal/packages/sdkwork-terminal-resources/src/model.ts'],
  'The root TypeScript project must resolve sdkwork-terminal resources model subpaths from the sibling source tree, matching the Vite alias contract.',
);
assert.deepEqual(
  rootTsconfig.compilerOptions?.paths?.['@sdkwork/terminal-sessions/model'],
  ['../sdkwork-terminal/packages/sdkwork-terminal-sessions/src/model.ts'],
  'The root TypeScript project must resolve sdkwork-terminal sessions model subpaths from the sibling source tree, matching the Vite alias contract.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /export \* from ['"]\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react\/src\/env\/index\.ts['"]/u,
  'The shared core browser facade must re-export the shared env module.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /export \* from ['"]\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react\/src\/app\/index\.ts['"]/u,
  'The shared core browser facade must re-export the shared app runtime module.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /from ['"]\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react\/src\/runtime\/shell-bridge\.ts['"]/u,
  'The shared core browser facade must use the IM-free shared shell bridge module for locale and shell bridge exports.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /from ['"]\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react\/src\/internal\/runtimeState\.ts['"]/u,
  'The shared core browser facade must compose runtime/session exports from shared runtimeState instead of the shared runtime barrel.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /export \* from ['"]\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react\/src\/preferences\/index\.ts['"]/u,
  'The shared core browser facade must re-export the shared preferences module.',
);
assert.match(
  sharedCoreBrowserFacadeSource,
  /export function usePcReactResolvedShellPreferences\(/u,
  'The shared core browser facade must provide the shell preference hook used by sdkwork-appbase without importing the shared hooks barrel.',
);
assert.doesNotMatch(
  sharedCoreBrowserFacadeSource,
  /\/im\/|runtime\/index\.ts|hooks\/index\.ts|src\/index\.ts/u,
  'The shared core browser facade must not re-export the shared root, runtime, hooks, or IM barrels because those barrels import the IM SDK runtime graph.',
);

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
assertSharedCoreBrowserFacadeAlias(rootConfig.resolve?.alias, 'Root Vite config');
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
assertSharedCoreBrowserFacadeAlias(webConfig.resolve?.alias, 'Web Vite config');
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
const webManualChunks = webConfig.build?.rollupOptions?.output?.manualChunks;
assert.equal(typeof webManualChunks, 'function', 'Web Vite config must expose manual chunk governance.');
for (const platformRuntimeModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  '/repo/packages/sdkwork-birdcoder-workbench-state/src/userProfileState.ts',
  '/repo/packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
]) {
  assert.equal(
    webManualChunks(platformRuntimeModuleId),
    'birdcoder-platform-runtime',
    `Web Vite config must keep platform orchestration runtime in the core platform chunk for ${platformRuntimeModuleId}.`,
  );
}
for (const platformApiClientModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
]) {
  assert.equal(
    webManualChunks(platformApiClientModuleId),
    'birdcoder-platform-api-client',
    `Web Vite config must split API transport/client/session-token runtime from generic platform orchestration for ${platformApiClientModuleId}.`,
  );
}
for (const platformFileSystemModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriRuntime.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
]) {
  assert.equal(
    webManualChunks(platformFileSystemModuleId),
    'birdcoder-platform-filesystem',
    `Web Vite config must split local filesystem and Tauri filesystem bridge runtime from generic platform orchestration for ${platformFileSystemModuleId}.`,
  );
}
for (const providerRuntimeModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
]) {
  assert.equal(
    webManualChunks(providerRuntimeModuleId),
    'birdcoder-platform-provider-services',
    `Web Vite config must split local provider-backed services from platform orchestration for ${providerRuntimeModuleId}.`,
  );
}
for (const serviceCoreModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/runtimeApiRetry.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionSelection.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/codingSessionMessageProjection.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/projectContentConfigData.ts',
]) {
  assert.equal(
    webManualChunks(serviceCoreModuleId),
    'birdcoder-platform-service-core',
    `Web Vite config must split service support modules from platform orchestration to preserve acyclic chunks for ${serviceCoreModuleId}.`,
  );
}
assert.equal(
  webManualChunks('/repo/packages/sdkwork-birdcoder-infrastructure/src/storage/bootstrapConsoleCatalog.ts'),
  'birdcoder-platform-storage',
  'Web Vite config must keep bootstrap storage catalog helpers in the storage chunk so provider-backed services do not depend back on platform orchestration.',
);
for (const terminalDesktopModuleId of [
  '/repo/sdkwork-terminal/apps/desktop/src/index.ts',
  '/repo/sdkwork-terminal/apps/desktop/src/App.tsx',
  '/repo/sdkwork-terminal/packages/sdkwork-terminal-shell/src/index.tsx',
  '/repo/sdkwork-terminal/packages/sdkwork-terminal-workbench/src/index.tsx',
]) {
  assert.equal(
    webManualChunks(terminalDesktopModuleId),
    'birdcoder-terminal-desktop',
    `Web Vite config must name the lazy sdkwork terminal desktop surface instead of letting Rollup emit anonymous index chunks for ${terminalDesktopModuleId}.`,
  );
}
for (const terminalInfrastructureModuleId of [
  '/repo/packages/sdkwork-birdcoder-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
  '/repo/packages/sdkwork-birdcoder-commons/src/terminal/terminalRuntimeSanitization.ts',
  '/repo/sdkwork-terminal/packages/sdkwork-terminal-core/src/index.ts',
  '/repo/sdkwork-terminal/packages/sdkwork-terminal-types/src/index.ts',
  '/repo/sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts',
]) {
  assert.equal(
    webManualChunks(terminalInfrastructureModuleId),
    'birdcoder-terminal-infrastructure',
    `Web Vite config must isolate terminal infrastructure from the generic platform runtime for ${terminalInfrastructureModuleId}.`,
  );
}
for (const terminalVendorModule of [
  {
    chunkName: 'vendor-terminal-xterm',
    moduleIds: [
      '/repo/node_modules/@xterm/xterm/lib/xterm.js',
      '\0sdkwork-birdcoder-web-xterm-xterm',
      '\0sdkwork-birdcoder-web-xterm-xterm-compiled',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-canvas',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-canvas/lib/addon-canvas.js',
      '\0sdkwork-birdcoder-web-xterm-addon-canvas',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-fit',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-fit/lib/addon-fit.js',
      '\0sdkwork-birdcoder-web-xterm-addon-fit',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-search',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-search/lib/addon-search.js',
      '\0sdkwork-birdcoder-web-xterm-addon-search',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-unicode11',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-unicode11/lib/addon-unicode11.js',
      '\0sdkwork-birdcoder-web-xterm-addon-unicode11',
    ],
  },
]) {
  for (const terminalVendorModuleId of terminalVendorModule.moduleIds) {
    assert.equal(
      webManualChunks(terminalVendorModuleId),
      terminalVendorModule.chunkName,
      `Web Vite config must publish terminal vendor runtime with governed chunk names instead of virtual-module-derived asset names for ${terminalVendorModuleId}.`,
    );
  }
}
for (const tauriVendorModule of [
  {
    chunkName: 'vendor-tauri-core',
    moduleIds: [
      '/repo/node_modules/@tauri-apps/api/core.js',
      '/repo/node_modules/@tauri-apps/api/core/index.js',
    ],
  },
  {
    chunkName: 'vendor-tauri-event',
    moduleIds: [
      '/repo/node_modules/@tauri-apps/api/event.js',
      '/repo/node_modules/@tauri-apps/api/event/index.js',
    ],
  },
  {
    chunkName: 'vendor-tauri-window',
    moduleIds: [
      '/repo/node_modules/@tauri-apps/api/window.js',
      '/repo/node_modules/@tauri-apps/api/window/index.js',
      '/repo/node_modules/@tauri-apps/api/dpi.js',
    ],
  },
]) {
  for (const tauriVendorModuleId of tauriVendorModule.moduleIds) {
    assert.equal(
      webManualChunks(tauriVendorModuleId),
      tauriVendorModule.chunkName,
      `Web Vite config must publish Tauri browser API runtime with governed chunk names instead of generic core/event/window assets for ${tauriVendorModuleId}.`,
    );
  }
}
for (const productSurfaceModule of [
  {
    chunkName: 'birdcoder-code-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-code/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
      '/repo/packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-studio-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-studio/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
      '/repo/packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-multiwindow-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-multiwindow/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-multiwindow/src/pages/MultiWindowProgrammingPage.tsx',
      '/repo/packages/sdkwork-birdcoder-multiwindow/src/components/MultiWindowPane.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-settings-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-settings/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-settings/src/pages/SettingsPage.tsx',
      '/repo/packages/sdkwork-birdcoder-settings/src/components/CodeEngineSettings.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-skills-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-skills/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-skills/src/SkillsPage.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-templates-surface',
    moduleIds: [
      '/repo/packages/sdkwork-birdcoder-templates/src/index.ts',
      '/repo/packages/sdkwork-birdcoder-templates/src/TemplatesPage.tsx',
    ],
  },
]) {
  for (const productSurfaceModuleId of productSurfaceModule.moduleIds) {
    assert.equal(
      webManualChunks(productSurfaceModuleId),
      productSurfaceModule.chunkName,
      `Web Vite config must name lazy product surface chunks instead of letting Rollup emit anonymous index chunks for ${productSurfaceModuleId}.`,
    );
  }
}
for (const typeDataModuleId of [
  '/repo/packages/sdkwork-birdcoder-types/src/data.ts',
]) {
  assert.equal(
    webManualChunks(typeDataModuleId),
    'birdcoder-types-data',
    `Web Vite config must split large static data entity definitions from the shared types runtime for ${typeDataModuleId}.`,
  );
}
for (const typeApiModuleId of [
  '/repo/packages/sdkwork-birdcoder-types/src/server-api.ts',
  '/repo/packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts',
  '/repo/packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts',
]) {
  assert.equal(
    webManualChunks(typeApiModuleId),
    'birdcoder-types-api',
    `Web Vite config must split generated server API contracts from the shared types runtime for ${typeApiModuleId}.`,
  );
}
assert.equal(
  webManualChunks('/repo/packages/sdkwork-birdcoder-types/src/storageBindings.ts'),
  'birdcoder-types-storage',
  'Web Vite config must keep storage binding contracts in the dedicated storage types chunk.',
);
assert.equal(
  webManualChunks('/repo/packages/sdkwork-birdcoder-types/src/coding-session.ts'),
  'birdcoder-types',
  'Web Vite config must keep general runtime type helpers in the shared types fallback chunk.',
);
for (const apiRuntimeModuleId of [
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts',
  '/repo/packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts',
]) {
  assert.equal(
    webManualChunks(apiRuntimeModuleId),
    'birdcoder-platform-api-services',
    `Web Vite config must split API-backed service implementations from platform orchestration for ${apiRuntimeModuleId}.`,
  );
}
for (const identitySurfaceModuleId of [
  '/repo/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/auth.ts',
  '/repo/sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/pages/AuthPage.tsx',
  '/repo/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-pc-react/src/index.ts',
  '/repo/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/domain/userCenterSurfaceRouting.ts',
  '/repo/sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/pages/userCenterProfileSurfacePage.tsx',
  '/repo/packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx',
  '/repo/packages/sdkwork-birdcoder-user/src/pages/UserCenterPage.tsx',
]) {
  assert.equal(
    webManualChunks(identitySurfaceModuleId),
    'birdcoder-identity-surface',
    `Web Vite config must keep mutually dependent auth/user/user-center surfaces in one lazy identity chunk to avoid circular chunk warnings for ${identitySurfaceModuleId}.`,
  );
}
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
assertSharedCoreBrowserFacadeAlias(desktopConfig.resolve?.alias, 'Desktop Vite config');
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
