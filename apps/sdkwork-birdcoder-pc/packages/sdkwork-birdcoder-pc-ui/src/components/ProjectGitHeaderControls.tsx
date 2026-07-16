import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type ProjectGitOverviewViewState,
  useProjectGitOverview,
} from '@sdkwork/birdcoder-pc-commons/hooks/useProjectGitOverview';
import { useProjectGitMutationActions } from '@sdkwork/birdcoder-pc-commons/hooks/useProjectGitMutationActions';
import { useToast } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import {
  getProjectGitWorktreeDisplayName,
  getProjectGitWorktreeKey,
  isProjectGitWorktreePrunable,
  isProjectGitWorktreeRemovable,
} from '@sdkwork/birdcoder-pc-commons/workbench/gitWorktrees';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  FolderGit2,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectGitBranchMenu } from './ProjectGitBranchMenu';
import { ProjectGitCreateBranchDialog } from './ProjectGitCreateBranchDialog';
import { ProjectGitWorktreeMenu } from './ProjectGitWorktreeMenu';

export type ProjectGitHeaderControlsVariant = 'topbar' | 'studio';

interface ProjectGitHeaderControlsProps {
  compactControls?: boolean;
  isOverviewDrawerOpen?: boolean;
  onAnyMenuOpen?: () => void;
  onRequestCommit?: () => void;
  onRequestPush?: () => void;
  onRequestViewDiff?: () => void;
  onToggleOverviewDrawer?: () => void;
  projectId?: string | null;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  showBranchControl?: boolean;
  showOverviewDrawerToggle?: boolean;
  showWorktreeControl?: boolean;
  variant: ProjectGitHeaderControlsVariant;
}

