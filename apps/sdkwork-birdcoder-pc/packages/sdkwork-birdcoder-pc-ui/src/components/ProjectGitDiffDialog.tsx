import { memo, useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileDiff, Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BirdCoderProjectGitDiff } from '@sdkwork/birdcoder-pc-types';
import { useIDEServices } from '@sdkwork/birdcoder-pc-commons';

interface ProjectGitDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
}

export const ProjectGitDiffDialog = memo(function ProjectGitDiffDialog({
  isOpen,
  onClose,
  projectId,
}: ProjectGitDiffDialogProps) {
  const { t } = useTranslation();
  const { gitService } = useIDEServices();
  const normalizedProjectId = projectId?.trim() ?? '';
  const [diff, setDiff] = useState<BirdCoderProjectGitDiff | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDiff = useCallback(async () => {
    if (!normalizedProjectId) {
      setDiff(null);
      setErrorMessage(t('code.gitDiffProjectRequired'));
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setDiff(await gitService.getProjectGitDiff(normalizedProjectId));
    } catch (error) {
      setDiff(null);
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('code.gitDiffLoadFailed'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [gitService, normalizedProjectId, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadDiff();
  }, [isOpen, loadDiff]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('app.menu.viewDiff')}
        className="flex h-[min(80vh,48rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151519] shadow-2xl shadow-black/60"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-100">
            <FileDiff size={16} className="shrink-0 text-blue-300" />
            <span className="truncate">{t('app.menu.viewDiff')}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              aria-label={t('code.refreshGitDiff')}
              title={t('code.refreshGitDiff')}
              onClick={() => { void loadDiff(); }}
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.07] hover:text-white"
              aria-label={t('app.close')}
              title={t('app.close')}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {diff?.truncated ? (
          <div className="shrink-0 border-b border-amber-400/15 bg-amber-400/[0.08] px-4 py-2 text-xs text-amber-200">
            {t('code.gitDiffTruncated')}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto bg-[#0d0d10]">
          {isLoading && !diff ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 size={17} className="animate-spin" />
              <span>{t('code.loadingGitDiff')}</span>
            </div>
          ) : errorMessage ? (
            <div className="m-4 flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.08] px-3 py-3 text-sm text-red-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          ) : diff?.patch ? (
            <pre className="min-w-max whitespace-pre p-4 font-mono text-xs leading-5 text-gray-300 selection:bg-blue-500/35">
              {diff.patch}
            </pre>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              {t('code.noGitChanges')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProjectGitDiffDialog.displayName = 'ProjectGitDiffDialog';
