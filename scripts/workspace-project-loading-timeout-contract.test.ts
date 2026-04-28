import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { hydrateImportedProjectFromAuthority } from '../packages/sdkwork-birdcoder-commons/src/workbench/importedProjectHydration.ts';
import type { BirdCoderProject } from '../packages/sdkwork-birdcoder-types/src/index.ts';
import type { IProjectService } from '../packages/sdkwork-birdcoder-commons/src/services/interfaces/IProjectService.ts';

const rootDir = process.cwd();
const useWorkspacesSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-commons/src/hooks/useWorkspaces.ts'),
  'utf8',
);
const useProjectsSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts'),
  'utf8',
);
const importedProjectHydrationSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-commons/src/workbench/importedProjectHydration.ts'),
  'utf8',
);
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const ciFlowSource = fs.readFileSync(path.join(rootDir, 'scripts/ci-flow-contract.test.mjs'), 'utf8');

const workspaceId = 'workspace-loading-timeout';
const projectId = 'project-loading-timeout';
const never = new Promise<never>(() => undefined);

function buildProject(): BirdCoderProject {
  return {
    archived: false,
    codingSessions: [],
    createdAt: '2026-04-28T10:00:00.000Z',
    id: projectId,
    name: 'Loading Timeout Project',
    path: 'D:/workspace/loading-timeout',
    updatedAt: '2026-04-28T10:00:00.000Z',
    workspaceId,
  };
}

function buildProjectService(
  implementation: Partial<IProjectService>,
): IProjectService {
  const fail = (method: string): never => {
    throw new Error(`${method} should not be called by this contract`);
  };

  return {
    async getProjects() {
      return fail('getProjects');
    },
    async getProjectById(candidateProjectId: string) {
      void candidateProjectId;
      return fail('getProjectById');
    },
    async getProjectByPath() {
      return fail('getProjectByPath');
    },
    async createProject() {
      return fail('createProject');
    },
    async renameProject() {
      return fail('renameProject');
    },
    async updateProject() {
      return fail('updateProject');
    },
    async deleteProject() {
      return fail('deleteProject');
    },
    async createCodingSession() {
      return fail('createCodingSession');
    },
    async renameCodingSession() {
      return fail('renameCodingSession');
    },
    async updateCodingSession() {
      return fail('updateCodingSession');
    },
    async forkCodingSession() {
      return fail('forkCodingSession');
    },
    async deleteCodingSession() {
      return fail('deleteCodingSession');
    },
    async addCodingSessionMessage() {
      return fail('addCodingSessionMessage');
    },
    async editCodingSessionMessage() {
      return fail('editCodingSessionMessage');
    },
    async deleteCodingSessionMessage() {
      return fail('deleteCodingSessionMessage');
    },
    ...implementation,
  };
}

async function assertRejectsWithin(
  promise: Promise<unknown>,
  expectedMessage: RegExp,
  label: string,
): Promise<void> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const outcome = await Promise.race([
    promise.then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    ),
    new Promise<{ status: 'hung' }>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({ status: 'hung' });
      }, 150);
    }),
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  if (outcome.status === 'resolved') {
    assert.fail(`${label} should reject instead of resolving.`);
  }
  if (outcome.status === 'hung') {
    assert.fail(`${label} did not settle within the guard window.`);
  }

  assert.match(
    outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
    expectedMessage,
    label,
  );
}

assert.match(
  useWorkspacesSource,
  /const WORKSPACES_FETCH_TIMEOUT_MS = 30_000;/,
  'useWorkspaces must bound initial and manual workspace catalog fetches so startup cannot keep the workspace selector loading forever.',
);
assert.match(
  useWorkspacesSource,
  /function runWorkspaceFetchWithTimeout\([\s\S]*Promise\.race\(\[[\s\S]*workspaceService\.getWorkspaces\(\)[\s\S]*timeoutBoundary\.promise[\s\S]*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'useWorkspaces must race workspaceService.getWorkspaces against a timeout boundary.',
);
assert.match(
  useProjectsSource,
  /const PROJECTS_FETCH_TIMEOUT_MS = 30_000;/,
  'useProjects must bound project inventory reads so the project sidebar cannot stay loading forever.',
);
assert.match(
  useProjectsSource,
  /function readProjectInventoryForWorkspaceWithTimeout\([\s\S]*Promise\.race\(\[[\s\S]*readProjectInventoryForWorkspace\(workspaceId, projectService\)[\s\S]*timeoutBoundary\.promise[\s\S]*\]\)[\s\S]*timeoutBoundary\.clear\(\);/,
  'useProjects must race project inventory reads against a timeout boundary.',
);
assert.match(
  importedProjectHydrationSource,
  /hydrationTimeoutMs\?: number;/,
  'Imported project hydration must expose a bounded timeout override for tests and constrained runtimes.',
);
assert.match(
  importedProjectHydrationSource,
  /const IMPORTED_PROJECT_HYDRATION_TIMEOUT_MS = 30_000;/,
  'Imported project hydration must have a default timeout so background hydration cannot poison future project selections.',
);
assert.match(
  importedProjectHydrationSource,
  /interface ImportedProjectHydrationTaskState \{\s*abandoned: boolean;\s*\}/,
  'Imported project hydration must track abandoned timed-out work to prevent stale side effects.',
);
assert.match(
  importedProjectHydrationSource,
  /taskState\.abandoned = true;/,
  'Imported project hydration timeout must mark the underlying task as abandoned before rejecting.',
);
assert.match(
  importedProjectHydrationSource,
  /if \(taskState\.abandoned\) \{\s*return null;\s*\}[\s\S]*upsertProjectIntoProjectsStore/,
  'Imported project hydration must not upsert stale authoritative results after the timeout path has returned control to the UI.',
);
assert.match(
  packageJson.scripts['check:project-inventory-standard'] ?? '',
  /workspace-project-loading-timeout-contract\.test\.ts/,
  'Project inventory standards must cover workspace/project loading timeout resilience.',
);
assert.match(
  ciFlowSource,
  /workspace-project-loading-timeout-contract\.test\.ts/,
  'CI flow governance must keep workspace/project loading timeout resilience in the first-class project inventory standard.',
);

let firstHydrationShouldHang = true;
let getProjectByIdCalls = 0;
const hydrationProject = buildProject();
const hydrationService = buildProjectService({
  async invalidateProjectReadCache() {
    return undefined;
  },
  async getProjectById(candidateProjectId: string) {
    assert.equal(candidateProjectId, projectId);
    getProjectByIdCalls += 1;
    if (firstHydrationShouldHang) {
      return never;
    }

    return hydrationProject;
  },
});

await assertRejectsWithin(
  hydrateImportedProjectFromAuthority({
    hydrationTimeoutMs: 10,
    projectId,
    projectService: hydrationService,
    userScope: 'loading-timeout-user',
    workspaceId,
  }),
  /Timed out hydrating imported project/,
  'imported project hydration must reject on timeout instead of keeping an in-flight hydration forever',
);

firstHydrationShouldHang = false;
const retryHydrationResult = await hydrateImportedProjectFromAuthority({
  hydrationTimeoutMs: 100,
  projectId,
  projectService: hydrationService,
  userScope: 'loading-timeout-user',
  workspaceId,
});

assert.equal(
  retryHydrationResult?.project.id,
  projectId,
  'imported project hydration must allow a clean retry after a timed-out hydration.',
);
assert.equal(
  getProjectByIdCalls,
  2,
  'imported project hydration retry must execute a fresh authoritative project lookup after timeout cleanup.',
);

console.log('workspace/project loading timeout contract passed.');
