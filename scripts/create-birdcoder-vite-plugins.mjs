import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';

/**
 * Vite config helpers are consumed from multiple workspace packages that resolve
 * different physical Vite peer instances under pnpm. Keep plugin values opaque
 * at this shared tooling boundary so package-local vite.config.ts files stay
 * compatible with their own resolved Vite types.
 *
 * @typedef {any} BirdcoderOpaqueVitePlugin
 */
/** @typedef {any} BirdcoderOpaqueVitePluginOption */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const defaultBirdcoderToolingRootDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-desktop');
const defaultBirdcoderAppRootDir = defaultBirdcoderToolingRootDir;
const defaultBirdcoderNamespace = 'sdkwork-birdcoder-desktop';

const BIRDCODER_VITE_DEDUPE_PACKAGES = [
  'react',
  'react-dom',
  'react-i18next',
  'react-router',
  'react-router-dom',
  'scheduler',
  'use-sync-external-store',
];
const BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE = [
  '@xterm/xterm',
  '@xterm/addon-canvas',
  '@xterm/addon-fit',
  '@xterm/addon-search',
  '@xterm/addon-unicode11',
  'qrcode',
  'qrcode/lib/browser.js',
];
const BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE = [];
const BIRDCODER_PUBLIC_RUNTIME_ENV_KEY = '__SDKWORK_PC_REACT_ENV__';
const BIRDCODER_PUBLIC_RUNTIME_ENV_PREFIXES = ['SDKWORK_', 'VITE_'];
const BIRDCODER_PUBLIC_RUNTIME_ENV_EXACT_KEYS = ['DEV', 'MODE', 'NODE_ENV', 'PROD'];

function resolveBirdcoderTerminalInfrastructureRuntimePath(
  appRootDir = defaultBirdcoderAppRootDir,
) {
  return path.resolve(
    appRootDir,
    '../sdkwork-birdcoder-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
  );
}

function resolveSdkworkTerminalDesktopEntryPath(appRootDir = defaultBirdcoderAppRootDir) {
  return path.resolve(appRootDir, '../../../sdkwork-terminal/apps/desktop/src/index.ts');
}

function resolveSdkworkTerminalInfrastructureEntryPath(
  appRootDir = defaultBirdcoderAppRootDir,
) {
  return path.resolve(
    appRootDir,
    '../../../sdkwork-terminal/packages/sdkwork-terminal-infrastructure/src/index.ts',
  );
}

function resolveSdkworkCorePcReactBrowserFacadePath() {
  return path.join(
    workspaceRootDir,
    'scripts',
    'vite-shims',
    'sdkwork-core-pc-react-browser-facade.mjs',
  );
}

function resolveWorkspacePackageEntryPath(appRootDir, specifier, relativeEntryPath) {
  const packageJsonPath = resolvePackageJsonPathFromWorkspaceRoot(
    resolveWorkspaceRootDir(appRootDir),
    specifier,
  );

  if (!packageJsonPath) {
    throw new Error(
      `Unable to resolve ${specifier} from BirdCoder workspace ${resolveWorkspaceRootDir(appRootDir)}.`,
    );
  }

  return path.join(path.dirname(packageJsonPath), ...relativeEntryPath);
}

