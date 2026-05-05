import { memo, useCallback, useEffect, useState } from 'react';
import {
  type ProjectGitOverviewViewState,
  useProjectGitMutationActions,
  useProjectGitOverview,
  useToast,
} from '@sdkwork/birdcoder-commons';
import { FolderGit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectGitBranchMenu } from './ProjectGitBranchMenu';
import { ProjectGitCreateBranchDialog } from './ProjectGitCreateBranchDialog';
import { ProjectGitWorktreeMenu } from './ProjectGitWorktreeMenu';

export type ProjectGitHeaderControlsVariant = 'topbar' | 'studio';

interface ProjectGitHeaderControlsProps {
  compactControls?: boolean;
  isOverviewDrawerOpen?: boolean;
  onAnyMenuOpen?: () => void;
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
  const [showWorktreeMenu, setShowWorktreeMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
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
    isCreatingBranch,
    isPruningWorktrees,
    pruneWorktrees,
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
    setShowWorktreeMenu(false);
    setNewBranchName('');
  }, [normalizedProjectId]);

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
