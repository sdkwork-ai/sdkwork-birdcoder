#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const openApiPath = path.join(
  rootDir,
  'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json',
);
const assemblyManifestPath = path.join(
  rootDir,
  'crates/sdkwork-api-birdcoder-assembly/assembly-manifest.json',
);
const HTTP_METHODS = [
  ['get', 'Get'],
  ['post', 'Post'],
  ['put', 'Put'],
  ['patch', 'Patch'],
  ['delete', 'Delete'],
];
const ROUTE_CRATE_CONFIG = new Map([
  [
    'sdkwork-routes-system-app-api',
    {
      fnName: 'system_app_api_route_manifest',
      routesConst: 'SYSTEM_APP_API_ROUTES',
      tag: resolveOperationDomainTag,
    },
  ],
  [
    'sdkwork-routes-workspace-app-api',
    {
      fnName: 'workspace_app_api_route_manifest',
      routesConst: 'WORKSPACE_APP_API_ROUTES',
      tag: resolveOperationDomainTag,
    },
  ],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveOperationDomainTag(operation) {
  const tags = operation.tags ?? [];
  const domain = operation['x-sdkwork-domain'];
  if (tags.length !== 1 || tags[0] !== domain) {
    throw new Error(
      `${operation.operationId} must declare exactly one tag matching x-sdkwork-domain`,
    );
  }
  return domain;
}

function readPathConstants(crateDir) {
  const pathsFile = path.join(rootDir, crateDir, 'src/paths.rs');
  const source = fs.readFileSync(pathsFile, 'utf8');
  const constants = [];
  const pattern = /pub const (\w+): &str =\s*"([^"]+)"/gs;
  for (const match of source.matchAll(pattern)) {
    constants.push({ name: match[1], path: match[2] });
  }
  if (constants.length === 0) {
    throw new Error(`${crateDir} does not declare any HTTP path constants`);
  }
  return constants;
}

function assertOwnedOperation(operation, method, routePath) {
  if (!operation?.operationId) {
    throw new Error(`${method.toUpperCase()} ${routePath} is missing operationId`);
  }
  if (operation['x-sdkwork-owner'] !== 'sdkwork-birdcoder') {
    throw new Error(`${operation.operationId} is not owned by sdkwork-birdcoder`);
  }
  if (operation['x-sdkwork-api-authority'] !== 'sdkwork-birdcoder-app-api') {
    throw new Error(`${operation.operationId} is not in the BirdCoder app API authority`);
  }
  if (operation['x-sdkwork-public'] === true) {
    throw new Error(`${operation.operationId} is public but the route manifest uses dual-token auth`);
  }
  if (!operation['x-sdkwork-permission']) {
    throw new Error(`${operation.operationId} is missing x-sdkwork-permission`);
  }
}

function collectRoutes(openApi, routeCrate, config, coveredOperations) {
  const routes = [];
  for (const pathConstant of readPathConstants(routeCrate.memberDir)) {
    const pathItem = openApi.paths?.[pathConstant.path];
    if (!pathItem) {
      throw new Error(
        `${routeCrate.packageName} path ${pathConstant.path} is absent from the owner-only OpenAPI`,
      );
    }
    for (const [method, rustMethod] of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }
      assertOwnedOperation(operation, method, pathConstant.path);
      const operationKey = `${method.toUpperCase()} ${pathConstant.path}`;
      if (coveredOperations.has(operationKey)) {
        throw new Error(`Duplicate assembled operation ${operationKey}`);
      }
      coveredOperations.add(operationKey);
      routes.push({
        idempotent: operation['x-sdkwork-idempotent'] === true,
        operationId: operation.operationId,
        pathConstant: pathConstant.name,
        permission: operation['x-sdkwork-permission'],
        rustMethod,
        tag: config.tag(operation),
      });
    }
  }
  return routes;
}

function renderRoute(route) {
  const idempotency = route.idempotent ? '\n    .with_idempotent(true)' : '';
  return `    HttpRoute::dual_token(
        HttpMethod::${route.rustMethod},
        paths::${route.pathConstant},
        "${route.tag}",
        "${route.operationId}",
    )${idempotency}
    .with_required_permission("${route.permission}"),`;
}

function renderManifest(config, routes) {
  return `use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const ${config.routesConst}: &[HttpRoute] = &[
${routes.map(renderRoute).join('\n')}
];

pub fn ${config.fnName}() -> HttpRouteManifest {
    HttpRouteManifest::new(${config.routesConst})
}
`;
}

function countOpenApiOperations(openApi) {
  let count = 0;
  for (const pathItem of Object.values(openApi.paths ?? {})) {
    for (const [method] of HTTP_METHODS) {
      if (pathItem?.[method]) {
        count += 1;
      }
    }
  }
  return count;
}

const openApi = readJson(openApiPath);
const assemblyManifest = readJson(assemblyManifestPath);
const routeCrates = assemblyManifest.routeCrates ?? [];
const coveredOperations = new Set();

if (routeCrates.length !== ROUTE_CRATE_CONFIG.size) {
  throw new Error(
    `BirdCoder assembly must contain exactly ${ROUTE_CRATE_CONFIG.size} owner route crates; found ${routeCrates.length}`,
  );
}

for (const routeCrate of routeCrates) {
  if (routeCrate.surface !== 'app-api') {
    throw new Error(`${routeCrate.packageName} must be an app-api route crate`);
  }
  const config = ROUTE_CRATE_CONFIG.get(routeCrate.packageName);
  if (!config) {
    throw new Error(`Unexpected BirdCoder route crate: ${routeCrate.packageName}`);
  }
  const routes = collectRoutes(openApi, routeCrate, config, coveredOperations);
  const target = path.join(rootDir, routeCrate.memberDir, 'src/manifest.rs');
  const body = renderManifest(config, routes);
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== body) {
    fs.writeFileSync(target, body, 'utf8');
    process.stdout.write(`generated ${target}\n`);
  }
}

const openApiOperationCount = countOpenApiOperations(openApi);
if (coveredOperations.size !== openApiOperationCount) {
  throw new Error(
    `Route manifests cover ${coveredOperations.size} operations but owner-only OpenAPI contains ${openApiOperationCount}`,
  );
}

process.stdout.write(
  `BirdCoder HTTP route manifests aligned (${coveredOperations.size} owner operations)\n`,
);
