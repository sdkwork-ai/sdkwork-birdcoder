import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Bot,
  Boxes,
  ChevronDown,
  Grid2X2,
  Network,
  Workflow,
} from 'lucide-react';
import { WorkbenchNewSessionButton } from '@sdkwork/birdcoder-pc-ui/components/WorkbenchNewSessionButton';
import { installWorkbenchWorkProvider } from '@sdkwork/birdcoder-pc-workbench/workbench/workProviderInstallation';
import { WorkProviderInstallDialog } from './WorkProviderInstallDialog';

interface WorkModeSidebarLabels {
  assistant: string;
  automation: string;
  automationUnavailable: string;
  expertTools: string;
  more: string;
  newTask: string;
  noPinnedTasks: string;
  noProjects: string;
  noTasks: string;
  pinnedTasks: string;
  providerInstalled: string;
  providerNotInstalled: string;
  providerInstallCancel: string;
  providerInstallClose: string;
  providerInstallDesktopRequired: string;
  providerInstallDone: string;
  providerInstallAction: string;
  providerInstallOfficialSource: string;
  providerInstallRetry: string;
  providerInstallDescription: (provider: string, baseline: string) => string;
  providerInstallFailed: (provider: string) => string;
  providerInstalling: (provider: string) => string;
  providerInstallReady: (provider: string) => string;
  providerInstallRestartRequired: (provider: string) => string;
  providerInstallTitle: (provider: string) => string;
  projects: string;
  selectProjectFirst: string;
  tasks: string;
  workProvidersUnavailable: string;
}

interface WorkModeSidebarProps {
  labels: WorkModeSidebarLabels;
  pinnedContent?: ReactNode;
  pinnedCount: number;
  projectContent?: ReactNode;
  projectCount: number;
  scrollRegionRef?: RefObject<HTMLDivElement | null>;
  selectedEngineId: string;
  selectedModelId: string;
  selectedProjectId?: string | null;
  taskContent?: ReactNode;
  taskCount: number;
  onCreateSession: (engineId: string, modelId: string) => void | Promise<void>;
  onOpenExpertTools: () => void;
  onOpenMore: () => void;
}

interface WorkModeSectionProps {
  children: ReactNode;
  count: number;
  dataAttribute: string;
  defaultExpanded?: boolean;
  label: string;
  sectionRef?: React.RefObject<HTMLElement | null>;
}

function WorkModeSection({
  children,
  count,
  dataAttribute,
  defaultExpanded = true,
  label,
  sectionRef,
}: WorkModeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <section ref={sectionRef} className="px-1" data-work-sidebar-section={dataAttribute}>
      <button
        type="button"
        aria-expanded={isExpanded}
        className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-[12px] font-semibold text-gray-500 transition-colors hover:text-gray-300 focus-visible:bg-white/[0.05] focus-visible:outline-none"
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span>{label}</span>
        <span className="tabular-nums">({count})</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}
        />
      </button>
      {isExpanded ? <div className="flex flex-col gap-0.5">{children}</div> : null}
    </section>
  );
}

export function WorkModeSidebar({
  labels,
  pinnedContent,
  pinnedCount,
  projectContent,
  projectCount,
  scrollRegionRef,
  selectedEngineId,
  selectedModelId,
  selectedProjectId,
  taskContent,
  taskCount,
  onCreateSession,
  onOpenExpertTools,
  onOpenMore,
}: WorkModeSidebarProps) {
  const tasksRef = useRef<HTMLElement>(null);
  const projectsRef = useRef<HTMLElement>(null);
  const [providerToInstall, setProviderToInstall] = useState<string | null>(null);
  const scrollToSection = (section: HTMLElement | null) => {
    section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const navigationItems = [
    {
      id: 'assistant',
      icon: Bot,
      label: labels.assistant,
      onClick: () => scrollToSection(tasksRef.current),
    },
    {
      id: 'projects',
      icon: Boxes,
      label: labels.projects,
      onClick: () => scrollToSection(projectsRef.current),
    },
    {
      id: 'expert-tools',
      icon: Network,
      label: labels.expertTools,
      onClick: onOpenExpertTools,
    },
    {
      id: 'automation',
      icon: Workflow,
      label: labels.automation,
      title: labels.automationUnavailable,
      disabled: true,
    },
    {
      id: 'more',
      icon: Grid2X2,
      label: labels.more,
      onClick: onOpenMore,
    },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-work-sidebar="true">
      <div className="birdcoder-sidebar-session-create shrink-0 px-2 pb-2 pt-2">
        <WorkbenchNewSessionButton
          buttonLabel={labels.newTask}
          disabled={!selectedProjectId}
          disabledTitle={labels.selectProjectFirst}
          installProviderLabel={labels.providerInstallAction}
          installedLabel={labels.providerInstalled}
          menuLabel={labels.newTask}
          notInstalledLabel={labels.providerNotInstalled}
          selectedEngineId={selectedEngineId}
          selectedModelId={selectedModelId}
          unavailableTitle={labels.workProvidersUnavailable}
          variant="work-sidebar"
          workbenchMode="work"
          onCreateSession={onCreateSession}
          onRequestProviderInstall={setProviderToInstall}
        />
      </div>

      <nav className="shrink-0 px-2 pb-3" aria-label={labels.assistant}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={'disabled' in item && item.disabled}
              title={'title' in item ? item.title : item.label}
              className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-left text-[13px] font-medium text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              data-work-navigation-item={item.id}
              onClick={'onClick' in item ? item.onClick : undefined}
            >
              <Icon size={17} strokeWidth={1.8} className="shrink-0 text-gray-400" aria-hidden="true" />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        ref={scrollRegionRef}
        className="project-explorer-scroll-region flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3"
      >
        <WorkModeSection
          count={pinnedCount}
          dataAttribute="pinned"
          label={labels.pinnedTasks}
        >
          {pinnedContent ?? (
            <div className="px-2 py-1.5 text-[11px] text-gray-600">{labels.noPinnedTasks}</div>
          )}
        </WorkModeSection>

        <WorkModeSection
          count={taskCount}
          dataAttribute="tasks"
          label={labels.tasks}
          sectionRef={tasksRef}
        >
          {taskContent ?? (
            <div className="px-2 py-1.5 text-[11px] text-gray-600">{labels.noTasks}</div>
          )}
        </WorkModeSection>

        <WorkModeSection
          count={projectCount}
          dataAttribute="projects"
          label={labels.projects}
          sectionRef={projectsRef}
        >
          {projectContent ?? (
            <div className="px-2 py-1.5 text-[11px] text-gray-600">{labels.noProjects}</div>
          )}
        </WorkModeSection>
      </div>
      {providerToInstall ? (
        <WorkProviderInstallDialog
          labels={{
            cancel: labels.providerInstallCancel,
            close: labels.providerInstallClose,
            desktopRequired: labels.providerInstallDesktopRequired,
            done: labels.providerInstallDone,
            install: labels.providerInstallAction,
            installDescription: labels.providerInstallDescription,
            installFailed: labels.providerInstallFailed,
            installing: labels.providerInstalling,
            officialSource: labels.providerInstallOfficialSource,
            ready: labels.providerInstallReady,
            restartRequired: labels.providerInstallRestartRequired,
            retry: labels.providerInstallRetry,
            title: labels.providerInstallTitle,
          }}
          providerId={providerToInstall}
          onClose={() => setProviderToInstall(null)}
          onInstall={installWorkbenchWorkProvider}
        />
      ) : null}
    </div>
  );
}
