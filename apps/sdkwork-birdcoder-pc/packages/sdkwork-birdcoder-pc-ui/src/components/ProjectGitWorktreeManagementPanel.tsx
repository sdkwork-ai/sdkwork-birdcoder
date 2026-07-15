import { useEffect, useMemo, useState } from 'react';
import { GitBranch, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  getProjectGitWorktreeDisplayName,
  getProjectGitWorktreeKey,
  isProjectGitWorktreePrunable,
  isProjectGitWorktreeRemovable,
  useProjectGitMutationActions,
  useProjectGitOverview,
  useToast,
} from '@sdkwork/birdcoder-pc-commons';
import type { BirdCoderGitWorktreeSummary } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { useTranslation } from 'react-i18next';

interface ProjectGitWorktreeManagementPanelProps {
  currentProjectId?: string;
}

function resolveManageableWorktrees(
  worktrees: readonly BirdCoderGitWorktreeSummary[],
): BirdCoderGitWorktreeSummary[] {
  return worktrees.filter(isProjectGitWorktreeRemovable);
}

export function ProjectGitWorktreeManagementPanel({
  currentProjectId,
}: ProjectGitWorktreeManagementPanelProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const {
    applyGitOverview,
    normalizedProjectId,
    overview,
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
  const [removingWorktreeKey, setRemovingWorktreeKey] = useState('');
  const manageableWorktrees = useMemo(
    () => resolveManageableWorktrees(overview?.worktrees ?? []),
    [overview?.worktrees],
  );
  const isRepositoryReady = overview?.status === 'ready';

  useEffect(() => {
    setBranchName('');
    setRemovingWorktreeKey('');
  }, [normalizedProjectId]);

  const handleCreateWorktree = async () => {
    if (!normalizedProjectId || !branchName.trim()) {
      return;
    }

    try {
      const createdWorktree = await createWorktree(branchName);
      addToast(t('code.worktreeCreated', { branch: createdWorktree.branchName }), 'success');
      setBranchName('');
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    }
  };

  const handleRemoveWorktree = async (worktree: BirdCoderGitWorktreeSummary) => {
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
      await removeWorktree({
        force: false,
        worktreeKey,
      });
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

  const handlePruneWorktrees = async () => {
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
  };

  return (
    <section className="rounded-2xl border border-white/8 bg-[#121318] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
            <GitBranch size={13} />
            <span>{t('code.manageWorktrees')}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">{t('code.createWorktree')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            {t('code.createWorktreeDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void handlePruneWorktrees();
          }}
          disabled={!normalizedProjectId || !isRepositoryReady || isPruningWorktrees}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200 transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPruningWorktrees ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{t('code.pruneWorktreesAction')}</span>
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex min-w-0 flex-col gap-2 text-sm text-gray-300">
          <span>{t('code.worktreeBranchName')}</span>
          <input
            value={branchName}
            onChange={(event) => {
              setBranchName(event.target.value);
            }}
            placeholder="feature/worktree"
            disabled={!normalizedProjectId || !isRepositoryReady || isCreatingWorktree}
            className="h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            void handleCreateWorktree();
          }}
          disabled={!normalizedProjectId || !isRepositoryReady || !branchName.trim() || isCreatingWorktree}
          className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        >
          {isCreatingWorktree ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          <span>{t('code.createWorktreeAction')}</span>
        </button>
      </div>

      {!normalizedProjectId ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
          {t('code.selectProjectFirst')}
        </div>
      ) : !isRepositoryReady ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
          {t('app.menu.noRepository')}
        </div>
      ) : manageableWorktrees.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
          {t('code.noManagedWorktrees')}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {manageableWorktrees.map((worktree) => {
            const worktreeKey = getProjectGitWorktreeKey(worktree);
            const displayName = getProjectGitWorktreeDisplayName(worktree);
            const isPrunable = isProjectGitWorktreePrunable(worktree);
            const isRemoving = removingWorktreeKey === worktreeKey;
            return (
              <div
                key={worktreeKey}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-medium text-gray-100">
                      {displayName}
                    </div>
                    {isPrunable ? (
                      <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-red-200">
                        {t('code.prunable')}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-500">
                    {t('code.worktreeKey')}: {worktreeKey}
                  </div>
                  {worktree.head ? (
                    <div className="mt-1 text-xs text-gray-400">
                      {worktree.head}
                    </div>
                  ) : null}
                  {worktree.prunableReason ? (
                    <div className="mt-1 text-xs text-red-200/80">{worktree.prunableReason}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleRemoveWorktree(worktree);
                  }}
                  disabled={isRemoving}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRemoving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{t('code.removeWorktreeAction')}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
