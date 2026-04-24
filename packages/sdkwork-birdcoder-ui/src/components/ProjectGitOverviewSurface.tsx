import { memo } from 'react';
import type { UseProjectGitOverviewResult } from '@sdkwork/birdcoder-commons';
import {
  AlertCircle,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ProjectGitOverviewSectionId =
  | 'summary'
  | 'status'
  | 'branches'
  | 'worktrees';

interface ProjectGitOverviewSurfaceProps extends Pick<
  UseProjectGitOverviewResult,
  'currentWorktree' | 'isLoading' | 'loadErrorMessage' | 'normalizedProjectId' | 'overview'
> {
  bodyMaxHeight?: number | null;
  onRefresh: () => void;
  showHeader?: boolean;
  visibleSections?: readonly ProjectGitOverviewSectionId[];
}

const STATUS_COUNT_KEYS = [
  { key: 'modified', tone: 'text-amber-300 bg-amber-500/10 border-amber-400/20' },
  { key: 'staged', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20' },
  { key: 'untracked', tone: 'text-sky-300 bg-sky-500/10 border-sky-400/20' },
  { key: 'deleted', tone: 'text-rose-300 bg-rose-500/10 border-rose-400/20' },
  { key: 'conflicted', tone: 'text-red-300 bg-red-500/10 border-red-400/20' },
] as const;

const DEFAULT_VISIBLE_SECTIONS: readonly ProjectGitOverviewSectionId[] = [
  'summary',
  'status',
  'branches',
  'worktrees',
];

export const ProjectGitOverviewSurface = memo(function ProjectGitOverviewSurface({
  bodyMaxHeight = 288,
  currentWorktree,
  isLoading,
  loadErrorMessage,
  normalizedProjectId,
  onRefresh,
  overview,
  showHeader = true,
  visibleSections = DEFAULT_VISIBLE_SECTIONS,
}: ProjectGitOverviewSurfaceProps) {
  const { t } = useTranslation();
  const displayedBranches = overview?.branches.slice(0, 6) ?? [];
  const remainingBranchCount = Math.max((overview?.branches.length ?? 0) - displayedBranches.length, 0);
  const visibleSectionSet = new Set<ProjectGitOverviewSectionId>(visibleSections);
  const sectionClassName = showHeader
    ? 'shrink-0 border-b border-white/5 bg-[#121318]/80 px-3 py-3 backdrop-blur-sm'
    : undefined;
  const contentOffsetClassName = showHeader ? 'mt-3 ' : '';
  const contentScrollClassName = bodyMaxHeight == null ? '' : 'overflow-y-auto pr-1';
  const contentStyle = bodyMaxHeight == null ? undefined : { maxHeight: bodyMaxHeight };

  return (
    <section className={sectionClassName}>
      {showHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2.5">
            <div className="mt-0.5 rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-gray-300">
              <FolderGit2 size={14} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-200">
                {t('code.gitOverview')}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {normalizedProjectId
                  ? overview?.repositoryRootPath || currentWorktree?.path || t('code.loadingGitOverview')
                  : t('code.selectProjectFirst')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={!normalizedProjectId || isLoading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-gray-400 transition hover:border-white/20 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('code.refreshGitOverview')}
            title={t('code.refreshGitOverview')}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      ) : null}

      {!normalizedProjectId ? (
        <div className={`${contentOffsetClassName}rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-[12px] text-gray-500`}>
          {t('code.selectProjectFirst')}
        </div>
      ) : loadErrorMessage ? (
        <div className={`${contentOffsetClassName}flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-3 text-[12px] text-red-200`}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">
            {loadErrorMessage || t('code.gitOverviewUnavailable')}
          </span>
        </div>
      ) : overview?.status !== 'ready' ? (
        <div className={`${contentOffsetClassName}rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-[12px] text-gray-500`}>
          {t('app.menu.noRepository')}
        </div>
      ) : (
        <div className={`${contentOffsetClassName}space-y-3 ${contentScrollClassName}`.trim()} style={contentStyle}>
          {visibleSectionSet.has('summary') ? (
            <div className="space-y-2 rounded-lg border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                <GitBranch size={12} />
                <span>{t('code.currentBranch')}</span>
              </div>
              <div className="truncate text-[13px] font-medium text-gray-100">
                {overview.currentBranch || (overview.detachedHead ? t('code.detachedHead') : 'HEAD')}
              </div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                <GitCommitHorizontal size={12} />
                <span>{t('code.currentRevision')}</span>
              </div>
              <div className="truncate font-mono text-[12px] text-gray-300">
                {overview.currentRevision?.slice(0, 12) || 'N/A'}
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                {t('code.currentWorktree')}
              </div>
              <div className="truncate text-[12px] text-gray-200">
                {currentWorktree?.label || currentWorktree?.path || 'N/A'}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {currentWorktree?.branch || currentWorktree?.path || overview.repositoryRootPath}
              </div>
            </div>
          ) : null}

          {visibleSectionSet.has('status') ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                {t('code.status')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_COUNT_KEYS.map(({ key, tone }) => (
                  <div
                    key={key}
                    className={`rounded-lg border px-2.5 py-2 text-[11px] ${tone}`}
                  >
                    <div className="uppercase tracking-[0.12em] opacity-75">
                      {t(`code.${key}`)}
                    </div>
                    <div className="mt-1 text-[15px] font-semibold text-gray-100">
                      {overview.statusCounts[key]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {visibleSectionSet.has('branches') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  {t('code.branches')}
                </div>
                <div className="text-[11px] text-gray-500">
                  {overview.branches.length}
                </div>
              </div>
              <div className="space-y-1.5">
                {displayedBranches.map((branch) => (
                  <div
                    key={branch.name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {branch.isCurrent ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                        ) : null}
                        <div className="truncate text-[12px] font-medium text-gray-200">
                          {branch.name}
                        </div>
                      </div>
                      {branch.upstreamName ? (
                        <div className="truncate pl-4 text-[11px] text-gray-500">
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
                  </div>
                ))}
                {remainingBranchCount > 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 px-2.5 py-2 text-[11px] text-gray-500">
                    +{remainingBranchCount} {t('code.branches')}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {visibleSectionSet.has('worktrees') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                  {t('code.worktrees')}
                </div>
                <div className="text-[11px] text-gray-500">
                  {overview.worktrees.length}
                </div>
              </div>
              <div className="space-y-1.5">
                {overview.worktrees.map((worktree) => (
                  <div
                    key={worktree.id}
                    className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {worktree.isCurrent ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                        ) : null}
                        <div className="truncate text-[12px] font-medium text-gray-200">
                          {worktree.label}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[10px] text-gray-400">
                        {worktree.isLocked ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5">
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
                    <div className="mt-1 truncate text-[11px] text-gray-500">
                      {worktree.path}
                    </div>
                    {worktree.branch || worktree.head ? (
                      <div className="mt-1 truncate text-[11px] text-gray-400">
                        {worktree.branch || worktree.head}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
});
