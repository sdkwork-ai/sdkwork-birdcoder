import assert from 'node:assert/strict';

import { getProjectGitOverviewStatusMessageKey } from './projectGitOverviewStatus.ts';

assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: null,
    subscriptionStatus: 'idle',
  }),
  'app.menu.loadingGitRepository',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: null,
    subscriptionStatus: 'not_repository',
  }),
  'app.menu.noRepository',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: 'repository_root_mismatch',
    subscriptionStatus: 'repository_root_mismatch',
  }),
  'app.menu.repositoryRootMismatch',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: 'git_executable_unavailable',
    subscriptionStatus: 'unavailable',
  }),
  'app.menu.gitExecutableUnavailable',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: 'project_path_unavailable',
    subscriptionStatus: 'unavailable',
  }),
  'app.menu.projectPathUnavailable',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: 'git_command_failed',
    subscriptionStatus: 'unavailable',
  }),
  'app.menu.gitCommandFailed',
);
assert.equal(
  getProjectGitOverviewStatusMessageKey({
    diagnosticCode: null,
    subscriptionStatus: 'error',
  }),
  'app.menu.gitRepositoryUnavailable',
);

console.log('project Git overview status presentation tests passed.');
