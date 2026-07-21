import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  CheckCircle2,
  FileCode2,
  Globe,
  Loader2,
  Lock,
  Share,
  Smartphone,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import type {
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectPublishResult,
  BirdCoderReleaseSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  ProjectGitDiffDialog,
  ProjectGitHeaderControls,
  ProjectGitSubmitDialog,
  type ProjectGitSubmitMode,
} from '@sdkwork/birdcoder-pc-ui';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import type { ProjectGitOverviewViewState } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useProjectGitOverview } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectGitOverview';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useToast } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { useTranslation } from 'react-i18next';

type PublishTargetMode = 'existing' | 'new';
type TopBarDensity = 'regular' | 'balanced' | 'compact' | 'minimal';

const PUBLISH_ENVIRONMENT_OPTIONS: Array<{
  value: BirdCoderDeploymentTargetSummary['environmentKey'];
  label: string;
}> = [
  { value: 'dev', label: 'Development' },
  { value: 'test', label: 'Test' },
  { value: 'staging', label: 'Staging' },
  { value: 'prod', label: 'Production' },
];

const PUBLISH_RUNTIME_OPTIONS: Array<{
  value: BirdCoderDeploymentTargetSummary['runtime'];
  label: string;
}> = [
  { value: 'web', label: 'Web' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'server', label: 'Server' },
  { value: 'container', label: 'Container' },
  { value: 'kubernetes', label: 'Kubernetes' },
];

const PUBLISH_RELEASE_KIND_OPTIONS: Array<{
  value: BirdCoderReleaseSummary['releaseKind'];
  label: string;
}> = [
  { value: 'formal', label: 'Formal' },
  { value: 'canary', label: 'Canary' },
  { value: 'hotfix', label: 'Hotfix' },
  { value: 'rollback', label: 'Rollback' },
];

const PUBLISH_ROLLOUT_STAGE_OPTIONS = [
  { value: 'full', label: 'Full rollout' },
  { value: 'canary', label: 'Canary rollout' },
  { value: 'staged', label: 'Staged rollout' },
];

