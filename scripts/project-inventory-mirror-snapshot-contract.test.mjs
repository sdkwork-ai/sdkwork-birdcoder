import assert from 'node:assert/strict';
import fs from 'node:fs';

const useProjectsSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);

assert.match(
  useProjectsSource,
  /function readProjectInventoryPageForWorkspace\(/,
  'useProjects must read project inventory through the bounded page adapter.',
);

assert.match(
  useProjectsSource,
  /return projectService\.getProjectsPage\(workspaceId, request\);/,
  'useProjects must delegate bounded project inventory reads to the paginated project service.',
);

assert.doesNotMatch(
  useProjectsSource,
  /getProjectMirrorSnapshots\?\.bind\(projectService\)/,
  'bounded project inventory reads must not materialize the broad mirror snapshot API.',
);

console.log('project inventory mirror snapshot contract passed.');