function createBirdcoderWorkspaceAliasEntries(appRootDir = defaultBirdcoderAppRootDir) {
  return [
    {
      find: /^qrcode\/lib\/browser\.js$/u,
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'qrcode',
        ['lib', 'browser.js'],
      ),
    },
    {
      find: /^qrcode$/u,
      replacement: path.resolve(
        appRootDir,
        '../../scripts/vite-shims/qrcode-compat.mjs',
      ),
    },
    {
      find: 'react-router-dom',
      replacement: resolveAppbaseWorkspacePackageEntryPath(
        appRootDir,
        'react-router-dom',
        ['dist', 'index.mjs'],
      ),
    },
    {
      find: 'react-router/dom',
      replacement: resolveAppbaseWorkspacePackageEntryPath(
        appRootDir,
        'react-router',
        ['dist', 'development', 'dom-export.mjs'],
      ),
    },
    {
      find: 'react-router',
      replacement: resolveAppbaseWorkspacePackageEntryPath(
        appRootDir,
        'react-router',
        ['dist', 'development', 'index.mjs'],
      ),
    },
    {
      find: 'cookie',
      replacement: path.resolve(
        appRootDir,
        '../../scripts/vite-shims/cookie-compat.mjs',
      ),
    },
    {
      find: 'set-cookie-parser',
      replacement: path.resolve(
        appRootDir,
        '../../scripts/vite-shims/set-cookie-parser-compat.mjs',
      ),
    },
    {
      find: /^@sdkwork\/core-pc-react\/(.+)$/u,
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-core/sdkwork-core-pc-react/src/$1',
      ),
    },
    {
      find: '@sdkwork/core-pc-react',
      replacement: resolveSdkworkCorePcReactBrowserFacadePath(),
    },
    {
      find: /^@sdkwork\/app-sdk\/(.+)$/u,
      replacement: path.resolve(
        appRootDir,
        '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/$1',
      ),
    },
    {
      find: '@sdkwork/app-sdk',
      replacement: path.resolve(
        appRootDir,
        '../../../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
      ),
    },
    {
      find: /^@sdkwork\/sdk-common\/(.+)$/u,
      replacement: path.resolve(
        appRootDir,
        '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/$1',
      ),
    },
    {
      find: '@sdkwork/sdk-common',
      replacement: path.resolve(
        appRootDir,
        '../../../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/appbase-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/foundation/sdkwork-appbase-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/auth-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/auth-runtime-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-auth-runtime-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/user-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/user-center-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/user-center-core-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-core-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/user-center-validation-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/identity/sdkwork-user-center-validation-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/vip-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/commerce/sdkwork-vip-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/wallet-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/commerce/sdkwork-wallet-pc-react/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/search-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-appbase/packages/pc-react/foundation/sdkwork-search-pc-react/src/index.ts',
      ),
    },
    {
      find: /^@sdkwork\/ui-pc-react\/(.+)$/u,
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-ui/sdkwork-ui-pc-react/src/$1',
      ),
    },
    {
      find: '@sdkwork/ui-pc-react',
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-ui/sdkwork-ui-pc-react/src/index.ts',
      ),
    },
    {
      find: /^@sdkwork\/birdcoder-([^/]+)\/(.+)$/u,
      replacement: path.resolve(appRootDir, '../sdkwork-birdcoder-$1/src/$2'),
    },
    {
      find: /^@sdkwork\/birdcoder-([^/]+)$/u,
      replacement: path.resolve(appRootDir, '../sdkwork-birdcoder-$1/src'),
    },
    {
      find: '@sdkwork/terminal-infrastructure',
      replacement: resolveBirdcoderTerminalInfrastructureRuntimePath(appRootDir),
    },
    {
      find: '@sdkwork/terminal-desktop',
      replacement: resolveSdkworkTerminalDesktopEntryPath(appRootDir),
    },
    {
      find: /^@sdkwork\/terminal-([^/]+)\/(.+)$/u,
      replacement: path.resolve(
        appRootDir,
        '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src/$2',
      ),
    },
    {
      find: /^@sdkwork\/terminal-([^/]+)$/u,
      replacement: path.resolve(appRootDir, '../../../sdkwork-terminal/packages/sdkwork-terminal-$1/src'),
    },
  ];
}

function createBirdcoderWorkspaceFsAllowList(appRootDir = defaultBirdcoderAppRootDir) {
  return [
    path.resolve(appRootDir, '../..'),
    path.resolve(appRootDir, '../../../sdkwork-appbase'),
    path.resolve(appRootDir, '../../../sdkwork-core'),
    path.resolve(appRootDir, '../../../sdkwork-ui'),
    path.resolve(appRootDir, '../../../sdkwork-terminal'),
    path.resolve(appRootDir, '../../../../spring-ai-plus-app-api'),
    path.resolve(appRootDir, '../../../../sdk'),
  ];
}

const commonJsCompatSpecifiers = [
  '@xterm/xterm',
  '@xterm/addon-canvas',
  '@xterm/addon-fit',
  '@xterm/addon-search',
  '@xterm/addon-unicode11',
  'qrcode/lib/browser.js',
  'void-elements',
  'style-to-js',
  'style-to-object',
  'inline-style-parser',
  'highlight.js',
  'debug',
  'extend',
];

const reactCompatBaseEntries = {
  react: {
    bundleRelativePath: ['react', 'index.js'],
    external: [],
  },
  'react/jsx-runtime': {
    bundleRelativePath: ['react', 'jsx-runtime.js'],
    external: ['react'],
  },
  'react/jsx-dev-runtime': {
    bundleRelativePath: ['react', 'jsx-dev-runtime.js'],
    external: ['react'],
  },
  'react-dom': {
    bundleRelativePath: ['react-dom', 'index.js'],
    external: ['react', 'scheduler'],
  },
  'react-dom/client': {
    bundleRelativePath: ['react-dom', 'client.js'],
    external: ['react', 'react-dom', 'scheduler'],
  },
  scheduler: {
    bundleRelativePath: ['scheduler', 'index.js'],
    external: [],
  },
  'use-sync-external-store/shim': {
    bundleRelativePath: ['use-sync-external-store', 'shim', 'index.js'],
    external: ['react'],
  },
};

