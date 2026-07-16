import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const defaultBirdcoderToolingRootDir = path.join(workspaceRootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-desktop');
const defaultBirdcoderAppRootDir = defaultBirdcoderToolingRootDir;
const terminalPcPackageIds = [
  'terminal-pc-ai-cli',
  'terminal-pc-commons',
  'terminal-pc-contracts',
  'terminal-pc-core',
  'terminal-pc-diagnostics',
  'terminal-pc-i18n',
  'terminal-pc-resources',
  'terminal-pc-sessions',
  'terminal-pc-settings',
  'terminal-pc-shell',
  'terminal-pc-types',
  'terminal-pc-ui',
  'terminal-pc-workbench',
];
const defaultBirdcoderNamespace = 'sdkwork-birdcoder-pc-desktop';

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
  '@xterm/addon-web-links',
  'qrcode',
  'qrcode/lib/browser.js',
];
const BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE = [
  'qrcode',
  'qrcode/lib/browser.js',
];
const BIRDCODER_VITE_DEV_WATCH_IGNORED = [
  '**/.local/**',
  '**/*.sqlite3',
  '**/*.sqlite3-wal',
  '**/*.sqlite3-shm',
];
const BIRDCODER_PUBLIC_RUNTIME_ENV_KEY = '__SDKWORK_PC_REACT_ENV__';
const BIRDCODER_CREDENTIAL_ENTRY_ENV_KEY = '__SDKWORK_IAM_CREDENTIAL_ENTRY_ENV__';
const BIRDCODER_PUBLIC_RUNTIME_ENV_EXACT_KEYS = ['DEV', 'MODE', 'NODE_ENV', 'PROD'];
const BIRDCODER_PUBLIC_RUNTIME_ENV_ALLOWED_KEYS = new Set([
  ...BIRDCODER_PUBLIC_RUNTIME_ENV_EXACT_KEYS,
  'SDKWORK_RUNTIME_TARGET',
  'SDKWORK_VITE_MODE',
  'SDKWORK_BIRDCODER_APP_API_BASE_URL',
  'SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL',
  'SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE',
  'SDKWORK_BIRDCODER_RUNTIME_TARGET',
  'VITE_BIRDCODER_API_BASE_URL',
  'VITE_BIRDCODER_IAM_DEPLOYMENT_MODE',
  'VITE_BIRDCODER_APP_API_BASE_URL',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD',
  'VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_ENABLED',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
  'VITE_BIRDCODER_OFFICIAL_WEBSITE_URL',
  'VITE_BIRDCODER_PRIVACY_POLICY_URL',
  'VITE_BIRDCODER_SUPPORT_URL',
  'VITE_BIRDCODER_TERMS_OF_SERVICE_URL',
  'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
  'VITE_SDKWORK_APP_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL',
  'VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE',
  'VITE_SDKWORK_BIRDCODER_IAM_DEPLOYMENT_MODE',
  'VITE_SDKWORK_BIRDCODER_OFFICIAL_WEBSITE_URL',
  'VITE_SDKWORK_BIRDCODER_REALTIME_TRANSPORT',
  'VITE_SDKWORK_BIRDCODER_PRIVACY_POLICY_URL',
  'VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET',
  'VITE_SDKWORK_BIRDCODER_SUPPORT_URL',
  'VITE_SDKWORK_BIRDCODER_TERMS_OF_SERVICE_URL',
  'VITE_SDKWORK_DEPLOYMENT_PROFILE',
  'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
  'VITE_SDKWORK_ENVIRONMENT',
  'VITE_SDKWORK_IAM_APP_API_BASE_URL',
  'VITE_SDKWORK_MESSAGING_APP_API_BASE_URL',
  'VITE_SDKWORK_RUNTIME_TARGET',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_ACCOUNT',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_EMAIL',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_PHONE',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_LOGIN_METHOD',
  'VITE_SDKWORK_AUTH_DEV_PREFILL_ENABLED',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_ENABLED',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
]);
const BIRDCODER_PUBLIC_RUNTIME_ENV_DEV_ONLY_KEYS = new Set([
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE',
  'VITE_BIRDCODER_AUTH_DEV_DEFAULT_LOGIN_METHOD',
  'VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_ENABLED',
  'VITE_BIRDCODER_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_ACCOUNT',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_EMAIL',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_PHONE',
  'VITE_SDKWORK_AUTH_DEV_DEFAULT_LOGIN_METHOD',
  'VITE_SDKWORK_AUTH_DEV_PREFILL_ENABLED',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_ENABLED',
  'VITE_SDKWORK_AUTH_DEV_VERIFICATION_CODE_PREFILL_ENABLED',
]);
const BIRDCODER_PUBLIC_RUNTIME_ENV_API_ORIGIN_KEYS = new Set([
  'SDKWORK_BIRDCODER_APP_API_BASE_URL',
  'SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL',
  'VITE_BIRDCODER_API_BASE_URL',
  'VITE_BIRDCODER_APP_API_BASE_URL',
  'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
  'VITE_SDKWORK_APP_API_BASE_URL',
  'VITE_SDKWORK_BACKEND_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_APP_API_BASE_URL',
  'VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL',
  'VITE_SDKWORK_BIRDCODER_BACKEND_API_BASE_URL',
  'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
  'VITE_SDKWORK_IAM_APP_API_BASE_URL',
  'VITE_SDKWORK_MESSAGING_APP_API_BASE_URL',
]);

