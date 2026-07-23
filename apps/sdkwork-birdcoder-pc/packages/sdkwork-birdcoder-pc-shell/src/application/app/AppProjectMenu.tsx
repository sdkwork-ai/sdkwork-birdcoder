import { memo, type FormEvent, type MouseEvent, type RefObject } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  Edit3,
  FolderGit2,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ProjectMountRecoveryEventPayload } from '@sdkwork/birdcoder-pc-workbench';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { useTranslation } from 'react-i18next';
import { HeaderLoadingStatus } from './HeaderLoadingStatus.tsx';

interface AppProjectMenuEngineOption {
  id: string;
  label: string;
  modelId: string;
}

interface AppProjectMenuProps {
  projectMenuRef: RefObject<HTMLDivElement | null>;
  activeProjectName?: string | null;
  effectiveProjectId: string;
  showProjectMenu: boolean;
  projects: readonly AgentProjectView[];
  hasProjectsFetched: boolean;
  hasMoreProjects: boolean;
  isProjectsLoading: boolean;
  isLoadingMoreProjects: boolean;
  projectMountRecoveryNotice: ProjectMountRecoveryEventPayload | null;
  projectMountRecoveryStartedAt: number | null;
  isCreatingProject: boolean;
  newProjectName: string;
  renamingProjectId: string | null;
  renameProjectValue: string;
  projectActionsMenuId: string | null;
  availableNewSessionEngines: readonly AppProjectMenuEngineOption[];
  preferredEngineId: string;
  preferredModelId: string;
  onToggleMenu: () => void;
  onCloseMenuSurface: () => void;
  onSelectProject: (projectId: string) => void;
  onLoadMoreProjects: () => Promise<unknown>;
  onStartProjectRename: (projectId: string, currentName: string) => void;
  onProjectRenameValueChange: (value: string) => void;
  onFinishProjectRename: () => void;
  onCommitProjectRename: (projectId: string, nextName: string) => void | Promise<void>;
  onArchiveProject: (projectId: string) => void | Promise<void>;
  onCreateProjectSession: (
    projectId: string,
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => void | Promise<void>;
  onToggleProjectActionsMenu: (projectId: string) => void;
  onOpenProjectInExplorer: (projectId: string, projectName?: string) => void;
  onConfirmDeleteProject: (
    event: MouseEvent<HTMLButtonElement>,
    projectId: string,
  ) => void;
  onStartCreatingProject: () => void;
  onCancelCreatingProject: () => void;
  onProjectNameChange: (value: string) => void;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export const AppProjectMenu = memo(function AppProjectMenu({
  projectMenuRef,
  activeProjectName,
  effectiveProjectId,
  showProjectMenu,
  projects,
  hasProjectsFetched,
  hasMoreProjects,
  isProjectsLoading,
  isLoadingMoreProjects,
  projectMountRecoveryNotice,
  projectMountRecoveryStartedAt,
  isCreatingProject,
  newProjectName,
  renamingProjectId,
  renameProjectValue,
  projectActionsMenuId,
  availableNewSessionEngines,
  preferredEngineId,
  preferredModelId,
  onToggleMenu,
  onCloseMenuSurface,
  onSelectProject,
  onLoadMoreProjects,
  onStartProjectRename,
  onProjectRenameValueChange,
  onFinishProjectRename,
  onCommitProjectRename,
  onArchiveProject,
  onCreateProjectSession,
  onToggleProjectActionsMenu,
  onOpenProjectInExplorer,
  onConfirmDeleteProject,
  onStartCreatingProject,
  onCancelCreatingProject,
  onProjectNameChange,
  onCreateProject,
}: AppProjectMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      className="relative flex h-full min-w-0 items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-2 fill-mode-both"
      ref={projectMenuRef}
      style={{ animationDelay: '50ms' }}
    >
      <button
        type="button"
        data-no-drag="true"
        onClick={onToggleMenu}
        aria-expanded={showProjectMenu}
        aria-haspopup="menu"
        className="group flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/5"
      >
        <FolderGit2 size={14} className="shrink-0 text-gray-400 group-hover:text-gray-300" />
        <span className="max-w-[240px] truncate font-medium group-hover:text-white">
          {activeProjectName || t('app.projects')}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 transition-transform duration-200 ${
            showProjectMenu ? 'rotate-180' : ''
          }`}
        />
      </button>

      <HeaderLoadingStatus
        hasProjectsFetched={hasProjectsFetched}
        isProjectsLoading={isProjectsLoading}
        projectMountRecoveryNotice={projectMountRecoveryNotice}
        projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
      />

      {showProjectMenu ? (
        <div
          data-no-drag="true"
          role="menu"
          className="absolute top-full z-50 mt-2 flex w-[390px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#18181b] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              {t('app.projects')}
            </span>
            <button
              type="button"
              onClick={onStartCreatingProject}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title={t('app.newProject')}
              aria-label={t('app.newProject')}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="max-h-[360px] min-h-[160px] overflow-y-auto p-2 custom-scrollbar">
            {!hasProjectsFetched && isProjectsLoading ? (
              <div className="flex h-28 items-center justify-center" aria-label={t('code.loadingProjects')}>
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            ) : projects.length > 0 ? (
              projects.map((project) => {
                const isSelected = project.projectId === effectiveProjectId;
                const isRenaming = renamingProjectId === project.projectId;
                const isArchived = project.status === 'archived';

                return (
                  <div
                    key={project.projectId}
                    className={`group relative mb-1 flex min-h-10 items-center rounded-md ${
                      isSelected ? 'bg-blue-500/10' : 'hover:bg-white/5'
                    }`}
                  >
                    {isRenaming ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameProjectValue}
                        onChange={(event) => onProjectRenameValueChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            const nextName = renameProjectValue.trim();
                            if (nextName && nextName !== project.name) {
                              void onCommitProjectRename(project.projectId, nextName);
                            }
                            onFinishProjectRename();
                          } else if (event.key === 'Escape') {
                            onFinishProjectRename();
                          }
                        }}
                        onBlur={onFinishProjectRename}
                        className="mx-2 h-8 min-w-0 flex-1 rounded-md border border-blue-500/50 bg-black/30 px-2 text-xs text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => onSelectProject(project.projectId)}
                        className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs ${
                          isSelected ? 'text-blue-300' : 'text-gray-300'
                        } ${isArchived ? 'opacity-60' : ''}`}
                      >
                        <FolderGit2 size={14} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                        {isArchived ? (
                          <Archive size={12} className="shrink-0 text-gray-500" />
                        ) : null}
                        {isSelected ? <Check size={13} className="shrink-0" /> : null}
                      </button>
                    )}

