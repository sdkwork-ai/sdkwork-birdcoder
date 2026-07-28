import { memo, type MouseEvent, type RefObject } from 'react';
import {
  Archive,
  Boxes,
  Check,
  ChevronDown,
  Edit3,
  FolderGit2,
  FolderMinus,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgentProjectView,
  AgentWorkspaceView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { ProjectMountRecoveryEventPayload } from '@sdkwork/birdcoder-pc-workbench';
import { useTranslation } from 'react-i18next';
import { HeaderLoadingStatus } from './HeaderLoadingStatus.tsx';

interface ProjectSessionEngineOption {
  id: string;
  label: string;
  modelId: string;
}

interface AppWorkspaceProjectPopoverProps {
  activeProjectName?: string | null;
  availableNewSessionEngines: readonly ProjectSessionEngineOption[];
  effectiveProjectId: string;
  hasMoreProjects: boolean;
  hasMoreWorkspaces: boolean;
  hasProjectsFetched: boolean;
  hasWorkspacesFetched: boolean;
  isLoadingMoreProjects: boolean;
  isLoadingMoreWorkspaces: boolean;
  isProjectCreationPending: boolean;
  isProjectsLoading: boolean;
  isWorkspacesLoading: boolean;
  onArchiveProject: (projectId: string) => void | Promise<void>;
  onArchiveWorkspace: (workspace: AgentWorkspaceView) => void;
  onClosePopover: () => void;
  onCommitProjectRename: (projectId: string, nextName: string) => void | Promise<void>;
  onCommitWorkspaceRename: (workspace: AgentWorkspaceView, name: string) => void;
  onConfirmDeleteProject: (
    event: MouseEvent<HTMLButtonElement>,
    projectId: string,
  ) => void;
  onCreateProjectSession: (
    projectId: string,
    requestedEngineId?: string,
    requestedModelId?: string,
  ) => void | Promise<void>;
  onDeleteWorkspace: (workspace: AgentWorkspaceView) => void;
  onFinishProjectRename: () => void;
  onFinishWorkspaceRename: () => void;
  onLoadMoreProjects: () => Promise<unknown>;
  onLoadMoreWorkspaces: () => Promise<unknown>;
  onOpenProjectInExplorer: (projectId: string, projectName?: string) => void;
  onProjectRenameValueChange: (value: string) => void;
  onRefreshProjects: () => Promise<unknown>;
  onRefreshWorkspaces: () => Promise<unknown>;
  onSelectProject: (projectId: string) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onRequestProjectCreation: () => Promise<string | undefined>;
  onStartProjectRename: (projectId: string, currentName: string) => void;
  onStartWorkspaceCreation: () => void;
  onStartWorkspaceRename: (workspace: AgentWorkspaceView) => void;
  onTogglePopover: () => void;
  onToggleProjectActions: (projectId: string) => void;
  onToggleWorkspaceActions: (workspaceId: string) => void;
  onWorkspaceRenameValueChange: (value: string) => void;
  popoverRef: RefObject<HTMLDivElement | null>;
  preferredEngineId: string;
  preferredModelId: string;
  projectActionsMenuId: string | null;
  projectMountRecoveryNotice: ProjectMountRecoveryEventPayload | null;
  projectMountRecoveryStartedAt: number | null;
  projects: readonly AgentProjectView[];
  projectsError: string | null;
  renameProjectValue: string;
  renamingProjectId: string | null;
  renamingWorkspaceId: string | null;
  selectedWorkspace: AgentWorkspaceView | null;
  showPopover: boolean;
  workspaceActionsMenuId: string | null;
  workspaceError: string | null;
  workspaceRenameValue: string;
  workspaces: readonly AgentWorkspaceView[];
}

export const AppWorkspaceProjectPopover = memo(function AppWorkspaceProjectPopover({
  activeProjectName,
  availableNewSessionEngines,
  effectiveProjectId,
  hasMoreProjects,
  hasMoreWorkspaces,
  hasProjectsFetched,
  hasWorkspacesFetched,
  isLoadingMoreProjects,
  isLoadingMoreWorkspaces,
  isProjectCreationPending,
  isProjectsLoading,
  isWorkspacesLoading,
  onArchiveProject,
  onArchiveWorkspace,
  onClosePopover,
  onCommitProjectRename,
  onCommitWorkspaceRename,
  onConfirmDeleteProject,
  onCreateProjectSession,
  onDeleteWorkspace,
  onFinishProjectRename,
  onFinishWorkspaceRename,
  onLoadMoreProjects,
  onLoadMoreWorkspaces,
  onOpenProjectInExplorer,
  onProjectRenameValueChange,
  onRefreshProjects,
  onRefreshWorkspaces,
  onSelectProject,
  onSelectWorkspace,
  onRequestProjectCreation,
  onStartProjectRename,
  onStartWorkspaceCreation,
  onStartWorkspaceRename,
  onTogglePopover,
  onToggleProjectActions,
  onToggleWorkspaceActions,
  onWorkspaceRenameValueChange,
  popoverRef,
  preferredEngineId,
  preferredModelId,
  projectActionsMenuId,
  projectMountRecoveryNotice,
  projectMountRecoveryStartedAt,
  projects,
  projectsError,
  renameProjectValue,
  renamingProjectId,
  renamingWorkspaceId,
  selectedWorkspace,
  showPopover,
  workspaceActionsMenuId,
  workspaceError,
  workspaceRenameValue,
  workspaces,
}: AppWorkspaceProjectPopoverProps) {
  const { t } = useTranslation();
  const selectedWorkspaceName = selectedWorkspace?.name ?? t('app.workspaces');
  const selectedProjectName = activeProjectName ?? t('app.selectProject');
  const canCreateProject = Boolean(selectedWorkspace) && !isProjectCreationPending;

  return (
    <div
      ref={popoverRef}
      className="relative flex h-full min-w-0 items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top-2 fill-mode-both"
      style={{ animationDelay: '50ms' }}
    >
      <button
        type="button"
        data-no-drag="true"
        onClick={onTogglePopover}
        aria-label={t('app.workspaceProjectSwitcher')}
        aria-expanded={showPopover}
        aria-haspopup="dialog"
        className={`group flex h-7 min-w-0 max-w-[520px] items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          showPopover
            ? 'bg-white/[0.09] text-white'
            : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'
        }`}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500 transition-colors group-hover:text-gray-300">
          <Boxes size={12} strokeWidth={1.8} />
        </span>
        <span className="max-w-[150px] truncate font-medium">{selectedWorkspaceName}</span>
        <span className="text-gray-700" aria-hidden="true">/</span>
        <FolderGit2 size={11} strokeWidth={1.8} className="shrink-0 text-gray-600 group-hover:text-gray-400" />
        <span className={`max-w-[210px] truncate ${activeProjectName ? '' : 'text-gray-600'}`}>
          {selectedProjectName}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-gray-500 transition-transform duration-200 ${showPopover ? 'rotate-180' : ''}`}
        />
      </button>

      <HeaderLoadingStatus
        hasProjectsFetched={hasProjectsFetched}
        isProjectsLoading={isProjectsLoading}
        projectMountRecoveryNotice={projectMountRecoveryNotice}
        projectMountRecoveryStartedAt={projectMountRecoveryStartedAt}
      />

      {showPopover ? (
        <section
          data-no-drag="true"
          role="dialog"
          aria-label={t('app.workspaceProjectSwitcher')}
          className="fixed left-1/2 top-11 z-50 flex w-[min(760px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#18191d] shadow-[0_20px_64px_rgba(0,0,0,0.58)] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150"
          style={{ height: 'min(560px, calc(100vh - 56px))' }}
        >
          <header className="flex h-11 shrink-0 items-center justify-between px-3.5">
            <h2 className="truncate text-xs font-semibold text-gray-100">
              {t('app.workspaceProjectSwitcher')}
            </h2>
            <button
              type="button"
              onClick={onClosePopover}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200"
              aria-label={t('app.closeSwitcher')}
              title={t('app.closeSwitcher')}
            >
              <X size={14} />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[clamp(168px,32vw,238px)_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-r border-white/[0.07] bg-[#15161a]">
              <div className="flex h-10 shrink-0 items-center justify-between px-3">
                <span className="text-[11px] font-medium text-gray-400">
                  {t('app.workspaces')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void onRefreshWorkspaces().catch(() => undefined)}
                    disabled={isWorkspacesLoading}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200 disabled:opacity-40"
                    aria-label={t('app.refreshWorkspaces')}
                    title={t('app.refreshWorkspaces')}
                  >
                    <RefreshCw size={13} className={isWorkspacesLoading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={onStartWorkspaceCreation}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-gray-400 transition-colors hover:bg-blue-500/15 hover:text-blue-300"
                    aria-label={t('app.newWorkspace')}
                    title={t('app.newWorkspace')}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {!hasWorkspacesFetched && isWorkspacesLoading ? (
                  <div className="flex h-28 items-center justify-center" aria-label={t('app.loadingWorkspaces')}>
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                  </div>
                ) : workspaceError && workspaces.length === 0 ? (
                  <div className="mx-1 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-3 py-4 text-center">
                    <p className="text-xs text-red-300">{workspaceError}</p>
                    <button
                      type="button"
                      onClick={() => void onRefreshWorkspaces().catch(() => undefined)}
                      className="mt-3 rounded-md bg-white/10 px-3 py-1.5 text-[11px] font-medium text-gray-200 hover:bg-white/15"
                    >
                      {t('app.retryWorkspaces')}
                    </button>
                  </div>
                ) : workspaces.length > 0 ? (
                  workspaces.map((workspace) => {
                    const isSelected = workspace.workspaceId === selectedWorkspace?.workspaceId;
                    const isRenaming = renamingWorkspaceId === workspace.workspaceId;
                    const showActions = workspaceActionsMenuId === workspace.workspaceId;
                    return (
                      <div key={workspace.workspaceId} className="mb-1">
                        <div
                          className={`group flex min-h-11 items-center rounded-xl border transition-colors ${
                            isSelected
                              ? 'border-blue-400/20 bg-blue-500/[0.11]'
                              : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.045]'
                          }`}
                        >
                          {isRenaming ? (
                            <input
                              type="text"
                              autoFocus
                              value={workspaceRenameValue}
                              onChange={(event) => onWorkspaceRenameValueChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  const nextName = workspaceRenameValue.trim();
                                  if (nextName && nextName !== workspace.name) {
                                    onCommitWorkspaceRename(workspace, nextName);
                                  }
                                  onFinishWorkspaceRename();
                                } else if (event.key === 'Escape') {
                                  onFinishWorkspaceRename();
                                }
                              }}
                              onBlur={onFinishWorkspaceRename}
                              className="mx-2 h-8 min-w-0 flex-1 rounded-lg border border-blue-400/40 bg-black/30 px-2 text-xs text-white outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectWorkspace(workspace.workspaceId)}
                              className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left ${
                                isSelected ? 'text-blue-200' : 'text-gray-300'
                              }`}
                            >
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                isSelected ? 'bg-blue-400/15 text-blue-300' : 'bg-white/[0.055] text-gray-500'
                              }`}>
                                <Boxes size={13} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">{workspace.name}</span>
                                {workspace.isDefault ? (
                                  <span className="mt-0.5 block text-[10px] text-gray-500">
                                    {t('app.defaultWorkspace')}
                                  </span>
                                ) : null}
                              </span>
                              {isSelected ? <Check size={13} className="shrink-0 text-blue-300" /> : null}
                            </button>
                          )}
                          {!isRenaming ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleWorkspaceActions(workspace.workspaceId);
                              }}
                              className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-600 opacity-0 transition-all hover:bg-white/10 hover:text-gray-200 group-hover:opacity-100 focus:opacity-100"
                              aria-label={t('app.moreActions')}
                              title={t('app.moreActions')}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          ) : null}
                        </div>

                        {showActions ? (
                          <div className="mx-1 mt-1 grid gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1">
                            <button
                              type="button"
                              onClick={() => {
                                onStartWorkspaceRename(workspace);
                                onToggleWorkspaceActions(workspace.workspaceId);
                              }}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-gray-400 hover:bg-white/[0.07] hover:text-white"
                            >
                              <Edit3 size={12} />
                              {t('app.renameWorkspace')}
                            </button>
                            {!workspace.isDefault ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onArchiveWorkspace(workspace)}
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-gray-400 hover:bg-white/[0.07] hover:text-white"
                                >
                                  <Archive size={12} />
                                  {t('app.archiveWorkspace')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteWorkspace(workspace)}
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 size={12} />
                                  {t('app.deleteWorkspace')}
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center px-3 text-center">
                    <Boxes size={19} className="mb-2 text-gray-700" />
                    <span className="text-xs text-gray-500">{t('app.noWorkspacesFound')}</span>
                  </div>
                )}

                {hasMoreWorkspaces ? (
                  <button
                    type="button"
                    onClick={() => void onLoadMoreWorkspaces().catch(() => undefined)}
                    disabled={isLoadingMoreWorkspaces}
                    className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-lg text-[11px] text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-gray-300 disabled:opacity-50"
                  >
                    {isLoadingMoreWorkspaces ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                    {isLoadingMoreWorkspaces ? t('app.loadingMoreWorkspaces') : t('app.loadMoreWorkspaces')}
                  </button>
                ) : null}
              </div>

            </aside>

            <main className="flex min-h-0 min-w-0 flex-col bg-[#18191d]">
              <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-3">
                <h3 className="truncate text-[11px] font-medium text-gray-400">
                  {t('app.projects')}
                </h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void onRefreshProjects().catch(() => undefined)}
                    disabled={!selectedWorkspace || isProjectsLoading}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-200 disabled:opacity-35"
                    aria-label={t('app.refreshProjects')}
                    title={t('app.refreshProjects')}
                  >
                    <RefreshCw size={13} className={isProjectsLoading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={onRequestProjectCreation}
                    disabled={!canCreateProject}
                    className="flex h-7 items-center gap-1.5 rounded-md bg-white/[0.07] px-2.5 text-[11px] font-medium text-gray-200 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isProjectCreationPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {t('app.newProject')}
                  </button>
                </div>
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2.5">
                {!selectedWorkspace ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center px-8 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.035] text-gray-700 ring-1 ring-inset ring-white/[0.05]">
                      <Boxes size={20} />
                    </span>
                    <p className="mt-3 text-xs font-medium text-gray-400">{t('app.selectWorkspaceHint')}</p>
                  </div>
                ) : !hasProjectsFetched && isProjectsLoading ? (
                  <div className="flex h-40 items-center justify-center" aria-label={t('code.loadingProjects')}>
                    <Loader2 size={17} className="animate-spin text-gray-500" />
                  </div>
                ) : projectsError && projects.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center px-8 text-center">
                    <p className="text-xs text-red-300">{projectsError}</p>
                    <button
                      type="button"
                      onClick={() => void onRefreshProjects().catch(() => undefined)}
                      className="mt-3 rounded-lg bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium text-gray-300 hover:bg-white/10"
                    >
                      {t('app.retryWorkspaces')}
                    </button>
                  </div>
                ) : projects.length > 0 ? (
                  projects.map((project) => {
                    const isSelected = project.projectId === effectiveProjectId;
                    const isRenaming = renamingProjectId === project.projectId;
                    const isArchived = project.status === 'archived';
                    const showActions = projectActionsMenuId === project.projectId;
                    return (
                      <article
                        key={project.projectId}
                        aria-label={project.name}
                        className={`mb-1.5 overflow-hidden rounded-xl border transition-colors ${
                          isSelected
                            ? 'border-blue-400/20 bg-blue-500/[0.085]'
                            : 'border-transparent bg-white/[0.018] hover:border-white/[0.07] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="group flex min-h-12 items-center">
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
                              className="mx-2.5 h-8 min-w-0 flex-1 rounded-lg border border-blue-400/40 bg-black/30 px-2.5 text-xs text-white outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectProject(project.projectId)}
                              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                isSelected
                                  ? 'bg-blue-400/15 text-blue-300 ring-1 ring-inset ring-blue-400/15'
                                  : 'bg-white/[0.05] text-gray-500'
                              }`}>
                                <FolderGit2 size={14} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-xs font-medium ${isSelected ? 'text-blue-100' : 'text-gray-200'}`}>
                                  {project.name}
                                </span>
                                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-600">
                                  {project.importSourceKind === 'drive_sandbox' ? (
                                    <span>{t('app.serverDirectory')}</span>
                                  ) : (
                                    <span>{t('app.projectType')}</span>
                                  )}
                                  {isArchived ? <span>{t('app.archived')}</span> : null}
                                </span>
                              </span>
                              {isSelected ? <Check size={14} className="shrink-0 text-blue-300" /> : null}
                            </button>
                          )}
                          {!isRenaming ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleProjectActions(project.projectId);
                              }}
                              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-600 opacity-0 transition-all hover:bg-white/[0.08] hover:text-gray-200 group-hover:opacity-100 focus:opacity-100"
                              aria-label={t('app.moreActions')}
                              title={t('app.moreActions')}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          ) : null}
                        </div>

                        {showActions ? (
                          <div className="grid grid-cols-2 gap-1 border-t border-white/[0.06] bg-black/15 p-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void onCreateProjectSession(project.projectId, preferredEngineId, preferredModelId);
                                onToggleProjectActions(project.projectId);
                                onClosePopover();
                              }}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-gray-300 hover:bg-blue-500/10 hover:text-blue-200"
                            >
                              <Plus size={12} />
                              {t('app.menu.newSession')}
                            </button>
                            {availableNewSessionEngines.map((engine) => (
                              <button
                                key={engine.id}
                                type="button"
                                onClick={() => {
                                  void onCreateProjectSession(project.projectId, engine.id, engine.modelId);
                                  onToggleProjectActions(project.projectId);
                                  onClosePopover();
                                }}
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white"
                              >
                                <Sparkles size={12} />
                                {`${engine.label} ${t('app.menu.newSession')}`}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                onStartProjectRename(project.projectId, project.name);
                                onToggleProjectActions(project.projectId);
                              }}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Edit3 size={12} />
                              {t('app.renameProject')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenProjectInExplorer(project.projectId, project.name);
                                onToggleProjectActions(project.projectId);
                                onClosePopover();
                              }}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white"
                            >
                              <FolderOpen size={12} />
                              {t('code.openInFileExplorer')}
                            </button>
                            {!isArchived ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void onArchiveProject(project.projectId);
                                  onToggleProjectActions(project.projectId);
                                }}
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-gray-400 hover:bg-white/[0.06] hover:text-white"
                              >
                                <Archive size={12} />
                                {t('code.archiveProject')}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={(event) => onConfirmDeleteProject(event, project.projectId)}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-red-400 hover:bg-red-500/10"
                            >
                              <FolderMinus size={12} />
                              {t('app.removeProject')}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center px-8 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-violet-500/[0.05] text-gray-600 ring-1 ring-inset ring-white/[0.05]">
                      <FolderGit2 size={22} />
                    </span>
                    <p className="mt-3 text-xs font-semibold text-gray-300">{t('app.noProjectsFound')}</p>
                    <p className="mt-1 max-w-xs text-[11px] leading-5 text-gray-600">{t('app.emptyWorkspaceDescription')}</p>
                    <button
                      type="button"
                      onClick={onRequestProjectCreation}
                      className="mt-4 flex h-8 items-center gap-2 rounded-lg bg-white/[0.07] px-3 text-[11px] font-medium text-gray-200 hover:bg-white/10"
                    >
                      <Plus size={12} />
                      {t('app.newProject')}
                    </button>
                  </div>
                )}

                {hasMoreProjects ? (
                  <button
                    type="button"
                    className="mt-1 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.07] text-[11px] font-medium text-gray-500 transition-colors hover:border-white/10 hover:bg-white/[0.035] hover:text-gray-300 disabled:opacity-50"
                    disabled={isLoadingMoreProjects}
                    onClick={() => void onLoadMoreProjects().catch(() => undefined)}
                  >
                    {isLoadingMoreProjects ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                    {isLoadingMoreProjects ? t('code.loadingMoreProjects') : t('code.loadMoreProjects')}
                  </button>
                ) : null}
              </div>
            </main>
          </div>
        </section>
      ) : null}
    </div>
  );
});

AppWorkspaceProjectPopover.displayName = 'AppWorkspaceProjectPopover';