export function resolveBirdcoderDevelopmentApiEnvDefines(mode = 'development') {
  if (mode !== 'development' && mode !== 'test') {
    return {};
  }

  return Object.fromEntries(
    [...BIRDCODER_PUBLIC_RUNTIME_ENV_API_ORIGIN_KEYS].map((key) => [
      `import.meta.env.${key}`,
      'undefined',
    ]),
  );
}

export function isBirdcoderPublicRuntimeEnvKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return false;
  }
  return BIRDCODER_PUBLIC_RUNTIME_ENV_ALLOWED_KEYS.has(key);
}

export function resolveBirdcoderProductionMinify(mode) {
  return mode === 'production' ? 'terser' : false;
}

export function resolveBirdcoderProductionCssMinify(mode) {
  return mode === 'production';
}

function resolveBirdcoderTerminalInfrastructureRuntimePath(
  appRootDir = defaultBirdcoderAppRootDir,
) {
  return path.resolve(
    appRootDir,
    '../sdkwork-birdcoder-pc-commons/src/terminal/birdcoderTerminalInfrastructureRuntime.ts',
  );
}

function resolveDependencyRootDir(dependencyId) {
  return path.resolve(workspaceRootDir, '..', dependencyId);
}

function resolveDependencyPath(dependencyId, ...relativePathParts) {
  return path.resolve(resolveDependencyRootDir(dependencyId), ...relativePathParts);
}

function resolveSdkworkTerminalDesktopRootPath(appRootDir = defaultBirdcoderAppRootDir) {
  return resolveDependencyPath(
    'sdkwork-terminal',
    'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-desktop/src',
  );
}

function resolveSdkworkTerminalDesktopEntryPath(appRootDir = defaultBirdcoderAppRootDir) {
  return path.join(resolveSdkworkTerminalDesktopRootPath(appRootDir), 'index.ts');
}

function resolveSdkworkTerminalDesktopSurfaceEntryPath(appRootDir = defaultBirdcoderAppRootDir) {
  return path.join(resolveSdkworkTerminalDesktopRootPath(appRootDir), 'surface/App.tsx');
}

function resolveSdkworkTerminalDesktopHostEntryPath(appRootDir = defaultBirdcoderAppRootDir) {
  return path.join(resolveSdkworkTerminalDesktopRootPath(appRootDir), 'host/index.ts');
}

function resolveSdkworkTerminalInfrastructureEntryPath(
  appRootDir = defaultBirdcoderAppRootDir,
) {
  return resolveDependencyPath('sdkwork-terminal', 'apps/sdkwork-terminal-pc/packages/sdkwork-terminal-pc-infrastructure/src/index.ts');
}

function resolveSdkworkTerminalLocalRuntimeAppSdkEntryPath() {
  const relativeCandidates = [
    'apps/sdkwork-terminal-pc/sdks/sdkwork-terminal-app-sdk/sdkwork-terminal-app-sdk-typescript/src/index.ts',
    'apps/sdkwork-terminal-pc/sdks/sdkwork-terminal-local-runtime-app-sdk/sdkwork-terminal-local-runtime-app-sdk-typescript/src/index.ts',
  ];
  return relativeCandidates
    .map((relativePath) => resolveDependencyPath('sdkwork-terminal', relativePath))
    .find((candidatePath) => existsSync(candidatePath))
    ?? resolveDependencyPath('sdkwork-terminal', relativeCandidates[0]);
}

