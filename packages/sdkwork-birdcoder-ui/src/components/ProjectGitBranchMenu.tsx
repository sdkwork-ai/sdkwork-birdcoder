import { memo, useEffect, useRef } from 'react';
import type { UseProjectGitOverviewResult } from '@sdkwork/birdcoder-commons';
import {
  AlertCircle,
  Check,
  ChevronDown,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ProjectGitBranchMenuVariant = 'topbar' | 'studio';

interface ProjectGitBranchMenuProps extends Pick<
  UseProjectGitOverviewResult,
  | 'currentBranchLabel'
  | 'isGitRepositoryReady'
  | 'isLoading'
  | 'loadErrorMessage'
  | 'normalizedProjectId'
  | 'overview'
> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onRequestCreateBranch?: () => void;
  onSelectBranch: (branchName: string) => void | Promise<void>;
  variant: ProjectGitBranchMenuVariant;
}

interface ProjectGitBranchMenuVariantStyle {
  button: string;
  container: string;
  menu: string;
}

function getVariantStyle(
  variant: ProjectGitBranchMenuVariant,
): ProjectGitBranchMenuVariantStyle {
  switch (variant) {
    case 'studio':
      return {
        button:
          'group flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs shadow-sm shadow-black/20 transition-colors',
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#17181d] shadow-2xl shadow-black/45 backdrop-blur-md',
      };
    case 'topbar':
    default:
      return {
        button:
          'flex items-center gap-1.5 rounded-md border border-white/5 px-2.5 py-1.5 text-xs transition-colors',
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 text-[13px] text-gray-300 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right',
      };
  }
}

export const ProjectGitBranchMenu = memo(function ProjectGitBranchMenu({
  currentBranchLabel,
  isGitRepositoryReady,
  isLoading,
  isOpen,
  loadErrorMessage,
  normalizedProjectId,
  onOpenChange,
  onRefresh,
  onRequestCreateBranch,
  onSelectBranch,
  overview,
  variant,
}: ProjectGitBranchMenuProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const variantStyle = getVariantStyle(variant);
  const branches = overview?.branches ?? [];
  const buttonValue = loadErrorMessage
    ? t('code.gitOverviewUnavailable')
    : currentBranchLabel || (isLoading ? '...' : t('app.menu.noRepository'));
  const buttonClassName =
    variant === 'studio'
      ? `${variantStyle.button} ${
          isOpen
            ? 'border-white/20 bg-[#1a1b22] text-white'
            : 'border-white/10 bg-[#15161b] text-gray-100 hover:border-white/15 hover:bg-[#1a1b22]'
        } ${!normalizedProjectId ? 'cursor-not-allowed opacity-60' : ''}`
      : `${variantStyle.button} ${
          isGitRepositoryReady
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
        disabled={!normalizedProjectId || !isGitRepositoryReady}
        className={buttonClassName}
        onClick={() => {
          if (!normalizedProjectId || !isGitRepositoryReady) {
            return;
          }
          onOpenChange(!isOpen);
        }}
      >
        <span className="shrink-0 text-blue-400">
          <GitBranch size={14} />
        </span>
        {variant === 'studio' ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500 group-hover:text-gray-400">
            {t('code.currentBranch')}
          </span>
        ) : null}
        <span className={variant === 'studio' ? 'min-w-0 max-w-[160px] truncate font-medium text-gray-100' : 'font-medium'}>
          {buttonValue}
        </span>
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
                {t('code.branches')}
              </div>
              <div className="truncate text-[11px] text-gray-600">
                {overview?.currentRevision?.slice(0, 12) || overview?.repositoryRootPath || ''}
              </div>
            </div>
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
          </div>

          {loadErrorMessage ? (
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
              {branches.map((branch) => (
                <button
                  key={branch.name}
                  type="button"
                  className={`mx-1 flex w-[calc(100%-0.5rem)] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${
                    branch.isCurrent
                      ? 'border-blue-500/20 bg-blue-500/10'
                      : 'border-white/8 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.05]'
                  }`}
                  onClick={() => {
                    onOpenChange(false);
                    void onSelectBranch(branch.name);
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {branch.isCurrent ? (
                        <Check size={14} className="shrink-0 text-blue-300" />
                      ) : null}
                      <div className="truncate text-[12px] font-medium text-gray-100">
                        {branch.name}
                      </div>
                    </div>
                    {branch.upstreamName ? (
                      <div className="truncate pl-6 text-[11px] text-gray-500">
                        {branch.upstreamName}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[10px] text-gray-400">
                    {branch.ahead > 0 ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">
                        {t('code.ahead')} {branch.ahead}
                      </span>
                    ) : null}
                    {branch.behind > 0 ? (
                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-200">
                        {t('code.behind')} {branch.behind}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}

          {onRequestCreateBranch ? (
            <>
              <div className="my-1.5 h-px bg-white/8" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => {
                  onOpenChange(false);
                  onRequestCreateBranch();
                }}
              >
                <Plus size={14} className="text-gray-400" />
                <span>{t('app.menu.newBranch')}</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

ProjectGitBranchMenu.displayName = 'ProjectGitBranchMenu';
