#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const openApiPath = path.join(rootDir, 'artifacts/openapi/coding-server-v1.json');

const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));

/** @type {Map<string, { operationId: string, permission: string | null, public: boolean }>} */
const operationByMethodPath = new Map();

for (const [routePath, methods] of Object.entries(openApi.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation?.operationId) {
      continue;
    }
    operationByMethodPath.set(`${method.toUpperCase()} ${routePath}`, {
      operationId: operation.operationId,
      permission: operation['x-sdkwork-permission'] ?? null,
      public: operation['x-sdkwork-public'] === true,
    });
  }
}

function readPathConstants(crateDir) {
  const pathsFile = path.join(rootDir, crateDir, 'src/paths.rs');
  const source = fs.readFileSync(pathsFile, 'utf8');
  /** @type {Record<string, string>} */
  const constants = {};
  const pattern = /pub const (\w+): &str =\s*"([^"]+)"/gs;
  for (const match of source.matchAll(pattern)) {
    constants[match[1]] = match[2];
  }
  return constants;
}

function resolveOperation(method, pathConst, pathConstants, routeOptions = {}) {
  const routePath = pathConstants[pathConst];
  if (!routePath) {
    throw new Error(`Unknown path constant ${pathConst}`);
  }
  const resolved = operationByMethodPath.get(`${method.toUpperCase()} ${routePath}`);
  if (routeOptions.routeCatalogOnly === true) {
    if (resolved) {
      throw new Error(
        `Route ${method.toUpperCase()} ${routePath} is marked route-catalog-only but exists in HTTP OpenAPI`,
      );
    }
    if (!routeOptions.operationId || !routeOptions.permission) {
      throw new Error(
        `Route-catalog-only route ${method.toUpperCase()} ${routePath} requires explicit operationId and permission`,
      );
    }
    return {
      operationId: routeOptions.operationId,
      permission: routeOptions.permission,
    };
  }
  if (!resolved) {
    throw new Error(`OpenAPI has no operation for ${method.toUpperCase()} ${routePath}`);
  }
  if (resolved.public) {
    throw new Error(`Route ${routePath} is public in OpenAPI but manifest declares dual_token`);
  }
  if (!resolved.permission) {
    throw new Error(`OpenAPI operation ${resolved.operationId} is missing x-sdkwork-permission`);
  }
  return resolved;
}

