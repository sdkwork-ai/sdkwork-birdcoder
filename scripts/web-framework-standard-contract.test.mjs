import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const httpMethods = new Set(['delete', 'get', 'patch', 'post', 'put']);

function absolutePath(relativePath) {
  return path.join(rootDir, ...relativePath.split('/'));
}

function readText(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const rootCargo = readText('Cargo.toml');
for (const dependency of ['sdkwork-web-core', 'sdkwork-web-axum', 'sdkwork-web-contract']) {
  assert.match(rootCargo, new RegExp(`^${dependency} = \\{`, 'mu'));
}

const assembly = readJson('crates/sdkwork-api-birdcoder-assembly/assembly-manifest.json');
assert.equal(assembly.apiMode, 'served');
assert.deepEqual(
  assembly.routeCrates.map((entry) => entry.packageName),
  ['sdkwork-routes-system-app-api', 'sdkwork-routes-workspace-app-api'],
  'BirdCoder API assembly must contain only its system and coding-workbench App route crates.',
);

for (const routeCrate of assembly.routeCrates) {
  assert.equal(routeCrate.surface, 'app-api');
  const crateRoot = routeCrate.memberDir;
  const cargo = readText(`${crateRoot}/Cargo.toml`);
  const manifest = readText(`${crateRoot}/src/manifest.rs`);
  const handlers = readText(`${crateRoot}/src/handlers.rs`);
  const lib = readText(`${crateRoot}/src/lib.rs`);
  assert.match(cargo, /sdkwork-web-contract/u);
  assert.match(cargo, /sdkwork-web-core/u);
  assert.match(manifest, /HttpRouteManifest/u);
  assert.match(manifest, /HttpRoute::dual_token/u);
  assert.match(manifest, /with_required_permission/u);
  assert.match(handlers, /WebRequestContext/u);
  assert.doesNotMatch(handlers, /["'](?:authorization|access-token|x-api-key)["']/iu);
  assert.doesNotMatch(handlers, /header::(?:AUTHORIZATION|PROXY_AUTHORIZATION)/u);
  assert.match(lib, /pub mod manifest/u);
}

for (const retiredCrate of [
  'sdkwork-routes-chat-app-api',
  'sdkwork-routes-coding-sessions-app-api',
  'sdkwork-routes-commerce-app-api',
  'sdkwork-routes-deployment-backend-api',
  'sdkwork-routes-document-app-api',
  'sdkwork-routes-engine-catalog-app-api',
  'sdkwork-routes-skill-packages-app-api',
]) {
  assert.equal(
    fs.existsSync(absolutePath(`crates/${retiredCrate}`)),
    false,
    `${retiredCrate} is dependency-owned and must not be restored in BirdCoder.`,
  );
}

const gatewayCargo = readText('crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml');
assert.match(gatewayCargo, /sdkwork-web-bootstrap\.workspace = true/u);
assert.match(gatewayCargo, /sdkwork-api-birdcoder-assembly\.workspace = true/u);
for (const assemblyOwnedDependency of [
  'sdkwork-web-axum',
  'sdkwork-web-core',
  'sdkwork-web-contract',
  'sdkwork-routes-system-app-api',
  'sdkwork-routes-workspace-app-api',
]) {
  assert.doesNotMatch(
    gatewayCargo,
    new RegExp(`^${assemblyOwnedDependency}(?:\\.workspace)?\\s*=`, 'mu'),
    `Standalone gateway must not duplicate assembly dependency ${assemblyOwnedDependency}.`,
  );
}

const assemblyCargo = readText('crates/sdkwork-api-birdcoder-assembly/Cargo.toml');
for (const frameworkDependency of [
  'sdkwork-web-bootstrap',
  'sdkwork-web-axum',
  'sdkwork-web-core',
  'sdkwork-web-contract',
]) {
  assert.match(
    assemblyCargo,
    new RegExp(`^${frameworkDependency}(?:\\.workspace)?\\s*=`, 'mu'),
    `API assembly must own framework dependency ${frameworkDependency}.`,
  );
}

const authBootstrap = readText(
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/auth.rs',
);
assert.match(authBootstrap, /build_web_framework_layer/u);
assert.match(authBootstrap, /with_web_request_context/u);
assert.match(authBootstrap, /birdcoder_app_api_route_manifest/u);
assert.match(authBootstrap, /SecurityPolicy/u);

const assemblyRouters = readText(
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/routers.rs',
);
assert.match(assemblyRouters, /sdkwork_web_bootstrap::mount_infra_routes/u);
const gatewayMain = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/main.rs');
assert.match(gatewayMain, /assemble_api_router/u);
assert.match(gatewayMain, /sdkwork_web_bootstrap::init_tracing_from_env/u);
assert.match(gatewayMain, /server::listen::serve/u);

const authorityPath = 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json';
const authority = readJson(authorityPath);
let operationCount = 0;
const domainOperationCounts = new Map();
for (const [routePath, pathItem] of Object.entries(authority.paths ?? {})) {
  assert.ok(routePath.startsWith('/app/v3/api/'));
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!httpMethods.has(method)) continue;
    operationCount += 1;
    assert.equal(operation['x-sdkwork-request-context'], 'WebRequestContext');
    assert.equal(operation['x-sdkwork-api-surface'], 'app-api');
    assert.equal(operation['x-sdkwork-owner'], 'sdkwork-birdcoder');
    assert.equal(operation['x-sdkwork-api-authority'], 'sdkwork-birdcoder-app-api');
    assert.deepEqual(
      operation.tags,
      [operation['x-sdkwork-domain']],
      `${operation.operationId} tag must match its canonical domain`,
    );
    domainOperationCounts.set(
      operation['x-sdkwork-domain'],
      (domainOperationCounts.get(operation['x-sdkwork-domain']) ?? 0) + 1,
    );
  }
}
assert.equal(operationCount, 39);
assert.deepEqual(Object.fromEntries(domainOperationCounts), {
  system: 4,
  intelligence: 35,
});

const extensionTargetsSource = readText('scripts/web-framework-openapi-extensions.mjs');
assert.match(extensionTargetsSource, new RegExp(authorityPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
assert.doesNotMatch(extensionTargetsSource, /mirrorRelativePath|backend-api|sdks\/specs\/openapi/u);
const ensureSource = readText('scripts/ensure-web-framework-openapi-extensions.mjs');
assert.match(ensureSource, /BIRDCODER_OPENAPI_AUTHORITY_TARGETS/u);
assert.doesNotMatch(ensureSource, /mirrorPath|mkdirSync/u);

console.log('BirdCoder App-only web framework standard passed.');
