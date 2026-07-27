import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import type { WorkbenchGitOverviewView } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  createProjectGitOverviewSubscription,
} from '../src/workbench/projectGitOverviewSubscription.ts';

function createOverview(
  status: WorkbenchGitOverviewView['status'],
  diagnosticCode?: WorkbenchGitOverviewView['diagnosticCode'],
): WorkbenchGitOverviewView {
  return {
    branches: status === 'ready'
      ? [{ isCurrent: true, isRemote: false, name: 'main' }]
      : [],
    currentBranch: status === 'ready' ? 'main' : undefined,
    detachedHead: false,
    diagnosticCode,
    status,
    statusCounts: { staged: 0, unstaged: 0, untracked: 0 },
    worktrees: [],
  };
}

describe('project Git overview subscription', () => {
  it('publishes loading and ready snapshots for an active project', async () => {
    const observedKinds: string[] = [];
    const subscription = createProjectGitOverviewSubscription({
      activation: 'active',
      projectId: 'ready-project',
      source: {
        getProjectGitOverview: async () => createOverview('ready'),
      },
    });
    const unsubscribe = subscription.subscribe(() => {
      observedKinds.push(subscription.getSnapshot().kind);
    });

    assert.equal(subscription.getSnapshot().kind, 'idle');
    const overview = await subscription.refresh();
    assert.equal(overview?.status, 'ready');
    assert.equal(subscription.getSnapshot().kind, 'ready');
    assert.deepEqual(observedKinds, ['loading', 'ready']);
    unsubscribe();
  });

  it('does not inspect Git for an inactive project', async () => {
    let loadCount = 0;
    const source = {
      getProjectGitOverview: async () => {
        loadCount += 1;
        return createOverview('ready');
      },
    };
    const inactive = createProjectGitOverviewSubscription({
      activation: 'inactive',
      projectId: 'inactive-project',
      source,
    });

    assert.equal(await inactive.refresh(), null);
    assert.equal(inactive.getSnapshot().kind, 'idle');
    assert.equal(loadCount, 0);
  });

  it('preserves unavailable diagnostics', async () => {
    const unavailable = createProjectGitOverviewSubscription({
      activation: 'active',
      projectId: 'unavailable-project',
      source: {
        getProjectGitOverview: async () => createOverview(
          'unavailable',
          'git_executable_unavailable',
        ),
      },
    });
    const unsubscribe = unavailable.subscribe(() => undefined);

    await unavailable.refresh();
    assert.equal(unavailable.getSnapshot().kind, 'unavailable');
    assert.equal(
      unavailable.getSnapshot().overview?.diagnosticCode,
      'git_executable_unavailable',
    );
    unsubscribe();
  });

  it('publishes errors and reports them to the caller', async () => {
    let reportedError: unknown;
    const failed = createProjectGitOverviewSubscription({
      activation: 'active',
      onLoadError: (error) => {
        reportedError = error;
      },
      projectId: 'failed-project',
      source: {
        getProjectGitOverview: async () => {
          throw new Error('inspection failed');
        },
      },
    });
    const unsubscribe = failed.subscribe(() => undefined);

    await failed.refresh();
    assert.equal(failed.getSnapshot().kind, 'error');
    assert.match(failed.getSnapshot().errorMessage ?? '', /inspection failed/);
    assert.ok(reportedError instanceof Error);
    unsubscribe();
  });
});
