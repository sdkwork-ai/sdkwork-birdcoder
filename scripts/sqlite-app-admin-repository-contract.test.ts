import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { createBirdCoderSqliteFileSqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts';
import {
  createBirdCoderRepresentativeAppAdminRepositories,
} from '../packages/sdkwork-birdcoder-server/src/appAdminRepository.ts';

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), `birdcoder-app-admin-${process.pid}-`));
const databaseFile = path.join(tempDirectory, 'authority.sqlite3');
const SQLITE_WORKSPACE_ID = '100000000000000101';
const SQLITE_PROJECT_ID = '100000000000000201';
const SQLITE_PROJECT_CONTENT_ID = '100000000000000202';
const SQLITE_TEAM_ID = '100000000000000301';

let provider:
  | ReturnType<typeof createBirdCoderStorageProvider>
  | null = null;
let reloadedProvider:
  | ReturnType<typeof createBirdCoderStorageProvider>
  | null = null;

try {
  provider = createBirdCoderStorageProvider('sqlite', {
    sqlExecutor: createBirdCoderSqliteFileSqlExecutor({
      databaseFile,
    }),
  });

  await provider.open();
  await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

  const repositories = createBirdCoderRepresentativeAppAdminRepositories({
    providerId: provider.providerId,
    storage: provider,
  });

  await Promise.all([
    repositories.projects.clear(),
    repositories.projectContents.clear(),
    repositories.deployments.clear(),
    repositories.policies.clear(),
    repositories.teams.clear(),
    repositories.releases.clear(),
    repositories.audits.clear(),
  ]);

  const unitOfWork = await provider.beginUnitOfWork();
  const stagedRepositories = createBirdCoderRepresentativeAppAdminRepositories({
    providerId: provider.providerId,
    storage: unitOfWork,
  });

  await stagedRepositories.projects.save({
    id: SQLITE_PROJECT_ID,
    workspaceId: SQLITE_WORKSPACE_ID,
    name: 'SQLite Repository Project',
    description: 'Representative app project persisted through the shared SQL executor.',
    parentMetadata: {
      ownerId: 101777208078558041n,
    },
    coverImage: {
      fileId: 101777208078558043n,
      url: 'https://sqlite-repository.sdkwork.dev/cover.png',
    },
    status: 'active',
    createdAt: '2026-04-10T16:00:00.000Z',
    updatedAt: '2026-04-10T16:00:00.000Z',
  });
  await stagedRepositories.projectContents.save({
    id: SQLITE_PROJECT_CONTENT_ID,
    projectId: SQLITE_PROJECT_ID,
    projectUuid: `project-${SQLITE_PROJECT_ID}`,
    configData: JSON.stringify({
      rootPath: 'D:/workspace/sqlite-repository-project',
    }),
    contentVersion: '1.0',
    createdAt: '2026-04-10T16:00:00.250Z',
    updatedAt: '2026-04-10T16:00:00.250Z',
  });
  await stagedRepositories.teams.save({
    id: SQLITE_TEAM_ID,
    workspaceId: SQLITE_WORKSPACE_ID,
    name: 'SQLite Repository Team',
    description: 'Representative team row persisted through the shared SQL executor.',
    status: 'active',
    createdAt: '2026-04-10T16:00:01.000Z',
    updatedAt: '2026-04-10T16:00:01.000Z',
  });
  await stagedRepositories.policies.save({
    id: 'policy-sqlite-repository',
    scopeType: 'workspace',
    scopeId: SQLITE_WORKSPACE_ID,
    policyCategory: 'terminal',
    targetType: 'engine',
    targetId: 'codex',
    approvalPolicy: 'Restricted',
    status: 'active',
    rationale: 'Repository-backed policy authority fixture.',
    createdAt: '2026-04-10T16:00:01.250Z',
    updatedAt: '2026-04-10T16:00:01.250Z',
  });
  await stagedRepositories.deployments.save({
    id: 'deployment-sqlite-repository',
    projectId: SQLITE_PROJECT_ID,
    targetId: 'target-sqlite-repository',
    releaseRecordId: 'release-sqlite-repository',
    endpointUrl: 'https://sqlite-repository.sdkwork.dev',
    status: 'succeeded',
    startedAt: '2026-04-10T16:00:01.500Z',
    completedAt: '2026-04-10T16:00:02.500Z',
    createdAt: '2026-04-10T16:00:01.500Z',
    updatedAt: '2026-04-10T16:00:02.500Z',
  });
  await stagedRepositories.releases.save({
    id: 'release-sqlite-repository',
    releaseVersion: '0.4.0-sqlite',
    releaseKind: 'formal',
    rolloutStage: 'general-availability',
    manifest: {
      channel: 'stable',
      evidence: ['sqlite'],
    },
    status: 'ready',
    createdAt: '2026-04-10T16:00:02.000Z',
    updatedAt: '2026-04-10T16:00:02.000Z',
  });
  await stagedRepositories.audits.save({
    id: 'audit-sqlite-repository',
    scopeType: 'workspace',
    scopeId: SQLITE_WORKSPACE_ID,
    eventType: 'release.promoted',
    payload: {
      actor: 'release-bot',
      stage: 'stable',
    },
    createdAt: '2026-04-10T16:00:03.000Z',
    updatedAt: '2026-04-10T16:00:03.000Z',
  });

  assert.equal(await repositories.projects.count(), 0);
  assert.equal(await repositories.projectContents.count(), 0);
  assert.equal(await repositories.deployments.count(), 0);
  assert.equal(await repositories.policies.count(), 0);
  assert.equal(await repositories.teams.count(), 0);
  assert.equal(await repositories.releases.count(), 0);
  assert.equal(await repositories.audits.count(), 0);

  await unitOfWork.commit();

  assert.equal(await repositories.projects.count(), 1);
  assert.equal(await repositories.projectContents.count(), 1);
  assert.equal(await repositories.deployments.count(), 1);
  assert.equal(await repositories.policies.count(), 1);
  assert.equal(await repositories.teams.count(), 1);
  assert.equal(await repositories.releases.count(), 1);
  assert.equal(await repositories.audits.count(), 1);
  const savedProject = await repositories.projects.findById(SQLITE_PROJECT_ID);
  assert.equal(savedProject?.workspaceId, SQLITE_WORKSPACE_ID);
  assert.deepEqual(
    savedProject?.parentMetadata,
    {
      ownerId: '101777208078558041',
    },
    'SQLite app/admin project parent metadata must preserve nested Long ids as strings through SQL JSON storage.',
  );
  assert.deepEqual(
    savedProject?.coverImage,
    {
      fileId: '101777208078558043',
      url: 'https://sqlite-repository.sdkwork.dev/cover.png',
    },
    'SQLite app/admin project cover image metadata must preserve nested Long ids as strings through SQL JSON storage.',
  );
  await assert.rejects(
    () =>
      repositories.projects.save({
        id: 'project-unsafe-budget',
        workspaceId: SQLITE_WORKSPACE_ID,
        name: 'Unsafe Budget Project',
        budgetAmount: Number('101777208078558105') as unknown as string,
        status: 'active',
        createdAt: '2026-04-10T16:00:00.500Z',
        updatedAt: '2026-04-10T16:00:00.500Z',
      }),
    /unsafe JavaScript number/u,
    'repository Long/BIGINT fields must reject unsafe JavaScript numbers instead of clearing the value before SQL planning.',
  );
  assert.deepEqual(
    JSON.parse(
      (await repositories.projectContents.findById(SQLITE_PROJECT_CONTENT_ID))?.configData ?? '{}',
    ),
    {
      rootPath: 'D:/workspace/sqlite-repository-project',
    },
  );
  assert.equal(
    (await repositories.deployments.findById('deployment-sqlite-repository'))?.targetId,
    'target-sqlite-repository',
  );
  assert.equal(
    (await repositories.policies.findById('policy-sqlite-repository'))?.approvalPolicy,
    'Restricted',
  );
  assert.equal(
    (await repositories.teams.findById(SQLITE_TEAM_ID))?.name,
    'SQLite Repository Team',
  );
  assert.deepEqual(
    (await repositories.releases.findById('release-sqlite-repository'))?.manifest,
    {
      channel: 'stable',
      evidence: ['sqlite'],
    },
  );
  assert.deepEqual(
    (await repositories.audits.findById('audit-sqlite-repository'))?.payload,
    {
      actor: 'release-bot',
      stage: 'stable',
    },
  );

  await provider.close();

  reloadedProvider = createBirdCoderStorageProvider('sqlite', {
    sqlExecutor: createBirdCoderSqliteFileSqlExecutor({
      databaseFile,
    }),
  });
  const reloadedRepositories = createBirdCoderRepresentativeAppAdminRepositories({
    providerId: 'sqlite',
    storage: reloadedProvider,
  });

  assert.equal((await reloadedRepositories.projects.list())[0]?.id, SQLITE_PROJECT_ID);
  assert.equal(
    (await reloadedRepositories.projectContents.list())[0]?.projectId,
    SQLITE_PROJECT_ID,
  );
  assert.equal(
    (await reloadedRepositories.deployments.list())[0]?.id,
    'deployment-sqlite-repository',
  );
  assert.equal(
    (await reloadedRepositories.policies.list())[0]?.id,
    'policy-sqlite-repository',
  );
  assert.equal((await reloadedRepositories.teams.list())[0]?.id, SQLITE_TEAM_ID);
  assert.equal((await reloadedRepositories.releases.list())[0]?.id, 'release-sqlite-repository');
  assert.equal((await reloadedRepositories.audits.list())[0]?.id, 'audit-sqlite-repository');

} finally {
  await reloadedProvider?.close().catch(() => undefined);
  await provider?.close().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await fs.rm(tempDirectory, { force: true, recursive: true }).catch(() => undefined);
}

console.log('sqlite app/admin repository contract passed.');
