import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';

/** @typedef {import('vite').Plugin} VitePlugin */
/** @typedef {import('vite').PluginOption} VitePluginOption */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const defaultBirdcoderToolingRootDir = path.join(workspaceRootDir, 'packages', 'sdkwork-birdcoder-desktop');
const defaultBirdcoderAppRootDir = defaultBirdcoderToolingRootDir;
const defaultBirdcoderNamespace = 'sdkwork-birdcoder-desktop';

const BIRDCODER_VITE_DEDUPE_PACKAGES = ['react', 'react-dom', 'react-i18next', 'scheduler', 'use-sync-external-store'];

const commonJsCompatSpecifiers = [
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

function isLucideReactEsmModule(id) {
  return /[\\/]lucide-react[\\/]dist[\\/]esm[\\/]/u.test(String(id ?? ''));
}

function shouldIgnoreBirdcoderRollupWarning(warning) {
  const warningCode = String(warning?.code ?? '').trim();
  const warningId = String(warning?.id ?? '').trim();
  const warningMessage = String(warning?.message ?? '').trim();

  return warningCode === 'MODULE_LEVEL_DIRECTIVE'
    && isLucideReactEsmModule(warningId || warningMessage)
    && warningMessage.includes('"use client"');
}

function onBirdcoderRollupWarning(warning, warn) {
  if (shouldIgnoreBirdcoderRollupWarning(warning)) {
    return;
  }

  warn(warning);
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

function resolveWorkspaceRootDir(appRootDir = defaultBirdcoderAppRootDir) {
  return path.resolve(appRootDir, '../..');
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
  const packageName = resolvePackageNameFromSpecifier(specifier);
  const resolvedWorkspaceRootDir = resolveWorkspaceRootDir(appRootDir);
  const directPackageJsonPath = path.join(
    resolvedWorkspaceRootDir,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );

  if (existsSync(directPackageJsonPath)) {
    return directPackageJsonPath;
  }

  const pnpmStoreDir = path.join(resolvedWorkspaceRootDir, 'node_modules', '.pnpm');
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

  if (typeof packageJson.browser === 'string') {
    return path.resolve(packageRootDir, packageJson.browser);
  }

  return createRequire(packageJsonPath).resolve(specifier);
}

function isBareSpecifier(source) {
  return Boolean(source) && !source.startsWith('.') && !source.startsWith('/') && !path.isAbsolute(source);
}

function createRollupRequireResolvePlugin({ namespace, resolverRequire, external = [] }) {
  /** @type {VitePlugin} */
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
      const resolverRequire = getResolverRequire(specifier);

      wrapperSourceCache.set(
        specifier,
        Promise.resolve(
          createCommonJsDefaultCompatWrapperSource({
            compiledPublicId: descriptor.compiledPublicId,
            exportNames: readModuleExportNames(resolverRequire, specifier),
          }),
        ),
      );
    }

    return wrapperSourceCache.get(specifier);
  }

  /** @type {VitePlugin} */
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

  /** @type {VitePlugin} */
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

  /** @type {VitePlugin} */
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

function createBirdcoderVitePlugins({
  appRootDir = defaultBirdcoderAppRootDir,
  toolingRootDir = defaultBirdcoderToolingRootDir,
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  /** @type {VitePluginOption[]} */
  const plugins = [
    createBirdcoderCommonJsDefaultCompatPlugin({
      appRootDir,
      toolingRootDir,
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
  createBirdcoderCommonJsDefaultCompatPlugin,
  createBirdcoderReactCompatPlugin,
  createBirdcoderTypeScriptTransformPlugin,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  shouldIgnoreBirdcoderRollupWarning,
};
