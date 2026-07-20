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
const providerBackedWorkspaceServiceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedWorkspaceService.ts',
  import.meta.url,
);
const providerBackedProjectServiceModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ProviderBackedProjectService.ts',
  import.meta.url,
);
const codingSessionRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/codingSessionRepository.ts',
  import.meta.url,
);
const evidenceRepositoryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts',
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
  const { ProviderBackedWorkspaceService } = await import(
    `${providerBackedWorkspaceServiceModulePath.href}?t=${Date.now()}`
  );
  const { ProviderBackedProjectService } = await import(
    `${providerBackedProjectServiceModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderCodingSessionRepositories } = await import(
    `${codingSessionRepositoryModulePath.href}?t=${Date.now()}`
  );
  const { createBirdCoderPromptSkillTemplateEvidenceRepositories } = await import(
    `${evidenceRepositoryModulePath.href}?t=${Date.now()}`
  );

  const provider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: 'sqlite',
    storage: provider,
  });
  const queries = createBirdCoderConsoleQueries({ repositories });

  await Promise.all([
    repositories.workspaces.clear(),
    repositories.projects.clear(),
    repositories.documents.clear(),
    repositories.deployments.clear(),
    repositories.targets.clear(),
    repositories.teams.clear(),
    repositories.members.clear(),
    repositories.releases.clear(),
    repositories.audits.clear(),
  ]);

  await repositories.workspaces.save({
    id: 'workspace-console-contract',
    name: 'Console Contract Workspace',
    description: 'Workspace persisted through the shared table repository.',
    ownerId: 'user-console-contract',
    createdAt: '2026-04-10T18:00:00.000Z',
    updatedAt: '2026-04-10T18:00:00.000Z',
  });
  await repositories.projects.save({
    id: 'project-console-contract',
    workspaceId: 'workspace-console-contract',
    name: 'Console Contract Project',
    description: 'Project listed through the representative console query service.',
    status: 'active',
    createdAt: '2026-04-10T18:00:01.000Z',
    updatedAt: '2026-04-10T18:00:01.000Z',
  });
  await repositories.documents.save({
    id: 'doc-console-contract',
    projectId: 'project-console-contract',
    documentKind: 'architecture',
    title: 'Console Contract Architecture',
    slug: 'console-contract-architecture',
    status: 'active',
    createdAt: '2026-04-10T18:00:01.500Z',
    updatedAt: '2026-04-10T18:00:01.500Z',
  });
  await repositories.deployments.save({
    id: 'deployment-console-contract',
    projectId: 'project-console-contract',
    targetId: 'target-console-contract',
    releaseRecordId: 'release-console-contract',
    endpointUrl: 'https://console-contract.sdkwork.dev',
    status: 'succeeded',
    startedAt: '2026-04-10T18:00:01.750Z',
    completedAt: '2026-04-10T18:00:02.250Z',
    createdAt: '2026-04-10T18:00:01.750Z',
    updatedAt: '2026-04-10T18:00:02.250Z',
  });
  await repositories.targets.save({
    id: 'target-console-contract',
    projectId: 'project-console-contract',
    name: 'Console Contract Target',
    environmentKey: 'staging',
    runtime: 'web',
    status: 'active',
    createdAt: '2026-04-10T18:00:01.900Z',
    updatedAt: '2026-04-10T18:00:01.900Z',
  });
  await repositories.teams.save({
    id: 'team-console-contract',
    workspaceId: 'workspace-console-contract',
    name: 'Console Contract Team',
    description: 'Team listed through the representative console query service.',
    status: 'active',
    createdAt: '2026-04-10T18:00:02.000Z',
    updatedAt: '2026-04-10T18:00:02.000Z',
  });
  await repositories.members.save({
    id: 'member-console-contract',
    teamId: 'team-console-contract',
    userId: 'user-console-contract',
    role: 'admin',
    status: 'active',
    createdAt: '2026-04-10T18:00:02.250Z',
    updatedAt: '2026-04-10T18:00:02.250Z',
  });
  await repositories.releases.save({
    id: 'release-console-contract',
    releaseVersion: '0.5.0-console-contract',
    releaseKind: 'formal',
    rolloutStage: 'stable',
    manifest: {
      channel: 'stable',
      evidence: ['provider-backed-console'],
    },
    status: 'ready',
    createdAt: '2026-04-10T18:00:03.000Z',
    updatedAt: '2026-04-10T18:00:03.000Z',
  });
  await repositories.audits.save({
    id: 'audit-console-contract',
    scopeType: 'workspace',
    scopeId: 'workspace-console-contract',
    eventType: 'release.promoted',
    payload: {
      actor: 'release-bot',
      stage: 'stable',
    },
    createdAt: '2026-04-10T18:00:04.000Z',
    updatedAt: '2026-04-10T18:00:04.000Z',
  });

  const workspaces = await queries.listWorkspaces();
  const projectPage = await queries.listProjectPage({
    page: 1,
    pageSize: 20,
    workspaceId: 'workspace-console-contract',
  });
  const projects = projectPage.items;
  const documents = await queries.listDocuments();
  const deployments = await queries.listDeployments();
  const targets = await queries.listDeploymentTargets({ projectId: 'project-console-contract' });
  const teams = await queries.listTeams({ workspaceId: 'workspace-console-contract' });
  const members = await queries.listTeamMembers({ teamId: 'team-console-contract' });
  const releases = await queries.listReleases();
  const auditEvents = await queries.listAuditEvents();

  assert.equal(workspaces[0]?.id, 'workspace-console-contract');
  assert.equal(projects[0]?.id, 'project-console-contract');
  assert.equal(documents[0]?.id, 'doc-console-contract');
  assert.equal(deployments[0]?.id, 'deployment-console-contract');
  assert.equal(targets[0]?.id, 'target-console-contract');
  assert.equal(targets[0]?.projectId, 'project-console-contract');
  assert.equal(teams[0]?.id, 'team-console-contract');
  assert.equal(members[0]?.id, 'member-console-contract');
  assert.equal(members[0]?.teamId, 'team-console-contract');
  assert.equal(releases[0]?.id, 'release-console-contract');
  assert.equal(auditEvents[0]?.id, 'audit-console-contract');

  const createProviderBackedServices = () => ({
    projectService: new ProviderBackedProjectService({
      codingSessionRepositories: createBirdCoderCodingSessionRepositories({
        providerId: provider.providerId,
        storage: provider,
      }),
      evidenceRepositories: createBirdCoderPromptSkillTemplateEvidenceRepositories({
        providerId: provider.providerId,
        storage: provider,
      }),
      repository: repositories.projects,
    }),
    workspaceService: new ProviderBackedWorkspaceService({
      repository: repositories.workspaces,
    }),
  });

  const services = createProviderBackedServices();
  const createdWorkspace = await services.workspaceService.createWorkspace(
    'Persisted Workspace',
    'Created through the provider-backed service boundary.',
  );
  await services.projectService.createProject(createdWorkspace.id, 'Persisted Project');

  const reloadedServices = createProviderBackedServices();
  const persistedWorkspaces = await reloadedServices.workspaceService.getWorkspaces();
  const persistedProjects = await reloadedServices.projectService.getProjects(createdWorkspace.id);

  assert.ok(
    persistedWorkspaces.some((workspace) => workspace.id === createdWorkspace.id),
    'provider-backed workspace service must persist through the shared console repositories.',
  );
  assert.ok(
    persistedProjects.some((project) => project.name === 'Persisted Project'),
    'provider-backed project service must persist project catalog state through the shared console repositories.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('provider-backed console contract passed.');
