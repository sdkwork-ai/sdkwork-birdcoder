import type { ReactNode, RefObject } from 'react';
import { Check, Folder, FolderPlus, ListFilter, RefreshCw, Search, X } from 'lucide-react';
import { WorkbenchNewSessionButton } from '@sdkwork/birdcoder-ui';
import type {
  ProjectExplorerOrganizeBy,
  ProjectExplorerSortBy,
} from './ProjectExplorer.shared';

interface ProjectExplorerHeaderProps {
  children?: ReactNode;
  scrollRegionRef?: RefObject<HTMLDivElement | null>;
  selectedProjectId?: string | null;
  showFilterMenu: boolean;
  showSearch: boolean;
  searchQuery: string;
  organizeBy: ProjectExplorerOrganizeBy;
  sortBy: ProjectExplorerSortBy;
  showArchived: boolean;
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
  searchSessionsPlaceholder: string;
  newProjectLabel: string;
  openFolderLabel: string;
  organizeLabel: string;
  byProjectLabel: string;
  chronologicalLabel: string;
  sortByLabel: string;
  createdLabel: string;
  updatedLabel: string;
  showLabel: string;
  allSessionsLabel: string;
  relevantLabel: string;
  filterMenuRef: RefObject<HTMLDivElement | null>;
  onCreateSession: (engineId: string, modelId: string) => void | Promise<void>;
  onRefreshSelectedProject?: () => void;
  onToggleSearch: () => void;
  onSearchQueryChange?: (query: string) => void;
  onClearSearch: () => void;
  onCreateProject: () => void | Promise<void>;
  onOpenFolder?: () => void;
  onToggleFilterMenu: () => void;
  onOrganizeByProject: () => void;
  onOrganizeChronologically: () => void;
  onSortByCreated: () => void;
  onSortByUpdated: () => void;
  onShowAllSessions: () => void;
  onShowRelevantSessions: () => void;
}

export function ProjectExplorerHeader({
  children,
  scrollRegionRef,
  selectedProjectId,
  showFilterMenu,
  showSearch,
  searchQuery,
  organizeBy,
  sortBy,
  showArchived,
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
  searchSessionsPlaceholder,
  newProjectLabel,
  openFolderLabel,
  organizeLabel,
  byProjectLabel,
  chronologicalLabel,
  sortByLabel,
  createdLabel,
  updatedLabel,
  showLabel,
  allSessionsLabel,
  relevantLabel,
  filterMenuRef,
  onCreateSession,
  onRefreshSelectedProject,
  onToggleSearch,
  onSearchQueryChange,
  onClearSearch,
  onCreateProject,
  onOpenFolder,
  onToggleFilterMenu,
  onOrganizeByProject,
  onOrganizeChronologically,
  onSortByCreated,
  onSortByUpdated,
  onShowAllSessions,
  onShowRelevantSessions,
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
      <div className="p-3 flex flex-col gap-2">
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

      <div
        ref={scrollRegionRef}
        className="project-explorer-scroll-region px-1 py-2 flex-1 overflow-y-auto"
      >
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
              title={searchSessionsTitleLabel}
              className="text-inherit"
              onClick={onToggleSearch}
            >
              <Search
                size={14}
                className={`cursor-pointer hover:text-white transition-colors ${showSearch || searchQuery ? 'text-white' : ''}`}
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
              className="absolute right-0 top-6 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 animate-in fade-in zoom-in-95 duration-150 origin-top-right"
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
                onClick={onOrganizeChronologically}
              >
                <span>{chronologicalLabel}</span>
                {organizeBy === 'chronological' && <Check size={14} className="text-gray-400" />}
              </button>

              <div className="h-px bg-white/10 my-1.5"></div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{sortByLabel}</div>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onSortByCreated}
              >
                <span>{createdLabel}</span>
                {sortBy === 'created' && <Check size={14} className="text-gray-400" />}
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-white/10 hover:text-white"
                onClick={onSortByUpdated}
              >
                <span>{updatedLabel}</span>
                {sortBy === 'updated' && <Check size={14} className="text-gray-400" />}
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

        {(showSearch || searchQuery) && (
          <div className="px-2 mb-3 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              placeholder={searchSessionsPlaceholder}
              className="w-full bg-white/5 text-white text-xs px-2 py-1.5 pr-6 rounded outline-none border border-white/10 focus:border-[#555]"
              autoFocus
            />
            {searchQuery && (
              <X
                size={12}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                onClick={onClearSearch}
              />
            )}
          </div>
        )}

        {children}
      </div>
    </>
  );
}
