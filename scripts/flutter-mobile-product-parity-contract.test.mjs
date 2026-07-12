import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const routeCatalog = read(
  'apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_core/lib/src/bootstrap/auth_route_catalog.dart',
);
const appRouter = read('apps/sdkwork-birdcoder-flutter-mobile/lib/routes/app_router.dart');
const appShell = read('apps/sdkwork-birdcoder-flutter-mobile/lib/shell/app_shell.dart');
const appDart = read('apps/sdkwork-birdcoder-flutter-mobile/lib/app.dart');
const routeFactory = read('apps/sdkwork-birdcoder-flutter-mobile/lib/routing/route_page_factory.dart');

assert.match(routeCatalog, /app\.im\.chat\.index/u, 'Flutter route catalog must include chat route.');
assert.match(routeCatalog, /app\.account\.settings\.index/u, 'Flutter route catalog must include settings route.');
assert.match(routeFactory, /buildBirdCoderRoutePageForPath/u, 'Flutter routing must resolve pages from the route catalog.');
assert.match(appRouter, /buildBirdCoderRoutePageForPath/u, 'App router must delegate product routes to the route page factory.');
assert.match(appShell, /static const _tabPaths = \['\/', '\/settings'\];/u, 'App shell must bind bottom navigation to catalog route paths.');
assert.match(appShell, /onTap: _openTab/u, 'App shell bottom navigation must switch through the persistent tab controller.');
assert.match(appShell, /_pages\.putIfAbsent\(/u, 'App shell must preserve mounted tab pages and their local state.');
assert.doesNotMatch(appShell, /pushReplacementNamed/u, 'Tab navigation must not replace the AppShell route and discard its AppBar or bottom navigation.');
assert.doesNotMatch(appDart, /_HomePlaceholder/u, 'Flutter app shell must not keep the bootstrap placeholder home surface.');

console.log('flutter mobile product parity contract passed.');
