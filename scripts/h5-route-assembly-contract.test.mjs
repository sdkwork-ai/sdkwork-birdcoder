import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const h5Prefix = 'apps/sdkwork-birdcoder-h5';
const shellPrefix = `${h5Prefix}/packages/sdkwork-birdcoder-h5-shell`;

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function collectArchitectureFiles(directory) {
  const ignoredDirectories = new Set(['android', 'dist', 'ios', 'node_modules']);
  const supportedExtensions = new Set(['.json', '.md', '.ts', '.tsx']);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectArchitectureFiles(entryPath));
    } else if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

const appSource = readText(`${h5Prefix}/src/App.tsx`);
const shellIndexSource = readText(`${shellPrefix}/src/index.ts`);
const shellPackage = JSON.parse(readText(`${shellPrefix}/package.json`));
const authContextSource = readText(`${shellPrefix}/src/auth/BirdCoderH5AuthContext.tsx`);
const authGateSource = readText(`${shellPrefix}/src/auth/BirdCoderAuthGate.tsx`);
const authLoginRouteSource = readText(`${shellPrefix}/src/auth/BirdCoderH5AuthLoginRoute.tsx`);
const providerSource = readText(`${shellPrefix}/src/providers/ShellRuntimeProviders.tsx`);
const bootstrapGateSource = readText(`${shellPrefix}/src/bootstrap/BootstrapGate.tsx`);
const bootstrapMessagesSource = readText(`${shellPrefix}/src/bootstrap/createBootstrapGateMessages.ts`);
const bootstrapRuntimeSource = readText(`${shellPrefix}/src/bootstrap/createBootstrapRuntime.ts`);
const routerSource = readText(`${shellPrefix}/src/routing/createBirdCoderH5AppRouter.tsx`);
const routeComponentsSource = readText(`${shellPrefix}/src/routing/routeComponents.tsx`);
const protectedRouteSource = readText(`${shellPrefix}/src/routing/BirdCoderH5ProtectedRoute.tsx`);
const catalogSource = readText(`${shellPrefix}/src/routes/routeCatalog.ts`);
const layoutSource = readText(`${shellPrefix}/src/layout/MobileShellLayout.tsx`);
const tabNavigationSource = readText(`${shellPrefix}/src/navigation/tabNavigation.ts`);
const routeCatalogNavigationSource = readText(`${shellPrefix}/src/navigation/routeCatalogNavigation.ts`);
const chatRouteContributionsSource = readText(
  `${h5Prefix}/packages/sdkwork-birdcoder-h5-chat/src/routes/appRouteContributions.ts`,
);
const settingsPageSource = readText(
  `${h5Prefix}/packages/sdkwork-birdcoder-h5-chat/src/screens/SettingsPage.tsx`,
);
const h5ArchitectureText = collectArchitectureFiles(path.join(rootDir, h5Prefix))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

assert.equal(
  shellPackage.dependencies['@sdkwork/iam-h5-auth'],
  'workspace:*',
  'H5 shell must consume the canonical IAM H5 auth package.',
);
assert.doesNotMatch(
  h5ArchitectureText,
  /@sdkwork\/birdcoder-pc|birdcoder-pc-|__SDKWORK_PC_REACT_ENV__/u,
  'H5 source, manifests, specs, and active docs must not depend on BirdCoder PC packages.',
);

assert.match(appSource, /<ShellRuntimeProviders>[\s\S]*<BirdCoderAuthGate>/u);
assert.match(providerSource, /<BirdCoderH5AuthProvider>/u);
assert.match(authGateSource, /initialized/u);
assert.match(authGateSource, /AuthLoadingState/u);

