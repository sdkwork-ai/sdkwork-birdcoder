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
  ['sdkwork-routes-system-app-api'],
  'BirdCoder API assembly must contain only its System App route crate.',
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
  'sdkwork-routes-workspace-app-api',
]) {
  assert.equal(
    fs.existsSync(absolutePath(`crates/${retiredCrate}/Cargo.toml`)),
    false,
    `${retiredCrate} is dependency-owned and must not be restored in BirdCoder.`,
  );
}

const gatewayCargo = readText('crates/sdkwork-api-birdcoder-standalone-gateway/Cargo.toml');
assert.match(gatewayCargo, /sdkwork-api-birdcoder-assembly\.workspace = true/u);
for (const gatewayFrameworkDependency of [
  'sdkwork-web-bootstrap',
  'sdkwork-web-axum',
  'sdkwork-web-core',
  'sdkwork-web-contract',
]) {
  assert.match(
    gatewayCargo,
    new RegExp(`^${gatewayFrameworkDependency}(?:\\.workspace)?\\s*=`, 'mu'),
    `Standalone gateway must own process-wide framework dependency ${gatewayFrameworkDependency}.`,
  );
}
assert.doesNotMatch(
  gatewayCargo,
  /^sdkwork-routes-system-app-api(?:\.workspace)?\s*=/mu,
  'Standalone gateway must consume BirdCoder routes through the host-neutral assembly.',
);

const assemblyCargo = readText('crates/sdkwork-api-birdcoder-assembly/Cargo.toml');
for (const frameworkDependency of ['sdkwork-web-core', 'sdkwork-web-contract']) {
  assert.match(
    assemblyCargo,
    new RegExp(`^${frameworkDependency}(?:\\.workspace)?\\s*=`, 'mu'),
    `API assembly must expose host-neutral framework contract ${frameworkDependency}.`,
  );
}
assert.doesNotMatch(
  assemblyCargo,
  /^sdkwork-web-axum(?:\.workspace)?\s*=/mu,
  'API assembly must not install the Axum Web Framework layer owned by its gateway host.',
);

const gatewayFramework = readText(
  'crates/sdkwork-api-birdcoder-standalone-gateway/src/server/framework.rs',
);
assert.match(gatewayFramework, /WebFrameworkLayer/u);
assert.match(gatewayFramework, /with_security_policy/u);
assert.match(gatewayFramework, /with_web_request_context/u);
assert.match(gatewayFramework, /build_cors_policy/u);

const assemblyRouters = readText(
  'crates/sdkwork-api-birdcoder-assembly/src/application_bootstrap/routers.rs',
);
assert.doesNotMatch(assemblyRouters, /with_web_request_context|CorsPolicy/u);
const gatewayLib = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/lib.rs');
assert.match(gatewayLib, /assemble_standalone_profile/u);
assert.match(gatewayLib, /wrap_with_web_framework/u);
assert.match(gatewayLib, /sdkwork_web_bootstrap::mount_infra_routes/u);
const gatewayMain = readText('crates/sdkwork-api-birdcoder-standalone-gateway/src/main.rs');
assert.match(gatewayMain, /build_app/u);
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
assert.equal(operationCount, 4);
assert.deepEqual(Object.fromEntries(domainOperationCounts), {
  system: 4,
});

const extensionTargetsSource = readText('scripts/web-framework-openapi-extensions.mjs');
assert.match(extensionTargetsSource, new RegExp(authorityPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
assert.doesNotMatch(extensionTargetsSource, /mirrorRelativePath|backend-api|sdks\/specs\/openapi/u);
const ensureSource = readText('scripts/ensure-web-framework-openapi-extensions.mjs');
assert.match(ensureSource, /BIRDCODER_OPENAPI_AUTHORITY_TARGETS/u);
assert.doesNotMatch(ensureSource, /mirrorPath|mkdirSync/u);

console.log('BirdCoder gateway web framework standard passed.');
