import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getProjectGitWorktreeDisplayName,
  getProjectGitWorktreeKey,
  isProjectGitWorktreePrunable,
  isProjectGitWorktreeRemovable,
  normalizeWorkbenchWorktreeListLimit,
  useProjectGitMutationActions,
  useProjectGitOverview,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-pc-workbench';
import type { WorkbenchGitWorktreeView } from '@sdkwork/birdcoder-pc-contracts-commons';

import { getProjectGitOverviewStatusMessageKey } from './projectGitOverviewStatus';

interface ProjectGitWorktreeManagementPanelProps {
  autoPrune?: boolean;
  currentProjectId?: string;
  listLimit?: number;
}

function resolveManageableWorktrees(
  worktrees: readonly WorkbenchGitWorktreeView[],
): WorkbenchGitWorktreeView[] {
  return worktrees.filter(isProjectGitWorktreeRemovable);
}

export function ProjectGitWorktreeManagementPanel({
  autoPrune = true,
  currentProjectId,
  listLimit,
}: ProjectGitWorktreeManagementPanelProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { preferences } = useWorkbenchPreferences();
  const {
    applyGitOverview,
    diagnosticCode,
    isLoading,
    normalizedProjectId,
    overview,
    refreshGitOverview,
    subscriptionStatus,
  } = useProjectGitOverview({
    projectId: currentProjectId,
  });
  const {
    createWorktree,
    isCreatingWorktree,
    isPruningWorktrees,
    pruneWorktrees,
    removeWorktree,
  } = useProjectGitMutationActions({
    applyGitOverview,
    projectId: currentProjectId,
  });
  const [branchName, setBranchName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [removingWorktreeKey, setRemovingWorktreeKey] = useState('');
  const autoPruneAttemptRef = useRef('');
  const manageableWorktrees = useMemo(
    () => resolveManageableWorktrees(overview?.worktrees ?? []),
    [overview?.worktrees],
  );
  const normalizedListLimit = normalizeWorkbenchWorktreeListLimit(listLimit);
  const displayedWorktrees = manageableWorktrees.slice(0, normalizedListLimit);
  const hiddenWorktreeCount = manageableWorktrees.length - displayedWorktrees.length;
  const prunableWorktrees = useMemo(
    () => manageableWorktrees.filter(isProjectGitWorktreePrunable),
    [manageableWorktrees],
  );
  const prunableSignature = prunableWorktrees
    .map((worktree) => getProjectGitWorktreeKey(worktree))
    .filter(Boolean)
    .sort()
    .join(':');
  const isRepositoryReady = subscriptionStatus === 'ready' && overview?.status === 'ready';
  const statusMessageKey = getProjectGitOverviewStatusMessageKey({
    diagnosticCode,
    subscriptionStatus,
  });
  const statusMessage = t(statusMessageKey ?? 'app.menu.gitRepositoryUnavailable');

  useEffect(() => {
    setBranchName('');
    setIsCreateOpen(false);
    setRemovingWorktreeKey('');
    autoPruneAttemptRef.current = '';
  }, [normalizedProjectId]);

  useEffect(() => {
    if (
      !autoPrune
      || !normalizedProjectId
      || !isRepositoryReady
      || isPruningWorktrees
      || !prunableSignature
    ) {
      return;
    }
    const attemptKey = `${normalizedProjectId}:${prunableSignature}`;
    if (autoPruneAttemptRef.current === attemptKey) {
      return;
    }
    autoPruneAttemptRef.current = attemptKey;
    void pruneWorktrees().catch((error) => {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    });
  }, [
    addToast,
    autoPrune,
    isPruningWorktrees,
    isRepositoryReady,
    normalizedProjectId,
    prunableSignature,
    pruneWorktrees,
    t,
  ]);

  const handleCreateWorktree = async () => {
    if (!normalizedProjectId || !branchName.trim()) {
      return;
    }
    try {
      const createdWorktree = await createWorktree(branchName);
      addToast(t('code.worktreeCreated', { branch: createdWorktree.branchName }), 'success');
      setBranchName('');
      setIsCreateOpen(false);
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    }
  };

  const handleRemoveWorktree = async (worktree: WorkbenchGitWorktreeView) => {
    if (!normalizedProjectId) {
      return;
    }
    const worktreeKey = getProjectGitWorktreeKey(worktree);
    if (!worktreeKey) {
      addToast(t('code.worktreeIdentifierUnavailable'), 'error');
      return;
    }
    setRemovingWorktreeKey(worktreeKey);
    try {
      await removeWorktree({ force: false, worktreeKey });
      addToast(
        t('code.worktreeRemoved', { name: getProjectGitWorktreeDisplayName(worktree) }),
        'success',
      );
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    } finally {
      setRemovingWorktreeKey('');
    }
  };

  const handlePruneWorktrees = useCallback(async () => {
    if (!normalizedProjectId) {
      return;
    }
    try {
      await pruneWorktrees();
      addToast(t('code.worktreePruned'), 'success');
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    }
  }, [addToast, normalizedProjectId, pruneWorktrees, t]);

  const sectionTitle = isRepositoryReady && manageableWorktrees.length === 0
    ? t('settings.worktree.emptyTitle')
    : t('settings.worktree.worktreesTitle', { count: manageableWorktrees.length });

  return (
    <section aria-labelledby="managed-worktrees-heading" className="mt-10">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2
          className="text-xs font-semibold text-[#dedee0]"
          id="managed-worktrees-heading"
        >
          {sectionTitle}
        </h2>
        <div className="flex items-center gap-1">
          {prunableWorktrees.length > 0 && !autoPrune ? (
            <button
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-[#9b9ca1] outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:pointer-events-none disabled:opacity-50"
              disabled={!isRepositoryReady || isPruningWorktrees}
              onClick={() => void handlePruneWorktrees()}
              title={t('code.pruneWorktreesAction')}
              type="button"
            >
              {isPruningWorktrees ? (
                <Loader2 aria-hidden="true" className="animate-spin" size={13} />
              ) : (
                <RefreshCw aria-hidden="true" size={13} />
              )}
              {t('code.pruneWorktreesAction')}
            </button>
          ) : null}
          <button
            aria-label={t('settings.worktree.createAction')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#85868b] outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:pointer-events-none disabled:opacity-40"
            disabled={!isRepositoryReady}
            onClick={() => {
              const nextIsOpen = !isCreateOpen;
              setIsCreateOpen(nextIsOpen);
              if (nextIsOpen) {
                setBranchName(preferences.gitBranchPrefix);
              }
            }}
            title={t('settings.worktree.createAction')}
            type="button"
          >
            {isCreateOpen ? <X aria-hidden="true" size={14} /> : <Plus aria-hidden="true" size={14} />}
          </button>
          <button
            aria-label={t('code.refreshGitOverview')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#85868b] outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:pointer-events-none disabled:opacity-40"
            disabled={!normalizedProjectId || isLoading}
            onClick={() => void refreshGitOverview()}
            title={t('code.refreshGitOverview')}
            type="button"
          >
            {isLoading ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={14} />
            ) : (
              <RefreshCw aria-hidden="true" size={14} />
            )}
          </button>
        </div>
      </div>

      {isCreateOpen ? (
        <form
          className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-white/[0.08] bg-[#1c1c1f] p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateWorktree();
          }}
        >
          <label className="sr-only" htmlFor="new-worktree-branch">
            {t('code.worktreeBranchName')}
          </label>
          <div className="relative min-w-0">
            <GitBranch
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77787d]"
              size={14}
            />
            <input
              autoFocus
              className="h-8 w-full rounded-md border border-white/[0.08] bg-[#252528] pl-8 pr-2.5 text-xs text-white outline-none placeholder:text-[#77787d] focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/25"
              disabled={isCreatingWorktree}
              id="new-worktree-branch"
              onChange={(event) => setBranchName(event.target.value)}
              placeholder={t('settings.worktree.branchPlaceholder')}
              value={branchName}
            />
          </div>
          <button
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#2f80ed] px-3 text-xs font-medium text-white outline-none hover:bg-[#3b8cf5] focus-visible:ring-2 focus-visible:ring-blue-300/70 disabled:pointer-events-none disabled:opacity-50"
            disabled={!branchName.trim() || isCreatingWorktree}
            type="submit"
          >
            {isCreatingWorktree ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={13} />
            ) : (
              <Plus aria-hidden="true" size={13} />
            )}
            {t('settings.worktree.createAction')}
          </button>
        </form>
      ) : null}

      {!normalizedProjectId ? (
        <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#1c1c1f] px-3.5 py-3 text-xs text-[#88898e]">
          {t('code.selectProjectFirst')}
        </div>
      ) : !isRepositoryReady ? (
        <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#1c1c1f] px-3.5 py-3 text-xs text-[#88898e]">
          {statusMessage}
        </div>
      ) : manageableWorktrees.length === 0 ? (
        <div className="mt-3 rounded-lg border border-white/[0.07] bg-[#1c1c1f] px-3.5 py-3 text-xs text-[#88898e]">
          {t('settings.worktree.emptyDescription')}
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.07] bg-[#1c1c1f]">
          {displayedWorktrees.map((worktree, index) => {
            const worktreeKey = getProjectGitWorktreeKey(worktree);
            const displayName = getProjectGitWorktreeDisplayName(worktree);
            const isRemoving = removingWorktreeKey === worktreeKey;
            return (
              <div
                className={`flex min-h-[54px] items-center justify-between gap-3 px-3.5 py-2.5 ${
                  index === displayedWorktrees.length - 1 && hiddenWorktreeCount === 0
                    ? ''
                    : 'border-b border-white/[0.07]'
                }`}
                key={worktreeKey}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch aria-hidden="true" className="shrink-0 text-[#9a9ba0]" size={14} />
                    <span className="truncate text-xs font-medium text-[#e6e6e8]">
                      {displayName}
                    </span>
                    {isProjectGitWorktreePrunable(worktree) ? (
                      <span className="shrink-0 rounded border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                        {t('code.prunable')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate pl-[22px] font-mono text-[10px] text-[#77787d]">
                    {worktree.head || worktreeKey}
                  </div>
                </div>
                <button
                  aria-label={t('settings.worktree.removeAction', { name: displayName })}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#85868b] outline-none hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-400/70 disabled:pointer-events-none disabled:opacity-50"
                  disabled={isRemoving}
                  onClick={() => void handleRemoveWorktree(worktree)}
                  title={t('code.removeWorktreeAction')}
                  type="button"
                >
                  {isRemoving ? (
                    <Loader2 aria-hidden="true" className="animate-spin" size={14} />
                  ) : (
                    <Trash2 aria-hidden="true" size={14} />
                  )}
                </button>
              </div>
            );
          })}
          {hiddenWorktreeCount > 0 ? (
            <div className="px-3.5 py-2 text-[11px] text-[#77787d]">
              {t('settings.worktree.moreWorktrees', { count: hiddenWorktreeCount })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
