import { memo, useState, useRef, useEffect } from 'react';
import {
  Bot,
  FileCode2,
  Loader2,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { ProjectGitDiffDialog } from '@sdkwork/birdcoder-pc-ui/components/ProjectGitDiffDialog';
import { ProjectGitHeaderControls } from '@sdkwork/birdcoder-pc-ui/components/ProjectGitHeaderControls';
import {
  ProjectGitSubmitDialog,
  type ProjectGitSubmitMode,
} from '@sdkwork/birdcoder-pc-ui/components/ProjectGitSubmitDialog';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useProjectGitOverview } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useTranslation } from 'react-i18next';

type TopBarDensity = 'regular' | 'balanced' | 'compact' | 'minimal';

function resolveTopBarDensity(width: number): TopBarDensity {
  if (width >= 1180) {
    return 'regular';
  }
  if (width >= 960) {
    return 'balanced';
  }
  if (width >= 720) {
    return 'compact';
  }
  return 'minimal';
}

export interface TopBarProps {
  projectId?: string;
  projectName?: string;
  isProjectGitOverviewDrawerOpen: boolean;
  onToggleProjectGitOverviewDrawer: () => void;
  isEngineBusyCurrentSession?: boolean;
  selectedSessionTitle?: string;
  projectGitOverviewState?: ProjectGitOverviewViewState;
  activeTab: 'ai' | 'editor' | 'mobile';
  setActiveTab: (tab: 'ai' | 'editor' | 'mobile') => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (isOpen: boolean) => void;
}

