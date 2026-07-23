import assert from 'node:assert/strict';
import fs from 'node:fs';

import type {
  AgentProjectCompositionSlotRecord,
  AgentProjectRecord,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

import {
  ApiBackedProjectService,
  type AgentProjectsSdkPort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';

const canonicalProjectId = 'project-canonical';

function createProjectRecord(
  overrides: Partial<AgentProjectRecord> = {},
): AgentProjectRecord {
  return {
    createdAt: '2026-07-23T00:00:00.000Z',
    driveAccessMode: 'disabled',
    id: '101',
    name: 'Canonical project',
    organizationId: '201',
    ownerUserId: '301',
    projectId: canonicalProjectId,
    status: 'active',
    tenantId: '401',
    updatedAt: '2026-07-23T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    ...overrides,
  };
}

function createCompositionSlot(
  overrides: Partial<AgentProjectCompositionSlotRecord> = {},
): AgentProjectCompositionSlotRecord {
  return {
    createdAt: '2026-07-23T00:00:00.000Z',
    createdBy: '301',
    enabled: true,
    id: '501',
    organizationId: '201',
    policyJson: JSON.stringify({
      logicalPath: '/source',
      rootEntryId: 'entry-1',
      schema: 'sdkwork.agents.project-drive/v1',
    }),
    priority: 0,
    projectId: canonicalProjectId,
    slotId: 'primary-drive',
    slotKind: 'drive',
    targetModule: 'drive',
    targetRef: 'drive-1',
    tenantId: '401',
    updatedAt: '2026-07-23T00:00:00.000Z',
    updatedBy: '301',
    version: '11',
    ...overrides,
  };
}

const listInputs: Parameters<AgentProjectsSdkPort['list']>[0][] = [];
const createInputs: Parameters<AgentProjectsSdkPort['create']>[0][] = [];
const updateInputs: Array<Parameters<AgentProjectsSdkPort['update']>> = [];
const archiveInputs: Array<Parameters<AgentProjectsSdkPort['archive']>> = [];
const deleteInputs: Array<Parameters<AgentProjectsSdkPort['delete']>> = [];
const retrieveInputs: Array<Parameters<AgentProjectsSdkPort['retrieve']>> = [];
let updateCount = 0;

const projects: AgentProjectsSdkPort = {
  async archive(projectId, body) {
    archiveInputs.push([projectId, body]);
    return createProjectRecord({ projectId, status: 'archived', version: '4' });
  },
  async create(body) {
    createInputs.push(body);
    return createProjectRecord({
      description: body.description,
      name: body.name,
      version: '2',
    });
  },
  async delete(projectId) {
    deleteInputs.push([projectId]);
  },
  async list(params) {
    listInputs.push(params);
    return {
      items: [createProjectRecord()],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 2,
        pageSize: 25,
        totalItems: '1',
        totalPages: 1,
      },
    };
  },
  async retrieve(projectId) {
    retrieveInputs.push([projectId]);
    return createProjectRecord({ projectId, version: '8' });
  },
  async update(projectId, body) {
    updateInputs.push([projectId, body]);
    updateCount += 1;
    return createProjectRecord({
      description: body.description,
      name: body.name ?? 'Canonical project',
      projectId,
      version: updateCount === 1 ? '3' : '9',
    });
  },
};

const compositionRetrieveInputs: string[][] = [];
const compositionUpdateInputs: unknown[][] = [];
let compositionCreateCount = 0;
const service = new ApiBackedProjectService({
  projectCompositionSlots: {
    async create(projectId, body) {
      compositionCreateCount += 1;
      return createCompositionSlot({
        enabled: body.enabled,
        policyJson: body.policyJson,
        projectId,
        slotId: body.slotId,
        slotKind: body.slotKind,
        targetModule: body.targetModule,
        targetRef: body.targetRef,
      });
    },
    async retrieve(projectId, slotId) {
      compositionRetrieveInputs.push([projectId, slotId]);
      return createCompositionSlot({ projectId, slotId });
    },
    async update(projectId, slotId, body) {
      compositionUpdateInputs.push([projectId, slotId, body]);
      return createCompositionSlot({
        enabled: body.enabled,
        policyJson: body.policyJson,
        projectId,
        slotId,
        slotKind: body.slotKind,
        targetModule: body.targetModule,
        targetRef: body.targetRef,
        version: '12',
      });
    },
  },
  projects,
});

const page = await service.getProjectsPage({
  includeDeleted: false,
  page: 2,
  pageSize: 25,
  q: '  canonical  ',
  status: 'active',
});
assert.deepEqual(listInputs, [{
  includeDeleted: false,
  page: 2,
  pageSize: 25,
  q: 'canonical',
  status: 'active',
}]);
assert.equal(page.items[0]?.projectId, canonicalProjectId);
assert.deepEqual(page.pageInfo, {
  hasMore: false,
  mode: 'offset',
  page: 2,
  pageSize: 25,
  totalItems: '1',
  totalPages: 1,
});

const createdProject = await service.createProject('Canonical project', {
  description: '  One Agents project authority  ',
});
assert.equal(createdProject.projectId, canonicalProjectId);
assert.deepEqual(createInputs, [{
  description: 'One Agents project authority',
  name: 'Canonical project',
}]);

await service.updateProject(canonicalProjectId, { name: 'Renamed project' });
assert.deepEqual(updateInputs[0], [canonicalProjectId, {
  expectedVersion: '2',
  name: 'Renamed project',
}]);

await service.archiveProject(canonicalProjectId);
assert.deepEqual(archiveInputs, [[canonicalProjectId, { expectedVersion: '3' }]]);

await service.deleteProject(canonicalProjectId);
assert.deepEqual(deleteInputs, [[canonicalProjectId]]);

await service.updateProject(canonicalProjectId, { description: 'After delete' });
assert.deepEqual(retrieveInputs, [[canonicalProjectId]]);
assert.deepEqual(updateInputs[1], [canonicalProjectId, {
  description: 'After delete',
  expectedVersion: '8',
}]);

const driveComposition = await service.bindProjectDrive(canonicalProjectId, {
  driveId: 'drive-2',
  logicalPath: ' /workspace ',
  rootEntryId: ' entry-2 ',
});
assert.equal(compositionCreateCount, 0);
assert.deepEqual(compositionRetrieveInputs, [[canonicalProjectId, 'primary-drive']]);
assert.equal(compositionUpdateInputs[0]?.[0], canonicalProjectId);
assert.equal(compositionUpdateInputs[0]?.[1], 'primary-drive');
assert.deepEqual(compositionUpdateInputs[0]?.[2], {
  enabled: true,
  expectedVersion: '11',
  policyJson: JSON.stringify({
    logicalPath: '/workspace',
    rootEntryId: 'entry-2',
    schema: 'sdkwork.agents.project-drive/v1',
  }),
  slotKind: 'drive',
  targetModule: 'drive',
  targetRef: 'drive-2',
});
assert.deepEqual(driveComposition, {
  driveId: 'drive-2',
  logicalPath: '/workspace',
  projectId: canonicalProjectId,
  rootEntryId: 'entry-2',
  slotId: 'primary-drive',
  version: '12',
});

assert.equal(createInputs.length, 1, 'Project creation must call Agents exactly once.');

const serviceSource = fs.readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
    import.meta.url,
  ),
  'utf8',
);
assert.doesNotMatch(
  serviceSource,
  /BirdCoderProject|defaultAgentProjectId|workspaceId|appClient|compensat|sdk\/birdcoder-app/iu,
  'The project service must not restore a second project authority or a compensating dual-create transaction.',
);

console.log('Agents project service contract passed.');
