import assert from 'node:assert/strict';
import type {
  BirdCoderEntityName,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import { getBirdCoderEntityDefinition } from '@sdkwork/birdcoder-types';
import { createBirdCoderAppAdminConsoleQueries } from '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts';
import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeAuditRecord,
  BirdCoderRepresentativeDeploymentRecord,
  BirdCoderRepresentativeDeploymentTargetRecord,
  BirdCoderRepresentativePolicyRecord,
  BirdCoderRepresentativeProjectDocumentRecord,
  BirdCoderRepresentativeProjectRecord,
  BirdCoderRepresentativeReleaseRecord,
  BirdCoderRepresentativeTeamMemberRecord,
  BirdCoderRepresentativeTeamRecord,
  BirdCoderWorkspaceRecord,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import type { BirdCoderTableRecordRepository } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';

type RecordWithId = { id: string };

function createInMemoryRepository<TRecord extends RecordWithId>(
  entityName: BirdCoderEntityName,
): BirdCoderTableRecordRepository<TRecord> {
  const records = new Map<string, TRecord>();
  const binding: BirdCoderEntityStorageBinding = {
    entityName,
    preferredProvider: 'sqlite',
    storageKey: `test.${entityName}`,
    storageMode: 'table',
    storageScope: 'contract-test',
  };

  return {
    binding,
    definition: getBirdCoderEntityDefinition(entityName),
    providerId: 'sqlite',
    async clear() {
      records.clear();
    },
    async count() {
      return records.size;
    },
    async delete(id: string) {
      records.delete(id);
    },
    async findById(id: string) {
      return records.get(id) ?? null;
    },
    async list() {
      return [...records.values()].map((record) => structuredClone(record));
    },
    async save(record: TRecord) {
      records.set(record.id, structuredClone(record));
      return structuredClone(record);
    },
    async saveMany(values: readonly TRecord[]) {
      const savedValues = values.map((value) => structuredClone(value));
      for (const value of savedValues) {
        records.set(value.id, value);
      }
      return savedValues;
    },
  };
}

function createRepositories(): BirdCoderConsoleRepositories {
  return {
    audits: createInMemoryRepository<BirdCoderRepresentativeAuditRecord>('audit_event'),
    deployments: createInMemoryRepository<BirdCoderRepresentativeDeploymentRecord>('deployment_record'),
    targets: createInMemoryRepository<BirdCoderRepresentativeDeploymentTargetRecord>('deployment_target'),
    documents: createInMemoryRepository<BirdCoderRepresentativeProjectDocumentRecord>('project_document'),
    members: createInMemoryRepository<BirdCoderRepresentativeTeamMemberRecord>('team_member'),
    policies: createInMemoryRepository<BirdCoderRepresentativePolicyRecord>('governance_policy'),
    projects: createInMemoryRepository<BirdCoderRepresentativeProjectRecord>('project'),
    releases: createInMemoryRepository<BirdCoderRepresentativeReleaseRecord>('release_record'),
    teams: createInMemoryRepository<BirdCoderRepresentativeTeamRecord>('team'),
    workspaces: createInMemoryRepository<BirdCoderWorkspaceRecord>('workspace'),
  };
}

const repositories = createRepositories();
const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

const createdWorkspace = await queries.createWorkspace({
  name: 'BirdCoder Plus Workspace',
  description: 'Workspace aligned with plus-standard fields.',
  dataScope: 'PRIVATE',
  icon: 'FolderGit2',
  color: '#115e59',
  startTime: '2026-04-23T09:00:00.000Z',
  endTime: '2026-04-30T18:00:00.000Z',
  maxMembers: 12,
  currentMembers: 3,
  memberCount: 3,
  maxStorage: 8192,
  usedStorage: 1024,
  settings: {
    theme: 'emerald',
    reviewMode: 'strict',
  },
  isPublic: true,
  isTemplate: true,
});

assert.equal(createdWorkspace.icon, 'FolderGit2');
assert.equal(createdWorkspace.color, '#115e59');
assert.equal(createdWorkspace.dataScope, 'PRIVATE');
assert.equal(createdWorkspace.maxMembers, 12);
assert.equal(createdWorkspace.currentMembers, 3);
assert.equal(createdWorkspace.memberCount, 3);
assert.equal(createdWorkspace.maxStorage, 8192);
assert.equal(createdWorkspace.usedStorage, 1024);
assert.deepEqual(createdWorkspace.settings, {
  theme: 'emerald',
  reviewMode: 'strict',
});
assert.equal(createdWorkspace.isPublic, true);
assert.equal(createdWorkspace.isTemplate, true);

const createdProject = await queries.createProject({
  workspaceId: createdWorkspace.id,
  name: 'BirdCoder Plus Project',
  description: 'Project aligned with plus-standard fields.',
  dataScope: 'PRIVATE',
  title: 'BirdCoder Plus Project',
  type: 'APP',
  rootPath: 'D:\\repos\\birdcoder-plus',
  userId: '100000000000000301',
  parentId: '0',
  parentUuid: '0',
  parentMetadata: {
    relation: 'root',
  },
  sitePath: '/birdcoder-plus',
  domainPrefix: 'birdcoder-plus',
  fileId: 'file-1001',
  conversationId: 'conversation-2001',
  coverImage: {
    url: 'https://example.test/cover.png',
  },
  startTime: '2026-04-23T10:00:00.000Z',
  endTime: '2026-05-01T20:00:00.000Z',
  budgetAmount: 500000,
  isTemplate: true,
});

assert.equal(createdProject.dataScope, 'PRIVATE');
assert.equal(createdProject.userId, '100000000000000301');
assert.equal(createdProject.parentId, '0');
assert.equal(createdProject.parentUuid, '0');
assert.deepEqual(createdProject.parentMetadata, {
  relation: 'root',
});
assert.equal(createdProject.sitePath, '/birdcoder-plus');
assert.equal(createdProject.domainPrefix, 'birdcoder-plus');
assert.equal(createdProject.fileId, 'file-1001');
assert.equal(createdProject.conversationId, 'conversation-2001');
assert.deepEqual(createdProject.coverImage, {
  url: 'https://example.test/cover.png',
});
assert.equal(createdProject.startTime, '2026-04-23T10:00:00.000Z');
assert.equal(createdProject.endTime, '2026-05-01T20:00:00.000Z');
assert.equal(createdProject.budgetAmount, 500000);
assert.equal(createdProject.isTemplate, true);

console.log('app admin console plus standard contract passed.');
