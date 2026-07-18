import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(message) {
  failures.push(message);
}

const rootCargo = read('Cargo.toml');
for (const crate of ['sdkwork-web-core', 'sdkwork-web-axum', 'sdkwork-web-contract']) {
  if (!rootCargo.includes(`${crate} = {`)) {
    fail(`root Cargo.toml must declare workspace dependency ${crate}`);
  }
}

const routeCrates = [
  'crates/sdkwork-routes-system-app-api',
  'crates/sdkwork-routes-engine-catalog-app-api',
  'crates/sdkwork-routes-coding-sessions-app-api',
  'crates/sdkwork-routes-workspace-app-api',
  'crates/sdkwork-routes-document-app-api',
  'crates/sdkwork-routes-skill-packages-app-api',
  'crates/sdkwork-routes-deployment-backend-api',
];

for (const crateDir of routeCrates) {
  const manifestPath = `${crateDir}/src/manifest.rs`;
  const manifest = read(manifestPath);
  if (!manifest.includes('HttpRouteManifest')) {
    fail(`${manifestPath} must export HttpRouteManifest via sdkwork-web-core`);
  }
  if (!manifest.includes('HttpRoute::')) {
    fail(`${manifestPath} must declare HttpRoute entries`);
  }

  const cargoToml = read(`${crateDir}/Cargo.toml`);
  if (!cargoToml.includes('sdkwork-web-contract')) {
    fail(`${crateDir}/Cargo.toml must depend on sdkwork-web-contract`);
  }
  if (!cargoToml.includes('sdkwork-web-core')) {
    fail(`${crateDir}/Cargo.toml must depend on sdkwork-web-core`);
  }

  if (!manifest.includes('with_required_permission')) {
    fail(`${manifestPath} must declare with_required_permission on protected routes`);
  }

  const libRs = read(`${crateDir}/src/lib.rs`);
  if (!libRs.includes('pub mod manifest')) {
    fail(`${crateDir}/src/lib.rs must expose manifest module`);
  }
}

const routeManifestBootstrap = read('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/route_manifest.rs');
if (!routeManifestBootstrap.includes('birdcoder_product_app_api_route_manifest')) {
  fail('standalone-gateway must compose product HttpRouteManifest from route crates');
}

const appOpenApiDocument = readJson('sdks/specs/openapi/birdcoder-app-v3.openapi.json');
const appOpenApiPathKeys = Object.keys(appOpenApiDocument.paths ?? {});
const requiredOpenApiPaths = [
  '/app/v3/api/intelligence/coding_sessions',
  '/app/v3/api/intelligence/coding_sessions/{sessionId}',
  '/app/v3/api/intelligence/coding_sessions/{sessionId}/turns',
  '/app/v3/api/intelligence/coding_sessions/{sessionId}/checkpoints/{checkpointId}/approval',
  '/app/v3/api/intelligence/coding_sessions/{sessionId}/questions/{questionId}/answer',
];
for (const routePath of requiredOpenApiPaths) {
  if (!appOpenApiPathKeys.includes(routePath)) {
    fail(`birdcoder-app-v3.openapi.json must declare route path ${routePath}`);
  }
}
if (appOpenApiPathKeys.some((routePath) => routePath === '/app/v3/api/coding_sessions' || routePath.startsWith('/app/v3/api/coding_sessions/'))) {
  fail('birdcoder-app-v3.openapi.json must not keep legacy /app/v3/api/coding_sessions paths');
}
if (appOpenApiPathKeys.some((routePath) => routePath.includes('coding-sessions'))) {
  fail('birdcoder-app-v3.openapi.json must use lower_snake_case coding_sessions path segments');
}

const apiServerCargo = read('crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml');
if (!apiServerCargo.includes('sdkwork-web-axum.workspace = true')) {
  fail('sdkwork-birdcoder-standalone-gateway must depend on sdkwork-web-axum');
}
if (!apiServerCargo.includes('sdkwork-web-core')) {
  fail('sdkwork-birdcoder-standalone-gateway must depend on sdkwork-web-core');
}

const authBootstrap = read('crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/auth.rs');
if (!authBootstrap.includes('build_web_framework_layer')) {
  fail('standalone-gateway auth bootstrap must compose sdkwork-web-framework layer');
}
if (!authBootstrap.includes('with_web_request_context')) {
  fail('standalone-gateway auth bootstrap must mount WebRequestContext middleware');
}
if (!authBootstrap.includes('birdcoder_product_app_api_route_manifest')) {
  fail('standalone-gateway auth bootstrap must use product HttpRouteManifest');
}
if (!authBootstrap.includes('SecurityPolicy')) {
  fail('standalone-gateway auth bootstrap must configure SecurityPolicy/CorsPolicy via web-framework');
}

const routerContext = read('crates/sdkwork-birdcoder-router-context/src/lib.rs');
if (!routerContext.includes('WebRequestContext')) {
  fail('sdkwork-birdcoder-router-context must resolve IAM from WebRequestContext');
}
const requiredIamContextExtractor = routerContext.match(
  /impl<S>\s+FromRequestParts<S>\s+for\s+RequiredIamContext\b[\s\S]*?^\}/mu,
)?.[0];
if (!requiredIamContextExtractor) {
  fail('sdkwork-birdcoder-router-context must implement FromRequestParts for RequiredIamContext');
} else if (!/^\s*type\s+Rejection\s*=\s*ProblemJsonBody\s*;\s*$/mu.test(requiredIamContextExtractor)) {
  fail('RequiredIamContext must reject missing IAM context with ProblemJsonBody');
}
if (routerContext.includes('ProblemDetailsPayload')) {
  fail('sdkwork-birdcoder-router-context must not reintroduce retired ProblemDetailsPayload');
}

const handlerFiles = [
  'crates/sdkwork-routes-coding-sessions-app-api/src/handlers.rs',
  'crates/sdkwork-routes-workspace-app-api/src/handlers.rs',
  'crates/sdkwork-routes-engine-catalog-app-api/src/handlers.rs',
  'crates/sdkwork-routes-document-app-api/src/handlers.rs',
  'crates/sdkwork-routes-skill-packages-app-api/src/handlers.rs',
  'crates/sdkwork-routes-deployment-backend-api/src/handlers.rs',
];

for (const relativePath of handlerFiles) {
  const source = read(relativePath);
  if (!source.includes('WebRequestContext')) {
    fail(`${relativePath} handlers must declare WebRequestContext per WEB_FRAMEWORK_SPEC.md`);
  }
  if (
    /["'](?:authorization|access-token|x-api-key)["']/iu.test(source) ||
    /header::(?:AUTHORIZATION|PROXY_AUTHORIZATION)/u.test(source)
  ) {
    fail(`${relativePath} must not parse credential headers directly`);
  }
}

const openApiPaths = [
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
  'apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json',
];

for (const relativePath of openApiPaths) {
  const openApi = read(relativePath);
  if (!openApi.includes('x-sdkwork-request-context')) {
    fail(`${relativePath} must declare x-sdkwork-request-context on operations`);
  }
  if (!openApi.includes('x-sdkwork-api-surface')) {
    fail(`${relativePath} must declare x-sdkwork-api-surface on operations`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Web framework standard failed:\n${failures.map((item) => `- ${item}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Web framework standard passed\n');
