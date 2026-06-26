#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspaceRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OPENAPI_CANDIDATE_PATHS = [
  'deployments/server-windows/x64/openapi/coding-server-v1.json',
  'deployments/server-win32/x64/openapi/coding-server-v1.json',
  'artifacts/openapi/coding-server-v1.json',
];

const RUST_PRODUCT_ROUTE_CRATES = [
  'crates/sdkwork-routes-system-app-api',
  'crates/sdkwork-routes-coding-sessions-app-api',
  'crates/sdkwork-routes-workspace-app-api',
  'crates/sdkwork-routes-document-app-api',
  'crates/sdkwork-routes-engine-catalog-app-api',
  'crates/sdkwork-routes-skill-packages-app-api',
  'crates/sdkwork-routes-membership-app-api',
  'crates/sdkwork-routes-deployment-backend-api',
];

const IAM_FEDERATION_DEPENDENCIES = [
  'sdkwork_routes_iam_app_api',
  'sdkwork_routes_iam_backend_api',
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRootDir, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(workspaceRootDir, relativePath), 'utf8');
}

function resolveOpenApiPath() {
  for (const relativePath of OPENAPI_CANDIDATE_PATHS) {
    const absolutePath = path.join(workspaceRootDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      return relativePath;
    }
  }

  throw new Error(
    `No coding-server OpenAPI snapshot found. Expected one of: ${OPENAPI_CANDIDATE_PATHS.join(', ')}`,
  );
}

function resolveCargoWorkspaceCrateRoot(cargoTomlSource, dependencyKey) {
  const pattern = new RegExp(
    `^${dependencyKey}\\s*=\\s*\\{[^\\}]*path\\s*=\\s*"([^"]+)"`,
    'mu',
  );
  const match = cargoTomlSource.match(pattern);
  if (!match) {
    throw new Error(`Cargo.toml must declare ${dependencyKey} with a workspace path.`);
  }
  return path.resolve(workspaceRootDir, match[1]);
}

function readPathConstants(crateDir) {
  const pathsFile = path.join(workspaceRootDir, crateDir, 'src/paths.rs');
  const source = fs.readFileSync(pathsFile, 'utf8');
  /** @type {Record<string, string>} */
  const constants = {};
  const pattern = /pub const (\w+): &str =\s*"([^"]+)"/gs;
  for (const match of source.matchAll(pattern)) {
    constants[match[1]] = match[2];
  }
  return constants;
}

function readRustProductManifestRoutes(crateDir) {
  const manifestFile = path.join(workspaceRootDir, crateDir, 'src/manifest.rs');
  const source = fs.readFileSync(manifestFile, 'utf8');
  const pathConstants = readPathConstants(crateDir);
  /** @type {Array<{ method: string, path: string, source: string }>} */
  const routes = [];
  const pattern =
    /HttpRoute::(?:dual_token|public)\(\s*HttpMethod::(\w+),\s*paths::(\w+)/gs;
  for (const match of source.matchAll(pattern)) {
    const routePath = pathConstants[match[2]];
    if (!routePath) {
      throw new Error(`${crateDir} references unknown path constant ${match[2]}`);
    }
    routes.push({
      method: match[1].toUpperCase(),
      path: routePath,
      source: 'birdcoder-product',
    });
  }
  return routes;
}

function readRustIamManifestRoutes(crateRoot, sourceLabel) {
  const manifestFile = path.join(crateRoot, 'src/manifest.rs');
  const source = fs.readFileSync(manifestFile, 'utf8');
  /** @type {Array<{ method: string, path: string, source: string }>} */
  const routes = [];
  const pattern =
    /HttpRoute::(?:dual_token|public|credential_entry_public)\(\s*HttpMethod::(\w+),\s*"([^"]+)"/gs;
  for (const match of source.matchAll(pattern)) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      source: sourceLabel,
    });
  }
  return routes;
}

function routeKey(method, routePath) {
  return `${method.toUpperCase()} ${routePath}`;
}

function classifyOwnerLane(routePath) {
  if (routePath.startsWith('/backend/v3/api/iam/')) {
    return 'backend-governance';
  }
  if (routePath.startsWith('/backend/v3/api')) {
    return 'backend-governance';
  }
  if (routePath.includes('/iam/') || routePath.startsWith('/app/v3/api/auth/')) {
    return 'iam-federation';
  }
  return 'app-feature-lane';
}