assert.match(authContextSource, /createSdkworkIamH5AuthController/u);
assert.match(authContextSource, /getBirdCoderIamRuntime/u);
assert.match(authContextSource, /runtime\.hydrateTokenManager\(\)/u);
assert.match(authContextSource, /service\.auth\.sessions\.current\.retrieve\(\)/u);
assert.match(authContextSource, /tokens\.authToken/u);
assert.match(authContextSource, /tokens\.accessToken/u);
assert.match(authContextSource, /service\.auth\.sessions\.current\.delete\(\)/u);
assert.match(authContextSource, /controller\.logout\(\)/u);
assert.doesNotMatch(authContextSource, /fetch\(|axios\.|Authorization|Access-Token/u);

assert.match(authLoginRouteSource, /SdkworkIamH5AuthLoginScreen/u);
assert.match(authLoginRouteSource, /completeAuthentication/u);
assert.match(authLoginRouteSource, /requestedTarget\.startsWith\('\/'\)/u);
assert.match(authLoginRouteSource, /requestedTarget\.startsWith\('\/\/'\)/u);
assert.match(authLoginRouteSource, /target\.pathname === '\/auth'/u);

assert.match(catalogSource, /IAM_H5_AUTH_ROUTES/u);
assert.match(catalogSource, /IAM_H5_AUTH_ROUTES\.loginPath/u);
assert.match(catalogSource, /IAM_H5_AUTH_ROUTES\.moduleId/u);
assert.match(catalogSource, /BIRDCODER_H5_CHAT_ROUTE_CONTRIBUTIONS/u);
assert.match(routeComponentsSource, /BirdCoderH5AuthLoginRoute/u);
assert.match(routeComponentsSource, /useBirdCoderH5Auth/u);
assert.match(routeComponentsSource, /await logout\(\)/u);
assert.match(routeComponentsSource, /navigate\(IAM_H5_AUTH_ROUTES\.loginPath/u);
assert.match(routerSource, /publicRoutes/u);
assert.match(routerSource, /createBirdCoderH5RouteCatalog\(\)/u);
assert.match(routerSource, /MobileShellLayout/u);
assert.match(routerSource, /BirdCoderH5ProtectedRoute/u);

assert.match(protectedRouteSource, /<Navigate replace to=\{loginTarget\}/u);
assert.match(protectedRouteSource, /IAM_H5_AUTH_ROUTES\.loginPath/u);
assert.match(protectedRouteSource, /\?redirect=/u);
assert.match(protectedRouteSource, /validatedLocationKey/u);
assert.doesNotMatch(protectedRouteSource, /replaceAuthSurfaceHashPath|window\.dispatchEvent/u);

assert.match(bootstrapGateSource, /Promise\.race/u);
assert.match(bootstrapGateSource, /DEFAULT_BOOTSTRAP_TIMEOUT_MS/u);
assert.match(bootstrapGateSource, /setAttempt/u);
assert.match(bootstrapMessagesSource, /Starting BirdCoder/u);
assert.doesNotMatch(bootstrapGateSource, /birdcoder-pc/u);
assert.doesNotMatch(bootstrapMessagesSource, /birdcoder-pc/u);
assert.doesNotMatch(bootstrapRuntimeSource, /__SDKWORK_PC_REACT_ENV__/u);
assert.match(shellIndexSource, /\.\/bootstrap\/BootstrapGate\.tsx/u);
assert.match(shellIndexSource, /\.\/bootstrap\/createBootstrapGateMessages\.ts/u);

assert.match(layoutSource, /<Outlet \/>/u);
assert.match(layoutSource, /resolveBirdCoderH5TabRoutes\(\)/u);
assert.match(layoutSource, /resolveBirdCoderH5RouteTitle/u);
assert.match(tabNavigationSource, /resolveBirdCoderH5TabRoutes/u);
assert.match(routeCatalogNavigationSource, /createBirdCoderH5RouteCatalog\(\)/u);
assert.match(routeCatalogNavigationSource, /presentation === 'tab'/u);
assert.match(chatRouteContributionsSource, /presentation: 'tab'/u);
assert.match(chatRouteContributionsSource, /app\.account\.settings\.index/u);
assert.match(settingsPageSource, /onLogout: \(\) => Promise<void>/u);
assert.match(settingsPageSource, /await onLogout\(\)/u);
assert.doesNotMatch(settingsPageSource, /clearBirdCoderSessionRecord|localStorage\.removeItem|sessionStorage/u);

console.log('h5 native IAM route assembly contract passed.');
