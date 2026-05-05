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
  compact?: boolean;
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
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
        container: 'relative animate-in fade-in slide-in-from-top-2 fill-mode-both',
        menu:
          'absolute right-0 top-full z-[80] mt-2 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl bg-[#17171b]/98 p-2 text-[13px] text-gray-300 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-right',
      };
  }
}

export const ProjectGitBranchMenu = memo(function ProjectGitBranchMenu({
  compact = false,
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
  const isCompactTopbar = variant === 'topbar' && compact;
  const branches = overview?.branches ?? [];
  const buttonValue = loadErrorMessage
    ? t('code.gitOverviewUnavailable')
    : currentBranchLabel || (isLoading ? '...' : t('app.menu.noRepository'));
  const topbarButtonBaseClassName = isCompactTopbar
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors'
    : variantStyle.button;
  const buttonClassName =
    variant === 'studio'
      ? `${variantStyle.button} ${
          isOpen
            ? 'border-white/20 bg-[#1a1b22] text-white'
            : 'border-white/10 bg-[#15161b] text-gray-100 hover:border-white/15 hover:bg-[#1a1b22]'
        } ${!normalizedProjectId ? 'cursor-not-allowed opacity-60' : ''}`
      : `${topbarButtonBaseClassName} ${
          normalizedProjectId
            ? isOpen
              ? 'cursor-pointer bg-white/[0.07] text-white'
              : 'cursor-pointer text-gray-300 hover:bg-white/[0.06] hover:text-white'
            : 'cursor-not-allowed text-gray-500 opacity-60'
        }`;
  const compactTitle = `${t('code.currentBranch')}: ${buttonValue}`;

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
        aria-label={isCompactTopbar ? compactTitle : undefined}
        title={isCompactTopbar ? compactTitle : undefined}
        onClick={() => {
          if (!normalizedProjectId) {
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
        {!isCompactTopbar ? (
          <>
            <span className={variant === 'studio' ? 'min-w-0 max-w-[160px] truncate font-medium text-gray-100' : 'font-medium'}>
              {buttonValue}
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180 text-gray-300' : ''}`}
            />
          </>
        ) : null}
      </button>

      {isOpen ? (
        <div className={variantStyle.menu}>
          <div className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {t('code.branches')}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-gray-600">
                {overview?.currentRevision?.slice(0, 12) || overview?.repositoryRootPath || ''}
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="m-3 flex items-start gap-2 rounded-lg bg-red-500/[0.12] px-3 py-3 text-[12px] text-red-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{loadErrorMessage}</span>
            </div>
          ) : !isGitRepositoryReady ? (
            <div className="px-3 py-3 text-[12px] text-gray-500">
              {t('app.menu.noRepository')}
            </div>
          ) : (
            <div className="mt-1 max-h-80 space-y-1 overflow-y-auto py-1 pr-1">
              {branches.map((branch) => (
                <button
                  key={branch.name}
                  type="button"
                  className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    branch.isCurrent
                      ? 'bg-blue-500/[0.13]'
                      : 'hover:bg-white/[0.055]'
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
                      <div className="truncate pl-6 text-[11px] text-gray-500 group-hover:text-gray-400">
                        {branch.upstreamName}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[10px] text-gray-400">
                    {branch.ahead > 0 ? (
                      <span className="rounded-full bg-emerald-500/[0.13] px-1.5 py-0.5 text-emerald-200">
                        {t('code.ahead')} {branch.ahead}
                      </span>
                    ) : null}
                    {branch.behind > 0 ? (
                      <span className="rounded-full bg-amber-500/[0.13] px-1.5 py-0.5 text-amber-200">
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
              <div className="my-1.5 h-px bg-white/[0.06]" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
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
