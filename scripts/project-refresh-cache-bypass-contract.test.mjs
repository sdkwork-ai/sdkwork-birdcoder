import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const commonsProjectServiceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/interfaces/IProjectService.ts',
);
const infrastructureProjectServiceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts',
);
const useProjectsSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
);
const sessionRefreshSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts',
);
const importedProjectHydrationSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/importedProjectHydration.ts',
);
const apiBackedProjectServiceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts',
);

assert.match(
  commonsProjectServiceSource,
  /invalidateProjectReadCache\?\(scope\?:\s*\{\s*projectId\?: string;\s*workspaceId\?: string;\s*\}\): Promise<void> \| void;/s,
  'Commons project service interface must expose an optional invalidateProjectReadCache hook for explicit refresh flows.',
);

assert.match(
  infrastructureProjectServiceSource,
  /invalidateProjectReadCache\?\(scope\?:\s*\{\s*projectId\?: string;\s*workspaceId\?: string;\s*\}\): Promise<void> \| void;/s,
  'Infrastructure project service interface must expose an optional invalidateProjectReadCache hook for explicit refresh flows.',
);

assert.match(
  useProjectsSource,
  /await projectService\.invalidateProjectReadCache\?\.\(\{\s*workspaceId:\s*normalizedWorkspaceId,\s*\}\);/s,
  'useProjects.refreshProjects must invalidate cached project reads before fetching a manual refresh snapshot.',
);

assert.match(
  sessionRefreshSource,
  /await options\.projectService\.invalidateProjectReadCache\?\.\(\{\s*projectId:\s*normalizedProjectId \|\| undefined,\s*workspaceId:\s*normalizedWorkspaceId,\s*\}\);/s,
  'refreshProjectSessions must invalidate cached project reads before performing an explicit project/session refresh.',
);

assert.match(
  importedProjectHydrationSource,
  /await options\.projectService\.invalidateProjectReadCache\?\.\(\{\s*projectId:\s*normalizedProjectId,\s*workspaceId:\s*normalizedWorkspaceId,\s*\}\);/s,
  'Imported project hydration must invalidate cached reads before requesting authoritative project detail.',
);

assert.match(
  apiBackedProjectServiceSource,
  /invalidateProjectReadCache\(scope:\s*\{\s*projectId\?: string;\s*workspaceId\?: string;\s*\}\s*=\s*\{\}\): void \{/s,
  'ApiBackedProjectService must implement invalidateProjectReadCache so manual refresh paths can bypass stale project caches.',
);

console.log('project refresh cache bypass contract passed.');