export const ProjectGitHeaderControls = memo(function ProjectGitHeaderControls({
  compactControls = false,
  isOverviewDrawerOpen = false,
  onAnyMenuOpen,
  onRequestCommit,
  onRequestPush,
  onRequestViewDiff,
  onToggleOverviewDrawer,
  projectId,
  projectGitOverviewState,
  showBranchControl = true,
  showOverviewDrawerToggle = false,
  showWorktreeControl = true,
  variant,
}: ProjectGitHeaderControlsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showUnifiedMenu, setShowUnifiedMenu] = useState(false);
  const [showWorktreeMenu, setShowWorktreeMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newWorktreeBranchName, setNewWorktreeBranchName] = useState('');
  const [removingWorktreeKey, setRemovingWorktreeKey] = useState('');
  const unifiedMenuRef = useRef<HTMLDivElement>(null);
  const localProjectGitOverviewState = useProjectGitOverview({
    isActive: !projectGitOverviewState,
    projectId,
  });
  const {
    applyGitOverview,
    currentBranchLabel,
    currentWorktree,
    currentWorktreeLabel,
    isGitRepositoryReady,
    isLoading,
    loadErrorMessage,
    normalizedProjectId,
    overview,
    refreshGitOverview,
    worktrees,
  } = projectGitOverviewState ?? localProjectGitOverviewState;
  const {
    createBranch,
    createWorktree,
    isCreatingBranch,
    isCreatingWorktree,
    isPruningWorktrees,
    isRemovingWorktree,
    pruneWorktrees,
    removeWorktree,
    switchBranch,
  } = useProjectGitMutationActions({
    applyGitOverview,
    projectId,
  });
  const showResolvedOverviewDrawerToggle =
    showOverviewDrawerToggle && Boolean(onToggleOverviewDrawer);
  const overviewDrawerLabel = isOverviewDrawerOpen ? t('code.closeGitOverview') : t('code.openGitOverview');
  const overviewToggleClassName =
    variant === 'studio'
      ? `inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
          normalizedProjectId
            ? isOverviewDrawerOpen
              ? 'border-blue-400/40 bg-blue-500/15 text-blue-300'
              : 'border-white/10 bg-[#15161b] text-gray-300 hover:border-white/15 hover:bg-[#1a1b22] hover:text-white'
            : 'cursor-not-allowed border-white/10 bg-[#15161b] text-gray-500 opacity-60'
        }`
      : `inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          normalizedProjectId
            ? isOverviewDrawerOpen
              ? 'bg-blue-500/[0.12] text-blue-300 hover:bg-blue-500/[0.16]'
              : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
            : 'cursor-not-allowed text-gray-500 opacity-60'
        }`;

  useEffect(() => {
    if (normalizedProjectId) {
      return;
    }

    setShowBranchMenu(false);
    setShowBranchModal(false);
    setShowUnifiedMenu(false);
    setShowWorktreeMenu(false);
    setNewBranchName('');
    setNewWorktreeBranchName('');
    setRemovingWorktreeKey('');
  }, [normalizedProjectId]);

  useEffect(() => {
    if (!showUnifiedMenu || !normalizedProjectId) {
      return undefined;
    }

    void refreshGitOverview();
    const handlePointerDown = (event: MouseEvent) => {
      if (unifiedMenuRef.current && !unifiedMenuRef.current.contains(event.target as Node)) {
        setShowUnifiedMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUnifiedMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [normalizedProjectId, refreshGitOverview, showUnifiedMenu]);

  useEffect(() => {
    if (!showBranchControl) {
      setShowBranchMenu(false);
      setShowBranchModal(false);
      setNewBranchName('');
    }
  }, [showBranchControl]);

  useEffect(() => {
    if (!showWorktreeControl) {
      setShowWorktreeMenu(false);
    }
  }, [showWorktreeControl]);

  const handleCreateBranch = useCallback(async () => {
    if (!normalizedProjectId || !newBranchName.trim()) {
      return;
    }

    try {
      const branchName = await createBranch(newBranchName);
      addToast(t('code.createdAndSwitchedBranch', { branch: branchName }), 'success');
      setShowBranchModal(false);
      setNewBranchName('');
    } catch (error) {
      addToast(t('code.failedToCreateBranch', { error: String(error) }), 'error');
    }
  }, [addToast, createBranch, newBranchName, normalizedProjectId, t]);

  const handleSwitchBranch = useCallback(async (branch: string) => {
    try {
      const branchName = await switchBranch(branch);
      addToast(t('code.switchedToBranch', { branch: branchName }), 'success');
      setShowBranchMenu(false);
    } catch (error) {
      addToast(t('code.failedToSwitchBranch', { error: String(error) }), 'error');
    }
  }, [addToast, switchBranch, t]);

  const handlePruneWorktrees = useCallback(async () => {
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
  }, [addToast, pruneWorktrees, t]);
  const handleRefreshGitOverview = useCallback(() => {
    void refreshGitOverview();
  }, [refreshGitOverview]);

  const handleCreateWorktree = useCallback(async () => {
    if (!normalizedProjectId || !newWorktreeBranchName.trim()) {
      return;
    }

    try {
      const createdWorktree = await createWorktree(newWorktreeBranchName);
      addToast(t('code.worktreeCreated', { branch: createdWorktree.branchName }), 'success');
      setNewWorktreeBranchName('');
    } catch (error) {
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.worktreeMutationFailed'),
        'error',
      );
    }
  }, [addToast, createWorktree, newWorktreeBranchName, normalizedProjectId, t]);

  const handleRemoveWorktree = useCallback(async (
    worktree: (typeof worktrees)[number],
  ) => {
    const worktreeKey = getProjectGitWorktreeKey(worktree);
    if (!normalizedProjectId || !worktreeKey) {
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
  }, [addToast, normalizedProjectId, removeWorktree, t]);

  if (variant === 'topbar') {
    const branchLabel = loadErrorMessage
      ? t('code.gitOverviewUnavailable')
      : currentBranchLabel || (isLoading ? '...' : t('app.menu.noRepository'));
    const compactTitle = `${t('code.gitOverview')}: ${branchLabel}`;
    const manageableWorktrees = worktrees.filter(isProjectGitWorktreeRemovable);
    const hasPrunableWorktrees = worktrees.some(isProjectGitWorktreePrunable);

    return (
      <>
        <div
          ref={unifiedMenuRef}
          className="relative animate-in fade-in slide-in-from-top-2 fill-mode-both"
        >
          <button
            type="button"
            disabled={!normalizedProjectId}
            className={`inline-flex h-8 items-center justify-center rounded-md text-xs transition-colors ${
              compactControls ? 'w-8 px-0' : 'max-w-[13rem] gap-1.5 px-2.5'
            } ${
              normalizedProjectId
                ? showUnifiedMenu || isOverviewDrawerOpen
                  ? 'bg-white/[0.07] text-white'
                  : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                : 'cursor-not-allowed text-gray-500 opacity-60'
            }`}
            aria-expanded={showUnifiedMenu}
            aria-haspopup="dialog"
            aria-label={compactControls ? compactTitle : undefined}
            title={compactControls ? compactTitle : undefined}
            onClick={() => {
              if (!normalizedProjectId) {
                return;
              }
              setShowUnifiedMenu((isOpen) => !isOpen);
              setShowBranchMenu(false);
              setShowWorktreeMenu(false);
              onAnyMenuOpen?.();
            }}
          >
            <FolderGit2 size={14} className="shrink-0 text-blue-400" />
            {!compactControls ? (
              <>
                <span className="truncate font-medium">{branchLabel}</span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-gray-500 transition-transform ${showUnifiedMenu ? 'rotate-180 text-gray-300' : ''}`}
                />
              </>
            ) : null}
          </button>

          {showUnifiedMenu ? (
            <div
              role="dialog"
              aria-label={t('code.gitOverview')}
              className="absolute right-0 top-full z-[80] mt-2 w-[25rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl bg-[#17171b]/98 p-2 text-[13px] text-gray-300 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-right"
            >
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-gray-100">
                    {t('code.gitOverview')}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-gray-500">
                    {overview?.currentRevision?.slice(0, 12) || branchLabel}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {showOverviewDrawerToggle && onToggleOverviewDrawer ? (
                    <button
                      type="button"
                      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors ${
                        isOverviewDrawerOpen
                          ? 'bg-blue-500/[0.14] text-blue-200'
                          : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
                      }`}
                      onClick={() => {
                        setShowUnifiedMenu(false);
                        onToggleOverviewDrawer();
                      }}
                    >
                      <FolderGit2 size={13} />
                      <span>{t('code.gitOverview')}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleRefreshGitOverview}
                    disabled={isLoading}
                    aria-label={t('code.refreshGitOverview')}
                    title={t('code.refreshGitOverview')}
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                </div>
              </div>

              {loadErrorMessage ? (
                <div className="m-2 flex items-start gap-2 rounded-lg bg-red-500/[0.12] px-3 py-3 text-[12px] text-red-200">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{loadErrorMessage}</span>
                </div>
              ) : !isGitRepositoryReady ? (
                <div className="px-3 py-4 text-[12px] text-gray-500">{t('app.menu.noRepository')}</div>
              ) : (
                <div className="max-h-[32rem] overflow-y-auto py-1 pr-1">
                  {onRequestCommit || onRequestPush || onRequestViewDiff ? (
                    <div className="grid grid-cols-3 gap-1 px-1 py-1">
                      {onRequestCommit ? (
                        <button
                          type="button"
                          className="flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                          onClick={() => {
                            setShowUnifiedMenu(false);
                            onRequestCommit();
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>{t('app.menu.commit')}</span>
                        </button>
                      ) : null}
                      {onRequestPush ? (
                        <button
                          type="button"
                          className="flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                          onClick={() => {
                            setShowUnifiedMenu(false);
                            onRequestPush();
                          }}
                        >
                          <Upload size={13} />
                          <span>{t('app.menu.pushToRemote')}</span>
                        </button>
                      ) : null}
                      {onRequestViewDiff ? (
                        <button
                          type="button"
                          className="flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                          onClick={() => {
                            setShowUnifiedMenu(false);
                            onRequestViewDiff();
                          }}
                        >
                          <GitBranch size={13} />
                          <span>{t('app.menu.viewDiff')}</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {onRequestCommit || onRequestPush || onRequestViewDiff ? (
                    <div className="my-1 h-px bg-white/[0.06]" />
                  ) : null}
                  {showBranchControl ? (
                    <section className="py-1">
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                          <GitBranch size={13} />
                          <span>{t('code.branches')}</span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                          onClick={() => {
                            setShowUnifiedMenu(false);
                            setNewBranchName('');
                            setShowBranchModal(true);
                          }}
                        >
                          <Plus size={13} />
                          <span>{t('app.menu.newBranch')}</span>
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {(overview?.branches ?? []).map((branch) => (
                          <button
                            key={branch.name}
                            type="button"
                            disabled={branch.isCurrent}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                              branch.isCurrent ? 'cursor-default bg-blue-500/[0.13]' : 'hover:bg-white/[0.055]'
                            }`}
                            onClick={() => {
                              setShowUnifiedMenu(false);
                              void handleSwitchBranch(branch.name);
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {branch.isCurrent ? <Check size={14} className="shrink-0 text-blue-300" /> : null}
                              <span className="truncate text-[12px] font-medium text-gray-100">{branch.name}</span>
                            </span>
                            {branch.isRemote ? (
                              <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-gray-300">
                                {t('code.remoteBranch')}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {showBranchControl && showWorktreeControl ? <div className="my-1 h-px bg-white/[0.06]" /> : null}

                  {showWorktreeControl ? (
                    <section className="py-1">
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                          <FolderGit2 size={13} />
                          <span>{t('code.worktrees')}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!hasPrunableWorktrees || isPruningWorktrees}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => {
                            void handlePruneWorktrees();
                          }}
                        >
                          {isPruningWorktrees ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          <span>{t('code.pruneWorktreesAction')}</span>
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {worktrees.map((worktree, index) => {
                          const worktreeKey = getProjectGitWorktreeKey(worktree);
                          const displayName = getProjectGitWorktreeDisplayName(worktree);
                          const canRemove = isProjectGitWorktreeRemovable(worktree);
                          return (
                            <div
                              key={worktreeKey || `${worktree.branch?.trim() || 'worktree'}:${worktree.head?.trim() || index}`}
                              className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 ${worktree.isCurrent ? 'bg-blue-500/[0.13]' : 'hover:bg-white/[0.04]'}`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {worktree.isCurrent ? <Check size={14} className="shrink-0 text-blue-300" /> : null}
                                  <span className="truncate text-[12px] font-medium text-gray-100">{displayName || 'N/A'}</span>
                                </div>
                                {worktreeKey && displayName !== worktreeKey ? (
                                  <div className="truncate pl-6 font-mono text-[11px] text-gray-500">{worktreeKey}</div>
                                ) : null}
                              </div>
                              {canRemove ? (
                                <button
                                  type="button"
                                  disabled={isRemovingWorktree && removingWorktreeKey === worktreeKey}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-500/[0.12] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() => {
                                    void handleRemoveWorktree(worktree);
                                  }}
                                  aria-label={t('code.removeWorktreeAction')}
                                  title={t('code.removeWorktreeAction')}
                                >
                                  {isRemovingWorktree && removingWorktreeKey === worktreeKey
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Trash2 size={13} />}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-2 px-3 pb-1">
                        <input
                          value={newWorktreeBranchName}
                          onChange={(event) => setNewWorktreeBranchName(event.target.value)}
                          placeholder={t('code.worktreeBranchName')}
                          className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2.5 text-[12px] text-white outline-none placeholder:text-gray-600 focus:border-blue-400/40"
                        />
                        <button
                          type="button"
                          disabled={!newWorktreeBranchName.trim() || isCreatingWorktree}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-blue-500/90 px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            void handleCreateWorktree();
                          }}
                        >
                          {isCreatingWorktree ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          <span>{t('code.createWorktreeAction')}</span>
                        </button>
                      </div>
                      {manageableWorktrees.length === 0 && worktrees.length <= 1 ? (
                        <div className="px-3 pb-1 text-[11px] text-gray-600">{t('code.noManagedWorktrees')}</div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
        {showBranchControl ? (
          <ProjectGitCreateBranchDialog
            branchName={newBranchName}
            isCreating={isCreatingBranch}
            isOpen={showBranchModal}
            onBranchNameChange={setNewBranchName}
            onClose={() => {
              setShowBranchModal(false);
              setNewBranchName('');
            }}
            onCreate={handleCreateBranch}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {showResolvedOverviewDrawerToggle ? (
        <button
          type="button"
          disabled={!normalizedProjectId}
          className={overviewToggleClassName}
          onClick={() => {
            if (!normalizedProjectId) {
              return;
            }
            onToggleOverviewDrawer?.();
          }}
          aria-expanded={isOverviewDrawerOpen}
          aria-haspopup="dialog"
          aria-label={overviewDrawerLabel}
          title={overviewDrawerLabel}
        >
          <FolderGit2 size={14} />
        </button>
      ) : null}
      {showBranchControl ? (
        <ProjectGitBranchMenu
          currentBranchLabel={currentBranchLabel}
          isGitRepositoryReady={isGitRepositoryReady}
          isLoading={isLoading}
          isOpen={showBranchMenu}
          loadErrorMessage={loadErrorMessage}
          normalizedProjectId={normalizedProjectId}
          onOpenChange={(nextIsOpen) => {
            setShowBranchMenu(nextIsOpen);
            if (nextIsOpen) {
              setShowWorktreeMenu(false);
              onAnyMenuOpen?.();
            }
          }}
          onRefresh={handleRefreshGitOverview}
          onRequestCreateBranch={() => {
            setNewBranchName('');
            setShowBranchModal(true);
          }}
          onSelectBranch={handleSwitchBranch}
          overview={overview}
          compact={compactControls}
          variant={variant}
        />
      ) : null}
      {showWorktreeControl ? (
        <ProjectGitWorktreeMenu
          currentWorktree={currentWorktree}
          currentWorktreeLabel={currentWorktreeLabel}
          isGitRepositoryReady={isGitRepositoryReady}
          isLoading={isLoading}
          isOpen={showWorktreeMenu}
          isPruning={isPruningWorktrees}
          loadErrorMessage={loadErrorMessage}
          normalizedProjectId={normalizedProjectId}
          onOpenChange={(nextIsOpen) => {
            setShowWorktreeMenu(nextIsOpen);
            if (nextIsOpen) {
              setShowBranchMenu(false);
              onAnyMenuOpen?.();
            }
          }}
          onPrune={handlePruneWorktrees}
          onRefresh={handleRefreshGitOverview}
          overview={overview}
          compact={compactControls}
          variant={variant}
          worktrees={worktrees}
        />
      ) : null}
      {showBranchControl ? (
        <ProjectGitCreateBranchDialog
          branchName={newBranchName}
          isCreating={isCreatingBranch}
          isOpen={showBranchModal}
          onBranchNameChange={setNewBranchName}
          onClose={() => {
            setShowBranchModal(false);
            setNewBranchName('');
          }}
          onCreate={handleCreateBranch}
        />
      ) : null}
    </>
  );
});

ProjectGitHeaderControls.displayName = 'ProjectGitHeaderControls';
