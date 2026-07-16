import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const workspacesHookSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useWorkspaces.ts',
  ),
  'utf8',
);
const appContentSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx',
  ),
  'utf8',
);
const codeEffectiveWorkspaceSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeEffectiveWorkspaceId.ts',
  ),
  'utf8',
);

assert.match(
  workspacesHookSource,
  /const requestKey = `\$\{mode\}:\$\{pageRequest\.page\}:\$\{pageRequest\.pageSize\}`;[\s\S]*store\.inflightKey === requestKey/u,
  'workspace inflight reuse must be scoped to the exact page request and operation mode.',
);

assert.match(
  workspacesHookSource,
  /const storeScopeKey = isDefaultPagination[\s\S]*::page:/u,
  'non-default workspace pages must not overwrite the default workspace inventory store.',
);

assert.match(
  workspacesHookSource,
  /workspaceService\.getWorkspacesPage\(request\)/u,
  'workspace inventory must use the standard paginated service API.',
);

assert.match(
  workspacesHookSource,
  /loadMoreWorkspaces = useCallback[\s\S]*page: pageInfo\.page \+ 1[\s\S]*pageSize: pageInfo\.pageSize[\s\S]*'append'/u,
  'workspace inventory must expose an explicit append-page loader.',
);

assert.match(
  workspacesHookSource,
  /!storeSnapshot\.error[\s\S]*isResolvingTargetWorkspace/u,
  'automatic target-workspace resolution must stop retrying after a page error.',
);

assert.match(
  workspacesHookSource,
  /\.catch\(\(error\) => \{[\s\S]*error: message,[\s\S]*throw error;/u,
  'workspace load failures must be retained as error state and propagated to callers.',
);

assert.doesNotMatch(
  workspacesHookSource,
  /\.catch\(\(error\) => \{[\s\S]{0,500}return store\.snapshot\.workspaces;/u,
  'workspace load failures must not be converted into a successful empty or stale inventory.',
);

assert.match(
  appContentSource,
  /error: workspacesError[\s\S]*if \(workspacesError\) \{[\s\S]*addToast\(workspacesError, 'error'\);[\s\S]*!workspacesHasFetched \|\|\s*workspacesError/u,
  'the PC shell must surface workspace errors and block automatic workspace creation while authority loading failed.',
);

assert.match(
  appContentSource,
  /hasMoreWorkspaces[\s\S]*onLoadMoreWorkspaces/u,
  'the PC workspace menu must expose a way to reach later workspace pages.',
);

assert.match(
  codeEffectiveWorkspaceSource,
  /error: workspacesError[\s\S]*!hasFetched \|\|\s*workspacesError \|\|/u,
  'Code workspace bootstrap must not create a default workspace after a failed workspace inventory request.',
);

console.log('workspaces pagination and error contract passed.');