function resolveSdkworkCorePcReactBrowserFacadePath() {
  return path.join(
    workspaceRootDir,
    'scripts',
    'vite-shims',
    'sdkwork-core-pc-react-browser-facade.mjs',
  );
}

function resolveWorkspacePackageEntryPath(
  appRootDir,
  specifier,
  relativeEntryPath,
  { allowMissing = false } = {},
) {
  const packageJsonPath = resolvePackageJsonPathFromWorkspaceRoot(
    resolveWorkspaceRootDir(appRootDir),
    specifier,
  );

  if (!packageJsonPath) {
    if (allowMissing) {
      return path.join(
        resolveWorkspaceRootDir(appRootDir),
        'node_modules',
        ...resolvePackageNameFromSpecifier(specifier).split('/'),
        ...relativeEntryPath,
      );
    }

    throw new Error(
      `Unable to resolve ${specifier} from BirdCoder workspace ${resolveWorkspaceRootDir(appRootDir)}.`,
    );
  }

  return path.join(path.dirname(packageJsonPath), ...relativeEntryPath);
}

function createBirdcoderWorkspaceAliasEntries(appRootDir = defaultBirdcoderAppRootDir) {
  return [
    {
      find: '@xterm/xterm/css/xterm.css',
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        '@xterm/xterm',
        ['css', 'xterm.css'],
      ),
    },
    {
      find: /^@tauri-apps\/api\/(.+)$/u,
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        '@tauri-apps/api',
        ['$1.js'],
      ),
    },
    {
      find: 'lucide-react',
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'lucide-react',
        ['dist', 'esm', 'lucide-react.js'],
      ),
    },
    {
      find: /^qrcode\/lib\/browser\.js$/u,
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'qrcode',
        ['lib', 'browser.js'],
        { allowMissing: true },
      ),
    },
    {
      find: /^qrcode$/u,
      replacement: path.resolve(
        workspaceRootDir,
        'scripts/vite-shims/qrcode-compat.mjs',
      ),
    },
    {
      find: 'react-router-dom',
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'react-router-dom',
        ['dist', 'index.mjs'],
      ),
    },
    {
      find: 'react-router/dom',
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'react-router',
        ['dist', 'development', 'dom-export.mjs'],
      ),
    },
    {
      find: 'react-router',
      replacement: resolveWorkspacePackageEntryPath(
        appRootDir,
        'react-router',
        ['dist', 'development', 'index.mjs'],
      ),
    },
    {
      find: 'cookie',
      replacement: path.resolve(
        workspaceRootDir,
        'scripts/vite-shims/cookie-compat.mjs',
      ),
    },
    {
      find: 'set-cookie-parser',
      replacement: path.resolve(
        workspaceRootDir,
        'scripts/vite-shims/set-cookie-parser-compat.mjs',
      ),
    },
    {
      find: /^@sdkwork\/core-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-core', 'sdkwork-core-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/core-pc-react',
      replacement: resolveSdkworkCorePcReactBrowserFacadePath(),
    },
    {
      find: /^@sdkwork\/sdk-common\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-sdk-commons', 'sdkwork-sdk-common-typescript/src/$1'),
    },
    {
      find: '@sdkwork/sdk-common',
      replacement: resolveDependencyPath('sdkwork-sdk-commons', 'sdkwork-sdk-common-typescript/src/index.ts'),
    },
    {
      find: /^@sdkwork\/utils\/(.+)$/u,
      replacement: resolveDependencyPath(
        'sdkwork-utils',
        'packages/sdkwork-utils-typescript/dist/$1.js',
      ),
    },
    {
      find: '@sdkwork/utils',
      replacement: resolveDependencyPath(
        'sdkwork-utils',
        'packages/sdkwork-utils-typescript/dist/index.js',
      ),
    },
    {
      find: '@sdkwork/iam-app-sdk',
      replacement: resolveDependencyPath('sdkwork-iam', 'sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/src/index.ts'),
    },
    {
      find: '@sdkwork/iam-backend-sdk',
      replacement: resolveDependencyPath('sdkwork-iam', 'sdks/sdkwork-iam-backend-sdk/sdkwork-iam-backend-sdk-typescript/src/index.ts'),
    },
    {
      find: /^@sdkwork\/auth-runtime-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/auth-runtime-pc-react',
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-auth-runtime-pc-react/src/index.ts'),
    },
    {
      find: '@sdkwork/appbase-pc-react',
      replacement: resolveDependencyPath('sdkwork-appbase', 'packages/pc-react/foundation/sdkwork-appbase-pc-react/src/index.ts'),
    },
    {
      find: /^@sdkwork\/auth-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/auth-pc-react',
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/index.ts'),
    },
    {
      find: /^@sdkwork\/user-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/user-pc-react',
      replacement: resolveDependencyPath('sdkwork-iam', 'apps/sdkwork-iam-pc/packages/sdkwork-user-pc-react/src/index.ts'),
    },
    {
      find: /^@sdkwork\/wallet-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-appbase', 'packages/pc-react/commerce/sdkwork-wallet-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/wallet-pc-react',
      replacement: resolveDependencyPath('sdkwork-appbase', 'packages/pc-react/commerce/sdkwork-wallet-pc-react/src/index.ts'),
    },
    // --- sdkwork-membership (membership + subscription PC packages) ---
    {
      find: /^@sdkwork\/membership-pc-membership\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-membership/src/$1'),
    },
    {
      find: '@sdkwork/membership-pc-membership',
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-membership/src/index.ts'),
    },
    {
      find: /^@sdkwork\/membership-pc-subscription\/catalog$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/src/catalog.ts'),
    },
    {
      find: /^@sdkwork\/membership-pc-subscription\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/src/$1'),
    },
    {
      find: '@sdkwork/membership-pc-subscription',
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/src/index.ts'),
    },
    // --- sdkwork-promotion (promotion PC coupon + service + core) ---
    {
      find: /^@sdkwork\/promotion-pc-coupon\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-coupon/src/$1'),
    },
    {
      find: '@sdkwork/promotion-pc-coupon',
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-coupon/src/index.ts'),
    },
    {
      find: /^@sdkwork\/promotion-pc-core\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-core/src/$1'),
    },
    {
      find: '@sdkwork/promotion-pc-core',
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-core/src/index.ts'),
    },
    {
      find: /^@sdkwork\/promotion-service\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-service/src/$1'),
    },
    {
      find: '@sdkwork/promotion-service',
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-service/src/index.ts'),
    },
    {
      find: /^@sdkwork\/promotion-contracts\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-contracts/src/$1'),
    },
    {
      find: '@sdkwork/promotion-contracts',
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-contracts/src/index.ts'),
    },
    {
      find: /^@sdkwork\/promotion-sdk-ports\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-sdk-ports/src/$1'),
    },
    {
      find: '@sdkwork/promotion-sdk-ports',
      replacement: resolveDependencyPath('sdkwork-promotion', 'apps/sdkwork-promotion-common/packages/sdkwork-promotion-sdk-ports/src/index.ts'),
    },
    // --- sdkwork-membership-service (membership service layer) ---
    {
      find: /^@sdkwork\/membership-service\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-service/src/$1'),
    },
    {
      find: '@sdkwork/membership-service',
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-service/src/index.ts'),
    },
    {
      find: /^@sdkwork\/membership-sdk-ports\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-sdk-ports/src/$1'),
    },
    {
      find: '@sdkwork/membership-sdk-ports',
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-sdk-ports/src/index.ts'),
    },
    {
      find: /^@sdkwork\/membership-contracts\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-contracts/src/$1'),
    },
    {
      find: '@sdkwork/membership-contracts',
      replacement: resolveDependencyPath('sdkwork-membership', 'apps/sdkwork-membership-common/packages/sdkwork-membership-contracts/src/index.ts'),
    },
    // --- sdkwork-order (order app SDK, dependency of membership-service) ---
    {
      find: /^@sdkwork\/order-app-sdk\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-order', 'sdks/sdkwork-order-app-sdk/sdkwork-order-app-sdk-typescript/src/$1'),
    },
    {
      find: '@sdkwork/order-app-sdk',
      replacement: resolveDependencyPath('sdkwork-order', 'sdks/sdkwork-order-app-sdk/sdkwork-order-app-sdk-typescript/src/index.ts'),
    },
    // --- sdkwork-membership SDK (membership app SDK, dependency of membership-service) ---
    {
      find: /^@sdkwork\/membership-app-sdk\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-membership', 'sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/src/$1'),
    },
    {
      find: '@sdkwork/membership-app-sdk',
      replacement: resolveDependencyPath('sdkwork-membership', 'sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/src/index.ts'),
    },
    {
      find: /^@sdkwork\/search-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-search', 'apps/sdkwork-search-pc/packages/sdkwork-search-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/search-pc-react',
      replacement: resolveDependencyPath('sdkwork-search', 'apps/sdkwork-search-pc/packages/sdkwork-search-pc-react/src/index.ts'),
    },
    {
      find: /^@sdkwork\/search-contracts\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-search', 'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src/$1'),
    },
    {
      find: '@sdkwork/search-contracts',
      replacement: resolveDependencyPath('sdkwork-search', 'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src/index.ts'),
    },
    {
      find: /^@sdkwork\/ui-pc-react\/(.+)$/u,
      replacement: resolveDependencyPath('sdkwork-ui', 'sdkwork-ui-pc-react/src/$1'),
    },
    {
      find: '@sdkwork/ui-pc-react',
      replacement: resolveDependencyPath('sdkwork-ui', 'sdkwork-ui-pc-react/src/index.ts'),
    },
    {
      find: '@sdkwork/birdcoder-app-sdk',
      replacement: path.resolve(
        appRootDir,
        '../../sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/birdcoder-backend-sdk',
      replacement: path.resolve(
        appRootDir,
        '../../sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/index.ts',
      ),
    },
    {
      find: /^@sdkwork\/birdcoder-chat-contracts\/(.+)$/u,
      replacement: path.resolve(
        workspaceRootDir,
        'apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts/src/$1',
      ),
    },
    {
      find: '@sdkwork/birdcoder-chat-contracts',
      replacement: path.resolve(
        workspaceRootDir,
        'apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts/src/index.ts',
      ),
    },
    {
      find: '@sdkwork/drive-app-sdk',
      replacement: resolveDependencyPath('sdkwork-drive', 'sdks/sdkwork-drive-app-sdk/sdkwork-drive-app-sdk-typescript/src/index.ts'),
    },
    {
      find: '@sdkwork/drive-pc-sandbox-contracts',
      replacement: resolveDependencyPath('sdkwork-drive', 'apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-contracts/src/index.ts'),
    },
    {
      find: '@sdkwork/drive-pc-sandbox-explorer',
      replacement: resolveDependencyPath('sdkwork-drive', 'apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-explorer/src/index.ts'),
    },
    {
      find: '@sdkwork/drive-pc-sandbox-explorer-sdk-adapter',
      replacement: resolveDependencyPath('sdkwork-drive', 'apps/sdkwork-drive-pc/packages/sdkwork-drive-pc-sandbox-explorer-sdk-adapter/src/index.ts'),
    },
    {
      find: '@sdkwork/messaging-app-sdk',
      replacement: resolveDependencyPath('sdkwork-messaging', 'sdks/sdkwork-messaging-app-sdk/sdkwork-messaging-app-sdk-typescript/src/index.ts'),
    },
    {
      find: '@sdkwork/agents-app-sdk',
      replacement: resolveDependencyPath('sdkwork-agents', 'sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/src/index.ts'),
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
      find: '@sdkwork/terminal-pc-infrastructure',
      replacement: resolveSdkworkTerminalInfrastructureEntryPath(appRootDir),
    },
    {
      find: '@sdkwork/terminal-local-runtime-app-sdk',
      replacement: resolveSdkworkTerminalLocalRuntimeAppSdkEntryPath(),
    },
    {
      find: '@sdkwork/terminal-app-sdk',
      replacement: resolveSdkworkTerminalLocalRuntimeAppSdkEntryPath(),
    },
    {
      find: /^@sdkwork\/terminal-pc-desktop\/surface\/(.+)$/u,
      replacement: `${resolveSdkworkTerminalDesktopRootPath(appRootDir)}/surface/$1`,
    },
    {
      find: '@sdkwork/terminal-pc-desktop/surface',
      replacement: resolveSdkworkTerminalDesktopSurfaceEntryPath(appRootDir),
    },
    {
      find: '@sdkwork/terminal-pc-desktop/host',
      replacement: resolveSdkworkTerminalDesktopHostEntryPath(appRootDir),
    },
    {
      find: '@sdkwork/terminal-pc-desktop',
      replacement: resolveSdkworkTerminalDesktopEntryPath(appRootDir),
    },
    ...terminalPcPackageIds.map((packageId) => ({
      find: `@sdkwork/${packageId}`,
      replacement: resolveDependencyPath(
        'sdkwork-terminal',
        `apps/sdkwork-terminal-pc/packages/sdkwork-${packageId}/src`,
      ),
    })),
  ];
}

