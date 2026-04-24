import { memo, useEffect, useRef } from 'react';
import type { UseProjectGitOverviewResult } from '@sdkwork/birdcoder-commons';
import {
  AlertCircle,
  Check,
  ChevronDown,
  FolderGit2,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ProjectGitWorktreeMenuVariant = 'topbar' | 'studio';

interface ProjectGitWorktreeMenuProps extends Pick<
  UseProjectGitOverviewResult,
  | 'currentWorktree'
  | 'currentWorktreeLabel'
  | 'isGitRepositoryReady'
  | 'isLoading'
  | 'loadErrorMessage'
  | 'normalizedProjectId'
  | 'overview'
  | 'worktrees'
> {
  isOpen: boolean;
  isPruning?: boolean;
  onOpenChange: (open: boolean) => void;
  onPrune?: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  variant: ProjectGitWorktreeMenuVariant;
}

interface ProjectGitWorktreeMenuVariantStyle {
  button: string;
  buttonIconTone: string;
  buttonLabel: string;
  buttonValue: string;
  container: string;
  menu: string;
}

function getVariantStyle(
  variant: ProjectGitWorktreeMenuVariant,
): ProjectGitWorktreeMenuVariantStyle {
  switch (variant) {
    case 'studio':
      return {
        button:
          'group flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs shadow-sm shadow-black/20 transition-colors',
        buttonIconTone: 'text-emerald-400',
        buttonLabel:
          'text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 group-hover:text-gray-400',
        buttonValue: 'min-w-0 max-w-[160px] truncate font-medium text-gray-100',
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl shadow-black/45 backdrop-blur-md',
      };
    case 'topbar':
    default:
      return {
        button:
          'flex items-center gap-1.5 rounded-md border border-white/5 px-2.5 py-1.5 text-xs transition-colors',
        buttonIconTone: 'text-emerald-400',
        buttonLabel: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500',
        buttonValue: 'max-w-[160px] truncate font-medium text-gray-200',
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right',
      };
  }
}

export const ProjectGitWorktreeMenu = memo(function ProjectGitWorktreeMenu({
  currentWorktree,
  currentWorktreeLabel,
  isGitRepositoryReady,
  isLoading,
  isOpen,
  isPruning = false,
  loadErrorMessage,
  normalizedProjectId,
  onOpenChange,
  onPrune,
  onRefresh,
  overview,
  variant,
  worktrees,
}: ProjectGitWorktreeMenuProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const variantStyle = getVariantStyle(variant);
  const hasPrunableWorktrees = worktrees.some((worktree) => worktree.isPrunable);
  const buttonValue = loadErrorMessage
    ? t('code.gitOverviewUnavailable')
    : currentWorktreeLabel || (isLoading ? '...' : t('app.menu.noRepository'));
  const buttonClassName =
    variant === 'studio'
      ? `${variantStyle.button} ${
          isOpen
            ? 'border-white/20 bg-[#1a1b22] text-white'
            : 'border-white/10 bg-[#15161b] text-gray-100 hover:border-white/15 hover:bg-[#1a1b22]'
        } ${!normalizedProjectId ? 'cursor-not-allowed opacity-60' : ''}`
      : `${variantStyle.button} ${
          normalizedProjectId
            ? 'cursor-pointer bg-white/5 hover:bg-white/10'
            : 'cursor-not-allowed bg-white/[0.03] text-gray-500 opacity-60'
        }`;

  useEffect(() => {
    if (normalizedProjectId || !isOpen) {
      return;
    }

    onOpenChange(false);
  }, [isOpen, normalizedProjectId, onOpenChange]);

  useEffect(() => {
    if (!isOpen || !normalizedProjectId) {
      return;
    }

    void onRefresh();
  }, [isOpen, normalizedProjectId, onRefresh]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div ref={rootRef} className={variantStyle.container}>
      <button
        type="button"
        disabled={!normalizedProjectId}
        className={buttonClassName}
        onClick={() => {
          if (!normalizedProjectId) {
            return;
          }
          onOpenChange(!isOpen);
        }}
      >
        <span className={variantStyle.buttonIconTone}>
          <FolderGit2 size={14} />
        </span>
        <span className={variantStyle.buttonLabel}>{t('app.menu.worktree')}</span>
        <span className={variantStyle.buttonValue}>{buttonValue}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180 text-gray-300' : ''}`}
        />
      </button>

      {isOpen ? (
        <div className={variantStyle.menu}>
          <div className="flex items-start justify-between gap-3 border-b border-white/8 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                {t('app.menu.worktree')}
              </div>
              <div className="truncate text-[11px] text-gray-600">
                {currentWorktree?.path || overview?.repositoryRootPath || ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-gray-400 transition hover:border-white/20 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  void onRefresh();
                }}
                disabled={!normalizedProjectId || isLoading}
                aria-label={t('code.refreshGitOverview')}
                title={t('code.refreshGitOverview')}
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
              {onPrune ? (
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-gray-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    void onPrune();
                  }}
                  disabled={!isGitRepositoryReady || !hasPrunableWorktrees || isPruning}
                  title={t('code.pruneWorktreesAction')}
                >
                  {isPruning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>{t('code.pruneWorktreesAction')}</span>
                </button>
              ) : null}
            </div>
          </div>

          {!normalizedProjectId ? (
            <div className="px-3 py-3 text-[12px] text-gray-500">
              {t('code.selectProjectFirst')}
            </div>
          ) : loadErrorMessage ? (
            <div className="m-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-3 text-[12px] text-red-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{loadErrorMessage}</span>
            </div>
          ) : !isGitRepositoryReady ? (
            <div className="px-3 py-3 text-[12px] text-gray-500">
              {t('app.menu.noRepository')}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto px-1 py-1.5">
              {worktrees.map((worktree) => (
                <div
                  key={worktree.id}
                  className={`mx-1 rounded-xl border px-3 py-2 ${
                    worktree.isCurrent
                      ? 'border-blue-500/20 bg-blue-500/10'
                      : 'border-white/8 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {worktree.isCurrent ? (
                          <Check size={14} className="mt-0.5 shrink-0 text-blue-300" />
                        ) : null}
                        <div className="truncate text-[12px] font-medium text-gray-100">
                          {worktree.label}
                        </div>
                      </div>
                      <div className="truncate pl-6 text-[11px] text-gray-500">
                        {worktree.path}
                      </div>
                      {worktree.branch || worktree.head ? (
                        <div className="truncate pl-6 text-[11px] text-gray-400">
                          {worktree.branch || worktree.head}
                        </div>
                      ) : null}
                      {worktree.prunableReason ? (
                        <div className="truncate pl-6 text-[11px] text-red-200/80">
                          {worktree.prunableReason}
                        </div>
                      ) : null}
                      {worktree.lockedReason ? (
                        <div className="truncate pl-6 text-[11px] text-gray-500">
                          {worktree.lockedReason}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[10px] text-gray-400">
                      {worktree.isLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-gray-300">
                          <Lock size={10} />
                          {t('code.locked')}
                        </span>
                      ) : null}
                      {worktree.isPrunable ? (
                        <span className="rounded-full border border-red-400/20 bg-red-500/10 px-1.5 py-0.5 text-red-200">
                          {t('code.prunable')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});

ProjectGitWorktreeMenu.displayName = 'ProjectGitWorktreeMenu';
