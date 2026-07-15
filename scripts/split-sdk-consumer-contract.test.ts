import type {
  BirdCoderAppSdkApiClient,
  BirdCoderAppRuntimeSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';

const dataKernelModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/dataKernel.ts',
  import.meta.url,
);
const consoleRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/appConsoleRepository.ts',
  import.meta.url,
);
const consoleQueriesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/consoleQueries.ts',
  import.meta.url,
);
const appSdkTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSdkTransport.ts',
  import.meta.url,
);
const backendSdkTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/backendSdkTransport.ts',
  import.meta.url,
);
const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const defaultServicesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, value);
      },
      removeItem(key: string) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const { createBirdCoderStorageProvider } = await import(
    `${dataKernelModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderConsoleRepositories } = await import(
    `${consoleRepositoryModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderConsoleQueries } = await import(
    `${consoleQueriesModulePath.href}?t=${Date.now()}`
  );
  const {
    createBirdCoderInProcessAppSdkTransport,
  } = await import(`${appSdkTransportModulePath.href}?t=${Date.now()}`);
  const {
    createBirdCoderInProcessBackendSdkTransport,
  } = await import(`${backendSdkTransportModulePath.href}?t=${Date.now()}`);
  const {
    createBirdCoderAppSdkApiClient,
    createBirdCoderBackendSdkApiClient,
  } = await import(
    `${sdkClientsModulePath.href}?t=${Date.now()}`
  );
  const { createDefaultBirdCoderIdeServices } = await import(
    `${defaultServicesModulePath.href}?t=${Date.now()}`
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: provider.providerId,
    storage: provider,
  });
  const queries = createBirdCoderConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    repositories.projectContents.clear(),
    repositories.documents.clear(),
    repositories.deployments.clear(),
    repositories.targets.clear(),
    repositories.members.clear(),
    repositories.policies.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
    repositories.audits.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-sdk-contract',
    name: 'SDK Contract Workspace',
    description: 'Workspace served through the split app/backend SDK clients.',
    ownerId: 'user-sdk-contract',
    createdAt: '2026-04-10T19:00:00.000Z',
    updatedAt: '2026-04-10T19:00:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-sdk-contract',
    workspaceId: 'workspace-sdk-contract',
    name: 'SDK Contract Project',
    description: 'Project catalog served through the typed app client.',
    status: 'active',
    createdAt: '2026-04-10T19:00:01.000Z',
    updatedAt: '2026-04-10T19:00:01.000Z',
  });
  await repositories.documents.save({
    id: 'doc-sdk-contract',
    projectId: 'project-sdk-contract',
    documentKind: 'architecture',
    title: 'SDK Contract Architecture',
    slug: 'sdk-contract-architecture',
    status: 'active',
    createdAt: '2026-04-10T19:00:01.500Z',
    updatedAt: '2026-04-10T19:00:01.500Z',
  });
  await repositories.deployments.save({
    id: 'deployment-sdk-contract',
    projectId: 'project-sdk-contract',
    targetId: 'target-sdk-contract',
    releaseRecordId: 'release-sdk-contract',
    endpointUrl: 'https://sdk-contract.sdkwork.dev',
    status: 'running',
    startedAt: '2026-04-10T19:00:01.750Z',
    completedAt: undefined,
    createdAt: '2026-04-10T19:00:01.750Z',
    updatedAt: '2026-04-10T19:00:01.750Z',
  });
  await repositories.targets.save({
    id: 'target-sdk-contract',
    projectId: 'project-sdk-contract',
    name: 'SDK Contract Target',
    environmentKey: 'staging',
    runtime: 'container',
    status: 'active',
    createdAt: '2026-04-10T19:00:01.900Z',
    updatedAt: '2026-04-10T19:00:01.900Z',
  });
  await repositories.teams.save({
    id: 'team-sdk-contract',
    workspaceId: 'workspace-sdk-contract',
    name: 'SDK Contract Team',
    description: 'Team catalog served through the typed app client.',
    status: 'active',
    createdAt: '2026-04-10T19:00:02.000Z',
    updatedAt: '2026-04-10T19:00:02.000Z',
  });
  await repositories.members.save({
    id: 'member-sdk-contract',
    teamId: 'team-sdk-contract',
    userId: 'user-sdk-contract',
    role: 'admin',
    status: 'active',
    createdAt: '2026-04-10T19:00:02.250Z',
    updatedAt: '2026-04-10T19:00:02.250Z',
  });
  await repositories.policies.save({
    id: 'policy-sdk-contract',
    scopeType: 'workspace',
    scopeId: 'workspace-sdk-contract',
    policyCategory: 'terminal',
    targetType: 'engine',
    targetId: 'codex',
    approvalPolicy: 'Restricted',
    status: 'active',
    rationale: 'High-risk terminal commands require explicit approval.',
    createdAt: '2026-04-10T19:00:02.500Z',
    updatedAt: '2026-04-10T19:00:02.500Z',
  });
  await repositories.releases.save({
    id: 'release-sdk-contract',
    releaseVersion: '0.5.0-sdk-contract',
    releaseKind: 'formal',
    rolloutStage: 'stable',
    manifest: {
      channel: 'stable',
      evidence: ['split-sdk-consumer'],
    },
    status: 'ready',
    createdAt: '2026-04-10T19:00:03.000Z',
    updatedAt: '2026-04-10T19:00:03.000Z',
  });
  await repositories.audits.save({
    id: 'audit-sdk-contract',
    scopeType: 'workspace',
    scopeId: 'workspace-sdk-contract',
    eventType: 'release.promoted',
    payload: {
      actor: 'release-bot',
      stage: 'stable',
    },
    createdAt: '2026-04-10T19:00:04.000Z',
    updatedAt: '2026-04-10T19:00:04.000Z',
  });

  const requests: Array<{
    method: string;
    path: string;
    query?: Record<string, string | undefined>;
  }> = [];

  const appClient: BirdCoderAppSdkApiClient = createBirdCoderAppSdkApiClient({
    transport: createBirdCoderInProcessAppSdkTransport({
      queries,
      observe(request) {
        requests.push({
          method: request.method,
          path: request.path,
          query: request.query,
        });
      },
    }),
  });
  const backendClient: BirdCoderBackendSdkApiClient = createBirdCoderBackendSdkApiClient({
    transport: createBirdCoderInProcessBackendSdkTransport({
      queries,
      observe(request) {
        requests.push({
          method: request.method,
          path: request.path,
          query: request.query,
        });
      },
    }),
  });

  const workspaceSummaries = await appClient.listWorkspaces();
  const projectSummaries = await appClient.listProjects({ workspaceId: 'workspace-sdk-contract' });
  const documentSummaries = await appClient.listDocuments();
  const deploymentSummaries = await appClient.listDeployments();
  const adminDeploymentSummaries = await backendClient.listGovernanceDeployments();
  const deploymentTargetSummaries = await backendClient.listDeploymentTargets('project-sdk-contract');
  const teamSummaries = await appClient.listTeams({ workspaceId: 'workspace-sdk-contract' });
  const adminTeamSummaries = await backendClient.listGovernanceTeams({ workspaceId: 'workspace-sdk-contract' });
  const memberSummaries = await backendClient.listTeamMembers('team-sdk-contract');
  const releaseSummaries = await backendClient.listReleases();
  const auditSummaries = await backendClient.listAuditEvents();
  const policySummaries = await backendClient.listPolicies();

  assert.equal(workspaceSummaries[0]?.id, 'workspace-sdk-contract');
  assert.equal(projectSummaries[0]?.id, 'project-sdk-contract');
  assert.equal(
    Object.hasOwn(projectSummaries[0] ?? {}, 'path'),
    false,
    'project SDK reads must not expose a client-local working directory.',
  );
  assert.equal(
    Object.hasOwn(projectSummaries[0] ?? {}, 'sitePath'),
    false,
    'project SDK reads must not expose a client-local site path.',
  );
  assert.equal(documentSummaries[0]?.id, 'doc-sdk-contract');
  assert.equal(deploymentSummaries[0]?.id, 'deployment-sdk-contract');
  assert.equal(adminDeploymentSummaries[0]?.id, 'deployment-sdk-contract');
  assert.equal(deploymentTargetSummaries[0]?.id, 'target-sdk-contract');
  assert.equal(deploymentTargetSummaries[0]?.projectId, 'project-sdk-contract');
  assert.equal(teamSummaries[0]?.id, 'team-sdk-contract');
  assert.equal(adminTeamSummaries[0]?.id, 'team-sdk-contract');
  assert.equal(memberSummaries[0]?.id, 'member-sdk-contract');
  assert.equal(memberSummaries[0]?.role, 'admin');
  assert.equal(releaseSummaries[0]?.id, 'release-sdk-contract');
  assert.equal(auditSummaries[0]?.id, 'audit-sdk-contract');
  assert.equal(policySummaries[0]?.id, 'policy-sdk-contract');
  assert.deepEqual(
    requests.map((request) => ({
      method: request.method,
      path: request.path,
      workspaceId: request.query?.workspaceId,
    })),
    [
      {
        method: 'GET',
        path: '/app/v3/api/workspaces',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/projects',
        workspaceId: 'workspace-sdk-contract',
      },
      {
        method: 'GET',
        path: '/app/v3/api/documents',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/deployments',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/backend/v3/api/deployments',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/backend/v3/api/projects/project-sdk-contract/deployment_targets',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/teams',
        workspaceId: 'workspace-sdk-contract',
      },
      {
        method: 'GET',
        path: '/backend/v3/api/iam/teams',
        workspaceId: 'workspace-sdk-contract',
      },
      {
        method: 'GET',
        path: '/backend/v3/api/iam/teams/team-sdk-contract/members',
        workspaceId: undefined,
      },
    {
      method: 'GET',
      path: '/backend/v3/api/releases',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/backend/v3/api/iam/audit_events',
      workspaceId: undefined,
    },
    {
      method: 'GET',
      path: '/backend/v3/api/iam/policies',
      workspaceId: undefined,
    },
  ],
);

  requests.length = 0;

  const services = createDefaultBirdCoderIdeServices({
    appClient,
    appRuntimeClient: {
      ...appClient,
      async listCodingSessions() {
        return [];
      },
    } satisfies BirdCoderAppRuntimeSdkApiClient,
    backendClient,
    storageProvider: provider,
  });
  const workspaceCatalog = await services.workspaceService.getWorkspaces();
  const projectCatalog = await services.projectService.getProjects('workspace-sdk-contract');
  const documentCatalog = await services.documentService.getDocuments();
  const deploymentCatalog = await services.deploymentService.getDeployments();
  const adminDeploymentCatalog = await services.adminDeploymentService.getDeployments();
  const adminPolicyCatalog = await services.adminPolicyService.getPolicies();
  const teamCatalog = await services.teamService.getTeams('workspace-sdk-contract');
  const auditCatalog = await services.auditService.getAuditEvents();

  assert.ok(
    workspaceCatalog.some((workspace) => workspace.id === 'workspace-sdk-contract'),
    'workspace catalog reads must be served through the app SDK client.',
  );
  assert.ok(
    projectCatalog.some((project) => project.id === 'project-sdk-contract'),
    'project catalog reads must be served through the app SDK client.',
  );
  assert.ok(
    documentCatalog.some((document) => document.id === 'doc-sdk-contract'),
    'document catalog reads must be served through the app SDK client.',
  );
  assert.ok(
    deploymentCatalog.some((deployment) => deployment.id === 'deployment-sdk-contract'),
    'deployment catalog reads must be served through the app SDK client.',
  );
  assert.ok(
    adminDeploymentCatalog.some((deployment) => deployment.id === 'deployment-sdk-contract'),
    'admin deployment catalog reads must be served through the backend SDK client.',
  );
  assert.ok(
    adminPolicyCatalog.some((policy) => policy.id === 'policy-sdk-contract'),
    'admin policy catalog reads must be served through the backend SDK client.',
  );
  assert.ok(
    teamCatalog.some((team) => team.id === 'team-sdk-contract'),
    'team catalog reads must be served through the app SDK client.',
  );
  assert.ok(
    auditCatalog.some((auditEvent) => auditEvent.id === 'audit-sdk-contract'),
    'audit catalog reads must be served through the backend SDK client.',
  );
  assert.deepEqual(
    requests.map((request) => ({
      method: request.method,
      path: request.path,
      workspaceId: request.query?.workspaceId,
    })),
    [
      {
        method: 'GET',
        path: '/app/v3/api/workspaces',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/projects',
        workspaceId: 'workspace-sdk-contract',
      },
      {
        method: 'GET',
        path: '/app/v3/api/documents',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/deployments',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/backend/v3/api/deployments',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/backend/v3/api/iam/policies',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/teams',
        workspaceId: 'workspace-sdk-contract',
      },
      {
        method: 'GET',
        path: '/backend/v3/api/iam/audit_events',
        workspaceId: undefined,
      },
    ],
  );

  requests.length = 0;

  const createdWorkspace = await services.workspaceService.createWorkspace(
    'Created Through API Backed Service',
    'Created locally and reloaded through the same app client contract.',
  );
  await services.projectService.createProject(
    createdWorkspace.id,
    'Created Through API Backed Project',
    {
      description: 'Created through the app API without a device-private mount.',
    },
  );

  const reloadedWorkspaces = await services.workspaceService.getWorkspaces();
  const reloadedProjects = await services.projectService.getProjects(createdWorkspace.id);

  assert.ok(
    reloadedWorkspaces.some((workspace) => workspace.id === createdWorkspace.id),
    'newly created workspaces must round-trip through the same app SDK client read path.',
  );
  assert.ok(
    reloadedProjects.some((project) => project.name === 'Created Through API Backed Project'),
    'newly created projects must round-trip through the same app SDK client read path.',
  );
  assert.deepEqual(
    requests.map((request) => ({
      method: request.method,
      path: request.path,
      workspaceId: request.query?.workspaceId,
    })),
    [
      {
        method: 'POST',
        path: '/app/v3/api/workspaces',
        workspaceId: undefined,
      },
      {
        method: 'POST',
        path: '/app/v3/api/projects',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/workspaces',
        workspaceId: undefined,
      },
      {
        method: 'GET',
        path: '/app/v3/api/projects',
        workspaceId: createdWorkspace.id,
      },
    ],
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('split SDK consumer contract passed.');
