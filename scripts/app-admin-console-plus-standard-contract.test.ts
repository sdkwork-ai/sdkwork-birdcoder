import assert from 'node:assert/strict';
import type {
  BirdCoderEntityName,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_WORKSPACE_STORAGE_BINDING,
  BIRDCODER_PROJECT_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';
import { createBirdCoderAppAdminConsoleQueries } from '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts';
import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeAuditRecord,
  BirdCoderRepresentativeDeploymentRecord,
  BirdCoderRepresentativeDeploymentTargetRecord,
  BirdCoderRepresentativePolicyRecord,
  BirdCoderProjectContentRecord,
  BirdCoderRepresentativeProjectDocumentRecord,
  BirdCoderRepresentativeProjectRecord,
  BirdCoderRepresentativeReleaseRecord,
  BirdCoderRepresentativeTeamMemberRecord,
  BirdCoderRepresentativeTeamRecord,
  BirdCoderWorkspaceRecord,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderConsoleRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { buildProviderScopedStorageKey } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
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
    projectContents: createInMemoryRepository<BirdCoderProjectContentRecord>('project_content'),
    projects: createInMemoryRepository<BirdCoderRepresentativeProjectRecord>('project'),
    releases: createInMemoryRepository<BirdCoderRepresentativeReleaseRecord>('release_record'),
    teams: createInMemoryRepository<BirdCoderRepresentativeTeamRecord>('team'),
    workspaces: createInMemoryRepository<BirdCoderWorkspaceRecord>('workspace'),
  };
}

const repositories = createRepositories();
const queries = createBirdCoderAppAdminConsoleQueries({ repositories });

const localStorageRows = new Map<string, string>();
const localJsonRepositories = createBirdCoderConsoleRepositories({
  providerId: 'sqlite',
  storage: {
    async readRawValue(scope, key) {
      return localStorageRows.get(`${scope}\u0001${key}`) ?? null;
    },
    async setRawValue(scope, key, value) {
      localStorageRows.set(`${scope}\u0001${key}`, value);
    },
    async removeRawValue(scope, key) {
      localStorageRows.delete(`${scope}\u0001${key}`);
    },
  },
});
const projectStorageKey = buildProviderScopedStorageKey(
  'sqlite',
  BIRDCODER_PROJECT_STORAGE_BINDING,
);
const workspaceStorageKey = buildProviderScopedStorageKey(
  'sqlite',
  BIRDCODER_WORKSPACE_STORAGE_BINDING,
);
localStorageRows.set(
  `${BIRDCODER_WORKSPACE_STORAGE_BINDING.storageScope}\u0001${workspaceStorageKey}`,
  '[{"id":"workspace-unsafe-int-json","name":"Unsafe Int Workspace","maxMembers":"101777208078558057","createdAt":"2026-04-23T00:00:00.000Z","updatedAt":"2026-04-23T00:00:00.000Z","status":"active"}]',
);
await assert.rejects(
  () => localJsonRepositories.workspaces.findById('workspace-unsafe-int-json'),
  /safe integer/u,
  'workspace small integer counters must reject unsafe numeric strings instead of rounding them through Number(value).',
);
localStorageRows.set(
  `${BIRDCODER_PROJECT_STORAGE_BINDING.storageScope}\u0001${projectStorageKey}`,
  '[{"id":"project-long-json","workspaceId":"workspace-long-json","name":"Project Long JSON","parentMetadata":"{\\"ownerId\\":101777208078558053}","coverImage":"{\\"assetId\\":101777208078558055}","createdAt":"2026-04-23T00:00:00.000Z","updatedAt":"2026-04-23T00:00:00.000Z","status":"active"}]',
);
const localJsonProject = await localJsonRepositories.projects.findById('project-long-json');
assert.deepEqual(
  localJsonProject?.parentMetadata,
  { ownerId: '101777208078558053' },
  'project parentMetadata JSON strings must preserve unsafe Long identifiers.',
);
assert.deepEqual(
  localJsonProject?.coverImage,
  { assetId: '101777208078558055' },
  'project coverImage JSON strings must preserve unsafe Long identifiers.',
);

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
  maxStorage: '101777208078558101',
  usedStorage: '101777208078558103',
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
assert.equal(
  createdWorkspace.maxStorage,
  '101777208078558101',
  'workspace maxStorage is a Java Long/BIGINT field and must remain an exact decimal string.',
);
assert.equal(
  createdWorkspace.usedStorage,
  '101777208078558103',
  'workspace usedStorage is a Java Long/BIGINT field and must remain an exact decimal string.',
);
assert.deepEqual(createdWorkspace.settings, {
  theme: 'emerald',
  reviewMode: 'strict',
});
assert.equal(createdWorkspace.isPublic, true);
assert.equal(createdWorkspace.isTemplate, true);

