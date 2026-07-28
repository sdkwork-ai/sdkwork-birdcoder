import type { ReactNode, RefObject } from 'react';
import { Check, Folder, FolderPlus, ListFilter, RefreshCw, Search } from 'lucide-react';
import { WorkbenchNewSessionButton } from '@sdkwork/birdcoder-pc-ui/components/WorkbenchNewSessionButton';
import type {
  ProjectExplorerOrganizeBy,
  ProjectExplorerSessionFilter,
  ProjectExplorerSortBy,
} from './ProjectExplorer.shared';

interface ProjectExplorerHeaderProps {
  children?: ReactNode;
  scrollRegionRef?: RefObject<HTMLDivElement | null>;
  selectedProjectId?: string | null;
  showFilterMenu: boolean;
  showSearch: boolean;
  organizeBy: ProjectExplorerOrganizeBy;
  sortBy: ProjectExplorerSortBy;
  showArchived: boolean;
  providerFilterId: string;
  providerOptions: readonly { id: string; label: string }[];
  sessionFilter: ProjectExplorerSessionFilter;
  isRefreshingSelectedProject: boolean;
  refreshSessionsLabel: string;
  refreshingSessionsLabel: string;
  newSessionLabel: string;
  newSessionInCurrentProjectLabel: string;
  selectProjectFirstLabel: string;
  currentSessionEngineId?: string | null;
  currentSessionModelId?: string | null;
  selectedEngineId: string;
  selectedModelId: string;
  sessionsLabel: string;
  searchSessionsTitleLabel: string;
  newProjectLabel: string;
  openFolderLabel: string;
  organizeLabel: string;
  byProjectLabel: string;
  byProviderLabel: string;
  chronologicalLabel: string;
  sortByLabel: string;
  smartLabel: string;
  recentLabel: string;
  createdLabel: string;
  showLabel: string;
  allSessionsLabel: string;
  relevantLabel: string;
  providerLabel: string;
  anyProviderLabel: string;
  statusLabel: string;
  attentionLabel: string;
  executingLabel: string;
  failedLabel: string;
  pinnedLabel: string;
  unreadLabel: string;
  filterMenuRef: RefObject<HTMLDivElement | null>;
  onCreateSession: (engineId: string, modelId: string) => void | Promise<void>;
  onRefreshSelectedProject?: () => void;
  onToggleSearch: (trigger: HTMLButtonElement) => void;
  onCreateProject: () => void | Promise<void>;
  onOpenFolder?: () => void;
  onToggleFilterMenu: () => void;
  onOrganizeByProject: () => void;
  onOrganizeByProvider: () => void;
  onOrganizeChronologically: () => void;
  onSortByCreated: () => void;
  onSortBySmart: () => void;
  onSortByRecent: () => void;
  onShowAllSessions: () => void;
  onShowRelevantSessions: () => void;
  onProviderFilterChange: (providerId: string) => void;
  onSessionFilterChange: (filter: ProjectExplorerSessionFilter) => void;
}

