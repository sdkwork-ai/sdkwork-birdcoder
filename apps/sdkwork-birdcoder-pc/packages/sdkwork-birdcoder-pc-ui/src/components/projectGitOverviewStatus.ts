import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';

export type ProjectGitOverviewStatusMessageKey =
  | 'app.menu.gitCommandFailed'
  | 'app.menu.gitExecutableUnavailable'
  | 'app.menu.gitRepositoryUnavailable'
  | 'app.menu.loadingGitRepository'
  | 'app.menu.noRepository'
  | 'app.menu.projectPathUnavailable'
  | 'app.menu.repositoryRootMismatch';

export function getProjectGitOverviewStatusMessageKey({
  diagnosticCode,
  subscriptionStatus,
}: Pick<
  ProjectGitOverviewViewState,
  'diagnosticCode' | 'subscriptionStatus'
>): ProjectGitOverviewStatusMessageKey | null {
  switch (subscriptionStatus) {
    case 'ready':
      return null;
    case 'idle':
    case 'loading':
      return 'app.menu.loadingGitRepository';
    case 'not_repository':
      return 'app.menu.noRepository';
    case 'repository_root_mismatch':
      return 'app.menu.repositoryRootMismatch';
    case 'unavailable':
      if (diagnosticCode === 'git_executable_unavailable') {
        return 'app.menu.gitExecutableUnavailable';
      }
      if (diagnosticCode === 'project_path_unavailable') {
        return 'app.menu.projectPathUnavailable';
      }
      return 'app.menu.gitCommandFailed';
    case 'error':
    default:
      return 'app.menu.gitRepositoryUnavailable';
  }
}
