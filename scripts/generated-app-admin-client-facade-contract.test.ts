import assert from 'node:assert/strict';

const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
  import.meta.url,
);

function createListEnvelope<TItem>(items: readonly TItem[]) {
  return {
    requestId: 'req.generated-app-admin-client-facade-contract',
    timestamp: '2026-04-10T23:30:00.000Z',
    items: [...items],
    meta: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      version: 'v1',
    },
  };
}

const observedRequests: Array<{
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
}> = [];

const {
  createBirdCoderGeneratedAppAdminApiClient,
} = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);

const client = createBirdCoderGeneratedAppAdminApiClient({
  transport: {
    async request<TResponse>(request: {
      method: string;
      path: string;
      query?: Record<string, string | undefined>;
    }): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
        query: request.query,
      });

      switch (request.path) {
        case '/api/app/v1/workspaces':
          return createListEnvelope([
            {
              id: 'workspace-generated-facade',
              name: 'Generated Facade Workspace',
              description: 'Workspace served through shared generated client facade.',
              ownerId: 'user-generated-facade',
              status: 'active',
            },
          ]) as TResponse;
        case '/api/app/v1/projects':
          return createListEnvelope([
            {
              id: 'project-generated-facade',
              workspaceId: String(request.query?.workspaceId ?? ''),
              name: 'Generated Facade Project',
              description: 'Project served through shared generated client facade.',
              rootPath: 'D:/workspace/generated-facade-project',
              status: 'active',
              createdAt: '2026-04-10T23:30:01.000Z',
              updatedAt: '2026-04-10T23:30:01.000Z',
            },
          ]) as TResponse;
        case '/api/app/v1/documents':
          return createListEnvelope([
            {
              id: 'doc-generated-facade',
              projectId: 'project-generated-facade',
              documentKind: 'architecture',
              title: 'Generated Facade Architecture',
              slug: 'generated-facade-architecture',
              status: 'active',
              updatedAt: '2026-04-10T23:30:01.000Z',
            },
          ]) as TResponse;
        case '/api/app/v1/deployments':
          return createListEnvelope([
            {
              id: 'deployment-generated-facade',
              projectId: 'project-generated-facade',
              targetId: 'target-generated-facade',
              status: 'succeeded',
              startedAt: '2026-04-10T23:30:02.000Z',
              completedAt: '2026-04-10T23:30:03.000Z',
            },
          ]) as TResponse;
        case '/api/admin/v1/deployments':
          return createListEnvelope([
            {
              id: 'deployment-admin-generated-facade',
              projectId: 'project-generated-facade',
              targetId: 'target-admin-generated-facade',
              status: 'running',
              startedAt: '2026-04-10T23:30:04.000Z',
            },
          ]) as TResponse;
        case '/api/app/v1/teams':
          return createListEnvelope([
            {
              id: 'team-generated-facade',
              workspaceId: String(request.query?.workspaceId ?? ''),
              name: 'Generated Facade Team',
              description: 'Workspace team served through shared generated client facade.',
              status: 'active',
            },
          ]) as TResponse;
        case '/api/admin/v1/teams':
          return createListEnvelope([
            {
              id: 'admin-team-generated-facade',
              workspaceId: String(request.query?.workspaceId ?? ''),
              name: 'Generated Facade Admin Team',
              description: 'Admin team served through shared generated client facade.',
              status: 'active',
            },
          ]) as TResponse;
        case '/api/admin/v1/teams/team-generated-facade/members':
          return createListEnvelope([
            {
              id: 'member-generated-facade',
              teamId: 'team-generated-facade',
              userId: 'user-generated-facade',
              role: 'admin',
              status: 'active',
            },
          ]) as TResponse;
        case '/api/admin/v1/projects/project-generated-facade/deployment-targets':
          return createListEnvelope([
            {
              id: 'target-generated-facade',
              projectId: 'project-generated-facade',
              name: 'Generated Facade Web Target',
              environmentKey: 'staging',
              runtime: 'web',
              status: 'active',
            },
          ]) as TResponse;
        case '/api/admin/v1/releases':
          return createListEnvelope([
            {
              id: 'release-generated-facade',
              releaseVersion: '0.5.0-generated-facade',
              releaseKind: 'formal',
              rolloutStage: 'stable',
              status: 'ready',
            },
          ]) as TResponse;
        case '/api/admin/v1/audit':
          return createListEnvelope([
            {
              id: 'audit-generated-facade',
              scopeType: 'workspace',
              scopeId: 'workspace-generated-facade',
              eventType: 'release.promoted',
              createdAt: '2026-04-11T15:00:00.000Z',
              payload: {
                actor: 'release-bot',
                stage: 'stable',
              },
            },
          ]) as TResponse;
        case '/api/admin/v1/policies':
          return createListEnvelope([
            {
              id: 'policy-generated-facade',
              scopeType: 'workspace',
              scopeId: 'workspace-generated-facade',
              policyCategory: 'terminal',
              targetType: 'engine',
              targetId: 'codex',
              approvalPolicy: 'Restricted',
              status: 'active',
              updatedAt: '2026-04-11T16:30:00.000Z',
            },
          ]) as TResponse;
        default:
          throw new Error(`Unhandled request: ${request.method} ${request.path}`);
      }
    },
  },
});

