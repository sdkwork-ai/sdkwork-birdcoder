import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-pc-workbench';
import { ProjectGitHeaderControls } from '@sdkwork/birdcoder-pc-ui/components/ProjectGitHeaderControls';
import {
  Check,
  ChevronDown,
  FolderClosed,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import {
  type CSSProperties,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  NewTaskRunModeSelector,
  type NewTaskExecutionTarget,
} from './NewTaskRunModeSelector';

interface ProjectSwitcherPosition extends CSSProperties {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
}

function resolveProjectSwitcherPosition(trigger: HTMLElement): ProjectSwitcherPosition {
  const triggerBounds = trigger.getBoundingClientRect();
  const viewportGutter = 12;
  const popoverGap = 8;
  const preferredPopoverHeight = 240;
  const availableAbove = triggerBounds.top - viewportGutter;
  const availableBelow = window.innerHeight - triggerBounds.bottom - viewportGutter;
  const shouldOpenAbove =
    availableAbove >= preferredPopoverHeight || availableAbove >= availableBelow;
  const width = Math.min(400, window.innerWidth - viewportGutter * 2);
  const left = Math.max(
    viewportGutter,
    Math.min(triggerBounds.left, window.innerWidth - width - viewportGutter),
  );

  return {
    bottom: shouldOpenAbove
      ? window.innerHeight - triggerBounds.top + popoverGap
      : undefined,
    left,
    maxHeight: Math.max(
      120,
      (shouldOpenAbove ? availableAbove : availableBelow) - popoverGap,
    ),
    top: shouldOpenAbove ? undefined : triggerBounds.bottom + popoverGap,
    width,
  };
}

interface CodeNewSessionContextProps {
  cloudExecutionAvailable: boolean;
  executionTarget: NewTaskExecutionTarget;
  hasMoreProjects: boolean;
  isLoadingMoreProjects: boolean;
  localExecutionAvailable: boolean;
  onLoadMoreProjects: () => Promise<unknown> | void;
  onExecutionTargetChange: (executionTarget: NewTaskExecutionTarget) => void;
  onNewProject: () => Promise<string | undefined>;
  onProjectSelect: (projectId: string) => void;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  projectId?: string;
  projectName?: string;
  projects: readonly AgentProjectView[];
}

export const CodeNewSessionContext = memo(function CodeNewSessionContext({
  cloudExecutionAvailable,
  executionTarget,
  hasMoreProjects,
  isLoadingMoreProjects,
  localExecutionAvailable,
  onLoadMoreProjects,
  onExecutionTargetChange,
  onNewProject,
  onProjectSelect,
  projectGitOverviewState,
  projectId,
  projectName,
  projects,
}: CodeNewSessionContextProps) {
  const { t } = useTranslation();
  const popoverId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const projectTriggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectSwitcherPosition, setProjectSwitcherPosition] =
    useState<ProjectSwitcherPosition | null>(null);
  const normalizedProjectSearchQuery = projectSearchQuery.trim().toLocaleLowerCase();
  const visibleProjects = useMemo(() => {
    if (!normalizedProjectSearchQuery) {
      return projects;
    }

    return projects.filter((project) => (
      project.name.toLocaleLowerCase().includes(normalizedProjectSearchQuery) ||
      project.projectId.toLocaleLowerCase().includes(normalizedProjectSearchQuery)
    ));
  }, [normalizedProjectSearchQuery, projects]);

  const closeProjectSwitcher = useCallback(() => {
    setIsProjectSwitcherOpen(false);
    setProjectSearchQuery('');
    setProjectSwitcherPosition(null);
  }, []);

  useLayoutEffect(() => {
    if (!isProjectSwitcherOpen) {
      return undefined;
    }

    const updatePosition = () => {
      if (projectTriggerRef.current) {
        setProjectSwitcherPosition(resolveProjectSwitcherPosition(projectTriggerRef.current));
      }
    };
    updatePosition();
    const focusFrame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closeProjectSwitcher();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeProjectSwitcher();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [closeProjectSwitcher, isProjectSwitcherOpen]);

  useEffect(() => {
    closeProjectSwitcher();
  }, [closeProjectSwitcher, projectId]);

  const handleProjectSelect = useCallback((nextProjectId: string) => {
    closeProjectSwitcher();
    if (nextProjectId !== projectId) {
      onProjectSelect(nextProjectId);
    }
  }, [closeProjectSwitcher, onProjectSelect, projectId]);

  const handleNewProject = useCallback(async () => {
    closeProjectSwitcher();
    const createdProjectId = await onNewProject();
    if (createdProjectId) {
      onProjectSelect(createdProjectId);
    }
  }, [closeProjectSwitcher, onNewProject, onProjectSelect]);

  return (
    <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-x-1 gap-y-1 px-2 text-sm text-gray-300">
      <div ref={containerRef} className="relative min-w-0 max-w-[min(20rem,100%)]">
        <button
          ref={projectTriggerRef}
          type="button"
          aria-controls={isProjectSwitcherOpen ? popoverId : undefined}
          aria-expanded={isProjectSwitcherOpen}
          aria-haspopup="dialog"
          aria-label={t('app.switchProject')}
          className={`flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
            isProjectSwitcherOpen
              ? 'bg-white/[0.09] text-white'
              : 'hover:bg-white/[0.06] hover:text-white'
          }`}
          data-new-task-project-switcher-trigger="true"
          onClick={() => setIsProjectSwitcherOpen((isOpen) => !isOpen)}
          title={projectName}
        >
          <FolderClosed size={16} className="shrink-0 text-gray-300" />
          <span className="min-w-0 truncate font-medium text-gray-100">{projectName || '-'}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-gray-500 transition-transform ${
              isProjectSwitcherOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isProjectSwitcherOpen && projectSwitcherPosition ? createPortal((
          <section
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={t('app.projectSwitcher')}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-lg border border-white/[0.1] bg-[#292929] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-1 duration-150"
            data-new-task-project-switcher="true"
            style={projectSwitcherPosition}
          >
            <label className="flex h-9 shrink-0 items-center gap-2 px-2 text-gray-400">
              <Search size={14} className="shrink-0" />
              <span className="sr-only">{t('app.searchProjects')}</span>
              <input
                ref={searchInputRef}
                type="search"
                value={projectSearchQuery}
                onChange={(event) => setProjectSearchQuery(event.target.value)}
                placeholder={t('app.searchProjects')}
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
              />
            </label>

            <div
              role="listbox"
              aria-label={t('app.projects')}
              className="custom-scrollbar min-h-0 overflow-y-auto py-1"
            >
              {visibleProjects.length > 0 ? visibleProjects.map((project) => {
                const isSelected = project.projectId === projectId;
                return (
                  <button
                    key={project.projectId}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/20 ${
                      isSelected
                        ? 'bg-white/[0.09] text-white'
                        : 'text-gray-200 hover:bg-white/[0.06] hover:text-white'
                    }`}
                    onClick={() => handleProjectSelect(project.projectId)}
                    title={project.name}
                  >
                    <FolderClosed size={16} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {isSelected ? <Check size={16} className="shrink-0 text-gray-100" /> : null}
                  </button>
                );
              }) : (
                <div className="flex min-h-20 items-center justify-center px-4 text-center text-xs text-gray-500">
                  {normalizedProjectSearchQuery
                    ? t('app.noMatchingProjects')
                    : t('app.noProjectsFound')}
                </div>
              )}
            </div>

            {hasMoreProjects ? (
              <button
                type="button"
                disabled={isLoadingMoreProjects}
                className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md text-xs text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-wait disabled:opacity-50"
                onClick={() => void Promise.resolve(onLoadMoreProjects()).catch(() => undefined)}
              >
                {isLoadingMoreProjects ? <Loader2 size={14} className="animate-spin" /> : null}
                {isLoadingMoreProjects
                  ? t('code.loadingMoreProjects')
                  : t('code.loadMoreProjects')}
              </button>
            ) : null}

            <div className="border-t border-white/[0.1] pt-1">
              <button
                type="button"
                className="flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                onClick={() => void handleNewProject().catch(() => undefined)}
              >
                <Plus size={17} className="shrink-0 text-gray-400" />
                <span>{t('app.newProject')}</span>
              </button>
            </div>
          </section>
        ), document.body)
        : null}
      </div>

      <NewTaskRunModeSelector
        cloudExecutionAvailable={cloudExecutionAvailable}
        executionTarget={executionTarget}
        localExecutionAvailable={localExecutionAvailable}
        onExecutionTargetChange={onExecutionTargetChange}
      />

      <ProjectGitHeaderControls
        compactControls={false}
        projectGitOverviewState={projectGitOverviewState}
        projectId={projectId}
        showBranchControl
        showOverviewDrawerToggle={false}
        showWorktreeControl
        variant="topbar"
      />
    </div>
  );
});

CodeNewSessionContext.displayName = 'CodeNewSessionContext';
