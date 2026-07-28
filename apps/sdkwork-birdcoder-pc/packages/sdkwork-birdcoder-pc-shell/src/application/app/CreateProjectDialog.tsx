import {
  memo,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Folder, FolderOpen, FolderPlus, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreateProjectDialogProps {
  isCreating: boolean;
  isOpen: boolean;
  isSelectingSourceFolder: boolean;
  onClearSourceFolder: () => void;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSelectSourceFolder: () => void | Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  projectName: string;
  sourceFolderName: string | null;
}

const focusableElementSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const CreateProjectDialog = memo(function CreateProjectDialog({
  isCreating,
  isOpen,
  isSelectingSourceFolder,
  onClearSourceFolder,
  onClose,
  onNameChange,
  onSelectSourceFolder,
  onSubmit,
  projectName,
  sourceFolderName,
}: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isBusy = isCreating || isSelectingSourceFolder;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isBusy, isOpen, onClose]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableElementSelector) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby="birdcoder-create-project-title"
        aria-modal="true"
        className="w-full max-w-[760px] overflow-hidden rounded-lg border border-white/10 bg-[#28282b] text-gray-100 shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-150"
        role="dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <form onSubmit={onSubmit}>
          <header className="flex items-center justify-between gap-4 px-7 pb-5 pt-7 sm:px-8 sm:pt-8">
            <h2 id="birdcoder-create-project-title" className="text-xl font-semibold text-white sm:text-2xl">
              {t('app.createProjectDialogTitle')}
            </h2>
            <button
              type="button"
              aria-label={t('app.closeCreateProjectDialog')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isBusy}
              onClick={onClose}
            >
              <X size={19} />
            </button>
          </header>

          <div className="space-y-6 px-7 pb-7 sm:px-8">
            <div>
              <label className="sr-only" htmlFor="birdcoder-create-project-name">
                {t('app.projectName')}
              </label>
              <div className="flex h-14 overflow-hidden rounded-lg border border-blue-400/80 bg-[#2b2b2e] shadow-[0_0_0_1px_rgba(96,165,250,0.08)] focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-400/15">
                <span className="flex w-14 shrink-0 items-center justify-center border-r border-white/10 text-gray-200">
                  <Folder size={20} strokeWidth={1.8} />
                </span>
                <input
                  id="birdcoder-create-project-name"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  disabled={isCreating}
                  value={projectName}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder={t('app.projectNamePlaceholder')}
                  className="min-w-0 flex-1 bg-transparent px-4 text-base text-white outline-none placeholder:text-gray-500 disabled:opacity-50"
                />
              </div>
            </div>

            <section aria-labelledby="birdcoder-source-folders-label">
              <h3 id="birdcoder-source-folders-label" className="mb-3 text-sm font-semibold text-white sm:text-base">
                {t('app.sourceFolders')}
              </h3>
              <div className="relative flex min-h-36 items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#29292c] transition-colors focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-400/10 hover:border-white/15">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 px-8 py-6 text-center text-gray-100 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onClick={() => void onSelectSourceFolder()}
                >
                  {isSelectingSourceFolder ? (
                    <Loader2 size={26} className="animate-spin text-gray-400" />
                  ) : sourceFolderName ? (
                    <FolderOpen size={27} className="text-blue-300" strokeWidth={1.7} />
                  ) : (
                    <FolderPlus size={27} className="text-gray-400" strokeWidth={1.7} />
                  )}
                  <span className="max-w-full break-words text-sm font-medium sm:text-base">
                    {isSelectingSourceFolder
                      ? t('app.selectingSourceFolder')
                      : sourceFolderName ?? t('app.addSourceFolder')}
                  </span>
                </button>
                {sourceFolderName && !isBusy ? (
                  <button
                    type="button"
                    aria-label={t('app.removeSourceFolder', { name: sourceFolderName })}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                    onClick={onClearSourceFolder}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </section>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-white/[0.07] px-7 py-5 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              className="h-11 rounded-lg px-5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isBusy}
              onClick={onClose}
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!projectName.trim() || isBusy}
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : null}
              {isCreating ? t('app.creatingProject') : t('app.createProjectAction')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
});

CreateProjectDialog.displayName = 'CreateProjectDialog';
