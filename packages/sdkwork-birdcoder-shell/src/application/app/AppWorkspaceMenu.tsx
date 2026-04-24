import { memo, type FormEvent, type MouseEvent, type RefObject } from 'react';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Edit,
  Folder,
  Globe,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import type { ProjectMountRecoveryEventPayload } from '@sdkwork/birdcoder-commons';
import type { BirdCoderProject, IWorkspace } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';
import { HeaderLoadingStatus } from './HeaderLoadingStatus.tsx';

interface AppWorkspaceMenuEngineOption {
  id: string;
  label: string;
}

interface AppWorkspaceMenuProps {
  workspaceMenuRef: RefObject<HTMLDivElement | null>;
  activeWorkspace?: IWorkspace | null;
  activeProjectName?: string | null;
  effectiveWorkspaceId: string;
  effectiveMenuWorkspaceId: string;
  effectiveProjectId: string;
  showWorkspaceMenu: boolean;
  workspaces: readonly IWorkspace[];
  menuProjects: readonly BirdCoderProject[];
  menuProjectsHasFetched: boolean;
  shouldUseDistinctMenuProjectsStore: boolean;
  isWorkspacesLoading: boolean;
  hasActiveProjectsFetched: boolean;
  projectMountRecoveryNotice: ProjectMountRecoveryEventPayload | null;
  projectMountRecoveryStartedAt: number | null;
  isCreatingWorkspace: boolean;
  newWorkspaceName: string;
  isCreatingProject: boolean;
  newProjectName: string;
  renamingWorkspaceId: string | null;
  renameWorkspaceValue: string;
  renamingProjectId: string | null;
  renameProjectValue: string;
  projectActionsMenuId: string | null;
  availableNewSessionEngines: readonly AppWorkspaceMenuEngineOption[];
  preferredEngineId: string;
  onToggleMenu: () => void;
  onCloseMenuSurface: () => void;
  onPreviewWorkspaceSelection: (workspaceId: string) => void;
  onStartWorkspaceRename: (workspaceId: string, currentName: string) => void;
  onWorkspaceRenameValueChange: (value: string) => void;
  onFinishWorkspaceRename: () => void;
  onCommitWorkspaceRename: (workspaceId: string, nextName: string) => void | Promise<void>;
  onConfirmDeleteWorkspace: (event: MouseEvent<HTMLButtonElement>, workspaceId: string) => void;
  onSelectProject: (projectId: string) => void;
  onStartProjectRename: (projectId: string, currentName: string) => void;
  onProjectRenameValueChange: (value: string) => void;
  onFinishProjectRename: () => void;
  onCommitProjectRename: (projectId: string, nextName: string) => void | Promise<void>;
  onCreateProjectSession: (projectId: string, requestedEngineId?: string) => void | Promise<void>;
  onToggleProjectActionsMenu: (projectId: string) => void;
  onOpenProjectInExplorer: (projectPath?: string, projectName?: string) => void;
  onConfirmDeleteProject: (event: MouseEvent<HTMLButtonElement>, projectId: string) => void;
  onStartCreatingWorkspace: () => void;
  onCancelCreatingWorkspace: () => void;
  onWorkspaceNameChange: (value: string) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onStartCreatingProject: () => void;
  onCancelCreatingProject: () => void;
  onProjectNameChange: (value: string) => void;
  onCreateProject: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

function getWorkspaceIcon(iconName?: string) {
  switch (iconName) {
    case 'Briefcase':
      return <Briefcase size={14} />;
    case 'Globe':
      return <Globe size={14} />;
    case 'User':
      return <User size={14} />;
    default:
      return <Folder size={14} />;
  }
}

export const AppWorkspaceMenu = memo(function AppWorkspaceMenu({
  workspaceMenuRef,
  activeWorkspace,
  activeProjectName,
  effectiveWorkspaceId,
  effectiveMenuWorkspaceId,
  effectiveProjectId,
  showWorkspaceMenu,
  workspaces,
  menuProjects,
  menuProjectsHasFetched,
  shouldUseDistinctMenuProjectsStore,
  isWorkspacesLoading,
  hasActiveProjectsFetched,
  projectMountRecoveryNotice,
  projectMountRecoveryStartedAt,
  isCreatingWorkspace,
  newWorkspaceName,
  isCreatingProject,
  newProjectName,
  renamingWorkspaceId,
  renameWorkspaceValue,
  renamingProjectId,
  renameProjectValue,
  projectActionsMenuId,
  availableNewSessionEngines,
  preferredEngineId,
  onToggleMenu,
  onCloseMenuSurface,
  onPreviewWorkspaceSelection,
  onStartWorkspaceRename,
  onWorkspaceRenameValueChange,
  onFinishWorkspaceRename,
  onCommitWorkspaceRename,
  onConfirmDeleteWorkspace,
  onSelectProject,
  onStartProjectRename,
  onProjectRenameValueChange,
  onFinishProjectRename,
  onCommitProjectRename,
  onCreateProjectSession,
  onToggleProjectActionsMenu,
  onOpenProjectInExplorer,
  onConfirmDeleteProject,
  onStartCreatingWorkspace,
  onCancelCreatingWorkspace,
  onWorkspaceNameChange,
  onCreateWorkspace,
  onStartCreatingProject,
  onCancelCreatingProject,
  onProjectNameChange,
  onCreateProject,
}: AppWorkspaceMenuProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-w-0 items-center justify-center gap-1.5 h-full relative animate-in fade-in slide-in-from-top-2 fill-mode-both"
      ref={workspaceMenuRef}
      style={{ animationDelay: '50ms' }}
    >
      <button
        type="button"
        data-no-drag="true"
        onClick={onToggleMenu}
        aria-expanded={showWorkspaceMenu}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg text-xs text-gray-300 transition-colors group"
      >
        <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
          {getWorkspaceIcon(activeWorkspace?.icon)}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="truncate max-w-[120px] font-medium text-gray-300 group-hover:text-white transition-colors">
            {activeWorkspace?.name || t('app.workspace')}
          </span>
          <span className="text-gray-600 text-[10px]">/</span>
          <span className="truncate max-w-[120px] font-medium text-gray-400 group-hover:text-gray-300 transition-colors">
            {activeProjectName || '-'}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 ${
            showWorkspaceMenu ? 'rotate-180' : ''
          }`}
        />
      </button>

      <HeaderLoadingStatus
        activeWorkspaceName={activeWorkspace?.name ?? null}
        workspaceId={effectiveWorkspaceId}
        isWorkspacesLoading={isWorkspacesLoading}
        hasActiveProjectsFetched={hasActiveProjectsFetched}
        projectMountRecoveryNotice={projectMountRecoveryNotice}
        projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
      />

      {showWorkspaceMenu ? (
        <div
          data-no-drag="true"
          className="absolute top-full mt-2 w-[500px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex h-[320px]">
            <div className="w-[45%] border-r border-white/10 overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/30 flex flex-col gap-1">
              <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {t('app.workspaces')}
              </div>
              {workspaces.map((workspace) => {
                const isMenuSelected = effectiveMenuWorkspaceId === workspace.id;
                const isActualSelected = effectiveWorkspaceId === workspace.id;

                return (
                  <div key={workspace.id} className="flex items-center group relative">
                    <button
                      onClick={() => {
                        onPreviewWorkspaceSelection(workspace.id);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isMenuSelected
                          ? 'bg-white/5 text-gray-100 shadow-sm'
                          : 'text-gray-400 hover:bg-white/5/60 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1">
                        <span
                          className={
                            isMenuSelected
                              ? 'text-blue-400 shrink-0'
                              : 'text-gray-500 group-hover:text-gray-400 shrink-0'
                          }
                        >
                          {getWorkspaceIcon(workspace.icon)}
                        </span>
                        {renamingWorkspaceId === workspace.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={renameWorkspaceValue}
                            onChange={(event) => onWorkspaceRenameValueChange(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                if (
                                  renameWorkspaceValue.trim() &&
                                  renameWorkspaceValue !== workspace.name
                                ) {
                                  void onCommitWorkspaceRename(workspace.id, renameWorkspaceValue);
                                }
                                onFinishWorkspaceRename();
                              } else if (event.key === 'Escape') {
                                onFinishWorkspaceRename();
                              }
                            }}
                            onBlur={onFinishWorkspaceRename}
                            onClick={(event) => event.stopPropagation()}
                            className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
                          />
                        ) : (
                          <span className="truncate font-medium">{workspace.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isActualSelected ? <Check size={14} className="text-gray-500" /> : null}
                        {isMenuSelected ? <ChevronRight size={14} className="text-gray-500" /> : null}
                      </div>
                    </button>
                    {workspaces.length > 1 && renamingWorkspaceId !== workspace.id ? (
                      <div className="absolute right-6 flex items-center opacity-0 group-hover:opacity-100 transition-all z-10 bg-[#18181b]/80 backdrop-blur-sm rounded-md px-1">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onStartWorkspaceRename(workspace.id, workspace.name);
                          }}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                          title={t('app.renameWorkspace')}
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={(event) => onConfirmDeleteWorkspace(event, workspace.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                          title={t('app.deleteWorkspace')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="w-[55%] overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/10 flex flex-col gap-1 relative">
              <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {t('app.projects')}
              </div>
              {!menuProjectsHasFetched && shouldUseDistinctMenuProjectsStore ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-white/70" />
                </div>
              ) : menuProjects.length > 0 ? (
                menuProjects.map((project) => {
                  const isSelected =
                    effectiveWorkspaceId === effectiveMenuWorkspaceId &&
                    effectiveProjectId === project.id;

                  return (
                    <div key={project.id} className="flex items-center group relative">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate flex-1">
                          <Folder
                            size={14}
                            className={
                              isSelected
                                ? 'text-blue-400 shrink-0'
                                : 'text-gray-500 group-hover:text-gray-400 shrink-0'
                            }
                          />
                          {renamingProjectId === project.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={renameProjectValue}
                              onChange={(event) => onProjectRenameValueChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  if (
                                    renameProjectValue.trim() &&
                                    renameProjectValue !== project.name
                                  ) {
                                    void onCommitProjectRename(project.id, renameProjectValue);
                                  }
                                  onFinishProjectRename();
                                } else if (event.key === 'Escape') {
                                  onFinishProjectRename();
                                }
                              }}
                              onBlur={onFinishProjectRename}
                              onClick={(event) => event.stopPropagation()}
                              className="flex-1 bg-transparent border-none outline-none text-white focus:ring-1 focus:ring-blue-500 rounded px-1 text-sm min-w-0 font-medium"
                            />
                          ) : (
                            <span className="truncate font-medium">{project.name}</span>
                          )}
                        </div>
                        {isSelected ? <Check size={14} className="text-blue-400 shrink-0" /> : null}
                      </button>
                      {renamingProjectId !== project.id ? (
                        <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10 bg-[#18181b]/80 backdrop-blur-sm rounded-md px-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void onCreateProjectSession(project.id, preferredEngineId);
                            }}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title={t('code.newSessionInProject')}
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleProjectActionsMenu(project.id);
                            }}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title={t('app.moreActions')}
                          >
                            <MoreHorizontal size={12} />
                          </button>
                        </div>
                      ) : null}
                      {projectActionsMenuId === project.id && renamingProjectId !== project.id ? (
                        <div className="absolute right-2 top-11 z-20 w-56 overflow-hidden rounded-lg border border-white/10 bg-[#18181b]/95 py-1.5 shadow-2xl backdrop-blur-xl">
                          {availableNewSessionEngines.map((engine) => (
                            <button
                              key={`${project.id}-${engine.id}-new-session`}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void onCreateProjectSession(project.id, engine.id);
                              }}
                              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              {`${engine.label} ${t('app.menu.newSession')}`}
                            </button>
                          ))}
                          {availableNewSessionEngines.length > 0 ? (
                            <div className="my-1 h-px bg-white/10" />
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onStartProjectRename(project.id, project.name);
                              onToggleProjectActionsMenu(project.id);
                            }}
                            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            {t('app.renameProject')}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenProjectInExplorer(project.path, project.name);
                              onToggleProjectActionsMenu(project.id);
                              onCloseMenuSurface();
                            }}
                            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            {t('code.openInFileExplorer')}
                          </button>
                          <div className="my-1 h-px bg-white/10" />
                          <button
                            type="button"
                            onClick={(event) => onConfirmDeleteProject(event, project.id)}
                            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            {t('app.removeProject')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-gray-500 text-xs">
                  {t('app.noProjectsFound')}
                </div>
              )}
            </div>
          </div>

          <div className="flex border-t border-white/10 bg-[#0e0e11]/80 backdrop-blur-sm">
            <div className="w-[45%] p-2 border-r border-white/10">
              {isCreatingWorkspace ? (
                <form onSubmit={onCreateWorkspace} className="px-1 py-0.5">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(event) => onWorkspaceNameChange(event.target.value)}
                    placeholder={t('app.workspaceNamePlaceholder')}
                    className="w-full bg-black/50 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={onCancelCreatingWorkspace}
                      className="px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      {t('app.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={!newWorkspaceName.trim()}
                      className="px-2.5 py-1 text-[10px] font-medium bg-white text-black hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('app.create')}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={onStartCreatingWorkspace}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                >
                  <Plus size={12} />
                  {t('app.newWorkspace')}
                </button>
              )}
            </div>
            <div className="w-[55%] p-2">
              {isCreatingProject ? (
                <form onSubmit={onCreateProject} className="px-1 py-0.5">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(event) => onProjectNameChange(event.target.value)}
                    placeholder={t('app.projectNamePlaceholder')}
                    className="w-full bg-black/50 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={onCancelCreatingProject}
                      className="px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      {t('app.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={!newProjectName.trim()}
                      className="px-2.5 py-1 text-[10px] font-medium bg-white text-black hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('app.create')}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={onStartCreatingProject}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-dashed border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all font-medium"
                >
                  <Plus size={12} />
                  {t('app.newProject')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

AppWorkspaceMenu.displayName = 'AppWorkspaceMenu';
