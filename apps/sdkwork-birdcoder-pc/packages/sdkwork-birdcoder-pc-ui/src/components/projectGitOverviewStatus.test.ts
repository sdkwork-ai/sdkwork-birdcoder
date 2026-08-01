import { describe, expect, it } from 'vitest';

import { getProjectGitOverviewStatusMessageKey } from './projectGitOverviewStatus.ts';

describe('project Git overview status presentation', () => {
  it.each([
    [{ diagnosticCode: null, subscriptionStatus: 'idle' }, 'app.menu.loadingGitRepository'],
    [{ diagnosticCode: null, subscriptionStatus: 'not_repository' }, 'app.menu.noRepository'],
    [
      {
        diagnosticCode: 'repository_root_mismatch',
        subscriptionStatus: 'repository_root_mismatch',
      },
      'app.menu.repositoryRootMismatch',
    ],
    [
      {
        diagnosticCode: 'git_executable_unavailable',
        subscriptionStatus: 'unavailable',
      },
      'app.menu.gitExecutableUnavailable',
    ],
    [
      {
        diagnosticCode: 'project_path_unavailable',
        subscriptionStatus: 'unavailable',
      },
      'app.menu.projectPathUnavailable',
    ],
    [
      {
        diagnosticCode: 'git_command_failed',
        subscriptionStatus: 'unavailable',
      },
      'app.menu.gitCommandFailed',
    ],
    [{ diagnosticCode: null, subscriptionStatus: 'error' }, 'app.menu.gitRepositoryUnavailable'],
  ] as const)('maps %o to %s', (input, expectedMessageKey) => {
    expect(getProjectGitOverviewStatusMessageKey(input)).toBe(expectedMessageKey);
  });
});
