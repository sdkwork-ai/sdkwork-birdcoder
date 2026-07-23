import assert from 'node:assert/strict';

import type { AgentProjectRecord } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import {
  createClient,
  type BirdCoderCreateProjectRequest,
  type BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';

import {
  ApiBackedProjectService,
  type AgentProjectProvisioningSdkPort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';

function createAgentProject(projectId: string): AgentProjectRecord {
  return {
    createdAt: '2026-07-23T00:00:00.000Z',
    driveAccessMode: 'disabled',
    id: '101',
    name: 'Composed project',
    organizationId: '201',
    ownerUserId: '301',
    projectId,
    status: 'active',
    tenantId: '401',
    updatedAt: '2026-07-23T00:00:00.000Z',
    version: '1',
    visibility: 'private',
  };
}

function createBirdCoderProject(
  request: BirdCoderCreateProjectRequest,
): BirdCoderProjectSummary {
  return {
    code: 'composed-project',
    createdAt: '2026-07-23T00:00:00.000Z',
    createdByUserId: '301',
    defaultAgentProjectId: request.defaultAgentProjectId ?? null,
    description: request.description ?? null,
    id: '501',
    name: request.name,
    organizationId: '201',
    ownerUserId: '301',
    projectKind: request.projectKind ?? 'standard',
    status: 'active',
    tenantId: '401',
    updatedAt: '2026-07-23T00:00:00.000Z',
    uuid: '55555555-5555-4555-8555-555555555555',
    version: '1',
    workspaceId: request.workspaceId,
  };
}

function createProjectService(
  agentProjects: AgentProjectProvisioningSdkPort,
  createBirdCoderProjectRequest: (
    request: BirdCoderCreateProjectRequest,
  ) => Promise<BirdCoderProjectSummary>,
): ApiBackedProjectService {
  const appClient = createClient({
    authMode: 'dual-token',
    baseUrl: 'http://127.0.0.1:1',
    platform: 'pc',
  });
  appClient.intelligence.projects.create = createBirdCoderProjectRequest;
  return new ApiBackedProjectService({ agentProjects, appClient });
}

const lifecycle: string[] = [];
let agentsProjectId = '';
let birdCoderCreateRequest: BirdCoderCreateProjectRequest | null = null;
const agentProjects: AgentProjectProvisioningSdkPort = {
  async create(request) {
    lifecycle.push('agents.create');
    agentsProjectId = request.projectId ?? '';
    assert.match(
      agentsProjectId,
      /^project\.[0-9a-f-]+$/u,
      'The application must request an opaque canonical Agents project id.',
    );
    return { item: createAgentProject(agentsProjectId) };
  },
  async delete(projectId) {
    lifecycle.push(`agents.delete:${projectId}`);
  },
};
const service = createProjectService(agentProjects, async (request) => {
  lifecycle.push('birdcoder.create');
  birdCoderCreateRequest = request;
  return createBirdCoderProject(request);
});

const project = await service.createProject(
  'workspace-project-composition',
  'Composed project',
  { description: 'Owner-first project composition' },
);

assert.deepEqual(lifecycle, ['agents.create', 'birdcoder.create']);
assert.equal(birdCoderCreateRequest?.defaultAgentProjectId, agentsProjectId);
assert.equal(project.id, '501', 'The workbench must keep the BirdCoder project id.');
assert.equal(
  project.defaultAgentProjectId,
  agentsProjectId,
  'The workbench must retain the separate canonical Agents project id.',
);
assert.notEqual(
  project.id,
  project.defaultAgentProjectId,
  'BirdCoder and Agents project ids must never be collapsed into one identifier.',
);

const birdCoderCreateFailure = new Error('BirdCoder project create failed');
const compensationCalls: string[] = [];
const compensationService = createProjectService(
  {
    async create(request) {
      return { item: createAgentProject(request.projectId!) };
    },
    async delete(projectId) {
      compensationCalls.push(projectId);
    },
  },
  async () => {
    throw birdCoderCreateFailure;
  },
);

await assert.rejects(
  () => compensationService.createProject('workspace-compensation', 'Compensated project'),
  (error) => error === birdCoderCreateFailure,
  'A BirdCoder create failure must be preserved after successful Agents compensation.',
);
assert.equal(compensationCalls.length, 1);
assert.match(compensationCalls[0]!, /^project\./u);

const compensationFailure = new Error('Agents compensation failed');
const failedCompensationService = createProjectService(
  {
    async create(request) {
      return { item: createAgentProject(request.projectId!) };
    },
    async delete() {
      throw compensationFailure;
    },
  },
  async () => {
    throw birdCoderCreateFailure;
  },
);

await assert.rejects(
  () => failedCompensationService.createProject(
    'workspace-failed-compensation',
    'Failed compensation project',
  ),
  (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [birdCoderCreateFailure, compensationFailure]);
    return true;
  },
  'A failed compensation must preserve both distributed creation failures.',
);

console.log('project and Agents project composition contract passed.');