await assert.rejects(
  () =>
    queries.createWorkspace({
      name: 'Unsafe Long Workspace',
      maxStorage: Number('101777208078558101') as unknown as string,
    }),
  /unsafe JavaScript number/u,
  'workspace Long/BIGINT fields must reject unsafe JavaScript numbers instead of dropping the value.',
);
await assert.rejects(
  () =>
    queries.createWorkspace({
      name: 'Unsafe Counter Workspace',
      maxMembers: Number('101777208078558107'),
    }),
  /unsafe JavaScript number/u,
  'workspace small integer counters must reject unsafe JavaScript numbers instead of persisting rounded values.',
);

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
  budgetAmount: '101777208078558105',
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
assert.equal(
  createdProject.budgetAmount,
  '101777208078558105',
  'project budgetAmount is a Java Long/BIGINT field and must remain an exact decimal string.',
);
assert.equal(createdProject.isTemplate, true);
assert.equal(createdProject.rootPath, 'D:\\repos\\birdcoder-plus');

await assert.rejects(
  () =>
    queries.createProject({
      workspaceId: createdWorkspace.id,
      name: 'Unsafe Long Project',
      rootPath: 'D:\\repos\\unsafe-long-project',
      budgetAmount: Number('101777208078558105') as unknown as string,
    }),
  /unsafe JavaScript number/u,
  'project Long/BIGINT fields must reject unsafe JavaScript numbers instead of dropping the value.',
);

const createdProjectContent = await repositories.projectContents.findById(createdProject.id);
assert.ok(
  createdProjectContent,
  'project rootPath must be stored in plus_project_content configData rather than non-Java plus_project columns.',
);
assert.equal(
  (await repositories.projects.findById(createdProject.id))?.rootPath,
  undefined,
  'plus_project must not retain a rootPath shadow; plus_project_content configData is the canonical project path authority.',
);
assert.deepEqual(JSON.parse(createdProjectContent.configData ?? '{}'), {
  rootPath: 'D:\\repos\\birdcoder-plus',
});

const listedProjects = await queries.listProjects({
  rootPath: 'D:/repos/birdcoder-plus',
  workspaceId: createdWorkspace.id,
});
assert.equal(listedProjects[0]?.id, createdProject.id);
assert.equal(listedProjects[0]?.rootPath, 'D:\\repos\\birdcoder-plus');

const repeatedNameProjectA = await queries.createProject({
  workspaceId: createdWorkspace.id,
  name: 'Repeated Folder',
  title: 'Repeated Folder',
  rootPath:
    'D:\\workspace\\very-long-common-prefix\\that-used-to-truncate-the-project-code-before-the-unique-suffix\\a',
});
const repeatedNameProjectB = await queries.createProject({
  workspaceId: createdWorkspace.id,
  name: 'Repeated Folder',
  title: 'Repeated Folder',
  rootPath:
    'D:\\workspace\\very-long-common-prefix\\that-used-to-truncate-the-project-code-before-the-unique-suffix\\b',
});
assert.notEqual(
  repeatedNameProjectA.name,
  repeatedNameProjectB.name,
  'app admin console createProject must persist Java-unique plus_project.name values for repeated display names.',
);
assert.notEqual(
  repeatedNameProjectA.code,
  repeatedNameProjectB.code,
  'app admin console createProject must persist Java-unique plus_project.code values for long common path prefixes.',
);
assert.equal(
  repeatedNameProjectA.title,
  'Repeated Folder',
  'app admin console title must preserve the requested display name when plus_project.name is made unique.',
);
assert.equal(
  repeatedNameProjectB.title,
  'Repeated Folder',
  'app admin console title must preserve the requested display name for duplicate display-name imports.',
);
assert.ok(
  repeatedNameProjectA.code && repeatedNameProjectA.code.length <= 64,
  'app admin console generated plus_project.code must respect the Java length=64 standard.',
);
assert.ok(
  repeatedNameProjectB.code && repeatedNameProjectB.code.length <= 64,
  'app admin console generated plus_project.code must respect the Java length=64 standard for every project.',
);

await repositories.projects.save({
  id: 'project-shadow-only-root-path',
  workspaceId: createdWorkspace.id,
  name: 'Shadow Only Root Path Project',
  rootPath: 'D:\\repos\\shadow-only',
  status: 'active',
  createdAt: '2026-04-23T10:01:00.000Z',
  updatedAt: '2026-04-23T10:01:00.000Z',
});
assert.equal(
  (
    await queries.listProjects({
      rootPath: 'D:/repos/shadow-only',
      workspaceId: createdWorkspace.id,
    })
  ).length,
  0,
  'plus_project.rootPath shadow data must not make a project resolvable without plus_project_content configData rootPath.',
);
assert.equal(
  (await queries.listProjects({ workspaceId: createdWorkspace.id })).some(
    (project) => project.id === 'project-shadow-only-root-path',
  ),
  false,
  'project listing must ignore projects whose only path authority is a plus_project.rootPath shadow.',
);

console.log('app admin console plus standard contract passed.');
