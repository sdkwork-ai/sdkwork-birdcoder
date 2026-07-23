import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const rootTsconfigPath = path.resolve(workspaceRootDir, 'tsconfig.json');
const dependencyPath = (dependencyId, ...relativePathParts) =>
  path.resolve(workspaceRootDir, '..', dependencyId, ...relativePathParts);
const infrastructurePackageSubpathProbe = [
  '@sdkwork/birdcoder-pc-infrastructure',
  '__contract_probe__',
].join('/');
const expectedDependencyFsAllowList = [
  workspaceRootDir,
  dependencyPath('sdkwork-appbase'),
  dependencyPath('sdkwork-iam'),
  dependencyPath('sdkwork-core'),
  dependencyPath('sdkwork-drive'),
  dependencyPath('sdkwork-messaging'),
  dependencyPath('sdkwork-sdk-commons'),
  dependencyPath('sdkwork-search'),
  dependencyPath('sdkwork-ui'),
  dependencyPath('sdkwork-terminal'),
  dependencyPath('sdkwork-membership'),
  dependencyPath('sdkwork-promotion'),
  dependencyPath('sdkwork-order'),
];
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

function assertXtermCssAlias(aliases, label) {
  const xtermCssAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === '@xterm/xterm/css/xterm.css',
    `${label} must expose an explicit xterm CSS alias.`,
  );

  assert.equal(
    xtermCssAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'),
    `${label} must resolve xterm CSS from the BirdCoder workspace dependency so sdkwork-terminal sibling CSS imports do not resolve from the sibling repository root.`,
  );
}

function assertTauriApiAlias(aliases, label) {
  const tauriApiAlias = findAliasEntry(
    aliases,
    (candidate) =>
      candidate?.find instanceof RegExp
      && candidate.find.test('@tauri-apps/api/core'),
    `${label} must expose an explicit Tauri API subpath alias.`,
  );

  assert.equal(
    tauriApiAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', '@tauri-apps', 'api', '$1.js'),
    `${label} must resolve Tauri API subpaths from the BirdCoder workspace dependency so sdkwork-terminal sibling source imports do not resolve from the sibling repository root.`,
  );
}

function assertLucideReactAlias(aliases, label) {
  const lucideReactAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === 'lucide-react',
    `${label} must expose an explicit lucide-react alias.`,
  );

  assert.equal(
    lucideReactAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', 'lucide-react', 'dist', 'esm', 'lucide-react.js'),
    `${label} must resolve lucide-react from the BirdCoder workspace dependency so sdkwork-appbase sibling React source imports do not resolve from the sibling repository root.`,
  );
}

function assertReactRouterAliases(aliases, label) {
  const reactRouterDomAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === 'react-router-dom',
    `${label} must expose the react-router-dom alias.`,
  );
  assert.equal(
    reactRouterDomAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', 'react-router-dom', 'dist', 'index.mjs'),
    `${label} must resolve react-router-dom from the BirdCoder workspace dependency so sibling appbase sources do not bind to another workspace's router build.`,
  );

  const reactRouterDomSubpathAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === 'react-router/dom',
    `${label} must expose the react-router/dom alias.`,
  );
  assert.equal(
    reactRouterDomSubpathAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', 'react-router', 'dist', 'development', 'dom-export.mjs'),
    `${label} must resolve react-router/dom from the BirdCoder workspace dependency so router-dom internals can load the matching router package.`,
  );

  const reactRouterAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === 'react-router',
    `${label} must expose the react-router alias.`,
  );
  assert.equal(
    reactRouterAlias.replacement,
    path.resolve(workspaceRootDir, 'node_modules', 'react-router', 'dist', 'development', 'index.mjs'),
    `${label} must resolve react-router from the BirdCoder workspace dependency so sibling appbase sources do not resolve through stale bridge node_modules.`,
  );
}

