import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const h5Prefix = 'apps/sdkwork-birdcoder-h5';
const shellPrefix = `${h5Prefix}/packages/sdkwork-birdcoder-h5-shell/src`;

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const appSource = readText(`${h5Prefix}/src/App.tsx`);
const shellIndexSource = readText(`${shellPrefix}/index.ts`);
const routerSource = readText(`${shellPrefix}/routing/createBirdCoderH5AppRouter.tsx`);
const layoutSource = readText(`${shellPrefix}/layout/MobileShellLayout.tsx`);
const protectedRouteSource = readText(`${shellPrefix}/routing/BirdCoderH5ProtectedRoute.tsx`);
const tabNavigationSource = readText(`${shellPrefix}/navigation/tabNavigation.ts`);
const routeCatalogNavigationSource = readText(`${shellPrefix}/navigation/routeCatalogNavigation.ts`);
const catalogSource = readText(`${shellPrefix}/routes/routeCatalog.ts`);
const chatRouteContributionsSource = readText(
  `${h5Prefix}/packages/sdkwork-birdcoder-h5-chat/src/routes/appRouteContributions.ts`,
);
const routesSource = readText(`${h5Prefix}/src/routes/index.ts`);

assert.match(
  appSource,
  /from '\.\/routes'/u,
  'H5 App must assemble routes through the root src/routes entrypoint.',
);
assert.match(
  appSource,
  /<BirdCoderH5AppRoutes \/>/u,
  'H5 App must mount the shell-owned router provider.',
);
assert.doesNotMatch(
  appSource,
  /Mobile shell bootstrap, IAM runtime, and auth gate are active\./u,
  'H5 App must not keep the placeholder home copy after route assembly is wired.',
);

assert.match(
  shellIndexSource,
  /export \{ BirdCoderH5AppRoutes \}/u,
  'h5-shell must export BirdCoderH5AppRoutes for root app wiring.',
);
assert.match(
  shellIndexSource,
  /export \{ createBirdCoderH5AppRouter \}/u,
  'h5-shell must export createBirdCoderH5AppRouter for route composition tests.',
);

assert.match(
  routerSource,
  /createBirdCoderH5RouteCatalog\(\)/u,
  'H5 router composition must assemble routes from the h5-shell catalog.',
);
assert.match(
  routerSource,
  /MobileShellLayout/u,
  'H5 router composition must use the mobile shell layout route.',
);
assert.match(
  routerSource,
  /BirdCoderH5ProtectedRoute/u,
  'H5 router composition must guard authenticated app routes.',
);

assert.match(
  layoutSource,
  /<Outlet \/>/u,
  'H5 mobile shell layout must render routed screen outlets.',
);
assert.match(
  layoutSource,
  /resolveBirdCoderH5TabRoutes\(\)/u,
  'H5 mobile shell layout must derive bottom navigation from the route catalog.',
);
assert.match(
  layoutSource,
  /resolveBirdCoderH5RouteTitle/u,
  'H5 mobile shell layout must render the active route title from catalog metadata.',
);

assert.match(
  protectedRouteSource,
  /replaceAuthSurfaceHashPath/u,
  'H5 protected routes must redirect unauthenticated users through the auth hash surface.',
);
assert.doesNotMatch(
  protectedRouteSource,
  /<Navigate/u,
  'H5 protected routes must not navigate to unmounted /auth router paths.',
);

assert.match(
  tabNavigationSource,
  /resolveBirdCoderH5TabRoutes/u,
  'H5 tab navigation must delegate to catalog-derived tab routes.',
);
assert.match(
  routeCatalogNavigationSource,
  /createBirdCoderH5RouteCatalog\(\)/u,
  'H5 tab navigation must derive from the canonical route catalog.',
);
assert.match(
  routeCatalogNavigationSource,
  /presentation === 'tab'/u,
  'H5 tab navigation must honor presentation.h5Mobile tab metadata.',
);

assert.match(
  catalogSource,
  /BIRDCODER_H5_CHAT_ROUTE_CONTRIBUTIONS/u,
  'H5 route catalog must merge capability route contributions from h5-chat.',
);
assert.match(
  chatRouteContributionsSource,
  /presentation: 'tab'/u,
  'h5-chat must publish tab presentation metadata for mobile navigation.',
);
assert.match(
  chatRouteContributionsSource,
  /app\.account\.settings\.index/u,
  'h5-chat must declare the settings screen route identity.',
);
assert.match(
  routesSource,
  /BirdCoderH5AppRoutes/u,
  'H5 root routes entry must export BirdCoderH5AppRoutes for App wiring.',
);

console.log('h5 route assembly contract passed.');
