import assert from 'node:assert/strict';

import {
  createClient,
  type BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';

import {
  ApiBackedProjectService,
  type AgentProjectProvisioningSdkPort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';

const workspaceId = 'workspace-semantic-project-page-contract';

function createProject(id: string): BirdCoderProjectSummary {
  return {
    code: `project-${id}`,
    createdAt: '2026-07-10T00:00:00.000Z',
    createdByUserId: 'user-project-page-contract',
    defaultAgentProjectId: `project.${id}`,
    description: null,
    id,
    name: `Semantic Project ${id}`,
    organizationId: 'organization-project-page-contract',
    ownerUserId: 'user-project-page-contract',
    projectKind: 'standard',
    status: 'active',
    tenantId: 'tenant-project-page-contract',
    updatedAt: '2026-07-10T00:00:00.000Z',
    uuid: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
    version: `version-${id}`,
    workspaceId,
  };
}

const projectPageResponse = {
  items: [createProject('21'), createProject('22')],
  pageInfo: {
    hasMore: false,
    mode: 'offset' as const,
    page: 2,
    pageSize: 20,
    totalItems: '22',
    totalPages: 2,
  },
};

const observedPaths: string[] = [];
const unusedAgentProjects: AgentProjectProvisioningSdkPort = {
  async create() {
    throw new Error('Project creation is outside this pagination contract.');
  },
  async delete() {
    throw new Error('Project deletion is outside this pagination contract.');
  },
};
const appClient = createClient({
  authMode: 'dual-token',
  baseUrl: 'http://127.0.0.1:1',
  platform: 'pc',
});
appClient.http.get = async function get<T>(requestPath: string): Promise<T> {
  observedPaths.push(requestPath);
  return projectPageResponse as T;
};

const projectService = new ApiBackedProjectService({
  agentProjects: unusedAgentProjects,
  appClient,
});
const projectPage = await projectService.getProjectsPage(
  workspaceId,
  { page: 2, pageSize: 20 },
);

assert.deepEqual(
  observedPaths,
  [
    '/app/v3/api/projects?workspaceId=workspace-semantic-project-page-contract&page=2&page_size=20',
  ],
  'Project pagination must use the generated SDK hierarchy and preserve standard page query semantics.',
);
assert.deepEqual(
  projectPage.items.map((project) => project.id),
  ['21', '22'],
  'The project service must map generated SDK project records without replacing the server page.',
);
assert.deepEqual(
  projectPage.pageInfo,
  projectPageResponse.pageInfo,
  'The project service must retain complete standard PageInfo metadata.',
);

const requestCountBeforeInvalidInput = observedPaths.length;
await assert.rejects(
  () => projectService.getProjectsPage(workspaceId, { page: 0, pageSize: 20 }),
  /positive safe integer/iu,
  'Page zero must fail before generated SDK dispatch.',
);
await assert.rejects(
  () => projectService.getProjectsPage(workspaceId, { page: 1, pageSize: 201 }),
  /between 1 and 200/iu,
  'Page sizes above the application limit must fail before generated SDK dispatch.',
);
assert.equal(
  observedPaths.length,
  requestCountBeforeInvalidInput,
  'Invalid project pagination must not dispatch a generated SDK request.',
);

console.log('app SDK semantic project page contract passed.');
