import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/fileSystemRequestGuard.ts',
  import.meta.url,
);

const {
  createFileSystemRequestGuardState,
  resetFileSystemRequestGuardState,
  beginFileTreeRequest,
  beginFileContentRequest,
  beginSearchRequest,
  completeFileTreeRequest,
  completeFileContentRequest,
  completeSearchRequest,
  hasPendingFileTreeRequests,
  hasPendingFileContentRequests,
  hasPendingSearchRequests,
  isProjectActiveForRequestGuard,
  isLatestFileTreeRequestForGuard,
  isLatestFileContentRequestForGuard,
  isLatestSearchRequestForGuard,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const initialState = createFileSystemRequestGuardState('project-alpha');
assert.equal(initialState.activeProjectId, 'project-alpha');
assert.equal(initialState.searchRequestVersion, 0);
assert.equal(isProjectActiveForRequestGuard(initialState, 'project-alpha'), true);
assert.equal(isProjectActiveForRequestGuard(initialState, 'project-beta'), false);
assert.equal(hasPendingFileTreeRequests(initialState), false);
assert.equal(hasPendingFileContentRequests(initialState), false);
assert.equal(hasPendingSearchRequests(initialState), false);

const firstTreeRequest = beginFileTreeRequest(initialState);
assert.equal(firstTreeRequest.requestVersion, 1);
assert.equal(firstTreeRequest.state.pendingFileTreeRequests, 1);
assert.equal(hasPendingFileTreeRequests(firstTreeRequest.state), true);
assert.equal(
  isLatestFileTreeRequestForGuard(firstTreeRequest.state, 'project-alpha', 1),
  true,
);
assert.equal(
  isLatestFileTreeRequestForGuard(firstTreeRequest.state, 'project-alpha', 2),
  false,
);

const secondTreeRequest = beginFileTreeRequest(firstTreeRequest.state);
assert.equal(secondTreeRequest.requestVersion, 2);
assert.equal(secondTreeRequest.state.pendingFileTreeRequests, 2);
assert.equal(
  isLatestFileTreeRequestForGuard(secondTreeRequest.state, 'project-alpha', 1),
  false,
);
assert.equal(
  isLatestFileTreeRequestForGuard(secondTreeRequest.state, 'project-alpha', 2),
  true,
);

const afterFirstTreeCompletion = completeFileTreeRequest(secondTreeRequest.state, 'project-alpha');
assert.equal(afterFirstTreeCompletion.pendingFileTreeRequests, 1);
assert.equal(hasPendingFileTreeRequests(afterFirstTreeCompletion), true);
assert.equal(
  isLatestFileTreeRequestForGuard(afterFirstTreeCompletion, 'project-alpha', 2),
  true,
);

const completedTreeState = completeFileTreeRequest(afterFirstTreeCompletion, 'project-alpha');
assert.equal(completedTreeState.pendingFileTreeRequests, 0);
assert.equal(hasPendingFileTreeRequests(completedTreeState), false);

const firstContentRequest = beginFileContentRequest(completedTreeState);
assert.equal(firstContentRequest.requestVersion, 1);
assert.equal(firstContentRequest.state.pendingFileContentRequests, 1);
assert.equal(hasPendingFileContentRequests(firstContentRequest.state), true);
assert.equal(
  isLatestFileContentRequestForGuard(firstContentRequest.state, 'project-alpha', 1),
  true,
);

const secondContentRequest = beginFileContentRequest(firstContentRequest.state);
assert.equal(secondContentRequest.requestVersion, 2);
assert.equal(secondContentRequest.state.pendingFileContentRequests, 2);
assert.equal(
  isLatestFileContentRequestForGuard(secondContentRequest.state, 'project-alpha', 1),
  false,
);
assert.equal(
  isLatestFileContentRequestForGuard(secondContentRequest.state, 'project-alpha', 2),
  true,
);

const searchRequest = beginSearchRequest(secondContentRequest.state);
assert.equal(searchRequest.requestVersion, 1);
assert.equal(searchRequest.state.pendingSearchRequests, 1);
assert.equal(hasPendingSearchRequests(searchRequest.state), true);
assert.equal(
  isLatestSearchRequestForGuard(searchRequest.state, 'project-alpha', 1),
  true,
);
assert.equal(
  isLatestFileContentRequestForGuard(searchRequest.state, 'project-alpha', 2),
  true,
  'search requests must not invalidate content requests',
);
assert.equal(
  isLatestFileTreeRequestForGuard(searchRequest.state, 'project-alpha', 2),
  true,
  'search requests must not invalidate file-tree requests',
);

const afterFirstContentCompletion = completeFileContentRequest(
  searchRequest.state,
  'project-alpha',
);
assert.equal(afterFirstContentCompletion.pendingFileContentRequests, 1);
assert.equal(hasPendingFileContentRequests(afterFirstContentCompletion), true);

const completedContentState = completeFileContentRequest(
  afterFirstContentCompletion,
  'project-alpha',
);
assert.equal(completedContentState.pendingFileContentRequests, 0);
assert.equal(hasPendingFileContentRequests(completedContentState), false);

const completedSearchState = completeSearchRequest(completedContentState, 'project-alpha');
assert.equal(completedSearchState.pendingSearchRequests, 0);
assert.equal(hasPendingSearchRequests(completedSearchState), false);

const switchedProjectState = resetFileSystemRequestGuardState(
  completedSearchState,
  'project-beta',
);
assert.equal(switchedProjectState.activeProjectId, 'project-beta');
assert.equal(switchedProjectState.pendingFileTreeRequests, 0);
assert.equal(switchedProjectState.pendingFileContentRequests, 0);
assert.equal(switchedProjectState.pendingSearchRequests, 0);
assert.equal(
  isProjectActiveForRequestGuard(switchedProjectState, 'project-alpha'),
  false,
);
assert.equal(
  isProjectActiveForRequestGuard(switchedProjectState, 'project-beta'),
  true,
);
assert.equal(
  isLatestFileTreeRequestForGuard(switchedProjectState, 'project-alpha', 2),
  false,
);
assert.equal(
  isLatestFileContentRequestForGuard(switchedProjectState, 'project-alpha', 2),
  false,
);
assert.equal(
  isLatestSearchRequestForGuard(switchedProjectState, 'project-alpha', 1),
  false,
);

const betaTreeRequest = beginFileTreeRequest(switchedProjectState);
assert.equal(betaTreeRequest.requestVersion, switchedProjectState.fileTreeRequestVersion + 1);
assert.equal(
  isLatestFileTreeRequestForGuard(betaTreeRequest.state, 'project-beta', betaTreeRequest.requestVersion),
  true,
);

console.log('file system request guard contract passed.');
