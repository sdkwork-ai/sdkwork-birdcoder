import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  WorkbenchGitOverviewView,
  WorkbenchGitRepositoryDiagnosticCode,
  WorkbenchGitWorktreeView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ProjectRuntimeLocationExecutionUnavailableError } from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';
import { useIDEServices } from '../context/ideServices.ts';
import { getProjectGitWorktreeDisplayName } from '../workbench/gitWorktrees.ts';
import {
  createProjectGitOverviewSubscription,
  type ProjectGitOverviewSubscriptionSnapshot,
} from '../workbench/projectGitOverviewSubscription.ts';
import { subscribeProjectGitOverviewRefresh } from '../workbench/projectGitOverview.ts';

export interface UseProjectGitOverviewOptions {
  isActive?: boolean;
  projectId?: string | null;
}

export interface ProjectGitOverviewViewState {
  applyGitOverview: (overview: WorkbenchGitOverviewView) => void;
  branches: string[];
  currentBranchLabel: string;
  currentWorktree: WorkbenchGitWorktreeView | null;
  currentWorktreeLabel: string;
  diagnosticCode: WorkbenchGitRepositoryDiagnosticCode | null;
  isGitRepositoryReady: boolean;
  isLoading: boolean;
  loadErrorMessage: string | null;
  normalizedProjectId: string;
  overview: WorkbenchGitOverviewView | null;
  refreshGitOverview: () => Promise<WorkbenchGitOverviewView | null>;
  subscriptionStatus: ProjectGitOverviewSubscriptionSnapshot['kind'];
  worktrees: WorkbenchGitWorktreeView[];
}

export interface UseProjectGitOverviewResult extends ProjectGitOverviewViewState {}

function shouldReportProjectGitOverviewLoadError(error: unknown): boolean {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
  return !(
    errorCode === 'tauri_project_git_runtime_unavailable'
    || (
      error instanceof ProjectRuntimeLocationExecutionUnavailableError
      && error.code === 'missing_runtime_location_id'
    )
  );
}

function reportProjectGitOverviewLoadError(error: unknown): void {
  if (shouldReportProjectGitOverviewLoadError(error)) {
    console.error('Failed to load project Git overview', error);
  }
}

export function useProjectGitOverview({
  isActive = true,
  projectId,
}: UseProjectGitOverviewOptions): UseProjectGitOverviewResult {
  const { gitService } = useIDEServices();
  const subscription = useMemo(
    () => createProjectGitOverviewSubscription({
      activation: isActive ? 'active' : 'inactive',
      onLoadError: reportProjectGitOverviewLoadError,
      projectId,
      source: gitService,
    }),
    [gitService, isActive, projectId],
  );
  const snapshot = useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot,
    subscription.getSnapshot,
  );

  useEffect(() => {
    if (snapshot.kind !== 'idle' || !subscription.normalizedProjectId) {
      return;
    }
    void subscription.refresh();
  }, [snapshot.kind, subscription]);

  useEffect(() => {
    if (!isActive || !subscription.normalizedProjectId) {
      return;
    }
    return subscribeProjectGitOverviewRefresh((refreshedProjectId) => {
      if (refreshedProjectId === subscription.normalizedProjectId) {
        void subscription.refresh();
      }
    });
  }, [isActive, subscription]);

  const overview = snapshot.overview;
  const currentWorktree = overview?.worktrees.find((worktree) => worktree.isCurrent) ?? null;
  const branches = overview?.branches.map((branch) => branch.name) ?? [];
  const currentBranchLabel = overview?.currentBranch?.trim()
    || overview?.currentRevision?.slice(0, 8)
    || branches[0]
    || '';
  const worktrees = overview?.worktrees ?? [];
  const currentWorktreeLabel = getProjectGitWorktreeDisplayName(currentWorktree);

  return useMemo(
    () => ({
      applyGitOverview: subscription.apply,
      branches,
      currentBranchLabel,
      currentWorktree,
      currentWorktreeLabel,
      diagnosticCode: overview?.diagnosticCode ?? null,
      isGitRepositoryReady: snapshot.kind === 'ready',
      isLoading: snapshot.kind === 'loading',
      loadErrorMessage: snapshot.errorMessage,
      normalizedProjectId: subscription.normalizedProjectId,
      overview,
      refreshGitOverview: subscription.refresh,
      subscriptionStatus: snapshot.kind,
      worktrees,
    }),
    [
      branches,
      currentBranchLabel,
      currentWorktree,
      currentWorktreeLabel,
      overview,
      snapshot.errorMessage,
      snapshot.kind,
      subscription,
      worktrees,
    ],
  );
}