export function ProjectExplorerHeader({
  children,
  scrollRegionRef,
  selectedProjectId,
  showFilterMenu,
  showSearch,
  organizeBy,
  sortBy,
  showArchived,
  providerFilterId,
  providerOptions,
  sessionFilter,
  isRefreshingSelectedProject,
  refreshSessionsLabel,
  refreshingSessionsLabel,
  newSessionLabel,
  newSessionInCurrentProjectLabel,
  selectProjectFirstLabel,
  currentSessionEngineId,
  currentSessionModelId,
  selectedEngineId,
  selectedModelId,
  sessionsLabel,
  searchSessionsTitleLabel,
  newProjectLabel,
  openFolderLabel,
  organizeLabel,
  byProjectLabel,
  byProviderLabel,
  chronologicalLabel,
  sortByLabel,
  smartLabel,
  recentLabel,
  createdLabel,
  showLabel,
  allSessionsLabel,
  relevantLabel,
  providerLabel,
  anyProviderLabel,
  statusLabel,
  attentionLabel,
  executingLabel,
  failedLabel,
  pinnedLabel,
  unreadLabel,
  filterMenuRef,
  onCreateSession,
  onRefreshSelectedProject,
  onToggleSearch,
  onCreateProject,
  onOpenFolder,
  onToggleFilterMenu,
  onOrganizeByProject,
  onOrganizeByProvider,
  onOrganizeChronologically,
  onSortByCreated,
  onSortBySmart,
  onSortByRecent,
  onShowAllSessions,
  onShowRelevantSessions,
  onProviderFilterChange,
  onSessionFilterChange,
}: ProjectExplorerHeaderProps) {
  const newSessionTitle = selectedProjectId
    ? newSessionInCurrentProjectLabel
    : selectProjectFirstLabel;

  return (
    <>
      <style>
        {`
          .project-explorer-scroll-region {
            scrollbar-width: none;
            scrollbar-color: transparent transparent;
          }

          .project-explorer-scroll-region:hover {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
          }

          .project-explorer-scroll-region::-webkit-scrollbar {
            width: 0;
            height: 0;
          }

          .project-explorer-scroll-region:hover::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .project-explorer-scroll-region::-webkit-scrollbar-track {
            background: transparent;
          }

          .project-explorer-scroll-region::-webkit-scrollbar-thumb {
            background: transparent;
            border: 2px solid transparent;
            border-radius: 9999px;
            background-clip: padding-box;
          }

          .project-explorer-scroll-region:hover::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.18);
            background-clip: padding-box;
          }

          .project-explorer-scroll-region:hover::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.28);
            background-clip: padding-box;
          }
        `}
      </style>
      <div className="birdcoder-sidebar-session-create p-3 flex shrink-0 flex-col gap-2">
        <WorkbenchNewSessionButton
          buttonLabel={newSessionLabel}
          currentSessionEngineId={currentSessionEngineId}
          currentSessionModelId={currentSessionModelId}
          disabled={!selectedProjectId}
          disabledTitle={newSessionTitle}
          menuLabel={newSessionLabel}
          selectedEngineId={selectedEngineId}
          selectedModelId={selectedModelId}
          variant="sidebar"
          onCreateSession={onCreateSession}
        />
      </div>

      <div className="shrink-0 px-1 pt-2">
        <div
          className="flex items-center justify-between text-gray-400 text-xs mb-3 px-2 relative font-semibold tracking-wider uppercase animate-in fade-in slide-in-from-left-4 fill-mode-both"
          style={{ animationDelay: '100ms' }}
        >
          <span>{sessionsLabel}</span>
          <div className="flex gap-2 items-center">
            {selectedProjectId && onRefreshSelectedProject && (
              <button
                type="button"
                className="text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRefreshingSelectedProject}
                title={isRefreshingSelectedProject ? refreshingSessionsLabel : refreshSessionsLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  onRefreshSelectedProject();
                }}
              >
                <RefreshCw
                  size={14}
                  className={isRefreshingSelectedProject ? 'animate-spin' : ''}
                />
              </button>
            )}
            <button
              type="button"
              aria-expanded={showSearch}
              aria-haspopup="dialog"
              aria-label={searchSessionsTitleLabel}
              title={searchSessionsTitleLabel}
              className="text-inherit"
              onClick={(event) => onToggleSearch(event.currentTarget)}
            >
              <Search
                size={14}
                aria-hidden="true"
                className={`cursor-pointer hover:text-white transition-colors ${showSearch ? 'text-white' : ''}`}
              />
            </button>
            <button
              type="button"
              title={newProjectLabel}
              className="text-inherit"
              onClick={() => {
                void onCreateProject();
              }}
            >
              <FolderPlus size={14} className="cursor-pointer hover:text-white transition-colors" />
            </button>
            {onOpenFolder && (
              <button
                type="button"
                title={openFolderLabel}
                className="text-inherit"
                onClick={onOpenFolder}
              >
                <Folder size={14} className="cursor-pointer hover:text-white transition-colors" />
              </button>
            )}
            <button
              type="button"
              title={organizeLabel}
              className="text-inherit"
              onClick={onToggleFilterMenu}
            >
              <ListFilter
                size={14}
                className={`cursor-pointer hover:text-white transition-colors ${showFilterMenu ? 'text-white' : ''}`}
              />
            </button>
          </div>

          {showFilterMenu && (
            <div
              ref={filterMenuRef}
              className="birdcoder-chrome-menu absolute right-0 top-6 max-h-[min(70vh,560px)] w-52 overflow-y-auto backdrop-blur-xl border rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
            >
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{organizeLabel}</div>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onOrganizeByProject}
              >
                <span>{byProjectLabel}</span>
                {organizeBy === 'project' && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onOrganizeByProvider}
              >
                <span>{byProviderLabel}</span>
                {organizeBy === 'provider' && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onOrganizeChronologically}
              >
                <span>{chronologicalLabel}</span>
                {organizeBy === 'chronological' && <Check size={14} className="text-gray-400" />}
              </button>

              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{providerLabel}</div>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => onProviderFilterChange('all')}
              >
                <span>{anyProviderLabel}</span>
                {providerFilterId === 'all' && <Check size={14} className="text-gray-400" />}
              </button>
              {providerOptions.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => onProviderFilterChange(provider.id)}
                >
                  <span className="truncate">{provider.label}</span>
                  {providerFilterId === provider.id && <Check size={14} className="shrink-0 text-gray-400" />}
                </button>
              ))}

              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{statusLabel}</div>
              {([
                ['all', allSessionsLabel],
                ['attention', attentionLabel],
                ['executing', executingLabel],
                ['failed', failedLabel],
                ['pinned', pinnedLabel],
                ['unread', unreadLabel],
              ] as const).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => onSessionFilterChange(filter)}
                >
                  <span>{label}</span>
                  {sessionFilter === filter && <Check size={14} className="text-gray-400" />}
                </button>
              ))}

              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{sortByLabel}</div>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onSortBySmart}
              >
                <span>{smartLabel}</span>
                {sortBy === 'smart' && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onSortByRecent}
              >
                <span>{recentLabel}</span>
                {sortBy === 'recent' && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onSortByCreated}
              >
                <span>{createdLabel}</span>
                {sortBy === 'created' && <Check size={14} className="text-gray-400" />}
              </button>
              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{showLabel}</div>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onShowAllSessions}
              >
                <span>{allSessionsLabel}</span>
                {showArchived && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onShowRelevantSessions}
              >
                <span>{relevantLabel}</span>
                {!showArchived && <Check size={14} className="text-gray-400" />}
              </button>
            </div>
          )}
        </div>

      </div>

      <div
        ref={scrollRegionRef}
        className="project-explorer-scroll-region px-1 pb-2 flex-1 min-h-0 overflow-y-auto"
      >
        {children}
      </div>
    </>
  );
}