                    {!isRenaming ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleProjectActionsMenu(project.projectId);
                        }}
                        className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100"
                        title={t('app.moreActions')}
                        aria-label={t('app.moreActions')}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    ) : null}

                    {projectActionsMenuId === project.projectId ? (
                      <div className="absolute right-1 top-9 z-20 w-48 overflow-hidden rounded-md border border-white/10 bg-[#202024] py-1 shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            void onCreateProjectSession(
                              project.projectId,
                              preferredEngineId,
                              preferredModelId,
                            );
                            onToggleProjectActionsMenu(project.projectId);
                            onCloseMenuSurface();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                        >
                          <Plus size={13} />
                          {t('app.menu.newSession')}
                        </button>
                        {availableNewSessionEngines.map((engine) => (
                          <button
                            key={engine.id}
                            type="button"
                            onClick={() => {
                              void onCreateProjectSession(
                                project.projectId,
                                engine.id,
                                engine.modelId,
                              );
                              onToggleProjectActionsMenu(project.projectId);
                              onCloseMenuSurface();
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                          >
                            <Plus size={13} />
                            {`${engine.label} ${t('app.menu.newSession')}`}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-white/10" />
                        <button
                          type="button"
                          onClick={() => {
                            onStartProjectRename(project.projectId, project.name);
                            onToggleProjectActionsMenu(project.projectId);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                        >
                          <Edit3 size={13} />
                          {t('app.renameProject')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenProjectInExplorer(project.projectId, project.name);
                            onToggleProjectActionsMenu(project.projectId);
                            onCloseMenuSurface();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                        >
                          <FolderOpen size={13} />
                          {t('code.openInFileExplorer')}
                        </button>
                        {!isArchived ? (
                          <button
                            type="button"
                            onClick={() => {
                              void onArchiveProject(project.projectId);
                              onToggleProjectActionsMenu(project.projectId);
                              onCloseMenuSurface();
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10 hover:text-white"
                          >
                            <Archive size={13} />
                            {t('code.archiveProject')}
                          </button>
                        ) : null}
                        <div className="my-1 h-px bg-white/10" />
                        <button
                          type="button"
                          onClick={(event) => onConfirmDeleteProject(event, project.projectId)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} />
                          {t('app.deleteProject')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="flex h-28 items-center justify-center text-xs text-gray-500">
                {t('app.noProjectsFound')}
              </div>
            )}

            {hasMoreProjects ? (
              <button
                type="button"
                className="mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-gray-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoadingMoreProjects}
                onClick={() => {
                  void onLoadMoreProjects().catch(() => undefined);
                }}
              >
                {isLoadingMoreProjects ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ChevronDown size={13} />
                )}
                {isLoadingMoreProjects
                  ? t('code.loadingMoreProjects')
                  : t('code.loadMoreProjects')}
              </button>
            ) : null}
          </div>

          {isCreatingProject ? (
            <form onSubmit={onCreateProject} className="border-t border-white/10 p-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                placeholder={t('app.projectNamePlaceholder')}
                className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-2.5 text-xs text-white outline-none transition-colors placeholder:text-gray-600 focus:border-blue-500/50"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelCreatingProject}
                  className="h-7 px-2.5 text-xs text-gray-400 hover:text-white"
                >
                  {t('app.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="h-7 rounded-md bg-white px-3 text-xs font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('app.create')}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

AppProjectMenu.displayName = 'AppProjectMenu';