function toVirtualModuleSlug(specifier) {
  return String(specifier ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function createVirtualModuleDescriptor(namespace, slug) {
  const normalizedNamespace = String(namespace ?? '').trim() || defaultBirdcoderNamespace;
  const normalizedSlug = String(slug ?? '').trim();

  return {
    publicId: `virtual:${normalizedNamespace}-${normalizedSlug}`,
    internalId: `\0${normalizedNamespace}-${normalizedSlug}`,
    compiledPublicId: `virtual:${normalizedNamespace}-${normalizedSlug}-compiled`,
    compiledInternalId: `\0${normalizedNamespace}-${normalizedSlug}-compiled`,
  };
}

function createCommonJsDefaultCompatEntries(namespace) {
  return Object.fromEntries(
    commonJsCompatSpecifiers.map((specifier) => [
      specifier,
      createVirtualModuleDescriptor(namespace, toVirtualModuleSlug(specifier)),
    ]),
  );
}

function createReactCompatEntries(namespace) {
  return Object.fromEntries(
    Object.entries(reactCompatBaseEntries).map(([specifier, descriptor]) => [
      specifier,
      {
        ...descriptor,
        ...createVirtualModuleDescriptor(namespace, toVirtualModuleSlug(specifier)),
      },
    ]),
  );
}

function createPackageRequire(packageRootDir = defaultBirdcoderAppRootDir) {
  return createRequire(path.join(packageRootDir, 'package.json'));
}

function createCommonJsDefaultCompatWrapperSource({ compiledPublicId, exportNames }) {
  const exportLines = exportNames
    .filter((exportName) => exportName !== 'default')
    .filter((exportName) => /^[$A-Z_a-z][$\w]*$/u.test(exportName))
    .map((exportName) => `export const ${exportName} = __compatModule[${JSON.stringify(exportName)}];`);

  return [
    `import * as __compatNamespace from '${compiledPublicId}';`,
    "const __compatModule = Object.prototype.hasOwnProperty.call(__compatNamespace, 'default')",
    '  ? __compatNamespace.default',
    '  : __compatNamespace;',
    'export default __compatModule;',
    ...exportLines,
  ].join('\n');
}

function resolveBundledEntryPath(appRootDir, bundleRelativePath) {
  const [packageName, ...relativePath] = bundleRelativePath;
  const packageRootDir = path.dirname(resolvePnpmPackageJsonPath(appRootDir, packageName) ?? '');

  if (!packageRootDir) {
    throw new Error(`Unable to resolve a bundled entry for ${packageName} from ${resolveWorkspaceRootDir(appRootDir)}.`);
  }

  return path.join(packageRootDir, ...relativePath);
}

function isTypeScriptModule(id) {
  return /\.[cm]?[jt]sx?$/u.test(id);
}

function containsNodeEnvExpression(code) {
  return /\bprocess\.env\.NODE_ENV\b/u.test(String(code ?? ''));
}

function normalizeWarningModuleReference(value) {
  return String(value ?? '').replace(/\\/gu, '/');
}

function isLucideReactEsmModule(id) {
  return /[\\/]lucide-react[\\/]dist[\\/]esm[\\/]/u.test(String(id ?? ''));
}

function isSharedReactRouterModule(id) {
  const normalizedId = normalizeWarningModuleReference(id);
  if (!normalizedId.includes('/sdkwork-appbase/node_modules/')) {
    return false;
  }

  const isReactRouterPackage =
    normalizedId.includes('/react-router/')
    || normalizedId.includes('/react-router-dom/');
  const isJavaScriptModule = /\.[cm]?[jt]sx?$/u.test(normalizedId);

  return isReactRouterPackage && isJavaScriptModule;
}

function isKnownSharedUiUseClientModule(id) {
  return /\/node_modules\/(?:@radix-ui\/react-[^/]+|cmdk|react-resizable-panels|sonner)(?:\/|$)/u.test(
    normalizeWarningModuleReference(id),
  );
}

function isKnownSmolTomlSelfCycleWarning(code, message) {
  const normalizedMessage = normalizeWarningModuleReference(message);
  return code === 'CIRCULAR_DEPENDENCY'
    && normalizedMessage.startsWith('Circular dependency:')
    && normalizedMessage.includes('/node_modules/smol-toml/dist/struct.js')
    && normalizedMessage.includes('/node_modules/smol-toml/dist/extract.js');
}

function isSharedCoreEnvModule(id) {
  return normalizeWarningModuleReference(id).endsWith('/sdkwork-core/sdkwork-core-pc-react/src/env/index.ts');
}

function patchSharedReactRouterModuleSource(code, mode) {
  return String(code)
    .replace(/^["']use client["'];?\s*/u, '')
    .replace(/\bprocess\.env\.NODE_ENV\b/gu, JSON.stringify(mode))
    .replace(/\bprocess\.env\?\.IS_RR_BUILD_REQUEST\b/gu, 'undefined')
    .replace(/\bimport\.meta\.hot\b/gu, 'undefined');
}

function patchSharedCoreEnvModuleSource(code) {
  return String(code).replace(
    /function readImportMetaEnv\(\): PcReactEnvSource \{[\s\S]*?\n\}/u,
    [
      'function readInjectedPcReactEnv(): PcReactEnvSource {',
      `  const runtimeGlobal = globalThis as RuntimeGlobal & { ${BIRDCODER_PUBLIC_RUNTIME_ENV_KEY}?: PcReactEnvSource; };`,
      `  return (runtimeGlobal.${BIRDCODER_PUBLIC_RUNTIME_ENV_KEY} ?? {}) as PcReactEnvSource;`,
      '}',
      '',
      'function readImportMetaEnv(): PcReactEnvSource {',
      '  return readInjectedPcReactEnv();',
      '}',
    ].join('\n'),
  );
}

function resolveBirdcoderPublicRuntimeEnv(runtimeEnvSource = {}, mode = 'development') {
  const filteredRuntimeEnv = Object.fromEntries(
    Object.entries(runtimeEnvSource).filter(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return false;
      }

      if (BIRDCODER_PUBLIC_RUNTIME_ENV_EXACT_KEYS.includes(key)) {
        return true;
      }

      return BIRDCODER_PUBLIC_RUNTIME_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
    }),
  );

  return {
    ...filteredRuntimeEnv,
    DEV: mode === 'development' ? 'true' : 'false',
    MODE: mode,
    NODE_ENV: mode,
    PROD: mode === 'production' ? 'true' : 'false',
    SDKWORK_VITE_MODE: mode,
  };
}

function shouldIgnoreBirdcoderRollupWarning(warning) {
  const warningCode = String(warning?.code ?? '').trim();
  const warningId = String(warning?.id ?? '').trim();
  const warningMessage = String(warning?.message ?? '').trim();
  const warningModuleReference = warningId || warningMessage;

  const isLucideUseClientNoise =
    warningCode === 'MODULE_LEVEL_DIRECTIVE'
      && isLucideReactEsmModule(warningModuleReference)
      && warningMessage.includes('"use client"');
  const isKnownSharedUiUseClientNoise =
    warningCode === 'MODULE_LEVEL_DIRECTIVE'
      && warningMessage.includes('"use client"')
      && isKnownSharedUiUseClientModule(warningModuleReference);
  const isSharedReactRouterUseClientNoise =
    warningCode === 'MODULE_LEVEL_DIRECTIVE'
      && warningMessage.includes('"use client"')
      && isSharedReactRouterModule(warningModuleReference);
  const isKnownSmolTomlSelfCycle = isKnownSmolTomlSelfCycleWarning(
    warningCode,
    warningMessage,
  );
  return isLucideUseClientNoise
    || isKnownSharedUiUseClientNoise
    || isSharedReactRouterUseClientNoise
    || isKnownSmolTomlSelfCycle;
}

function onBirdcoderRollupWarning(warning, warn) {
  if (shouldIgnoreBirdcoderRollupWarning(warning)) {
    return;
  }

  const warningCode = String(warning?.code ?? 'UNKNOWN_WARNING').trim() || 'UNKNOWN_WARNING';
  const warningMessage = String(warning?.message ?? warning ?? '').trim();
  throw new Error(
    [
      `BirdCoder Rollup warning is not governed (${warningCode}).`,
      warningMessage || 'No warning message was provided.',
    ].join('\n'),
  );
}

function resolveRollupEntryPath(commonjsEntryPath) {
  const candidatePaths = [
    path.resolve(path.dirname(commonjsEntryPath), '..', '..', '..', '..', 'rollup', 'dist', 'es', 'rollup.js'),
    path.resolve(path.dirname(commonjsEntryPath), '..', '..', '..', 'rollup', 'dist', 'es', 'rollup.js'),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(`Unable to resolve a Rollup runtime next to ${commonjsEntryPath}.`);
}

async function loadRollupRuntime(toolingRequire) {
  const commonjsEntryPath = toolingRequire.resolve('@rollup/plugin-commonjs');
  const rollupEntryPath = resolveRollupEntryPath(commonjsEntryPath);

  const [{ rollup }, { default: commonjs }] = await Promise.all([
    import(pathToFileURL(rollupEntryPath).href),
    import(pathToFileURL(commonjsEntryPath).href),
  ]);

  return {
    rollup,
    commonjs,
  };
}

function readModuleExportNames(packageRequire, specifier) {
  const namespace = packageRequire(specifier);

  return Object.keys(namespace).filter((exportName) => exportName !== 'default');
}

function collectEsmExportNames(source) {
  const exportNames = new Set();

  for (const match of String(source).matchAll(/export\s*\{([^}]+)\}/gu)) {
    const rawSpecifiers = String(match[1] ?? '')
      .split(',')
      .map((specifier) => specifier.trim())
      .filter(Boolean);
    for (const rawSpecifier of rawSpecifiers) {
      const aliasMatch = /\bas\s+([A-Za-z_$][\w$]*)$/u.exec(rawSpecifier);
      const exportName = aliasMatch?.[1] ?? rawSpecifier.split(/\s+/u)[0];
      if (exportName && exportName !== 'default') {
        exportNames.add(exportName);
      }
    }
  }

  for (const match of String(source).matchAll(/export\s+(?:const|function|class|let|var)\s+([A-Za-z_$][\w$]*)/gu)) {
    const exportName = String(match[1] ?? '').trim();
    if (exportName && exportName !== 'default') {
      exportNames.add(exportName);
    }
  }

  return [...exportNames];
}

function resolveWorkspaceRootDir(appRootDir = defaultBirdcoderAppRootDir) {
  return path.resolve(appRootDir, '../..');
}

function resolvePackageJsonPathFromWorkspaceRoot(workspaceRootDir, specifier) {
  const packageName = resolvePackageNameFromSpecifier(specifier);
  const directPackageJsonPath = path.join(
    workspaceRootDir,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );

  if (existsSync(directPackageJsonPath)) {
    return directPackageJsonPath;
  }

  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  if (!existsSync(pnpmStoreDir)) {
    return null;
  }

  const candidatePackageJsonPaths = readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(pnpmStoreDir, entry.name, 'node_modules', ...packageName.split('/'), 'package.json'))
    .filter((candidatePath) => existsSync(candidatePath))
    .sort((left, right) => compareVersionLike(right, left));

  return candidatePackageJsonPaths[0] ?? null;
}

function resolveAppbaseWorkspacePackageEntryPath(appRootDir, specifier, relativeEntryPath) {
  const appbaseWorkspaceRootDir = path.resolve(appRootDir, '../../../sdkwork-appbase');
  const packageJsonPath = resolvePackageJsonPathFromWorkspaceRoot(appbaseWorkspaceRootDir, specifier)
    ?? resolveAppbaseManagedBridgePackageJsonPath(appbaseWorkspaceRootDir, specifier);

  if (!packageJsonPath) {
    throw new Error(
      `Unable to resolve ${specifier} from shared workspace ${appbaseWorkspaceRootDir}.`,
    );
  }

  return path.join(path.dirname(packageJsonPath), ...relativeEntryPath);
}

function resolveAppbaseManagedBridgePackageJsonPath(appbaseWorkspaceRootDir, specifier) {
  const packageName = resolvePackageNameFromSpecifier(specifier);
  const bridgePackageRoots = [
    'packages/pc-react/identity/sdkwork-auth-pc-react',
    'packages/pc-react/identity/sdkwork-user-center-pc-react',
  ];

  for (const bridgePackageRoot of bridgePackageRoots) {
    const candidatePackageJsonPath = path.join(
      appbaseWorkspaceRootDir,
      bridgePackageRoot,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    );
    if (existsSync(candidatePackageJsonPath)) {
      return candidatePackageJsonPath;
    }
  }

  return null;
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function resolvePackageNameFromSpecifier(specifier) {
  const normalizedSpecifier = String(specifier ?? '').trim();
  if (!normalizedSpecifier) {
    return normalizedSpecifier;
  }

  if (normalizedSpecifier.startsWith('@')) {
    const [scope, name] = normalizedSpecifier.split('/');
    return scope && name ? `${scope}/${name}` : normalizedSpecifier;
  }

  return normalizedSpecifier.split('/')[0];
}

function resolvePnpmPackageJsonPath(appRootDir, specifier) {
  return resolvePackageJsonPathFromWorkspaceRoot(resolveWorkspaceRootDir(appRootDir), specifier);
}

function createPackageRootRequireForSpecifier(appRootDir, specifier) {
  const packageJsonPath = resolvePnpmPackageJsonPath(appRootDir, specifier);

  if (!packageJsonPath) {
    throw new Error(`Unable to resolve package.json for ${specifier} from ${resolveWorkspaceRootDir(appRootDir)}.`);
  }

  return createRequire(packageJsonPath);
}

function resolveCompatEntryPath(appRootDir, specifier) {
  const packageJsonPath = resolvePnpmPackageJsonPath(appRootDir, specifier);

  if (!packageJsonPath) {
    throw new Error(`Unable to resolve a compat entry for ${specifier} from ${resolveWorkspaceRootDir(appRootDir)}.`);
  }

  const packageRootDir = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const packageRequire = createRequire(packageJsonPath);

  if (typeof packageJson.browser === 'string') {
    return path.resolve(packageRootDir, packageJson.browser);
  }

  const resolvedSpecifierPath = packageRequire.resolve(specifier);
  if (packageJson.browser && typeof packageJson.browser === 'object' && !Array.isArray(packageJson.browser)) {
    const normalizedResolvedRelativePath = `./${path.relative(packageRootDir, resolvedSpecifierPath).replace(/\\/gu, '/')}`;
    const browserMappedPath = packageJson.browser[normalizedResolvedRelativePath];
    if (typeof browserMappedPath === 'string') {
      return path.resolve(packageRootDir, browserMappedPath);
    }
  }

  return resolvedSpecifierPath;
}

function isBareSpecifier(source) {
  return Boolean(source) && !source.startsWith('.') && !source.startsWith('/') && !path.isAbsolute(source);
}

function createRollupRequireResolvePlugin({ namespace, resolverRequire, external = [] }) {
  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-rollup-require-resolve`,
    resolveId(source) {
      if (external.includes(source)) {
        return {
          id: source,
          external: true,
        };
      }

      if (!isBareSpecifier(source)) {
        return null;
      }

      try {
        return resolverRequire.resolve(source);
      } catch {
        return null;
      }
    },
  };

  return plugin;
}

function createReactCompatWrapperSource({ compiledPublicId, exportNames }) {
  const exportLines = exportNames.map((exportName) => `export const ${exportName} = __compatModule.${exportName};`);

  return [
    `import __compatModule from '${compiledPublicId}';`,
    'export default __compatModule;',
    ...exportLines,
  ].join('\n');
}

function replaceNodeEnv(code, mode) {
  return code.replace(/\bprocess\.env\.NODE_ENV\b/gu, JSON.stringify(mode));
}

function createBirdcoderCommonJsDefaultCompatPlugin({
  appRootDir = defaultBirdcoderAppRootDir,
  toolingRootDir = defaultBirdcoderToolingRootDir,
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  const appRequire = createPackageRequire(appRootDir);
  const toolingRequire = createPackageRequire(toolingRootDir);
  const compatEntries = createCommonJsDefaultCompatEntries(namespace);
  const resolverRequireCache = new Map();
  const compiledModuleSourceCache = new Map();
  const wrapperSourceCache = new Map();
  let rollupRuntimePromise;

  function getResolverRequire(specifier) {
    if (!resolverRequireCache.has(specifier)) {
      resolverRequireCache.set(specifier, createPackageRootRequireForSpecifier(appRootDir, specifier));
    }

    return resolverRequireCache.get(specifier);
  }

  async function getRollupRuntime() {
    if (!rollupRuntimePromise) {
      rollupRuntimePromise = loadRollupRuntime(toolingRequire);
    }

    return rollupRuntimePromise;
  }

  async function getCompiledModuleSource(specifier) {
    if (!compiledModuleSourceCache.has(specifier)) {
      compiledModuleSourceCache.set(
        specifier,
        (async () => {
          const resolverRequire = getResolverRequire(specifier);
          const { rollup, commonjs } = await getRollupRuntime();
          const bundle = await rollup({
            input: resolveCompatEntryPath(appRootDir, specifier),
            plugins: [
              createRollupRequireResolvePlugin({
                namespace,
                resolverRequire,
              }),
              commonjs({
                extensions: ['.js'],
                transformMixedEsModules: true,
              }),
            ],
            onwarn() {},
          });

          try {
            const output = await bundle.generate({
              format: 'esm',
            });
            const chunk = output.output.find((item) => item.type === 'chunk');
            if (!chunk) {
              throw new Error(`Expected an ESM chunk when bundling ${specifier}.`);
            }

            return replaceNodeEnv(chunk.code, mode);
          } finally {
            await bundle.close();
          }
        })(),
      );
    }

    return compiledModuleSourceCache.get(specifier);
  }

  async function getWrapperSource(specifier) {
    if (!wrapperSourceCache.has(specifier)) {
      const descriptor = compatEntries[specifier];

      wrapperSourceCache.set(
        specifier,
        (async () => {
          const compiledModuleSource = await getCompiledModuleSource(specifier);
          return createCommonJsDefaultCompatWrapperSource({
            compiledPublicId: descriptor.compiledPublicId,
            exportNames: collectEsmExportNames(compiledModuleSource),
          });
        })(),
      );
    }

    return wrapperSourceCache.get(specifier);
  }

  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-cjs-default-compat`,
    /** @type {'pre'} */
    enforce: 'pre',
    resolveId(source) {
      for (const [specifier, descriptor] of Object.entries(compatEntries)) {
        if (source === specifier) {
          return descriptor.internalId;
        }
        if (source === descriptor.compiledPublicId) {
          return descriptor.compiledInternalId;
        }
      }

      return null;
    },
    async load(id) {
      for (const [specifier, descriptor] of Object.entries(compatEntries)) {
        if (id === descriptor.internalId) {
          return getWrapperSource(specifier);
        }
        if (id === descriptor.compiledInternalId) {
          return getCompiledModuleSource(specifier);
        }
      }

      return null;
    },
  };

  return plugin;
}

function createBirdcoderReactCompatPlugin({
  appRootDir = defaultBirdcoderAppRootDir,
  toolingRootDir = defaultBirdcoderToolingRootDir,
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  const toolingRequire = createPackageRequire(toolingRootDir);
  const compatEntries = createReactCompatEntries(namespace);
  const resolverRequireCache = new Map();
  const compiledModuleSourceCache = new Map();
  const wrapperSourceCache = new Map();
  let rollupRuntimePromise;

  function getResolverRequire(specifier) {
    if (!resolverRequireCache.has(specifier)) {
      resolverRequireCache.set(specifier, createPackageRootRequireForSpecifier(appRootDir, specifier));
    }

    return resolverRequireCache.get(specifier);
  }

  async function getRollupRuntime() {
    if (!rollupRuntimePromise) {
      rollupRuntimePromise = loadRollupRuntime(toolingRequire);
    }

    return rollupRuntimePromise;
  }

  async function getCompiledModuleSource(specifier) {
    if (!compiledModuleSourceCache.has(specifier)) {
      compiledModuleSourceCache.set(
        specifier,
        (async () => {
          const descriptor = compatEntries[specifier];
          const { rollup, commonjs } = await getRollupRuntime();
          const bundle = await rollup({
            input: resolveBundledEntryPath(appRootDir, descriptor.bundleRelativePath),
            external: descriptor.external,
            plugins: [
              commonjs({
                extensions: ['.js'],
                transformMixedEsModules: true,
              }),
            ],
            onwarn() {},
          });

          try {
            const output = await bundle.generate({
              format: 'esm',
            });
            const chunk = output.output.find((item) => item.type === 'chunk');
            if (!chunk) {
              throw new Error(`Expected an ESM chunk when bundling ${specifier}.`);
            }

            return replaceNodeEnv(chunk.code, mode);
          } finally {
            await bundle.close();
          }
        })(),
      );
    }

    return compiledModuleSourceCache.get(specifier);
  }

  async function getWrapperSource(specifier) {
    if (!wrapperSourceCache.has(specifier)) {
      const descriptor = compatEntries[specifier];
      const exportNames = readModuleExportNames(getResolverRequire(specifier), specifier);

      wrapperSourceCache.set(
        specifier,
        Promise.resolve(
          createReactCompatWrapperSource({
            compiledPublicId: descriptor.compiledPublicId,
            exportNames,
          }),
        ),
      );
    }

    return wrapperSourceCache.get(specifier);
  }

  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-react-compat`,
    /** @type {'pre'} */
    enforce: 'pre',
    resolveId(source) {
      for (const [specifier, descriptor] of Object.entries(compatEntries)) {
        if (source === specifier) {
          return descriptor.internalId;
        }
        if (source === descriptor.compiledPublicId) {
          return descriptor.compiledInternalId;
        }
      }

      return null;
    },
    async load(id) {
      for (const [specifier, descriptor] of Object.entries(compatEntries)) {
        if (id === descriptor.internalId) {
          return getWrapperSource(specifier);
        }
        if (id === descriptor.compiledInternalId) {
          return getCompiledModuleSource(specifier);
        }
      }

      return null;
    },
  };

  return plugin;
}

function createBirdcoderTypeScriptTransformPlugin({
  toolingRootDir = defaultBirdcoderToolingRootDir,
  namespace = defaultBirdcoderNamespace,
} = {}) {
  const toolingRequire = createPackageRequire(toolingRootDir);
  let typescriptPromise;

  async function getTypeScriptRuntime() {
    if (!typescriptPromise) {
      typescriptPromise = import(pathToFileURL(toolingRequire.resolve('typescript')).href);
    }

    return typescriptPromise;
  }

  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-typescript-transpile`,
    /** @type {'pre'} */
    enforce: 'pre',
    async transform(code, id) {
      const cleanId = String(id ?? '').split('?')[0] ?? '';
      if (!cleanId || cleanId.includes('/node_modules/') || cleanId.endsWith('.d.ts') || !isTypeScriptModule(cleanId)) {
        return null;
      }

      const ts = await getTypeScriptRuntime();
      const transpileResult = ts.transpileModule(code, {
        compilerOptions: {
          allowJs: true,
          isolatedModules: true,
          jsx: ts.JsxEmit.ReactJSX,
          jsxImportSource: 'react',
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          sourceMap: true,
          inlineSources: true,
          target: ts.ScriptTarget.ESNext,
          useDefineForClassFields: true,
        },
        fileName: cleanId,
        reportDiagnostics: false,
      });

      return {
        code: transpileResult.outputText,
        map: transpileResult.sourceMapText ? JSON.parse(transpileResult.sourceMapText) : null,
      };
    },
  };

  return plugin;
}

function createBirdcoderNodeEnvGuardPlugin({
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-node-env-guard`,
    /** @type {'pre'} */
    enforce: 'pre',
    transform(code, id) {
      const cleanId = String(id ?? '').split('?')[0] ?? '';
      if (!cleanId || cleanId.endsWith('.css') || cleanId.endsWith('.json') || !isTypeScriptModule(cleanId)) {
        return null;
      }

      if (!containsNodeEnvExpression(code)) {
        return null;
      }

      return {
        code: replaceNodeEnv(code, mode),
        map: null,
      };
    },
  };

  return plugin;
}

function createBirdcoderCoreEnvCompatPlugin({
  namespace = defaultBirdcoderNamespace,
} = {}) {
  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-core-env-compat`,
    /** @type {'pre'} */
    enforce: 'pre',
    transform(code, id) {
      const cleanId = String(id ?? '').split('?')[0] ?? '';
      if (!cleanId || !isSharedCoreEnvModule(cleanId)) {
        return null;
      }

      const patchedCode = patchSharedCoreEnvModuleSource(code);
      if (patchedCode === code) {
        return null;
      }

      return {
        code: patchedCode,
        map: null,
      };
    },
  };

  return plugin;
}

function createBirdcoderSharedRouterCompatPlugin({
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-shared-router-compat`,
    /** @type {'pre'} */
    enforce: 'pre',
    transform(code, id) {
      const cleanId = String(id ?? '').split('?')[0] ?? '';
      if (!cleanId || !isSharedReactRouterModule(cleanId)) {
        return null;
      }

      const patchedCode = patchSharedReactRouterModuleSource(code, mode);
      if (patchedCode === code) {
        return null;
      }

      return {
        code: patchedCode,
        map: null,
      };
    },
  };

  return plugin;
}

function createBirdcoderRuntimeEnvBootstrapPlugin({
  mode = 'development',
  runtimeEnvSource = {},
  namespace = defaultBirdcoderNamespace,
} = {}) {
  const publicRuntimeEnv = resolveBirdcoderPublicRuntimeEnv(runtimeEnvSource, mode);

  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-runtime-env-bootstrap`,
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `globalThis.${BIRDCODER_PUBLIC_RUNTIME_ENV_KEY} = Object.freeze(${JSON.stringify(publicRuntimeEnv)});`,
        },
      ];
    },
  };

  return plugin;
}