const crates = [
  {
    crateDir: 'crates/sdkwork-routes-system-app-api',
    fnName: 'system_app_api_route_manifest',
    routesConst: 'SYSTEM_APP_API_ROUTES',
    routes: [
      ['Get', 'SYSTEM_DESCRIPTOR_PATH', 'system'],
      ['Get', 'SYSTEM_ROUTES_PATH', 'system'],
      ['Get', 'SYSTEM_RUNTIME_PATH', 'system'],
      ['Get', 'SYSTEM_HEALTH_PATH', 'system'],
      ['Get', 'OPERATIONS_PATH', 'system'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-routes-coding-sessions-app-api',
    fnName: 'coding_sessions_app_api_route_manifest',
    routesConst: 'CODING_SESSIONS_APP_API_ROUTES',
    routes: [
      ['Get', 'SESSIONS', 'intelligence'],
      ['Post', 'SESSIONS', 'intelligence'],
      ['Get', 'SESSION', 'intelligence'],
      ['Patch', 'SESSION', 'intelligence'],
      ['Delete', 'SESSION', 'intelligence'],
      ['Post', 'SESSION_FORK', 'intelligence'],
      ['Post', 'SESSION_TURNS', 'intelligence'],
      ['Patch', 'SESSION_MESSAGE', 'intelligence'],
      ['Delete', 'SESSION_MESSAGE', 'intelligence'],
      ['Get', 'SESSION_EVENTS', 'intelligence'],
      ['Get', 'SESSION_ARTIFACTS', 'intelligence'],
      ['Get', 'SESSION_CHECKPOINTS', 'intelligence'],
      ['Post', 'APPROVAL_DECISION', 'intelligence'],
      ['Post', 'USER_QUESTION_ANSWER', 'intelligence'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-routes-workspace-app-api',
    fnName: 'workspace_app_api_route_manifest',
    routesConst: 'WORKSPACE_APP_API_ROUTES',
    routes: [
      ['Get', 'WORKSPACES_PATH', 'workspaces'],
      ['Post', 'WORKSPACES_PATH', 'workspaces'],
      ['Get', 'WORKSPACE_DETAIL_PATH', 'workspaces'],
      ['Patch', 'WORKSPACE_DETAIL_PATH', 'workspaces'],
      ['Delete', 'WORKSPACE_DETAIL_PATH', 'workspaces'],
      [
        'Get',
        'WORKSPACE_REALTIME_PATH',
        'workspaces',
        {
          operationId: 'workspaces.realtime.subscribe',
          permission: 'birdcoder.platform-workspaces-realtime.subscribe',
          routeCatalogOnly: true,
          streamKind: 'websocket',
        },
      ],
      ['Get', 'WORKSPACE_MEMBERS_PATH', 'workspaces'],
      ['Post', 'WORKSPACE_MEMBERS_PATH', 'workspaces'],
      ['Get', 'PROJECTS_PATH', 'projects'],
      ['Post', 'PROJECTS_PATH', 'projects'],
      ['Get', 'PROJECT_DETAIL_PATH', 'projects'],
      ['Patch', 'PROJECT_DETAIL_PATH', 'projects'],
      ['Delete', 'PROJECT_DETAIL_PATH', 'projects'],
      ['Get', 'PROJECT_WORKSPACE_BINDING_PATH', 'projects'],
      ['Put', 'PROJECT_WORKSPACE_BINDING_PATH', 'projects', { idempotent: true }],
      ['Delete', 'PROJECT_WORKSPACE_BINDING_PATH', 'projects'],
      ['Get', 'PROJECT_RUNTIME_LOCATIONS_PATH', 'projects'],
      ['Post', 'PROJECT_RUNTIME_LOCATIONS_PATH', 'projects', { idempotent: true }],
      ['Get', 'PROJECT_RUNTIME_LOCATION_DETAIL_PATH', 'projects'],
      ['Patch', 'PROJECT_RUNTIME_LOCATION_DETAIL_PATH', 'projects', { idempotent: true }],
      ['Delete', 'PROJECT_RUNTIME_LOCATION_DETAIL_PATH', 'projects'],
      ['Post', 'PROJECT_RUNTIME_LOCATION_REBIND_PATH', 'projects', { idempotent: true }],
      [
        'Post',
        'PROJECT_RUNTIME_LOCATION_VERIFICATION_REQUEST_PATH',
        'projects',
        { idempotent: true },
      ],
      ['Get', 'PROJECT_RUNTIME_LOCATION_PREFERENCES_PATH', 'projects'],
      ['Put', 'PROJECT_RUNTIME_LOCATION_PREFERENCE_PATH', 'projects', { idempotent: true }],
      ['Get', 'PROJECT_GIT_OVERVIEW_PATH', 'projects'],
      ['Get', 'PROJECT_GIT_DIFF_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_BRANCHES_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_BRANCH_SWITCH_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_COMMITS_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_PUSHES_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_WORKTREES_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_WORKTREE_REMOVALS_PATH', 'projects'],
      ['Post', 'PROJECT_GIT_WORKTREE_PRUNE_PATH', 'projects'],
      ['Get', 'PROJECT_COLLABORATORS_PATH', 'projects'],
      ['Post', 'PROJECT_COLLABORATORS_PATH', 'projects'],
      ['Get', 'DEPLOYMENTS_PATH', 'deployments'],
      ['Get', 'PROJECT_DEPLOYMENT_TARGETS_PATH', 'projects'],
      ['Post', 'PROJECT_PUBLISH_PATH', 'projects'],
      ['Get', 'TEAMS_PATH', 'workspaceTeams'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-routes-engine-catalog-app-api',
    fnName: 'engine_catalog_app_api_route_manifest',
    routesConst: 'ENGINE_CATALOG_APP_API_ROUTES',
    routes: [
      ['Get', 'ENGINES_PATH', 'engines'],
      ['Get', 'ENGINE_CAPABILITIES_PATH', 'engines'],
      ['Get', 'NATIVE_SESSION_PROVIDERS_PATH', 'nativeSessionProviders'],
      ['Get', 'MODELS_PATH', 'models'],
      ['Get', 'MODEL_CONFIG_PATH', 'models'],
      ['Put', 'MODEL_CONFIG_PATH', 'models'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-routes-document-app-api',
    fnName: 'document_app_api_route_manifest',
    routesConst: 'DOCUMENT_APP_API_ROUTES',
    routes: [['Get', 'DOCUMENTS_PATH', 'documents']],
  },
  {
    crateDir: 'crates/sdkwork-routes-skill-packages-app-api',
    fnName: 'skill_packages_app_api_route_manifest',
    routesConst: 'SKILL_PACKAGES_APP_API_ROUTES',
    routes: [['Get', 'APP_TEMPLATES_PATH', 'appTemplates']],
  },
  {
    crateDir: 'crates/sdkwork-routes-commerce-app-api',
    fnName: 'commerce_app_api_route_manifest',
    routesConst: 'COMMERCE_APP_API_ROUTES',
    routes: [
      ['Get', 'ORDERS_PATH', 'commerce'],
      ['Post', 'ORDERS_PATH', 'commerce'],
      ['Get', 'ORDER_PATH', 'commerce'],
      ['Get', 'INVOICES_PATH', 'commerce'],
      ['Get', 'INVOICE_PATH', 'commerce'],
      ['Get', 'PAYMENTS_PATH', 'commerce'],
      ['Post', 'PAYMENTS_PATH', 'commerce'],
      ['Get', 'PAYMENT_PATH', 'commerce'],
      ['Post', 'PAYMENT_CONFIRM_PATH', 'commerce'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-routes-deployment-backend-api',
    fnName: 'deployment_backend_api_route_manifest',
    routesConst: 'DEPLOYMENT_BACKEND_API_ROUTES',
    routes: [
      ['Get', 'ADMIN_PROJECT_DEPLOYMENT_TARGETS_PATH', 'deploymentGovernance'],
      ['Get', 'ADMIN_RELEASES_PATH', 'releases'],
      ['Get', 'ADMIN_DEPLOYMENTS_PATH', 'deploymentGovernance'],
      ['Get', 'ADMIN_TEAMS_PATH', 'teams'],
      ['Get', 'ADMIN_TEAM_MEMBERS_PATH', 'teams'],
    ],
  },
];

function renderRoute(method, pathConst, tag, pathConstants, routeOptions = {}) {
  const resolved = resolveOperation(method, pathConst, pathConstants, routeOptions);
  const idempotency = routeOptions.idempotent === true
    ? '\n    .with_idempotent(true)'
    : '';
  return `    HttpRoute::dual_token(
        HttpMethod::${method},
        paths::${pathConst},
        "${tag}",
        "${resolved.operationId}",
    )${idempotency}
    .with_required_permission("${resolved.permission}"),`;
}

for (const crate of crates) {
  const pathConstants = readPathConstants(crate.crateDir);
  const body = `use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const ${crate.routesConst}: &[HttpRoute] = &[
${crate.routes.map(([method, pathConst, tag, routeOptions]) => renderRoute(method, pathConst, tag, pathConstants, routeOptions)).join('\n')}
];

pub fn ${crate.fnName}() -> HttpRouteManifest {
    HttpRouteManifest::new(${crate.routesConst})
}
`;
  const target = path.join(rootDir, crate.crateDir, 'src/manifest.rs');
  fs.writeFileSync(target, body, 'utf8');
  process.stdout.write(`generated ${target}\n`);
}

process.stdout.write('BirdCoder HTTP route manifests generated\n');
