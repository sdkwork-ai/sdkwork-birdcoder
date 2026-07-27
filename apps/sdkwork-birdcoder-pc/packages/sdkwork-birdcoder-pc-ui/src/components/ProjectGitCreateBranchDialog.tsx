import { memo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { GitBranch, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';

interface ProjectGitCreateBranchDialogProps {
  branchName: string;
  isCreating?: boolean;
  isOpen: boolean;
  onBranchNameChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}

export const ProjectGitCreateBranchDialog = memo(function ProjectGitCreateBranchDialog({
  branchName,
  isCreating = false,
  isOpen,
  onBranchNameChange,
  onClose,
  onCreate,
}: ProjectGitCreateBranchDialogProps) {
  const { t } = useTranslation();
  const branchNameInputId = useId();
  const dialogTitleId = useId();

  useEffect(() => {
    if (!isOpen || isCreating) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreating, isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-black/70 p-4 whitespace-normal backdrop-blur-[3px] animate-in fade-in duration-200 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCreating) {
          onClose();
        }
      }}
    >
      <form
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="w-full max-w-[35rem] overflow-hidden rounded-lg border border-white/[0.12] bg-[#18181c] text-gray-200 shadow-[0_24px_80px_rgba(0,0,0,0.62)] animate-in zoom-in-95 duration-200"
        role="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (branchName.trim() && !isCreating) {
            void onCreate();
          }
        }}
      >
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#141417] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-400/20 bg-blue-500/[0.10] text-blue-300">
              <GitBranch size={18} />
            </span>
            <h2 id={dialogTitleId} className="truncate text-base font-semibold text-white">
              {t('app.createNewBranch')}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('app.close')}
            title={t('app.close')}
            disabled={isCreating}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-6 sm:px-6 sm:py-7">
          <label
            className="mb-2.5 block text-sm font-medium text-gray-200"
            htmlFor={branchNameInputId}
          >
            {t('app.branchName')}
          </label>
          <input
            id={branchNameInputId}
            name="branchName"
            type="text"
            value={branchName}
            onChange={(event) => {
              onBranchNameChange(event.target.value);
            }}
            autoComplete="off"
            autoFocus
            disabled={isCreating}
            placeholder={t('app.branchNamePlaceholder')}
            required
            spellCheck={false}
            className="block h-12 w-full rounded-md border border-white/[0.12] bg-[#0f0f12] px-4 font-mono text-sm text-gray-100 outline-none transition-[border-color,box-shadow,background-color] placeholder:font-sans placeholder:text-gray-600 hover:border-white/20 focus:border-blue-400/70 focus:bg-[#111116] focus:ring-4 focus:ring-blue-500/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-white/[0.08] bg-[#141417] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={isCreating}
            onClick={onClose}
            className="w-full border-white/[0.12] px-5 text-gray-300 sm:w-auto sm:min-w-24"
          >
            {t('app.cancel')}
          </Button>
          <Button
            type="submit"
            className="w-full gap-2 bg-blue-600 px-5 text-white shadow-[0_8px_24px_rgba(37,99,235,0.20)] hover:bg-blue-500 sm:w-auto sm:min-w-32"
            disabled={!branchName.trim() || isCreating}
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}
            <span>{t('app.createBranch')}</span>
          </Button>
        </footer>
      </form>
    </div>,
    document.body,
  );
});

ProjectGitCreateBranchDialog.displayName = 'ProjectGitCreateBranchDialog';