function createBirdcoderVitePlugins({
  appRootDir = defaultBirdcoderAppRootDir,
  runtimeEnvSource = process.env,
  toolingRootDir = defaultBirdcoderToolingRootDir,
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  /** @type {BirdcoderOpaqueVitePluginOption[]} */
  const plugins = [
    createBirdcoderCommonJsDefaultCompatPlugin({
      appRootDir,
      toolingRootDir,
      mode,
      namespace,
    }),
    createBirdcoderRuntimeEnvBootstrapPlugin({
      mode,
      runtimeEnvSource,
      namespace,
    }),
    createBirdcoderSharedRouterCompatPlugin({
      mode,
      namespace,
    }),
    createBirdcoderCoreEnvCompatPlugin({
      namespace,
    }),
    createBirdcoderNodeEnvGuardPlugin({
      mode,
      namespace,
    }),
    createBirdcoderTypeScriptTransformPlugin({
      toolingRootDir,
      namespace,
    }),
    createBirdcoderReactCompatPlugin({
      appRootDir,
      toolingRootDir,
      mode,
      namespace,
    }),
    tailwindcss(),
  ];

  return plugins;
}

export {
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  createBirdcoderCommonJsDefaultCompatPlugin,
  createBirdcoderCoreEnvCompatPlugin,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderReactCompatPlugin,
  createBirdcoderNodeEnvGuardPlugin,
  createBirdcoderRuntimeEnvBootstrapPlugin,
  createBirdcoderSharedRouterCompatPlugin,
  createBirdcoderTypeScriptTransformPlugin,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderTerminalInfrastructureRuntimePath,
  resolveSdkworkTerminalDesktopEntryPath,
  resolveSdkworkTerminalInfrastructureEntryPath,
  shouldIgnoreBirdcoderRollupWarning,
};