function assertSearchPcReactAliases(aliases, label) {
  const searchSubpathAlias = findAliasEntry(
    aliases,
    (candidate) =>
      candidate?.find instanceof RegExp
      && candidate.find.test('@sdkwork/search-pc-react/search'),
    `${label} must expose the @sdkwork/search-pc-react subpath alias.`,
  );
  assert.equal(
    searchSubpathAlias.replacement,
    dependencyPath('sdkwork-search', 'apps/sdkwork-search-pc/packages/sdkwork-search-pc-react/src/$1'),
    `${label} must resolve @sdkwork/search-pc-react subpaths from the sdkwork-search workspace dependency root, not the retired sdkwork-appbase copy.`,
  );

  const searchRootAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === '@sdkwork/search-pc-react',
    `${label} must expose the @sdkwork/search-pc-react root alias.`,
  );
  assert.equal(
    searchRootAlias.replacement,
    dependencyPath('sdkwork-search', 'apps/sdkwork-search-pc/packages/sdkwork-search-pc-react/src/index.ts'),
    `${label} must resolve @sdkwork/search-pc-react from the sdkwork-search workspace dependency root, not the retired sdkwork-appbase copy.`,
  );

  const searchContractsAlias = findAliasEntry(
    aliases,
    (candidate) => candidate?.find === '@sdkwork/search-contracts',
    `${label} must expose the @sdkwork/search-contracts alias required by @sdkwork/search-pc-react.`,
  );
  assert.equal(
    searchContractsAlias.replacement,
    dependencyPath('sdkwork-search', 'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src/index.ts'),
    `${label} must resolve @sdkwork/search-contracts from the sdkwork-search workspace dependency root so the search PC package can build from source.`,
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
  rootTsconfig.compilerOptions?.paths?.['@sdkwork/terminal-pc-resources/model'],
  ['../sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-resources/src/model.ts'],
  'The root TypeScript project must resolve sdkwork-terminal resources model subpaths from the workspace dependency root, matching the Vite alias contract.',
);
assert.deepEqual(
  rootTsconfig.compilerOptions?.paths?.['@sdkwork/terminal-pc-sessions/model'],
  ['../sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-sessions/src/model.ts'],
  'The root TypeScript project must resolve sdkwork-terminal sessions model subpaths from the workspace dependency root, matching the Vite alias contract.',
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

const previousApplicationProxyTarget =
  process.env.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL;
const previousPlatformProxyTarget =
  process.env.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL;
process.env.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL =
  'http://127.0.0.1:10240';
process.env.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL =
  'http://127.0.0.1:3900';

const rootConfig = await loadConfigModule('apps/sdkwork-birdcoder-pc/vite.config.ts');
assert.equal(rootConfig.resolve?.alias?.[0]?.find, '@');
assert.equal(
  rootConfig.resolve?.alias?.[0]?.replacement,
  path.resolve(workspaceRootDir, 'apps', 'sdkwork-birdcoder-pc', 'src'),
  'Root Vite config should resolve @ to the workspace src directory.',
);
const rootAuthSurfaceAlias = findAliasEntry(
  rootConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/auth-pc-react',
  'Root Vite config should expose the shared auth root alias so root-hosted Vite sessions can resolve the appbase auth UI.',
);
assert.equal(
  rootAuthSurfaceAlias.replacement,
  dependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/index.ts'),
  'Root Vite config should resolve @sdkwork/auth-pc-react from the sdkwork-iam workspace dependency root.',
);
assertSharedCoreBrowserFacadeAlias(rootConfig.resolve?.alias, 'Root Vite config');
assertXtermCssAlias(rootConfig.resolve?.alias, 'Root Vite config');
assertTauriApiAlias(rootConfig.resolve?.alias, 'Root Vite config');
assertLucideReactAlias(rootConfig.resolve?.alias, 'Root Vite config');
assertReactRouterAliases(rootConfig.resolve?.alias, 'Root Vite config');
assertSearchPcReactAliases(rootConfig.resolve?.alias, 'Root Vite config');
assert.equal(
  (rootConfig.resolve?.alias ?? []).some((candidate) =>
    candidate?.find instanceof RegExp
    && candidate.find.test('@sdkwork/birdcoder-pc-infrastructure')),
  false,
  'Root Vite config must resolve BirdCoder workspace packages through package exports.',
);
assert.deepEqual(
  rootConfig.server?.fs?.allow,
  expectedDependencyFsAllowList,
  'Root Vite config should preserve the BirdCoder, dependency SDK, search, shared UI, and terminal workspace dependency fs allow-list under ESM-native loading.',
);
assert.equal(
  rootConfig.server?.proxy?.['/app']?.ws,
  true,
  'Root Vite config must proxy realtime WebSocket upgrades through the same-origin /app boundary.',
);
assert.equal(
  rootConfig.server?.proxy?.['/app']?.target,
  'http://127.0.0.1:10240',
  'Root /app proxy must use the BirdCoder application ingress.',
);
assert.equal(
  rootConfig.server?.proxy?.['/__sdkwork/platform']?.target,
  'http://127.0.0.1:3900',
  'Root dependency SDK proxy must use the independent platform gateway.',
);
assert.equal(
  rootConfig.server?.proxy?.['/__sdkwork/platform']?.rewrite(
    '/__sdkwork/platform/app/v3/api/iam/users/current',
  ),
  '/app/v3/api/iam/users/current',
  'The platform proxy must remove only its controlled renderer prefix.',
);

const webConfig = await loadConfigModule('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts');
const webViteConfigSource = readFileSync(
  path.resolve(
    workspaceRootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
  ),
  'utf8',
);
assert.match(
  webViteConfigSource,
  /path\.resolve\(__dirname, ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/sdkwork-models['"]\)/u,
  'SDKWork models middleware must resolve the sibling repository from the workspace root.',
);
assert.match(
  webViteConfigSource,
  /decodeURIComponent\(requestPath\)/u,
  'SDKWork models middleware must validate URL-encoded traversal input after decoding.',
);
assert.match(
  webViteConfigSource,
  /path\.relative\(rootPath, candidatePath\)/u,
  'SDKWork models middleware must use path-relative containment instead of a raw prefix check.',
);
assert.match(
  webViteConfigSource,
  /fs\.realpathSync\.native\(candidatePath\)/u,
  'SDKWork models middleware must reject symlink/reparse-point escapes.',
);
assert.doesNotMatch(
  webViteConfigSource,
  /filePath\.startsWith\(sdkworkModelsRoot\)/u,
  'SDKWork models middleware must not rely on an unsafe string prefix containment check.',
);
assert.equal(webConfig.esbuild, false);
for (const apiPrefix of ['/app', '/backend', '/api', '/readyz', '/healthz', '/livez', '/metrics', '/openapi.json']) {
  assert.ok(
    webConfig.server?.proxy?.[apiPrefix],
    `Web Vite config must proxy ${apiPrefix} through the same-origin development gateway.`,
  );
}
assert.equal(
  webConfig.server?.proxy?.['/app']?.ws,
  true,
  'Web Vite config must proxy realtime WebSocket upgrades through the same-origin /app boundary.',
);
assert.equal(
  webConfig.server?.proxy?.['/app']?.target,
  'http://127.0.0.1:10240',
);
assert.equal(
  webConfig.server?.proxy?.['/__sdkwork/platform']?.target,
  'http://127.0.0.1:3900',
);
if (previousApplicationProxyTarget === undefined) {
  delete process.env.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL;
} else {
  process.env.SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL =
    previousApplicationProxyTarget;
}
if (previousPlatformProxyTarget === undefined) {
  delete process.env.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL;
} else {
  process.env.SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL =
    previousPlatformProxyTarget;
}
assertSharedCoreBrowserFacadeAlias(webConfig.resolve?.alias, 'Web Vite config');
assertXtermCssAlias(webConfig.resolve?.alias, 'Web Vite config');
assertTauriApiAlias(webConfig.resolve?.alias, 'Web Vite config');
assertLucideReactAlias(webConfig.resolve?.alias, 'Web Vite config');
assertReactRouterAliases(webConfig.resolve?.alias, 'Web Vite config');
assertSearchPcReactAliases(webConfig.resolve?.alias, 'Web Vite config');
assert.equal(
  (webConfig.resolve?.alias ?? []).some((candidate) =>
    candidate?.find instanceof RegExp
    && (
      candidate.find.test('@sdkwork/birdcoder-pc-infrastructure')
      || candidate.find.test(infrastructurePackageSubpathProbe)
    )),
  false,
  'Web Vite config must resolve BirdCoder workspace packages through package exports.',
);
const webTerminalBareAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/terminal-pc-shell',
  'Web Vite config should expose a bare sdkwork-terminal package alias.',
);
assert.equal(
  webTerminalBareAlias.replacement,
  dependencyPath('sdkwork-terminal', 'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-shell/src'),
  'Web Vite config should resolve bare sdkwork-terminal aliases from the workspace dependency root.',
);
const webTerminalSubpathAlias = findAliasEntry(
  webConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/terminal-pc-core',
  'Web Vite config should expose a sdkwork-terminal package subpath alias.',
);
assert.equal(
  webTerminalSubpathAlias.replacement,
  dependencyPath('sdkwork-terminal', 'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src'),
  'Web Vite config should resolve sdkwork-terminal subpath aliases from the workspace dependency root.',
);
assert.equal(
  (webConfig.resolve?.alias ?? []).some((candidate) =>
    candidate?.find === '@sdkwork/vip-pc-react'
    || (candidate?.find instanceof RegExp && candidate.find.test('@sdkwork/vip-pc-react/vip')),
  ),
  false,
  'Web Vite config must not keep aliases for the retired shared VIP UI package.',
);
assert.equal(
  webConfig.build?.minify,
  'terser',
  'Web Vite production build must use terser minification on all platforms.',
);
assert.equal(
  webConfig.build?.cssMinify,
  true,
  'Web Vite production build must minify CSS on all platforms.',
);
assertLucideRollupWarningFilter(
  webConfig.build?.rollupOptions?.onwarn,
  'Web Vite config',
);
const webManualChunks = webConfig.build?.rollupOptions?.output?.manualChunks;
assert.equal(typeof webManualChunks, 'function', 'Web Vite config must expose manual chunk governance.');
assert.notEqual(
  webConfig.build?.rollupOptions?.output?.onlyExplicitManualChunks,
  true,
  'Web Vite config must allow Rollup to merge manual-chunk dependencies; forcing explicit-only chunks creates cross-chunk initialization cycles.',
);
for (const platformUtilsModuleId of [
  '/repo/sdkwork-utils/packages/sdkwork-utils-typescript/dist/string.js',
  '/repo/sdkwork-utils/packages/sdkwork-utils-typescript/src/pagination.ts',
  '/repo/node_modules/@sdkwork/utils/id.js',
]) {
  assert.equal(
    webManualChunks(platformUtilsModuleId),
    'birdcoder-platform-utils',
    `Web Vite config must keep shared SDKWork utilities in a stable foundation chunk for ${platformUtilsModuleId}.`,
  );
}
for (const platformRuntimeModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-state/src/index.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/preferences.ts',
]) {
  assert.equal(
    webManualChunks(platformRuntimeModuleId),
    'birdcoder-platform-runtime',
    `Web Vite config must keep platform orchestration runtime in the core platform chunk for ${platformRuntimeModuleId}.`,
  );
}
for (const platformApiClientModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdCoderSdkClient.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/dependencyAppSdkClients.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkSessionErrorHandler.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/iamRuntime.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sessionService.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeAuthService.ts',
]) {
  assert.equal(
    webManualChunks(platformApiClientModuleId),
    'birdcoder-platform-api-client',
    `Web Vite config must split API transport/client/session-token runtime from generic platform orchestration for ${platformApiClientModuleId}.`,
  );
}
assert.equal(
  webManualChunks('\0vite/preload-helper.js'),
  'vite-preload-helper',
  'Web Vite config must isolate the Vite preload helper so lazy runtime chunks cannot form artificial circular chunk edges through helper placement.',
);
for (const platformFileSystemModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriRuntime.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts',
]) {
  assert.equal(
    webManualChunks(platformFileSystemModuleId),
    'birdcoder-platform-filesystem',
    `Web Vite config must split local filesystem and Tauri filesystem bridge runtime from generic platform orchestration for ${platformFileSystemModuleId}.`,
  );
}
for (const serviceCoreModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localBusinessUuid.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localServerRequestId.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/localUuid.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/apiJson.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionEvents.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionEvents.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeApiRetry.ts',
]) {
  assert.equal(
    webManualChunks(serviceCoreModuleId),
    'birdcoder-platform-service-core',
    `Web Vite config must split service support modules from platform orchestration to preserve acyclic chunks for ${serviceCoreModuleId}.`,
  );
}
for (const terminalDesktopModuleId of [
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-desktop/src/index.ts',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-desktop/src/surface/App.tsx',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-shell/src/index.tsx',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-workbench/src/index.tsx',
]) {
  assert.equal(
    webManualChunks(terminalDesktopModuleId),
    'birdcoder-terminal-desktop',
    `Web Vite config must name the lazy sdkwork terminal desktop surface instead of letting Rollup emit anonymous index chunks for ${terminalDesktopModuleId}.`,
  );
}
for (const terminalInfrastructureModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/terminalRuntimeSanitization.ts',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src/index.ts',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-types/src/index.ts',
  '/repo/sdkwork-terminal/apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-infrastructure/src/index.ts',
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
      '\0sdkwork-birdcoder-pc-web-xterm-xterm',
      '\0sdkwork-birdcoder-pc-web-xterm-xterm-compiled',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-canvas',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-canvas/lib/addon-canvas.js',
      '\0sdkwork-birdcoder-pc-web-xterm-addon-canvas',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-fit',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-fit/lib/addon-fit.js',
      '\0sdkwork-birdcoder-pc-web-xterm-addon-fit',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-search',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-search/lib/addon-search.js',
      '\0sdkwork-birdcoder-pc-web-xterm-addon-search',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-unicode11',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-unicode11/lib/addon-unicode11.js',
      '\0sdkwork-birdcoder-pc-web-xterm-addon-unicode11',
    ],
  },
  {
    chunkName: 'vendor-terminal-xterm-addon-web-links',
    moduleIds: [
      '/repo/node_modules/@xterm/addon-web-links/lib/addon-web-links.js',
      '\0sdkwork-birdcoder-pc-web-xterm-addon-web-links',
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
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/index.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-project-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeServerDirectoryProjectImport.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-session-location-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeProjectSessionResolution.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-search-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/codeFileSearch.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-session-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSessionSelection.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-clipboard-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageClipboardActions.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-terminal-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-run-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeRunEntryActions.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-commands-runtime',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts',
    ],
  },
  {
    chunkName: 'birdcoder-terminal-requests',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/requests.ts',
    ],
  },
  {
    chunkName: 'birdcoder-terminal-profile-availability',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/profileAvailability.ts',
    ],
  },
  {
    chunkName: 'birdcoder-run-config-definitions',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigDefinitions.ts',
    ],
  },
  {
    chunkName: 'birdcoder-run-config-storage',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigStorage.ts',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-state/src/runConfigurations.ts',
    ],
  },
  {
    chunkName: 'birdcoder-code-sidebar',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorer.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-topbar',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-workbench',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorWorkspacePanel.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-mobile',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeMobileProgrammingPanel.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-dialogs',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePageDialogs.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-code-overlays',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeWorkspaceOverlays.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-studio-surface',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/index.ts',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioChatSidebar.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-multiwindow-surface',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/index.ts',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/pages/MultiWindowProgrammingPage.tsx',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-multiwindow/src/components/MultiWindowPane.tsx',
    ],
  },
  {
    chunkName: 'birdcoder-settings-surface',
    moduleIds: [
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/index.ts',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/pages/SettingsPage.tsx',
      '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/CodeEngineSettings.tsx',
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
for (const sharedContractModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/workbench-view.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/apiTransportError.ts',
]) {
  assert.equal(
    webManualChunks(sharedContractModuleId),
    'birdcoder-types',
    `Web Vite config must keep active presentation and boundary contracts in the shared types chunk for ${sharedContractModuleId}.`,
  );
}
for (const apiRuntimeModuleId of [
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCatalogService.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
]) {
  assert.equal(
    webManualChunks(apiRuntimeModuleId),
    'birdcoder-platform-api-services',
    `Web Vite config must split API-backed service implementations from platform orchestration for ${apiRuntimeModuleId}.`,
  );
}
for (const identitySurfaceModuleId of [
  '/repo/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth.ts',
  '/repo/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/pages/AuthPage.tsx',
  '/repo/sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/index.ts',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/pages/AuthPage.tsx',
  '/repo/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/pages/UserPage.tsx',
]) {
  assert.equal(
    webManualChunks(identitySurfaceModuleId),
    'birdcoder-iam-surface',
    `Web Vite config must keep mutually dependent auth and user IAM surfaces in one lazy IAM chunk to avoid circular chunk warnings for ${identitySurfaceModuleId}.`,
  );
}
assert.deepEqual(
  webConfig.server?.fs?.allow,
  expectedDependencyFsAllowList,
  'Web Vite config should preserve the BirdCoder, dependency SDK, search, shared UI, and terminal workspace dependency fs allow-list under ESM-native loading.',
);

const desktopConfig = await loadConfigModule('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/vite.config.ts');
assert.equal(desktopConfig.base, './');
assert.equal(desktopConfig.esbuild, false);
assert.equal(desktopConfig.resolve?.preserveSymlinks, undefined);
assertSharedCoreBrowserFacadeAlias(desktopConfig.resolve?.alias, 'Desktop Vite config');
assertXtermCssAlias(desktopConfig.resolve?.alias, 'Desktop Vite config');
assertTauriApiAlias(desktopConfig.resolve?.alias, 'Desktop Vite config');
assertLucideReactAlias(desktopConfig.resolve?.alias, 'Desktop Vite config');
assertReactRouterAliases(desktopConfig.resolve?.alias, 'Desktop Vite config');
assertSearchPcReactAliases(desktopConfig.resolve?.alias, 'Desktop Vite config');
assert.equal(
  desktopConfig.build?.minify,
  'terser',
  'Desktop Vite production build must use terser minification on all platforms.',
);
assert.equal(
  desktopConfig.build?.cssMinify,
  true,
  'Desktop Vite production build must minify CSS on all platforms.',
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
assert.equal(
  (desktopConfig.resolve?.alias ?? []).some((candidate) =>
    candidate?.find instanceof RegExp
    && (
      candidate.find.test('@sdkwork/birdcoder-pc-infrastructure')
      || candidate.find.test(infrastructurePackageSubpathProbe)
    )),
  false,
  'Desktop Vite config must resolve BirdCoder workspace packages through package exports.',
);
const desktopTerminalBareAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/terminal-pc-shell',
  'Desktop Vite config should expose a bare sdkwork-terminal package alias.',
);
assert.equal(
  desktopTerminalBareAlias.replacement,
  dependencyPath('sdkwork-terminal', 'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-shell/src'),
  'Desktop Vite config should resolve bare sdkwork-terminal aliases from the workspace dependency root.',
);
const desktopTerminalSubpathAlias = findAliasEntry(
  desktopConfig.resolve?.alias,
  (candidate) => candidate?.find === '@sdkwork/terminal-pc-core',
  'Desktop Vite config should expose a sdkwork-terminal package subpath alias.',
);
assert.equal(
  desktopTerminalSubpathAlias.replacement,
  dependencyPath('sdkwork-terminal', 'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-core/src'),
  'Desktop Vite config should resolve sdkwork-terminal subpath aliases from the workspace dependency root.',
);
assert.equal(
  (desktopConfig.resolve?.alias ?? []).some((candidate) =>
    candidate?.find === '@sdkwork/vip-pc-react'
    || (candidate?.find instanceof RegExp && candidate.find.test('@sdkwork/vip-pc-react/vip')),
  ),
  false,
  'Desktop Vite config must not keep aliases for the retired shared VIP UI package.',
);
assert.deepEqual(
  desktopConfig.server?.fs?.allow,
  expectedDependencyFsAllowList,
  'Desktop Vite config should preserve the BirdCoder, dependency SDK, search, shared UI, and terminal workspace dependency fs allow-list under ESM-native loading.',
);

console.log('vite config ESM contract passed.');
