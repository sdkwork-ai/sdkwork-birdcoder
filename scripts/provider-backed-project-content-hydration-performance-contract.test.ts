import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';
import {
  createBirdCoderRepresentativeAppAdminRepositories,
  type BirdCoderProjectContentRecord,
  type BirdCoderRepresentativeProjectRecord,
} from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderInMemorySqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlExecutor.ts';

const timestamp = '2026-04-29T08:00:00.000Z';

function buildProject(id: string, workspaceId: string): BirdCoderRepresentativeProjectRecord {
  return {
    createdAt: timestamp,
    id,
    name: id,
    status: 'active',
    updatedAt: timestamp,
    workspaceId,
  };
}

function buildProjectContent(id: string, rootPath: string): BirdCoderProjectContentRecord {
  return {
    configData: JSON.stringify({
      rootPath,
    }),
    contentVersion: '1.0',
    createdAt: timestamp,
    id,
    projectId: id,
    updatedAt: timestamp,
  };
}

function readPlanTableName(plan: (typeof sqlExecutor.history)[number]): string | undefined {
  const meta = plan.meta;
  return meta && 'tableName' in meta ? meta.tableName : undefined;
}

const sqlExecutor = createBirdCoderInMemorySqlExecutor('sqlite');
const storageProvider = createBirdCoderStorageProvider('sqlite', {
  sqlExecutor,
});
const appRepositories = createBirdCoderRepresentativeAppAdminRepositories({
  providerId: storageProvider.providerId,
  storage: storageProvider,
});
const service = new ProviderBackedProjectService({
  projectContentRepository: appRepositories.projectContents,
  repository: appRepositories.projects,
});

await appRepositories.projects.saveMany([
  buildProject('project-content-hydration-target', 'workspace-content-hydration'),
  buildProject('project-content-hydration-target-b', 'workspace-content-hydration'),
  buildProject('project-content-hydration-noise', 'workspace-content-hydration-noise'),
]);
await appRepositories.projectContents.saveMany([
  buildProjectContent(
    'project-content-hydration-target',
    'D:/workspace/project-content-hydration-target',
  ),
  buildProjectContent(
    'project-content-hydration-target-b',
    'D:/workspace/project-content-hydration-target-b',
  ),
  buildProjectContent(
    'project-content-hydration-noise',
    'D:/workspace/project-content-hydration-noise',
  ),
]);

sqlExecutor.history.length = 0;
const hydratedProject = await service.getProjectById('project-content-hydration-target');

assert.equal(
  hydratedProject?.path,
  'D:/workspace/project-content-hydration-target',
  'single-project hydration must still resolve the canonical rootPath from plus_project_content.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => [plan.meta?.kind, readPlanTableName(plan)]),
  [
    ['table-find-by-id', 'plus_project'],
    ['table-find-by-id', 'plus_project_content'],
  ],
  'single-project hydration must use id-based project and project_content reads instead of scanning project_content.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) => plan.meta?.kind === 'table-list' && plan.meta.tableName === 'plus_project_content',
  ),
  false,
  'single-project hydration must not full-scan plus_project_content.',
);

const providerBackedProjectServiceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts', import.meta.url),
  'utf8',
);

assert.match(
  providerBackedProjectServiceSource,
  /if \(projectIds\.length === 1\) \{[\s\S]*projectContentRepository\.findById\(projectIds\[0\]!\)/,
  'ProviderBackedProjectService.resolveProjectRootPathsById must use projectContentRepository.findById for single-project hydration.',
);
assert.match(
  providerBackedProjectServiceSource,
  /private async findProjectContentByProjectId\([\s\S]*projectContentRepository\.findById\(projectId\)/,
  'ProviderBackedProjectService.findProjectContentByProjectId must use id-based reads before any broader fallback.',
);

sqlExecutor.history.length = 0;
const workspaceProjects = await service.getProjects('workspace-content-hydration');

assert.deepEqual(
  workspaceProjects.map((project) => project.id).sort(),
  ['project-content-hydration-target', 'project-content-hydration-target-b'],
  'workspace-scoped project listing must still return only projects from the requested workspace.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => [plan.meta?.kind, readPlanTableName(plan)]),
  [
    ['project-list-by-workspace-ids', 'plus_project'],
    ['project-content-list-by-project-ids', 'plus_project_content'],
  ],
  'workspace-scoped project listing must use batched workspace project and project_content reads after workspace filtering.',
);
assert.equal(
  sqlExecutor.history.some(
    (plan) => plan.meta?.kind === 'table-list' && plan.meta.tableName === 'plus_project',
  ),
  false,
  'workspace-scoped project listing must not full-scan plus_project before filtering workspace projects.',
);
assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /async getProjects\(workspaceId\?: string\): Promise<BirdCoderProject\[\]> \{\s*const records = await this\.hydrateProjectRecords\(await this\.repository\.list\(\)\);/,
  'ProviderBackedProjectService.getProjects must not hydrate every project before applying the workspace filter.',
);
assert.match(
  providerBackedProjectServiceSource,
  /this\.listProjectRecordsByWorkspaceId\(workspaceId\)/,
  'ProviderBackedProjectService.getProjects must use a workspace-indexed project reader when workspaceId is provided.',
);
assert.match(
  providerBackedProjectServiceSource,
  /projectContentRepository\.listProjectContentsByProjectIds\(projectIds\)/,
  'ProviderBackedProjectService must use the project_content batch accelerator for multi-project rootPath hydration.',
);

sqlExecutor.history.length = 0;
const projectByPath = await service.getProjectByPath(
  'workspace-content-hydration',
  'D:/workspace/project-content-hydration-target-b',
);
assert.equal(
  projectByPath?.id,
  'project-content-hydration-target-b',
  'workspace path lookup must still find the matching project by canonical project_content rootPath.',
);
assert.deepEqual(
  sqlExecutor.history.map((plan) => [plan.meta?.kind, readPlanTableName(plan)]),
  [
    ['project-list-by-workspace-ids', 'plus_project'],
    ['project-content-list-by-project-ids', 'plus_project_content'],
  ],
  'workspace path lookup must not full-scan all projects before matching a canonical rootPath.',
);
assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /getProjectByPath\([\s\S]*?hydrateProjectRecords\(await this\.repository\.list\(\)\)/,
  'ProviderBackedProjectService.getProjectByPath must not hydrate all projects before workspace/path matching.',
);
assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /findProjectByWorkspaceAndPath\([\s\S]*?hydrateProjectRecords\(await this\.repository\.list\(\)\)/,
  'ProviderBackedProjectService.findProjectByWorkspaceAndPath must not hydrate all projects before checking path conflicts.',
);

sqlExecutor.history.length = 0;
await service.deleteProject('project-content-hydration-target-b');
assert.deepEqual(
  sqlExecutor.history.map((plan) => [plan.meta?.kind, readPlanTableName(plan)]),
  [
    ['table-delete', 'plus_project'],
    ['table-find-by-id', 'plus_project_content'],
    ['table-delete', 'plus_project_content'],
  ],
  'project deletion must delete canonical project_content by id without scanning plus_project_content.',
);
assert.doesNotMatch(
  providerBackedProjectServiceSource,
  /deleteProjectRootPathContent\([\s\S]*?projectContentRepository\.list\(\)/,
  'ProviderBackedProjectService.deleteProjectRootPathContent must not full-scan plus_project_content for one project deletion.',
);

console.log('provider-backed project content hydration performance contract passed.');