function createBirdcoderWorkspaceFsAllowList(appRootDir = defaultBirdcoderAppRootDir) {
  return [
    resolveWorkspaceRootDir(appRootDir),
    resolveDependencyRootDir('sdkwork-appbase'),
    resolveDependencyRootDir('sdkwork-iam'),
    resolveDependencyRootDir('sdkwork-core'),
    resolveDependencyRootDir('sdkwork-drive'),
    resolveDependencyRootDir('sdkwork-messaging'),
    resolveDependencyRootDir('sdkwork-sdk-commons'),
    resolveDependencyRootDir('sdkwork-search'),
    resolveDependencyRootDir('sdkwork-ui'),
    resolveDependencyRootDir('sdkwork-terminal'),
    resolveDependencyRootDir('sdkwork-membership'),
    resolveDependencyRootDir('sdkwork-promotion'),
    resolveDependencyRootDir('sdkwork-order'),
  ];
}

const commonJsCompatSpecifiers = [
  '@xterm/xterm',
  '@xterm/addon-canvas',
  '@xterm/addon-fit',
  '@xterm/addon-search',
  '@xterm/addon-unicode11',
  '@xterm/addon-web-links',
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
  const isReactRouterPackage = /\/node_modules\/(?:\.pnpm\/(?:react-router|react-router-dom)@[^/]+\/node_modules\/)?(?:react-router|react-router-dom)\//u.test(
    normalizedId,
  );
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

      return isBirdcoderPublicRuntimeEnvKey(key)
        && ((mode === 'development' || mode === 'test')
          || !BIRDCODER_PUBLIC_RUNTIME_ENV_DEV_ONLY_KEYS.has(key));
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
  const isSmolTomlSelfCycle = isKnownSmolTomlSelfCycleWarning(
    warningCode,
    warningMessage,
  );
  const isUnresolvedExternalImport =
    warningCode === 'UNRESOLVED_IMPORT'
    && warningMessage.includes('treating it as an external dependency');
  const isQrCodeCompatDynamicImport =
    warningCode === 'INEFFECTIVE_DYNAMIC_IMPORT'
    && warningMessage.includes('qrcode/lib/browser.js')
    && warningMessage.includes('src/shims/qrcode.ts')
    && warningMessage.includes('qrcode-compat.mjs');
  const isSharedAuthRouteDynamicImport =
    warningCode === 'INEFFECTIVE_DYNAMIC_IMPORT'
    && ((warningMessage.includes('sdkwork-auth-pc-react/src/index.ts')
      && warningMessage.includes('TerminalAuthRoutes.tsx')
      && warningMessage.includes('sdkwork-birdcoder-pc-auth'))
      || (warningMessage.includes('sdkwork-birdcoder-pc-auth/src/index.ts')
        && warningMessage.includes('iamIntegration.ts')
        && warningMessage.includes('BirdCoderAuthGate.tsx')));
  const isTauriCoreDynamicImport =
    warningCode === 'INEFFECTIVE_DYNAMIC_IMPORT'
    && warningMessage.includes('@tauri-apps/api/')
    && (warningMessage.includes('tauriFileManager.ts')
      || warningMessage.includes('tauriFileSystemRuntime.ts'))
    && warningMessage.includes('@tauri-apps/api');
  const isTerminalInfrastructureDynamicImport =
    warningCode === 'INEFFECTIVE_DYNAMIC_IMPORT'
    && warningMessage.includes('sdkwork-terminal-pc-infrastructure/src/index.ts')
    && warningMessage.includes('src/terminal/sessions.ts');
  const isRolldownPluginTimingDiagnostic =
    warningCode === 'PLUGIN_TIMINGS'
    && warningMessage.includes('sdkwork-birdcoder-pc-web-');
  return isLucideUseClientNoise
    || isKnownSharedUiUseClientNoise
    || isSharedReactRouterUseClientNoise
    || isSmolTomlSelfCycle
    || isUnresolvedExternalImport
    || isQrCodeCompatDynamicImport
    || isSharedAuthRouteDynamicImport
    || isTauriCoreDynamicImport
    || isTerminalInfrastructureDynamicImport
    || isRolldownPluginTimingDiagnostic;
}

