#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const crates = [
  {
    crateDir: 'crates/sdkwork-router-system-app-api',
    fnName: 'system_app_api_route_manifest',
    routesConst: 'SYSTEM_APP_API_ROUTES',
    routes: [
      ['Get', 'SYSTEM_DESCRIPTOR_PATH', 'system', 'descriptor.retrieve', 'dual_token'],
      ['Get', 'SYSTEM_ROUTES_PATH', 'system', 'routes.list', 'dual_token'],
      ['Get', 'SYSTEM_RUNTIME_PATH', 'system', 'runtime.retrieve', 'dual_token'],
      ['Get', 'SYSTEM_HEALTH_PATH', 'system', 'health.retrieve', 'dual_token'],
      ['Get', 'OPERATIONS_PATH', 'system', 'operations.retrieve', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-coding-sessions-app-api',
    fnName: 'coding_sessions_app_api_route_manifest',
    routesConst: 'CODING_SESSIONS_APP_API_ROUTES',
    routes: [
      ['Get', 'SESSIONS', 'intelligence', 'listCodingSessions', 'dual_token'],
      ['Post', 'SESSIONS', 'intelligence', 'createCodingSession', 'dual_token'],
      ['Get', 'SESSION', 'intelligence', 'getCodingSession', 'dual_token'],
      ['Patch', 'SESSION', 'intelligence', 'updateCodingSession', 'dual_token'],
      ['Delete', 'SESSION', 'intelligence', 'deleteCodingSession', 'dual_token'],
      ['Post', 'SESSION_FORK', 'intelligence', 'forkCodingSession', 'dual_token'],
      ['Post', 'SESSION_TURNS', 'intelligence', 'createCodingSessionTurn', 'dual_token'],
      ['Patch', 'SESSION_MESSAGE', 'intelligence', 'editCodingSessionMessage', 'dual_token'],
      ['Delete', 'SESSION_MESSAGE', 'intelligence', 'deleteCodingSessionMessage', 'dual_token'],
      ['Get', 'SESSION_EVENTS', 'intelligence', 'listCodingSessionEvents', 'dual_token'],
      ['Get', 'SESSION_ARTIFACTS', 'intelligence', 'listCodingSessionArtifacts', 'dual_token'],
      ['Get', 'SESSION_CHECKPOINTS', 'intelligence', 'listCodingSessionCheckpoints', 'dual_token'],
      ['Post', 'APPROVAL_DECISION', 'intelligence', 'submitApprovalDecision', 'dual_token'],
      ['Post', 'USER_QUESTION_ANSWER', 'intelligence', 'submitUserQuestionAnswer', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-workspace-app-api',
    fnName: 'workspace_app_api_route_manifest',
    routesConst: 'WORKSPACE_APP_API_ROUTES',
    routes: [
      ['Get', 'WORKSPACES_PATH', 'workspaces', 'workspaces.list', 'dual_token'],
      ['Post', 'WORKSPACES_PATH', 'workspaces', 'workspaces.create', 'dual_token'],
      ['Get', 'WORKSPACE_DETAIL_PATH', 'workspaces', 'workspaces.retrieve', 'dual_token'],
      ['Patch', 'WORKSPACE_DETAIL_PATH', 'workspaces', 'workspaces.update', 'dual_token'],
      ['Delete', 'WORKSPACE_DETAIL_PATH', 'workspaces', 'workspaces.delete', 'dual_token'],
      ['Get', 'WORKSPACE_REALTIME_PATH', 'workspaces', 'workspaces.realtime.subscribe', 'dual_token'],
      ['Get', 'WORKSPACE_MEMBERS_PATH', 'workspaces', 'workspaces.members.list', 'dual_token'],
      ['Post', 'WORKSPACE_MEMBERS_PATH', 'workspaces', 'workspaces.members.upsert', 'dual_token'],
      ['Get', 'PROJECTS_PATH', 'projects', 'projects.list', 'dual_token'],
      ['Post', 'PROJECTS_PATH', 'projects', 'projects.create', 'dual_token'],
      ['Get', 'PROJECT_DETAIL_PATH', 'projects', 'projects.retrieve', 'dual_token'],
      ['Patch', 'PROJECT_DETAIL_PATH', 'projects', 'projects.update', 'dual_token'],
      ['Delete', 'PROJECT_DETAIL_PATH', 'projects', 'projects.delete', 'dual_token'],
      ['Get', 'PROJECT_GIT_OVERVIEW_PATH', 'projects', 'projects.git.overview.retrieve', 'dual_token'],
      ['Post', 'PROJECT_GIT_BRANCHES_PATH', 'projects', 'projects.git.branches.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_BRANCH_SWITCH_PATH', 'projects', 'projects.git.branchSwitch.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_COMMITS_PATH', 'projects', 'projects.git.commits.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_PUSHES_PATH', 'projects', 'projects.git.pushes.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_WORKTREES_PATH', 'projects', 'projects.git.worktrees.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_WORKTREE_REMOVALS_PATH', 'projects', 'projects.git.worktreeRemovals.create', 'dual_token'],
      ['Post', 'PROJECT_GIT_WORKTREE_PRUNE_PATH', 'projects', 'projects.git.worktreePrune.create', 'dual_token'],
      ['Get', 'PROJECT_COLLABORATORS_PATH', 'projects', 'projects.collaborators.list', 'dual_token'],
      ['Post', 'PROJECT_COLLABORATORS_PATH', 'projects', 'projects.collaborators.upsert', 'dual_token'],
      ['Get', 'DEPLOYMENTS_PATH', 'deployments', 'deployments.list', 'dual_token'],
      ['Get', 'PROJECT_DEPLOYMENT_TARGETS_PATH', 'projects', 'projects.deploymentTargets.list', 'dual_token'],
      ['Post', 'PROJECT_PUBLISH_PATH', 'projects', 'projects.publish.create', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-engine-catalog-app-api',
    fnName: 'engine_catalog_app_api_route_manifest',
    routesConst: 'ENGINE_CATALOG_APP_API_ROUTES',
    routes: [
      ['Get', 'ENGINES_PATH', 'engines', 'engines.list', 'dual_token'],
      ['Get', 'ENGINE_CAPABILITIES_PATH', 'engines', 'engines.capabilities.retrieve', 'dual_token'],
      ['Get', 'NATIVE_SESSION_PROVIDERS_PATH', 'nativeSessions', 'nativeSessionProviders.list', 'dual_token'],
      ['Get', 'NATIVE_SESSIONS_PATH', 'nativeSessions', 'nativeSessions.list', 'dual_token'],
      ['Get', 'NATIVE_SESSION_DETAIL_PATH', 'nativeSessions', 'nativeSessions.retrieve', 'dual_token'],
      ['Get', 'MODELS_PATH', 'models', 'models.list', 'dual_token'],
      ['Get', 'MODEL_CONFIG_PATH', 'models', 'modelConfig.retrieve', 'dual_token'],
      ['Put', 'MODEL_CONFIG_PATH', 'models', 'modelConfig.sync', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-document-app-api',
    fnName: 'document_app_api_route_manifest',
    routesConst: 'DOCUMENT_APP_API_ROUTES',
    routes: [['Get', 'DOCUMENTS_PATH', 'documents', 'documents.list', 'dual_token']],
  },
  {
    crateDir: 'crates/sdkwork-router-skill-packages-app-api',
    fnName: 'skill_packages_app_api_route_manifest',
    routesConst: 'SKILL_PACKAGES_APP_API_ROUTES',
    routes: [
      ['Get', 'SKILL_PACKAGES_PATH', 'skillPackages', 'skillPackages.list', 'dual_token'],
      ['Post', 'SKILL_PACKAGE_INSTALLATIONS_PATH', 'skillPackages', 'skillPackages.installations.create', 'dual_token'],
      ['Get', 'APP_TEMPLATES_PATH', 'appTemplates', 'appTemplates.list', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-membership-app-api',
    fnName: 'membership_app_api_route_manifest',
    routesConst: 'MEMBERSHIP_APP_API_ROUTES',
    routes: [
      ['Get', 'MEMBERSHIP_CURRENT_PATH', 'memberships', 'memberships.current.retrieve', 'dual_token'],
      ['Get', 'MEMBERSHIP_PACKAGE_GROUPS_PATH', 'memberships', 'memberships.packageGroups.list', 'dual_token'],
    ],
  },
  {
    crateDir: 'crates/sdkwork-router-deployment-backend-api',
    fnName: 'deployment_backend_api_route_manifest',
    routesConst: 'DEPLOYMENT_BACKEND_API_ROUTES',
    routes: [
      ['Get', 'ADMIN_DEPLOYMENT_TARGETS_PATH', 'deploymentGovernance', 'deploymentTargets.list', 'dual_token'],
      ['Get', 'ADMIN_RELEASES_PATH', 'releases', 'releases.list', 'dual_token'],
      ['Get', 'ADMIN_DEPLOYMENTS_PATH', 'deploymentGovernance', 'deploymentGovernance.list', 'dual_token'],
    ],
  },
];

function renderRoute([method, pathConst, tag, operationId, auth]) {
  const authExpr = auth === 'public' ? 'HttpRoute::public' : 'HttpRoute::dual_token';
  return `    ${authExpr}(\n        HttpMethod::${method},\n        paths::${pathConst},\n        "${tag}",\n        "${operationId}",\n    ),`;
}

for (const crate of crates) {
  const body = `use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const ${crate.routesConst}: &[HttpRoute] = &[
${crate.routes.map(renderRoute).join('\n')}
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
