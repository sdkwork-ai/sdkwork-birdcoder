import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertCircle,
  Check,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useProjectGitOverview,
  type ProjectGitOverviewViewState,
} from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useProjectGitMutationActions } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitMutationActions';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';

const MAX_COMMIT_MESSAGE_LENGTH = 500;

export type ProjectGitSubmitMode = 'commit' | 'commitAndPush';

interface ProjectGitSubmitDialogProps {
  initialMode: ProjectGitSubmitMode;
  isOpen: boolean;
  onClose: () => void;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  projectId?: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

export function ProjectGitSubmitDialog({
  initialMode,
  isOpen,
  onClose,
  projectGitOverviewState,
  projectId,
}: ProjectGitSubmitDialogProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const localOverviewState = useProjectGitOverview({
    isActive: !projectGitOverviewState && isOpen,
    projectId,
  });
  const overviewState = projectGitOverviewState ?? localOverviewState;
  const { applyGitOverview, currentBranchLabel, overview } = overviewState;
  const { commitChanges, pushBranch } = useProjectGitMutationActions({
    applyGitOverview,
    projectId,
  });
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [preferredMode, setPreferredMode] = useState<ProjectGitSubmitMode>(initialMode);
  const [phase, setPhase] = useState<'idle' | 'committing' | 'pushing'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [committedAwaitingPush, setCommittedAwaitingPush] = useState(false);

  const currentBranch = overview?.currentBranch?.trim() || currentBranchLabel.trim();
  const counts = overview?.statusCounts ?? { staged: 0, unstaged: 0, untracked: 0 };
  const totalChanges = counts.staged + counts.unstaged + counts.untracked;
  const selectedChangeCount = includeUnstaged ? totalChanges : counts.staged;
  const isBusy = phase !== 'idle';
  const normalizedMessage = commitMessage.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCommitMessage('');
    setIncludeUnstaged(true);
    setPreferredMode(initialMode);
    setPhase('idle');
    setErrorMessage('');
    setValidationMessage('');
    setCommittedAwaitingPush(false);
    window.setTimeout(() => messageRef.current?.focus(), 0);
  }, [initialMode, isOpen]);

  const closeDialog = () => {
    if (!isBusy) {
      onClose();
    }
  };

  const validateCommit = (mode: ProjectGitSubmitMode): boolean => {
    if (!normalizedMessage) {
      setValidationMessage(t('code.gitCommitMessageRequired'));
      messageRef.current?.focus();
      return false;
    }
    if (commitMessage.length > MAX_COMMIT_MESSAGE_LENGTH) {
      setValidationMessage(t('code.gitCommitMessageTooLong'));
      messageRef.current?.focus();
      return false;
    }
    if (selectedChangeCount === 0) {
      setValidationMessage(t('code.gitNoChangesToCommit'));
      return false;
    }
    if (mode === 'commitAndPush' && !currentBranch) {
      setValidationMessage(t('code.gitPushBranchRequired'));
      return false;
    }
    setValidationMessage('');
    return true;
  };

  const pushCommittedChanges = async () => {
    if (!currentBranch) {
      setValidationMessage(t('code.gitPushBranchRequired'));
      return;
    }
    setPhase('pushing');
    setErrorMessage('');
    try {
      await pushBranch({ branchName: currentBranch });
      addToast(t('code.gitCommittedAndPushed'), 'success');
      onClose();
    } catch (error) {
      setErrorMessage(
        `${t('code.gitCommitSucceededPushFailed')} ${getErrorMessage(error)}`,
      );
    } finally {
      setPhase('idle');
    }
  };

  const submit = async (mode: ProjectGitSubmitMode) => {
    if (isBusy) {
      return;
    }
    setPreferredMode(mode);
    if (committedAwaitingPush) {
      await pushCommittedChanges();
      return;
    }
    if (!validateCommit(mode)) {
      return;
    }

    setPhase('committing');
    setErrorMessage('');
    try {
      await commitChanges(normalizedMessage, { includeUnstaged });
      if (mode === 'commit') {
        addToast(t('code.gitCommitted'), 'success');
        onClose();
        return;
      }
      setCommittedAwaitingPush(true);
      setPhase('pushing');
      try {
        await pushBranch({ branchName: currentBranch });
        addToast(t('code.gitCommittedAndPushed'), 'success');
        onClose();
      } catch (error) {
        setErrorMessage(
          `${t('code.gitCommitSucceededPushFailed')} ${getErrorMessage(error)}`,
        );
      }
    } catch (error) {
      setErrorMessage(t('code.gitOperationFailed', { error: getErrorMessage(error) }));
    } finally {
      setPhase('idle');
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit(preferredMode);
    }
  };

  if (!isOpen) {
    return null;
  }

  const phaseLabel = phase === 'committing'
    ? t('code.gitCommitting')
    : t('code.gitPushing');

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div
        aria-label={t('code.gitSubmitTitle')}
        aria-modal="true"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1b1b1f] text-gray-200 shadow-2xl shadow-black/60"
        role="dialog"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
            <GitCommitHorizontal size={16} className="shrink-0 text-blue-300" />
            <span className="truncate">{t('code.gitSubmitTitle')}</span>
          </div>
          <button
            type="button"
            aria-label={t('code.gitCloseSubmitDialog')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            onClick={closeDialog}
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <GitBranch size={15} className="shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-gray-500">{t('code.gitCurrentBranch')}</div>
            <div className="truncate text-sm font-medium text-gray-100">{currentBranch || 'HEAD'}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[11px]">
            <span className="text-emerald-300">{t('code.gitStagedCount', { count: counts.staged })}</span>
            <span className="text-amber-300">{t('code.gitUnstagedCount', { count: counts.unstaged })}</span>
            <span className="text-gray-400">{t('code.gitUntrackedCount', { count: counts.untracked })}</span>
          </div>
        </div>

        <div className="px-4 pb-3 pt-4">
          <label className="mb-2 block text-xs font-medium text-gray-300" htmlFor="project-git-commit-message">
            {t('code.gitCommitMessage')}
            <span aria-hidden="true" className="ml-1 text-red-300">*</span>
          </label>
          <textarea
            ref={messageRef}
            id="project-git-commit-message"
            aria-describedby="project-git-commit-message-feedback project-git-commit-message-counter"
            aria-invalid={Boolean(validationMessage)}
            className="h-32 w-full resize-none bg-transparent text-[15px] leading-6 text-gray-100 outline-none placeholder:text-gray-600"
            disabled={isBusy || committedAwaitingPush}
            maxLength={MAX_COMMIT_MESSAGE_LENGTH + 1}
            placeholder={t('code.gitCommitMessagePlaceholder')}
            required
            value={commitMessage}
            onChange={(event) => {
              setCommitMessage(event.target.value);
              if (validationMessage) {
                setValidationMessage('');
              }
            }}
          />
          <div className="flex min-h-5 items-start justify-between gap-3 text-[11px]">
            <span
              id="project-git-commit-message-feedback"
              aria-live="polite"
              className={validationMessage ? 'text-red-300' : 'text-gray-600'}
            >
              {validationMessage}
            </span>
            <span
              id="project-git-commit-message-counter"
              className={commitMessage.length > MAX_COMMIT_MESSAGE_LENGTH ? 'text-red-300' : 'text-gray-600'}
            >
              {commitMessage.length}/{MAX_COMMIT_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 border-y border-white/[0.07] px-4 text-sm text-gray-200">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              className="peer h-5 w-5 appearance-none rounded border border-white/20 bg-white/[0.04] transition-colors checked:border-blue-500 checked:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              checked={includeUnstaged}
              disabled={isBusy || committedAwaitingPush}
              onChange={(event) => {
                setIncludeUnstaged(event.target.checked);
                setValidationMessage('');
              }}
            />
            <Check size={13} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" />
          </span>
          <span>{t('code.gitIncludeUnstaged')}</span>
        </label>

        {errorMessage ? (
          <div className="flex items-start gap-2 border-b border-red-400/15 bg-red-500/[0.08] px-4 py-3 text-xs leading-5 text-red-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {isBusy ? (
          <div className="flex h-12 items-center gap-2 px-4 text-sm text-gray-300">
            <Loader2 size={15} className="animate-spin text-blue-300" />
            <span>{phaseLabel}</span>
          </div>
        ) : committedAwaitingPush ? (
          <button
            type="button"
            className="flex h-12 items-center gap-3 px-4 text-left text-sm font-medium text-blue-200 transition-colors hover:bg-white/[0.06] hover:text-white"
            onClick={() => void submit('commitAndPush')}
          >
            <Upload size={16} />
            <span>{t('code.gitRetryPush')}</span>
          </button>
        ) : (
          <div className="py-1">
            <button
              type="button"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className={`flex h-11 w-full items-center gap-3 px-4 text-left text-sm transition-colors hover:bg-white/[0.06] hover:text-white ${preferredMode === 'commit' ? 'bg-white/[0.04] text-white' : 'text-gray-300'}`}
              onClick={() => void submit('commit')}
            >
              <GitCommitHorizontal size={16} className="text-gray-400" />
              <span>{t('code.gitCommitOnly')}</span>
              {preferredMode === 'commit' ? (
                <kbd className="ml-auto shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-sans text-[10px] font-normal text-gray-500">
                  Ctrl/⌘ + Enter
                </kbd>
              ) : null}
            </button>
            <button
              type="button"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className={`flex h-11 w-full items-center gap-3 px-4 text-left text-sm font-medium transition-colors hover:bg-blue-500/15 hover:text-white ${preferredMode === 'commitAndPush' ? 'bg-blue-500/10 text-blue-100' : 'text-gray-300'}`}
              onClick={() => void submit('commitAndPush')}
            >
              <Upload size={16} className="text-blue-300" />
              <span>{t('code.gitCommitAndPush')}</span>
              {preferredMode === 'commitAndPush' ? (
                <kbd className="ml-auto shrink-0 rounded border border-blue-300/15 bg-black/20 px-1.5 py-0.5 font-sans text-[10px] font-normal text-blue-200/60">
                  Ctrl/⌘ + Enter
                </kbd>
              ) : null}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