export function resolveBirdcoderWebRuntimeEnvSource(
  runtimeEnvSource = {},
  mode = 'development',
) {
  const resolvedRuntimeEnvSource = { ...runtimeEnvSource };
  if (mode !== 'development' && mode !== 'test') {
    return resolvedRuntimeEnvSource;
  }

  for (const key of BIRDCODER_PUBLIC_RUNTIME_ENV_API_ORIGIN_KEYS) {
    delete resolvedRuntimeEnvSource[key];
  }
  return resolvedRuntimeEnvSource;
}

export function resolveBirdcoderViteRuntimeEnvSource(
  fileRuntimeEnvSource = {},
  processRuntimeEnvSource = process.env,
) {
  return {
    ...fileRuntimeEnvSource,
    ...processRuntimeEnvSource,
  };
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
  let dir = appRootDir;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@sdkwork/birdcoder-workspace') {
          return dir;
        }
      } catch {}
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
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

  const directCandidatePackageJsonPaths = candidatePackageJsonPaths.filter((candidatePath) =>
    isDirectPnpmStorePackageJsonPath(candidatePath, packageName),
  );

  if (directCandidatePackageJsonPaths.length > 0) {
    return directCandidatePackageJsonPaths
      .sort((left, right) => compareVersionLike(
        getPnpmStorePackageVersion(right, packageName),
        getPnpmStorePackageVersion(left, packageName),
      ))[0] ?? null;
  }

  return candidatePackageJsonPaths[0] ?? null;
}

