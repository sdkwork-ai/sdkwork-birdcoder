import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useProjects.ts',
  ),
  'utf8',
);
const storeSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/stores/projectsStore.ts',
  ),
  'utf8',
);

assert.match(
  hookSource,
  /function readProjectInventoryPageForWorkspace\([\s\S]*return projectService\.getProjectsPage\(workspaceId, request\);/u,
  'bounded project inventory requests must reach the paginated service.',
);

assert.match(
  hookSource,
  /const requestKey = `\$\{mode\}:\$\{pageRequest\.page\}:\$\{pageRequest\.pageSize\}`;[\s\S]*store\.inflightKey === requestKey/u,
  'project inventory inflight reuse must be scoped to the exact page request and operation mode.',
);

assert.match(
  hookSource,
  /store\.inflight = null;\s*store\.inflightKey = null;/u,
  'project inventory completion must clear both the promise and its pagination identity.',
);

assert.match(
  hookSource,
  /const isDefaultPagination =[\s\S]*pageRequest\.pageSize === DEFAULT_LIST_PAGE_SIZE && pageRequest\.page === 1;[\s\S]*`\$\{baseStoreScopeKey\}::page:\$\{pageRequest\.pageSize\}:\$\{pageRequest\.page\}`/u,
  'non-default project pages must use an isolated store scope while the default workbench inventory keeps its shared mutation scope.',
);

assert.match(
  storeSource,
  /inflightKey: string \| null;/u,
  'the shared project store must retain the pagination identity of its inflight request.',
);

console.log('projects pagination store isolation contract passed.');