function classifySurface(routePath) {
  if (routePath.startsWith('/backend/v3/api')) {
    return 'backend';
  }
  if (routePath.startsWith('/app/v3/api')) {
    return 'app';
  }
  return 'unknown';
}

function listOpenApiOperations(openApi) {
  /** @type {Array<{ method: string, path: string, operationId: string }>} */
  const operations = [];
  for (const [routePath, methods] of Object.entries(openApi.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation?.operationId) {
        continue;
      }
      operations.push({
        method: method.toUpperCase(),
        path: routePath,
        operationId: operation.operationId,
      });
    }
  }
  return operations.sort((left, right) =>
    routeKey(left.method, left.path).localeCompare(routeKey(right.method, right.path)),
  );
}

export function buildCodingServerOpenApiRustDeferRegistry() {
  const openApiRelativePath = resolveOpenApiPath();
  const openApi = readJson(openApiRelativePath);
  const contractOperations = listOpenApiOperations(openApi);
  const cargoTomlSource = readText('Cargo.toml');

  const productRoutes = RUST_PRODUCT_ROUTE_CRATES.flatMap((crateDir) =>
    readRustProductManifestRoutes(crateDir),
  );
  const iamAppCrateRoot = resolveCargoWorkspaceCrateRoot(
    cargoTomlSource,
    'sdkwork_routes_iam_app_api',
  );
  const iamBackendCrateRoot = resolveCargoWorkspaceCrateRoot(
    cargoTomlSource,
    'sdkwork_routes_iam_backend_api',
  );
  const iamAppRoutes = readRustIamManifestRoutes(iamAppCrateRoot, 'sdkwork-iam-app');
  const iamBackendRoutes = readRustIamManifestRoutes(iamBackendCrateRoot, 'sdkwork-iam-backend');

  const hostRoutes = [...productRoutes, ...iamAppRoutes, ...iamBackendRoutes];
  const hostRouteKeys = new Set(hostRoutes.map((route) => routeKey(route.method, route.path)));

  const deferred = contractOperations
    .filter((operation) => !hostRouteKeys.has(routeKey(operation.method, operation.path)))
    .map((operation) => ({
      method: operation.method,
      path: operation.path,
      operationId: operation.operationId,
      surface: classifySurface(operation.path),
      ownerLane: classifyOwnerLane(operation.path),
      phase: 'pre-launch-deferred',
    }));

  const implemented = contractOperations
    .filter((operation) => hostRouteKeys.has(routeKey(operation.method, operation.path)))
    .map((operation) => ({
      method: operation.method,
      path: operation.path,
      operationId: operation.operationId,
      surface: classifySurface(operation.path),
    }));

  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString().slice(0, 10),
    openApiSnapshotPath: openApiRelativePath,
    summary: {
      contractOperationCount: contractOperations.length,
      rustProductManifestRouteCount: productRoutes.length,
      iamFederationManifestRouteCount: iamAppRoutes.length + iamBackendRoutes.length,
      hostManifestRouteCount: hostRouteKeys.size,
      implementedOperationCount: implemented.length,
      deferredOperationCount: deferred.length,
    },
    federation: {
      iamAppCrate: path.relative(workspaceRootDir, iamAppCrateRoot).replaceAll('\\', '/'),
      iamBackendCrate: path.relative(workspaceRootDir, iamBackendCrateRoot).replaceAll('\\', '/'),
      wiredInApiServer: 'crates/sdkwork-birdcoder-api-server/src/bootstrap/iam.rs',
    },
    rule:
      'Deferred operations are absent from BirdCoder product manifests and federated sdkwork-iam manifests wired in api-server; remaining routes are intentionally phased per TECH-2026-06-24.',
    implemented,
    deferred,
  };
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const registry = buildCodingServerOpenApiRustDeferRegistry();
  const outputPath = path.join(
    workspaceRootDir,
    'specs/coding-server-openapi-rust-defer-registry.json',
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `Wrote ${path.relative(workspaceRootDir, outputPath)} (${registry.summary.deferredOperationCount} deferred / ${registry.summary.contractOperationCount} contract operations)\n`,
  );
}
