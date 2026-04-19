import assert from 'node:assert/strict';
import fs from 'node:fs';

const useProjectsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts', import.meta.url),
  'utf8',
);

assert.match(
  useProjectsSource,
  /function materializeProjectInventoryFromMirrorSnapshot\(/,
  'useProjects must materialize project inventory from mirror snapshots so list reads avoid full transcript payload hydration.',
);

assert.match(
  useProjectsSource,
  /getProjectMirrorSnapshots\?\.bind\(projectService\)/,
  'useProjects must prefer project mirror snapshots when the project service exposes lightweight inventory reads.',
);

assert.match(
  useProjectsSource,
  /return projectService\.getProjects\(workspaceId\);/,
  'useProjects must keep a getProjects fallback when a project mirror snapshot reader is unavailable.',
);

console.log('project inventory mirror snapshot contract passed.');
