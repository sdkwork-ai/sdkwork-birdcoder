import { useCallback, useEffect, useState } from 'react';
import { useIDEServices, useToast } from '@sdkwork/birdcoder-commons/workbench';
import { Button } from '@sdkwork/birdcoder-ui';
import { RunConfigurationDialog, RunTaskDialog } from '@sdkwork/birdcoder-ui/run-config';
import type { RunConfigurationRecord } from '@sdkwork/birdcoder-commons/workbench';
import type {
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectPublishResult,
  BirdCoderReleaseSummary,
} from '@sdkwork/birdcoder-types';
import { Code2, Copy, Globe, Lock, Share, Upload, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PublishTargetMode = 'existing' | 'new';

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

export interface StudioAnalyzeReport {
  loc: number;
  emptyLines: number;
  imports: number;
  functions: number;
  classes: number;
  complexity: number;
  maintainability: number;
}

export interface StudioDeleteConfirmation {
  type: 'message';
  id: string;
  parentId?: string;
}

interface StudioPageDialogsProps {
  isAnalyzeModalVisible: boolean;
  analyzeReport: StudioAnalyzeReport | null;
  onCloseAnalyze: () => void;
  isRunTaskVisible: boolean;
  runConfigurations: RunConfigurationRecord[];
  onCloseRunTask: () => void;
  onRunTask: (configuration: RunConfigurationRecord) => void;
  isRunConfigVisible: boolean;
  runConfigurationDraft: RunConfigurationRecord;
  onRunConfigurationDraftChange: (draft: RunConfigurationRecord) => void;
  onCloseRunConfig: () => void;
  onSubmitRunConfig: () => void | Promise<void>;
  isDebugConfigVisible: boolean;
  onCloseDebugConfig: () => void;
  onSaveDebugConfig: () => void;
  deleteConfirmation: StudioDeleteConfirmation | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  showShareModal: boolean;
  shareAccess: 'private' | 'public';
  publicShareUrl: string;
  collaborators: BirdCoderProjectCollaboratorSummary[];
  inviteEmail: string;
  isCollaboratorsLoading: boolean;
  isInvitePending: boolean;
  onShareAccessChange: (access: 'private' | 'public') => void;
  onCloseShare: () => void;
  onCopyPublicLink: () => void;
  onInviteEmailChange: (value: string) => void;
  onInviteCollaborator: () => void | Promise<void>;
  showPublishModal: boolean;
  publishProjectId?: string;
  publishProjectName?: string;
  onClosePublish: () => void;
}

export function StudioPageDialogs({
  isAnalyzeModalVisible,
  analyzeReport,
  onCloseAnalyze,
  isRunTaskVisible,
  runConfigurations,
  onCloseRunTask,
  onRunTask,
  isRunConfigVisible,
  runConfigurationDraft,
  onRunConfigurationDraftChange,
  onCloseRunConfig,
  onSubmitRunConfig,
  isDebugConfigVisible,
  onCloseDebugConfig,
  onSaveDebugConfig,
  deleteConfirmation,
  onCancelDelete,
  onConfirmDelete,
  showShareModal,
  shareAccess,
  publicShareUrl,
  collaborators,
  inviteEmail,
  isCollaboratorsLoading,
  isInvitePending,
  onShareAccessChange,
  onCloseShare,
  onCopyPublicLink,
  onInviteEmailChange,
  onInviteCollaborator,
  showPublishModal,
  publishProjectId,
  publishProjectName,
  onClosePublish,
}: StudioPageDialogsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { deploymentService } = useIDEServices();
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

  const resolveCollaboratorTitle = (collaborator: BirdCoderProjectCollaboratorSummary) =>
    collaborator.identityDisplayName?.trim() ||
    collaborator.identityEmail?.trim() ||
    collaborator.identityId;

  const resolveCollaboratorSubtitle = (collaborator: BirdCoderProjectCollaboratorSummary) => {
    const email = collaborator.identityEmail?.trim();
    if (email && email !== resolveCollaboratorTitle(collaborator)) {
      return email;
    }
    return collaborator.identityId;
  };

  const applyPublishTargetDraft = useCallback(
    (target?: BirdCoderDeploymentTargetSummary | null) => {
      setPublishEnvironmentKey(target?.environmentKey ?? 'prod');
      setPublishRuntime(target?.runtime ?? 'web');
      setPublishTargetName(
        target?.name?.trim() || `${publishProjectName?.trim() || 'Project'} Production`,
      );
    },
    [publishProjectName],
  );

  const loadDeploymentTargets = useCallback(async () => {
    const projectId = publishProjectId?.trim();
    if (!projectId) {
      setDeploymentTargets([]);
      setSelectedPublishTargetId('');
      setPublishTargetMode('new');
      applyPublishTargetDraft(null);
      return;
    }

    setIsLoadingDeploymentTargets(true);
    try {
      const targets = await deploymentService.getDeploymentTargets(projectId);
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
  }, [addToast, applyPublishTargetDraft, deploymentService, publishProjectId]);

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

  const handlePublishProject = async () => {
    const projectId = publishProjectId?.trim();
    if (!projectId) {
      addToast('Select a project before publishing.', 'error');
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
      const result = await deploymentService.publishProject(projectId, {
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
      addToast(
        `Published ${publishProjectName || 'project'} release ${result.release.releaseVersion}.`,
        'success',
      );
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
      {isAnalyzeModalVisible && analyzeReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <Code2 size={16} className="text-blue-400" />
                {t('studio.codeAnalysisReport')}
              </h3>
              <button onClick={onCloseAnalyze} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.linesOfCode')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.loc}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.emptyLines')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.emptyLines}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.functions')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.functions}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.classes')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.classes}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.complexity')}</div>
                  <div className="text-xl font-semibold text-gray-200">{analyzeReport.complexity}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-xs text-gray-500 mb-1">{t('studio.maintainability')}</div>
                  <div
                    className={`text-xl font-semibold ${analyzeReport.maintainability > 80 ? 'text-green-400' : analyzeReport.maintainability > 60 ? 'text-yellow-400' : 'text-red-400'}`}
                  >
                    {analyzeReport.maintainability}/100
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white" onClick={onCloseAnalyze}>
                  {t('studio.close')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RunTaskDialog
        open={isRunTaskVisible}
        title={t('studio.runTask')}
        configurations={runConfigurations}
        onClose={onCloseRunTask}
        onRun={onRunTask}
      />

      <RunConfigurationDialog
        open={isRunConfigVisible}
        title={t('studio.runConfig')}
        draft={runConfigurationDraft}
        onDraftChange={onRunConfigurationDraftChange}
        onClose={onCloseRunConfig}
        onSubmit={onSubmitRunConfig}
        nameLabel={t('studio.name')}
        commandLabel={t('studio.command')}
        profileLabel="Profile"
        workingDirectoryLabel="Working Directory"
        customDirectoryLabel="Custom Directory"
        taskGroupLabel="Task Group"
        cancelLabel={t('studio.cancel')}
        submitLabel={t('studio.save')}
        projectLabel="Project"
        workspaceLabel="Workspace"
        customLabel="Custom"
        devLabel="Dev"
        buildLabel="Build"
        testLabel="Test"
        customGroupLabel="Custom"
      />

      {isDebugConfigVisible && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-200">{t('studio.debugConfig')}</h3>
              <button onClick={onCloseDebugConfig} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                The Rust debugger host API is not wired yet. Debug attach remains unavailable until
                the server-side debugger bridge is implemented.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.name')}</label>
                <input
                  type="text"
                  defaultValue="Launch Chrome against localhost"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.url')}</label>
                <input
                  type="text"
                  defaultValue="http://localhost:3000"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('studio.webRoot')}</label>
                <input
                  type="text"
                  defaultValue="${workspaceFolder}/src"
                  disabled
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={onCloseDebugConfig}>
                  {t('studio.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={onSaveDebugConfig}
                  disabled
                >
                  {t('studio.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('studio.delete')} {deleteConfirmation.type.charAt(0).toUpperCase() + deleteConfirmation.type.slice(1)}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {t('studio.deleteConfirm', { type: deleteConfirmation.type })}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCancelDelete}
                className="border-white/10 text-gray-300 hover:bg-white/5"
              >
                {t('studio.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={onConfirmDelete}
                className="bg-red-500 hover:bg-red-600 text-white border-transparent"
              >
                {t('studio.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#0e0e11] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#18181b]/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Share size={18} className="text-blue-400" />
                {t('studio.shareProject')}
              </h3>
              <button
                onClick={onCloseShare}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">{t('studio.accessLevel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${shareAccess === 'private' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#18181b] border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
                    onClick={() => onShareAccessChange('private')}
                  >
                    <Lock size={24} />
                    <span className="text-sm font-medium">{t('studio.private')}</span>
                  </button>
                  <button
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${shareAccess === 'public' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#18181b] border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'}`}
                    onClick={() => onShareAccessChange('public')}
                  >
                    <Globe size={24} />
                    <span className="text-sm font-medium">{t('studio.publicLink')}</span>
                  </button>
                </div>
              </div>

              {shareAccess === 'public' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-gray-300">{t('studio.publicLink')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicShareUrl}
                      className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <Button
                      onClick={onCopyPublicLink}
                      className="bg-[#18181b] hover:bg-white/10 text-white border border-white/10"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
              )}

              {shareAccess === 'private' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-gray-300">{t('studio.inviteCollaborators')}</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => onInviteEmailChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void onInviteCollaborator();
                        }
                      }}
                      placeholder={t('studio.emailAddress')}
                      className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <Button
                      onClick={() => void onInviteCollaborator()}
                      disabled={!inviteEmail.trim() || isInvitePending}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {isInvitePending ? <Loader2 size={16} className="animate-spin" /> : t('studio.invite')}
                    </Button>
                  </div>
                  {(isCollaboratorsLoading || collaborators.length > 0) && (
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/5 bg-[#121214] p-2">
                      {isCollaboratorsLoading ? (
                        <div className="flex justify-center py-3 text-gray-400">
                          <Loader2 size={16} className="animate-spin" />
                        </div>
                      ) : (
                        collaborators.map((collaborator) => (
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
              )}
            </div>
            <div className="p-4 border-t border-white/5 bg-[#18181b]/30 flex justify-end gap-3">
              <Button variant="outline" onClick={onCloseShare}>
                {t('studio.done')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#0e0e11] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#18181b]/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload size={18} className="text-blue-400" />
                Publish Project
              </h3>
              <button
                onClick={onClosePublish}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {!publishProjectId ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Select a project before publishing.
                </div>
              ) : (
                <>
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-gray-200">Deployment target</div>
                        <p className="mt-1 text-xs text-gray-500">
                          Reuse a saved target or create a new target in the Rust server before recording the release.
                        </p>
                      </div>

                      <div className="flex gap-2 rounded-lg border border-white/5 bg-[#18181b] p-1">
                        <button
                          type="button"
                          onClick={() => setPublishTargetMode('existing')}
                          disabled={deploymentTargets.length === 0}
                          className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                            publishTargetMode === 'existing'
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
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
                              : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
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
                              className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                            <div className="rounded-md border border-white/5 bg-[#18181b] px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Environment</div>
                              <div className="mt-1 text-sm text-gray-200">{publishEnvironmentKey}</div>
                            </div>
                            <div className="rounded-md border border-white/5 bg-[#18181b] px-3 py-2">
                              <div className="text-[11px] uppercase tracking-wide text-gray-500">Runtime</div>
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
                              placeholder="Production"
                              className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                                className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                                className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                          Release, deployment, and target metadata are persisted through the server API.
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
                            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Rollout stage
                          </label>
                          <select
                            value={publishRolloutStage}
                            onChange={(event) => setPublishRolloutStage(event.target.value)}
                            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
                            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {publishResult && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <Upload size={18} className="mt-0.5 text-emerald-300" />
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
            <div className="p-4 border-t border-white/5 bg-[#18181b]/30 flex justify-end gap-3">
              <Button variant="outline" onClick={onClosePublish}>
                {t('studio.done')}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={() => {
                  void handlePublishProject();
                }}
                disabled={
                  !publishProjectId ||
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
    </>
  );
}
