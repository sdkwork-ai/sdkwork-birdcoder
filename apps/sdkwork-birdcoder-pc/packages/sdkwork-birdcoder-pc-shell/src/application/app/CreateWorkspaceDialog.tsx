import {
  memo,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Boxes, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreateWorkspaceDialogProps {
  isCreating: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  workspaceName: string;
}

const focusableElementSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const CreateWorkspaceDialog = memo(function CreateWorkspaceDialog({
  isCreating,
  isOpen,
  onClose,
  onNameChange,
  onSubmit,
  workspaceName,
}: CreateWorkspaceDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isCreating, isOpen, onClose]);

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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 animate-in fade-in duration-150"
      data-no-drag="true"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !isCreating) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        aria-labelledby="birdcoder-create-workspace-title"
        aria-modal="true"
        className="w-full max-w-[480px] overflow-hidden rounded-lg border border-white/[0.09] bg-[#202125] text-gray-100 shadow-[0_20px_64px_rgba(0,0,0,0.58)] animate-in zoom-in-95 duration-150"
        role="dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <form onSubmit={onSubmit}>
          <header className="flex h-14 items-center justify-between gap-4 px-5">
            <h2
              id="birdcoder-create-workspace-title"
              className="truncate text-sm font-semibold text-gray-100"
            >
              {t('app.createWorkspaceDialogTitle')}
            </h2>
            <button
              type="button"
              aria-label={t('app.closeCreateWorkspaceDialog')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isCreating}
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </header>

          <div className="px-5 pb-5">
            <label
              className="mb-2 block text-xs font-medium text-gray-400"
              htmlFor="birdcoder-create-workspace-name"
            >
              {t('app.workspaceName')}
            </label>
            <div className="flex h-11 overflow-hidden rounded-md bg-white/[0.045] ring-1 ring-inset ring-white/[0.08] transition-shadow focus-within:ring-blue-400/55">
              <span className="flex w-11 shrink-0 items-center justify-center text-gray-500">
                <Boxes size={16} strokeWidth={1.8} />
              </span>
              <input
                id="birdcoder-create-workspace-name"
                type="text"
                autoComplete="off"
                autoFocus
                disabled={isCreating}
                value={workspaceName}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={t('app.workspaceNamePlaceholder')}
                className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-white outline-none placeholder:text-gray-600 disabled:opacity-50"
              />
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-2 bg-black/10 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="h-9 rounded-md px-4 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isCreating}
              onClick={onClose}
            >
              {t('app.cancel')}
            </button>
            <button
              type="submit"
              className="flex h-9 min-w-32 items-center justify-center gap-2 rounded-md bg-white px-4 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!workspaceName.trim() || isCreating}
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : null}
              {isCreating ? t('app.creatingWorkspace') : t('app.createWorkspaceAction')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
});

CreateWorkspaceDialog.displayName = 'CreateWorkspaceDialog';