const workspaces = await client.listWorkspaces();
const projects = await client.listProjects({ workspaceId: 'workspace-generated-facade' });
const documents = await client.listDocuments();
const deployments = await client.listDeployments();
const adminDeployments = await client.listAdminDeployments();
const teams = await client.listTeams({ workspaceId: 'workspace-generated-facade' });
const adminTeams = await client.listAdminTeams({ workspaceId: 'workspace-generated-facade' });
const members = await client.listTeamMembers('team-generated-facade');
const deploymentTargets = await client.listDeploymentTargets('project-generated-facade');
const releases = await client.listReleases();
const auditEvents = await client.listAuditEvents();
const policies = await client.listPolicies();

assert.equal(workspaces[0]?.id, 'workspace-generated-facade');
assert.equal(projects[0]?.workspaceId, 'workspace-generated-facade');
assert.equal(documents[0]?.projectId, 'project-generated-facade');
assert.equal(deployments[0]?.id, 'deployment-generated-facade');
assert.equal(deployments[0]?.targetId, 'target-generated-facade');
assert.equal(adminDeployments[0]?.id, 'deployment-admin-generated-facade');
assert.equal(adminDeployments[0]?.targetId, 'target-admin-generated-facade');
assert.equal(teams[0]?.workspaceId, 'workspace-generated-facade');
assert.equal(adminTeams[0]?.id, 'admin-team-generated-facade');
assert.equal(members[0]?.teamId, 'team-generated-facade');
assert.equal(members[0]?.role, 'admin');
assert.equal(deploymentTargets[0]?.projectId, 'project-generated-facade');
assert.equal(deploymentTargets[0]?.runtime, 'web');
assert.equal(releases[0]?.id, 'release-generated-facade');
assert.equal(auditEvents[0]?.id, 'audit-generated-facade');
assert.equal(auditEvents[0]?.scopeId, 'workspace-generated-facade');
assert.equal(policies[0]?.id, 'policy-generated-facade');
assert.equal(policies[0]?.approvalPolicy, 'Restricted');
assert.deepEqual(
  observedRequests.map((request) => ({
    method: request.method,
    path: request.path,
    workspaceId: request.query?.workspaceId,
  })),
  [
    {
      method: 'GET',
      path: '/api/app/v1/workspaces',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/app/v1/projects',
      workspaceId: 'workspace-generated-facade',
    },
    {
      method: 'GET',
      path: '/api/app/v1/documents',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/app/v1/deployments',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/admin/v1/deployments',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/app/v1/teams',
      workspaceId: 'workspace-generated-facade',
    },
    {
      method: 'GET',
      path: '/api/admin/v1/teams',
      workspaceId: 'workspace-generated-facade',
    },
    {
      method: 'GET',
      path: '/api/admin/v1/teams/team-generated-facade/members',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/admin/v1/projects/project-generated-facade/deployment-targets',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/admin/v1/releases',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/admin/v1/audit',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/api/admin/v1/policies',
      workspaceId: undefined,
    },
  ],
);

console.log('generated app/admin client facade contract passed.');