function resolveAppbaseWorkspacePackageEntryPath(appRootDir, specifier, relativeEntryPath) {
  const iamWorkspaceRootDir = resolveDependencyRootDir('sdkwork-iam');
  const packageJsonPath = resolvePackageJsonPathFromWorkspaceRoot(iamWorkspaceRootDir, specifier)
    ?? resolveAppbaseManagedBridgePackageJsonPath(iamWorkspaceRootDir, specifier);

  if (!packageJsonPath) {
    return path.join(
      iamWorkspaceRootDir,
      'node_modules',
      ...resolvePackageNameFromSpecifier(specifier).split('/'),
      ...relativeEntryPath,
    );
  }

  return path.join(path.dirname(packageJsonPath), ...relativeEntryPath);
}

function resolveAppbaseManagedBridgePackageJsonPath(appbaseWorkspaceRootDir, specifier) {
  const packageName = resolvePackageNameFromSpecifier(specifier);
  const bridgePackageRoots = [
    'apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react',
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

function getPnpmStoreEntryName(packageJsonPath) {
  const packageDirPath = path.dirname(packageJsonPath);
  const packageNodeModulesDirPath = path.dirname(packageDirPath);
  const storeEntryDirPath = path.dirname(packageNodeModulesDirPath);

  return path.basename(storeEntryDirPath);
}

function encodePnpmPackageName(packageName) {
  return String(packageName ?? '').replace(/\//gu, '+');
}

function isDirectPnpmStorePackageJsonPath(packageJsonPath, packageName) {
  const storeEntryName = getPnpmStoreEntryName(packageJsonPath);
  const encodedPackageName = encodePnpmPackageName(packageName);

  return storeEntryName === encodedPackageName || storeEntryName.startsWith(`${encodedPackageName}@`);
}

function getPnpmStorePackageVersion(packageJsonPath, packageName) {
  const storeEntryName = getPnpmStoreEntryName(packageJsonPath);
  const encodedPackageName = encodePnpmPackageName(packageName);

  if (!storeEntryName.startsWith(`${encodedPackageName}@`)) {
    return '';
  }

  return storeEntryName.slice(encodedPackageName.length + 1).split('_')[0] ?? '';
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

function resolveBirdcoderCredentialEntryBootstrapAccessToken(runtimeEnvSource = {}, mode = 'development') {
  if (mode !== 'development' && mode !== 'test') {
    return undefined;
  }
  const token = String(runtimeEnvSource.SDKWORK_ACCESS_TOKEN ?? '').trim();
  return token || undefined;
}

function patchCredentialEntryBootstrapTokenSource(code, bootstrapAccessToken) {
  if (!bootstrapAccessToken) {
    return code;
  }

  return String(code).replace(
    /export function readBootstrapAccessTokenFromProcessEnv\([\s\S]*?\n\}/u,
    [
      'export function readBootstrapAccessTokenFromProcessEnv(',
      '  env = (globalThis).process?.env,',
      ') {',
      `  const privateToken = (globalThis).${BIRDCODER_CREDENTIAL_ENTRY_ENV_KEY}?.SDKWORK_ACCESS_TOKEN?.trim();`,
      '  if (privateToken) {',
      '    return privateToken;',
      '  }',
      '  const value = env?.SDKWORK_ACCESS_TOKEN?.trim();',
      '  return value || undefined;',
      '}',
    ].join('\n'),
  );
}

function isCredentialEntryBootstrapTokenModule(id) {
  return normalizeWarningModuleReference(id).includes('/sdkwork-iam-credential-entry/');
}

function createBirdcoderCredentialEntryBootstrapPlugin({
  runtimeEnvSource = process.env,
  mode = 'development',
  namespace = defaultBirdcoderNamespace,
} = {}) {
  const bootstrapAccessToken = resolveBirdcoderCredentialEntryBootstrapAccessToken(runtimeEnvSource, mode);

  /** @type {BirdcoderOpaqueVitePlugin} */
  const plugin = {
    name: `${namespace}-credential-entry-bootstrap`,
    /** @type {'pre'} */
    enforce: 'pre',
    transformIndexHtml() {
      if (!bootstrapAccessToken) {
        return [];
      }

      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `globalThis.${BIRDCODER_CREDENTIAL_ENTRY_ENV_KEY} = Object.freeze({ SDKWORK_ACCESS_TOKEN: ${JSON.stringify(bootstrapAccessToken)} });`,
        },
      ];
    },
    transform(code, id) {
      const cleanId = String(id ?? '').split('?')[0] ?? '';
      if (!cleanId || !isCredentialEntryBootstrapTokenModule(cleanId)) {
        return null;
      }

      if (!code.includes('readBootstrapAccessTokenFromProcessEnv')) {
        return null;
      }

      const patchedCode = patchCredentialEntryBootstrapTokenSource(code, bootstrapAccessToken);
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

function createBirdcoderTailwindcssPlugin({
  namespace = defaultBirdcoderNamespace,
  toolingRootDir = defaultBirdcoderToolingRootDir,
} = {}) {
  try {
    const toolingRequire = createPackageRequire(toolingRootDir);
    const tailwindcssModule = toolingRequire('@tailwindcss/vite');
    const tailwindcss = tailwindcssModule?.default ?? tailwindcssModule;
    if (typeof tailwindcss === 'function') {
      return tailwindcss();
    }
  } catch {
    // Static contract tests import this helper before dependencies are installed.
  }

  return {
    name: `${namespace}-tailwindcss-unavailable`,
  };
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
    createBirdcoderCredentialEntryBootstrapPlugin({
      runtimeEnvSource,
      mode,
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
    createBirdcoderTailwindcssPlugin({
      namespace,
      toolingRootDir,
    }),
  ];

  return plugins;
}

export {
  BIRDCODER_CREDENTIAL_ENTRY_ENV_KEY,
  BIRDCODER_VITE_DEDUPE_PACKAGES,
  BIRDCODER_VITE_DESKTOP_OPTIMIZE_DEPS_INCLUDE,
  BIRDCODER_VITE_DEV_WATCH_IGNORED,
  BIRDCODER_VITE_WEB_OPTIMIZE_DEPS_INCLUDE,
  createBirdcoderCommonJsDefaultCompatPlugin,
  createBirdcoderCoreEnvCompatPlugin,
  createBirdcoderCredentialEntryBootstrapPlugin,
  createBirdcoderWorkspaceAliasEntries,
  createBirdcoderWorkspaceFsAllowList,
  createBirdcoderReactCompatPlugin,
  createBirdcoderNodeEnvGuardPlugin,
  createBirdcoderRuntimeEnvBootstrapPlugin,
  createBirdcoderSharedRouterCompatPlugin,
  createBirdcoderTypeScriptTransformPlugin,
  createBirdcoderVitePlugins,
  onBirdcoderRollupWarning,
  resolveBirdcoderPublicRuntimeEnv,
  resolveBirdcoderCredentialEntryBootstrapAccessToken,
  resolveBirdcoderTerminalInfrastructureRuntimePath,
  resolveSdkworkTerminalDesktopEntryPath,
  resolveSdkworkTerminalDesktopHostEntryPath,
  resolveSdkworkTerminalDesktopRootPath,
  resolveSdkworkTerminalDesktopSurfaceEntryPath,
  resolveSdkworkTerminalInfrastructureEntryPath,
  shouldIgnoreBirdcoderRollupWarning,
};