function resolveDefaultPublishTargetName(
  runtime: BirdCoderDeploymentTargetSummary['runtime'],
  projectName?: string,
) {
  return runtime === 'web' ? 'SDKWORK Cloud Web' : `${projectName?.trim() || 'App'} Production`;
}

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
  const { addToast } = useToast();
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

  const [showShareModal, setShowShareModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showGitDiffDialog, setShowGitDiffDialog] = useState(false);
  const [gitSubmitMode, setGitSubmitMode] = useState<ProjectGitSubmitMode | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [projectCollaborators, setProjectCollaborators] = useState<
    BirdCoderProjectCollaboratorSummary[]
  >([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isInvitingCollaborator, setIsInvitingCollaborator] = useState(false);

  useEffect(
    () => globalEventBus.on('toggleDiffPanel', () => {
      setShowGitDiffDialog((isOpen) => !isOpen);
    }),
    [],
  );
  const [deploymentTargets, setDeploymentTargets] = useState<BirdCoderDeploymentTargetSummary[]>(
    [],
  );
  const [publishTargetMode, setPublishTargetMode] = useState<PublishTargetMode>('new');
  const [selectedPublishTargetId, setSelectedPublishTargetId] = useState('');
  const [publishTargetName, setPublishTargetName] = useState('');
  const [publishEnvironmentKey, setPublishEnvironmentKey] =
    useState<BirdCoderDeploymentTargetSummary['environmentKey']>('prod');
  const [publishRuntime, setPublishRuntime] =
    useState<BirdCoderDeploymentTargetSummary['runtime']>('web');
  const [publishReleaseKind, setPublishReleaseKind] =
    useState<BirdCoderReleaseSummary['releaseKind']>('formal');
  const [publishReleaseVersion, setPublishReleaseVersion] = useState('');
  const [publishRolloutStage, setPublishRolloutStage] = useState('full');
  const [publishEndpointUrl, setPublishEndpointUrl] = useState('');
  const [publishResult, setPublishResult] = useState<BirdCoderProjectPublishResult | null>(null);
  const [isLoadingDeploymentTargets, setIsLoadingDeploymentTargets] = useState(false);
  const [isPublishingProject, setIsPublishingProject] = useState(false);
  const { collaborationService, deploymentService } = useIDEServices();
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

  const applyPublishTargetDraft = useCallback(
    (target?: BirdCoderDeploymentTargetSummary | null) => {
      setPublishEnvironmentKey(target?.environmentKey ?? 'prod');
      setPublishRuntime(target?.runtime ?? 'web');
      setPublishTargetName(
        target?.name?.trim()
          || resolveDefaultPublishTargetName(target?.runtime ?? 'web', projectName),
      );
    },
    [projectName],
  );

  const loadProjectCollaborators = useCallback(async () => {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId) {
      setProjectCollaborators([]);
      return;
    }

    setIsLoadingCollaborators(true);
    try {
      const collaborators = await collaborationService.listProjectCollaborators(normalizedProjectId);
      setProjectCollaborators(collaborators);
    } catch (error) {
      console.error('Failed to load project collaborators', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load project collaborators.',
        'error',
      );
    } finally {
      setIsLoadingCollaborators(false);
    }
  }, [addToast, collaborationService, projectId]);

  const loadDeploymentTargets = useCallback(async () => {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId) {
      setDeploymentTargets([]);
      setSelectedPublishTargetId('');
      setPublishTargetMode('new');
      applyPublishTargetDraft(null);
      return;
    }

    setIsLoadingDeploymentTargets(true);
    try {
      const targets = await deploymentService.getDeploymentTargets(normalizedProjectId);
      setDeploymentTargets(targets);
      const primaryTarget = targets[0];
      setSelectedPublishTargetId(primaryTarget?.id ?? '');
      setPublishTargetMode(primaryTarget ? 'existing' : 'new');
      applyPublishTargetDraft(primaryTarget);
    } catch (error) {
      console.error('Failed to load deployment targets', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to load deployment targets.',
        'error',
      );
    } finally {
      setIsLoadingDeploymentTargets(false);
    }
  }, [addToast, applyPublishTargetDraft, deploymentService, projectId]);

  useEffect(() => {
    if (!showShareModal) {
      return;
    }
    void loadProjectCollaborators();
  }, [loadProjectCollaborators, showShareModal]);

  useEffect(() => {
    if (!showShareModal) {
      setInviteUserId('');
    }
  }, [showShareModal]);

  useEffect(() => {
    if (!showPublishModal) {
      setPublishResult(null);
      return;
    }
    void loadDeploymentTargets();
  }, [loadDeploymentTargets, showPublishModal]);

  useEffect(() => {
    if (publishTargetMode !== 'existing') {
      return;
    }
    const target = deploymentTargets.find(
      (deploymentTarget) => deploymentTarget.id === selectedPublishTargetId,
    );
    applyPublishTargetDraft(target);
  }, [
    applyPublishTargetDraft,
    deploymentTargets,
    publishTargetMode,
    selectedPublishTargetId,
  ]);

  const handleInviteCollaborator = async () => {
    const normalizedProjectId = projectId?.trim();
    const userId = inviteUserId.trim();
    if (!normalizedProjectId) {
      addToast('Please select a project before inviting collaborators.', 'error');
      return;
    }
    if (!userId || isInvitingCollaborator) {
      return;
    }

    setIsInvitingCollaborator(true);
    try {
      await collaborationService.upsertProjectCollaborator(normalizedProjectId, {
        userId,
        role: 'member',
        status: 'invited',
      });
      setInviteUserId('');
      addToast(t('code.invitationSent'), 'success');
      await loadProjectCollaborators();
    } catch (error) {
      console.error('Failed to invite collaborator', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to invite collaborator.',
        'error',
      );
    } finally {
      setIsInvitingCollaborator(false);
    }
  };

  const resolveCollaboratorTitle = (collaborator: BirdCoderProjectCollaboratorSummary) =>
    collaborator.userDisplayName?.trim() ||
    collaborator.userEmail?.trim() ||
    collaborator.userId;

  const resolveCollaboratorSubtitle = (collaborator: BirdCoderProjectCollaboratorSummary) => {
    const email = collaborator.userEmail?.trim();
    if (email && email !== resolveCollaboratorTitle(collaborator)) {
      return email;
    }
    return collaborator.userId;
  };

  const handlePublishProject = async () => {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId) {
      addToast('Please select a project before publishing.', 'error');
      return;
    }
    if (isPublishingProject) {
      return;
    }
    if (publishTargetMode === 'existing' && !selectedPublishTargetId.trim()) {
      addToast('Select a deployment target before publishing.', 'error');
      return;
    }
    if (publishTargetMode === 'new' && !publishTargetName.trim()) {
      addToast('Deployment target name is required.', 'error');
      return;
    }

    setIsPublishingProject(true);
    try {
      const result = await deploymentService.publishProject(normalizedProjectId, {
        endpointUrl: publishEndpointUrl.trim() || undefined,
        releaseKind: publishReleaseKind,
        releaseVersion: publishReleaseVersion.trim() || undefined,
        rolloutStage: publishRolloutStage.trim() || undefined,
        ...(publishTargetMode === 'existing'
          ? {
              targetId: selectedPublishTargetId.trim(),
            }
          : {
              environmentKey: publishEnvironmentKey,
              runtime: publishRuntime,
              targetName: publishTargetName.trim(),
            }),
      });
      setPublishResult(result);
      setSelectedPublishTargetId(result.target.id);
      setPublishTargetMode('existing');
      applyPublishTargetDraft(result.target);
      addToast(`Published ${projectName || 'project'} release ${result.release.releaseVersion}.`, 'success');
      await loadDeploymentTargets();
    } catch (error) {
      console.error('Failed to publish project', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to publish project.',
        'error',
      );
    } finally {
      setIsPublishingProject(false);
    }
  };

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

          <Button
            variant="ghost"
            size="sm"
            title={t('app.menu.share')}
            aria-label={t('app.menu.share')}
            className={`h-8 text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white animate-in fade-in slide-in-from-top-2 fill-mode-both ${
              showPrimaryActionLabels ? 'gap-1.5 px-2.5' : 'w-8 px-0'
            }`}
            style={{ animationDelay: '250ms' }}
            onClick={() => setShowShareModal(true)}
          >
            <Share size={14} />
            {showPrimaryActionLabels ? <span>{t('app.menu.share')}</span> : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title={t('app.menu.publish')}
            aria-label={t('app.menu.publish')}
            className={`h-8 text-xs text-gray-300 hover:bg-white/[0.08] hover:text-white animate-in fade-in slide-in-from-top-2 fill-mode-both ${
              showPrimaryActionLabels ? 'gap-1.5 px-2.5' : 'w-8 px-0'
            }`}
            style={{ animationDelay: '300ms' }}
            onClick={() => setShowPublishModal(true)}
          >
            <Upload size={14} />
            {showPrimaryActionLabels ? <span>{t('app.menu.publish')}</span> : null}
          </Button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="code-share-dialog-title"
            className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3
                id="code-share-dialog-title"
                className="text-lg font-semibold text-white flex items-center gap-2"
              >
                <Share size={18} className="text-blue-400" />
                {t('app.shareProject')}
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                aria-label={t('app.close')}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-300">{t('app.accessLevel')}</div>
                <div className="grid grid-cols-2 gap-3" role="group" aria-label={t('app.accessLevel')}>
                  <div
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-blue-500 bg-blue-600/10 p-4 text-blue-400"
                  >
                    <Lock size={24} aria-hidden="true" />
                    <span className="text-sm font-medium">{t('app.private')}</span>
                  </div>
                  <button
                    type="button"
                    disabled
                    aria-describedby="code-public-share-unavailable"
                    className="flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#121214] p-4 text-gray-500 opacity-70"
                  >
                    <Globe size={24} aria-hidden="true" />
                    <span className="text-sm font-medium">{t('app.publicLink')}</span>
                    <span className="text-[11px] font-medium uppercase text-amber-300">
                      {t('app.publicLinkUnavailable')}
                    </span>
                  </button>
                </div>
                <div
                  id="code-public-share-unavailable"
                  role="status"
                  className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-amber-100"
                >
                  <Lock size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <p className="text-xs leading-5 text-amber-100/80">
                    {t('app.publicLinkUnavailableDesc')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <label
                  className="text-sm font-medium text-gray-300"
                  htmlFor="code-share-invite-user-id"
                >
                  {t('app.inviteCollaborators')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="code-share-invite-user-id"
                    type="text"
                    value={inviteUserId}
                    onChange={(event) => setInviteUserId(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleInviteCollaborator();
                      }
                    }}
                    placeholder="User ID"
                    className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                  />
                  <Button
                    onClick={() => void handleInviteCollaborator()}
                    disabled={!inviteUserId.trim() || isInvitingCollaborator || !projectId}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {isInvitingCollaborator ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      t('app.invite')
                    )}
                  </Button>
                </div>
                {(isLoadingCollaborators || projectCollaborators.length > 0) && (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/5 bg-[#121214] p-2">
                    {isLoadingCollaborators ? (
                      <div className="flex justify-center py-3 text-gray-400">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                    ) : (
                      projectCollaborators.map((collaborator) => (
                        <div
                          key={collaborator.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-black/20 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-200">
                              {resolveCollaboratorTitle(collaborator)}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {resolveCollaboratorSubtitle(collaborator)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-wide">
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-gray-300">
                              {collaborator.role}
                            </span>
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-300">
                              {collaborator.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowShareModal(false)}>{t('app.done')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload size={18} className="text-blue-400" />
                Publish App
              </h3>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {!projectId ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Select a project before publishing.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <Globe size={18} className="mt-0.5 text-blue-300" />
                      <div>
                        <div className="text-sm font-semibold text-blue-50">
                          One-click publish from the IDE
                        </div>
                        <p className="mt-1 text-xs leading-5 text-blue-100/75">
                          Build and publish the current app to SDKWORK Cloud by default, then record
                          release, endpoint, and deployment evidence for the workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-200">Publish destination</div>
                        <p className="mt-1 text-xs text-gray-500">
                          Choose an existing destination or use the default SDKWORK Cloud app target.
                        </p>
                      </div>

                      <div className="flex gap-2 rounded-lg border border-white/5 bg-[#121214] p-1">
                        <button
                          type="button"
                          onClick={() => setPublishTargetMode('existing')}
                          disabled={deploymentTargets.length === 0}
                          className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                            publishTargetMode === 'existing'
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          } ${deploymentTargets.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          Existing target
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublishTargetMode('new')}
                          className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                            publishTargetMode === 'new'
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                          }`}
                        >
                          New target
                        </button>
                      </div>

                      {isLoadingDeploymentTargets ? (
                        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-4 text-sm text-gray-400">
                          <Loader2 size={16} className="animate-spin" />
                          Loading deployment targets...
                        </div>
                      ) : publishTargetMode === 'existing' ? (
                        <div className="space-y-3 rounded-lg border border-white/5 bg-black/20 p-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Target
                            </label>
                            <select
                              value={selectedPublishTargetId}
                              onChange={(event) => setSelectedPublishTargetId(event.target.value)}
                              className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              disabled={deploymentTargets.length === 0}
                            >
                              {deploymentTargets.length === 0 ? (
                                <option value="">No deployment targets found</option>
                              ) : (
                                deploymentTargets.map((target) => (
                                  <option key={target.id} value={target.id}>
                                    {target.name} ({target.environmentKey} / {target.runtime})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                            <div className="rounded-md border border-white/5 bg-[#121214] px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Environment</div>
                              <div className="mt-1 text-sm text-gray-200">{publishEnvironmentKey}</div>
                            </div>
                            <div className="rounded-md border border-white/5 bg-[#121214] px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">App mode</div>
                              <div className="mt-1 text-sm text-gray-200">{publishRuntime}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-lg border border-white/5 bg-black/20 p-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Target name
                            </label>
                            <input
                              type="text"
                              value={publishTargetName}
                              onChange={(event) => setPublishTargetName(event.target.value)}
                              placeholder="SDKWORK Cloud Web"
                              className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Environment
                              </label>
                              <select
                                value={publishEnvironmentKey}
                                onChange={(event) =>
                                  setPublishEnvironmentKey(
                                    event.target.value as BirdCoderDeploymentTargetSummary['environmentKey'],
                                  )
                                }
                                className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              >
                                {PUBLISH_ENVIRONMENT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Runtime
                              </label>
                              <select
                                value={publishRuntime}
                                onChange={(event) =>
                                  setPublishRuntime(
                                    event.target.value as BirdCoderDeploymentTargetSummary['runtime'],
                                  )
                                }
                                className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              >
                                {PUBLISH_RUNTIME_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-200">Release settings</div>
                        <p className="mt-1 text-xs text-gray-500">
                          These values are stored in the Rust server as release and deployment records.
                        </p>
                      </div>

                      <div className="space-y-3 rounded-lg border border-white/5 bg-black/20 p-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Release kind
                          </label>
                          <select
                            value={publishReleaseKind}
                            onChange={(event) =>
                              setPublishReleaseKind(
                                event.target.value as BirdCoderReleaseSummary['releaseKind'],
                              )
                            }
                            className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          >
                            {PUBLISH_RELEASE_KIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Release version
                          </label>
                          <input
                            type="text"
                            value={publishReleaseVersion}
                            onChange={(event) => setPublishReleaseVersion(event.target.value)}
                            placeholder="Optional"
                            className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Rollout stage
                          </label>
                          <select
                            value={publishRolloutStage}
                            onChange={(event) => setPublishRolloutStage(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          >
                            {PUBLISH_ROLLOUT_STAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Endpoint URL
                          </label>
                          <input
                            type="text"
                            value={publishEndpointUrl}
                            onChange={(event) => setPublishEndpointUrl(event.target.value)}
                            placeholder="https://example.sdkwork.app"
                            className="w-full rounded-md border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {publishResult && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 size={18} className="mt-0.5 text-emerald-300" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-emerald-100">
                            Release {publishResult.release.releaseVersion} recorded
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-emerald-50/90 sm:grid-cols-3">
                            <div>
                              <div className="uppercase tracking-wide text-emerald-200/70">Target</div>
                              <div className="mt-1 break-all">{publishResult.target.name}</div>
                            </div>
                            <div>
                              <div className="uppercase tracking-wide text-emerald-200/70">Release</div>
                              <div className="mt-1 break-all">{publishResult.release.id}</div>
                            </div>
                            <div>
                              <div className="uppercase tracking-wide text-emerald-200/70">Deployment</div>
                              <div className="mt-1 break-all">
                                {publishResult.deployment.id} ({publishResult.deployment.status})
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPublishModal(false)}>
                {t('app.cancel')}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={handlePublishProject}
                disabled={
                  !projectId ||
                  isLoadingDeploymentTargets ||
                  isPublishingProject ||
                  (publishTargetMode === 'existing' && !selectedPublishTargetId.trim()) ||
                  (publishTargetMode === 'new' && !publishTargetName.trim())
                }
              >
                {isPublishingProject ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Publishing...
                  </span>
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

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

