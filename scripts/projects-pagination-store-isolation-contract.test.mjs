import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
  ),
  'utf8',
);
const storeSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/stores/projectsStore.ts',
  ),
  'utf8',
);

assert.match(
  hookSource,
  /function readProjectInventoryPage\([\s\S]*return projectService\.getProjectsPage\(request\);/u,
  'bounded project inventory requests must reach the paginated service.',
);

assert.match(
  hookSource,
  /const requestKey = \[\s*mode,\s*pageRequest\.workspaceId,\s*pageRequest\.q \?\? '',\s*pageRequest\.nameExact \?\? '',\s*pageRequest\.status \?\? '',\s*pageRequest\.includeDeleted \?\? false,\s*pageRequest\.page,\s*pageRequest\.pageSize,\s*\]\.join\(':'\);[\s\S]*store\.inflightKey === requestKey/u,
  'project inventory inflight reuse must be scoped to the exact filtered page request and operation mode.',
);

assert.match(
  hookSource,
  /store\.inflight = null;\s*store\.inflightAbortController = null;\s*store\.inflightKey = null;/u,
  'project inventory completion must clear the promise, abort controller, and pagination identity.',
);

assert.match(
  hookSource,
  /const isDefaultPagination =\s*pageRequest\.pageSize === DEFAULT_LIST_PAGE_SIZE\s*&& pageRequest\.page === 1\s*&& !normalizedSearchQuery;[\s\S]*const paginationScopeSuffix =[\s\S]*`::page:\$\{pageRequest\.pageSize\}:\$\{pageRequest\.page\}`;[\s\S]*const searchScopeSuffix = normalizedSearchQuery[\s\S]*sha256Hash\(normalizedSearchQuery\)\.slice\(0, 24\)/u,
  'non-default pages and searches must use isolated store scopes while the default workbench inventory keeps its shared mutation scope.',
);

assert.match(
  storeSource,
  /inflightKey: string \| null;/u,
  'the shared project store must retain the pagination identity of its inflight request.',
);

console.log('projects pagination store isolation contract passed.');