function TopBarComponent({
  projectId,
  projectName,
  isProjectGitOverviewDrawerOpen,
  onToggleProjectGitOverviewDrawer,
  isEngineBusyCurrentSession = false,
  selectedSessionTitle,
  projectGitOverviewState,
  activeTab,
  setActiveTab,
  isTerminalOpen,
  setIsTerminalOpen,
}: TopBarProps) {
  const [topBarDensity, setTopBarDensity] = useState<TopBarDensity>('compact');
  const topBarRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const showSessionTitle = topBarDensity !== 'minimal';
  const showTabLabels = topBarDensity === 'regular' || topBarDensity === 'balanced';
  const useCompactGitControls = topBarDensity !== 'regular';
  const showPrimaryActionLabels = topBarDensity === 'regular';
  const topBarActionGapClassName = topBarDensity === 'regular' ? 'gap-1.5' : 'gap-1';
  const projectDisplayLabel = projectName || '-';
  const sessionDisplayLabel = selectedSessionTitle || '-';
  const headerTitle = `${projectDisplayLabel} / ${sessionDisplayLabel}`;
  const localProjectGitOverviewState = useProjectGitOverview({
    isActive: !projectGitOverviewState,
    projectId,
  });
  const resolvedProjectGitOverviewState =
    projectGitOverviewState ?? localProjectGitOverviewState;

  const [showGitDiffDialog, setShowGitDiffDialog] = useState(false);
  const [gitSubmitMode, setGitSubmitMode] = useState<ProjectGitSubmitMode | null>(null);

  useEffect(
    () => globalEventBus.on('toggleDiffPanel', () => {
      setShowGitDiffDialog((isOpen) => !isOpen);
    }),
    [],
  );
  useEffect(() => {
    const element = topBarRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateDensity = (width: number) => {
      setTopBarDensity((previousDensity) => {
        const nextDensity = resolveTopBarDensity(width);
        return previousDensity === nextDensity ? previousDensity : nextDensity;
      });
    };

    updateDensity(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      updateDensity(entries[0]?.contentRect.width ?? element.getBoundingClientRect().width);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div
        ref={topBarRef}
        className="birdcoder-workbench-header relative z-50 flex h-12 shrink-0 items-center gap-2 overflow-visible border-b px-3 text-sm text-gray-100 sm:px-4"
      >
        <div
          aria-hidden={topBarDensity === 'minimal' ? 'true' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-top-2 fill-mode-both ${
            topBarDensity === 'minimal' ? 'invisible' : ''
          }`}
          data-code-page-title="true"
          style={{ animationDelay: '100ms' }}
          title={headerTitle}
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden font-medium text-gray-200">
            <span className="min-w-0 truncate text-sm font-semibold text-gray-100 transition-colors">
              {projectDisplayLabel}
            </span>
            {showSessionTitle ? (
              <>
                <span className="shrink-0 text-xs text-gray-600">/</span>
                <span className="min-w-[4rem] max-w-[13rem] truncate text-sm text-gray-400 transition-colors">
                  {sessionDisplayLabel}
                </span>
              </>
            ) : null}
            {isEngineBusyCurrentSession && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-200">
                <Loader2 size={12} className="animate-spin" />
                <span>{t('code.executingSession')}</span>
              </span>
            )}
          </div>
        </div>

        <div
          className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg bg-transparent p-0 animate-in fade-in slide-in-from-top-2 fill-mode-both"
          style={{ animationDelay: '125ms' }}
          aria-label="Code view mode"
        >
          <button
            type="button"
            title={t('app.menu.aiMode')}
            aria-label={t('app.menu.aiMode')}
            onClick={() => setActiveTab('ai')}
            className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors duration-150 ${
              showTabLabels ? 'min-w-[4.5rem] gap-1.5 px-3' : 'w-8 px-0'
            } ${activeTab === 'ai' ? 'bg-white/[0.07] text-white' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'}`}
          >
            <Bot size={14} />
            {showTabLabels ? <span className="truncate">{t('app.menu.aiMode')}</span> : null}
          </button>
          <button
            type="button"
            title={t('app.menu.editorMode')}
            aria-label={t('app.menu.editorMode')}
            onClick={() => setActiveTab('editor')}
            className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors duration-150 ${
              showTabLabels ? 'min-w-[4.75rem] gap-1.5 px-3' : 'w-8 px-0'
            } ${activeTab === 'editor' ? 'bg-white/[0.07] text-white' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'}`}
          >
            <FileCode2 size={14} />
            {showTabLabels ? <span className="truncate">{t('app.menu.editorMode')}</span> : null}
          </button>
          <button
            type="button"
            title={t('app.menu.mobileCodingMode')}
            aria-label={t('app.menu.mobileCodingMode')}
            onClick={() => setActiveTab('mobile')}
            className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors duration-150 ${
              showTabLabels ? 'min-w-[5.5rem] gap-1.5 px-3' : 'w-8 px-0'
            } ${activeTab === 'mobile' ? 'bg-white/[0.07] text-white' : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'}`}
          >
            <Smartphone size={14} />
            {showTabLabels ? (
              <span className="truncate">{t('app.menu.mobileCodingMode')}</span>
            ) : null}
          </button>
        </div>

        <div className={`ml-auto flex w-max max-w-full shrink-0 flex-nowrap items-center justify-end whitespace-nowrap text-gray-400 [&>*]:shrink-0 ${topBarActionGapClassName}`}>
          <ProjectGitHeaderControls
            compactControls={useCompactGitControls}
            isOverviewDrawerOpen={isProjectGitOverviewDrawerOpen}
            onRequestCommit={() => setGitSubmitMode('commit')}
            onRequestPush={() => setGitSubmitMode('commitAndPush')}
            onRequestViewDiff={() => setShowGitDiffDialog(true)}
            onToggleOverviewDrawer={onToggleProjectGitOverviewDrawer}
            projectId={projectId}
            projectGitOverviewState={resolvedProjectGitOverviewState}
            showBranchControl
            showOverviewDrawerToggle={activeTab === 'editor'}
            showWorktreeControl
            variant="topbar"
          />

          <Button
            variant="ghost"
            size="sm"
            title={t('app.terminal')}
            aria-label={t('app.terminal')}
            className={`h-8 text-xs transition-colors animate-in fade-in slide-in-from-top-2 fill-mode-both ${
              showPrimaryActionLabels ? 'gap-1.5 px-2.5' : 'w-8 px-0'
            } ${isTerminalOpen ? 'bg-blue-500/[0.12] text-blue-300 hover:bg-blue-500/[0.16] hover:text-blue-200' : 'text-gray-400 hover:bg-white/[0.06] hover:text-gray-200'}`}
            style={{ animationDelay: '225ms' }}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          >
            <Terminal size={14} />
            {showPrimaryActionLabels ? <span>{t('app.terminal')}</span> : null}
          </Button>

        </div>
      </div>

      <ProjectGitDiffDialog
        isOpen={showGitDiffDialog}
        onClose={() => setShowGitDiffDialog(false)}
        projectId={projectId}
      />
      <ProjectGitSubmitDialog
        initialMode={gitSubmitMode ?? 'commit'}
        isOpen={gitSubmitMode !== null}
        onClose={() => setGitSubmitMode(null)}
        projectGitOverviewState={resolvedProjectGitOverviewState}
        projectId={projectId}
      />
    </>
  );
}

export const TopBar = memo(TopBarComponent);
TopBar.displayName = 'TopBar';
