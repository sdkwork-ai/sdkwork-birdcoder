import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

const serviceCrate = 'crates/sdkwork-birdcoder-commerce-service/Cargo.toml';
const repositoryCrate = 'crates/sdkwork-birdcoder-commerce-repository-sqlx/Cargo.toml';
const routesCrate = 'crates/sdkwork-routes-commerce-app-api/Cargo.toml';

assert.ok(exists(serviceCrate), 'commerce service crate must exist');
assert.ok(exists(repositoryCrate), 'commerce repository crate must exist');
assert.ok(exists(routesCrate), 'commerce routes crate must exist');

const routers = read('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/routers.rs');
const routeManifest = read(
  'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/route_manifest.rs',
);
const routeCatalog = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts',
);
const commerceService = read(
  'crates/sdkwork-birdcoder-commerce-service/src/service/commerce_service.rs',
);
const manifest = read('crates/sdkwork-routes-commerce-app-api/src/manifest.rs');
const paths = read('crates/sdkwork-routes-commerce-app-api/src/paths.rs');

assert.match(
  routers,
  /sdkwork_routes_commerce_app_api::build_commerce_app_router/u,
  'gateway must wire commerce app router',
);
assert.match(
  routeManifest,
  /COMMERCE_APP_API_ROUTES/u,
  'route manifest must include commerce app routes',
);

assert.match(routeCatalog, /commerceOrders/u, 'route catalog must expose commerce orders list route.');
assert.match(routeCatalog, /\/app\/v3\/api\/commerce\/orders/u);
assert.match(routeCatalog, /\/app\/v3\/api\/commerce\/invoices/u);
assert.match(routeCatalog, /\/app\/v3\/api\/commerce\/payments/u);

assert.match(manifest, /commerce\.orders\.list/u);
assert.match(manifest, /commerce\.orders\.create/u);
assert.match(manifest, /commerce\.orders\.retrieve/u);
assert.match(manifest, /commerce\.invoices\.list/u);
assert.match(manifest, /commerce\.invoices\.retrieve/u);
assert.match(manifest, /commerce\.payments\.list/u);
assert.match(manifest, /commerce\.payments\.create/u);
assert.match(manifest, /commerce\.payments\.retrieve/u);

assert.match(paths, /\{orderId\}/u, 'commerce paths must use OpenAPI path templates.');
assert.match(paths, /\{invoiceId\}/u);
assert.match(paths, /\{paymentId\}/u);

assert.match(
  commerceService,
  /parse_numeric_tenant_id/u,
  'commerce service must use commerce-quota tenant id parser',
);
assert.match(
  commerceService,
  /parse_numeric_user_id/u,
  'commerce service must use commerce-quota user id parser',
);

console.log('commerce transactions contract passed.');
