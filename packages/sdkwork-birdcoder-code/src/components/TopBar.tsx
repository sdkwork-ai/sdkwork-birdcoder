import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, GitBranch, CheckCircle2, Share, Upload, Terminal, X, Copy, Globe, Lock, Plus, Loader2 } from 'lucide-react';
import type {
  BirdCoderCodingSession,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProject,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectPublishResult,
  BirdCoderReleaseSummary,
} from '@sdkwork/birdcoder-types';
import { Button } from '@sdkwork/birdcoder-ui';
import { globalEventBus, useIDEServices, useToast } from '@sdkwork/birdcoder-commons/workbench';
import { useTranslation } from 'react-i18next';
import {
  executeGitCommand,
  listGitBranches,
  normalizeGitBranchName,
  requireDesktopGitRepositoryPath,
} from './gitRuntime';

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

interface TopBarProps {
  currentProject: BirdCoderProject | undefined;
  selectedCodingSession: BirdCoderCodingSession | undefined;
  activeTab: 'ai' | 'editor';
  setActiveTab: (tab: 'ai' | 'editor') => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (isOpen: boolean) => void;
}

export function TopBar({
  currentProject,
  selectedCodingSession,
  activeTab,
  setActiveTab,
  isTerminalOpen,
  setIsTerminalOpen,
}: TopBarProps) {
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main', 'dev', 'feature/auth']);
  const { addToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const repositoryPath = requireDesktopGitRepositoryPath(currentProject?.path);
        const branchState = await listGitBranches(repositoryPath);
        if (branchState.currentBranch) {
          setSelectedBranch(branchState.currentBranch);
        }
        if (branchState.branches.length > 0) {
          setBranches(branchState.branches);
        }
      } catch (err) {
        console.error('Failed to fetch branches', err);
      }
    };
    
    if (showBranchMenu) {
      fetchBranches();
    }
  }, [showBranchMenu, currentProject?.path]);

  const [showSubmitMenu, setShowSubmitMenu] = useState(false);
  const submitMenuRef = useRef<HTMLDivElement>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [shareAccess, setShareAccess] = useState<'private' | 'public'>('private');
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectCollaborators, setProjectCollaborators] = useState<
    BirdCoderProjectCollaboratorSummary[]
  >([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isInvitingCollaborator, setIsInvitingCollaborator] = useState(false);
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

  const applyPublishTargetDraft = useCallback(
    (target?: BirdCoderDeploymentTargetSummary | null) => {
      setPublishEnvironmentKey(target?.environmentKey ?? 'prod');
      setPublishRuntime(target?.runtime ?? 'web');
      setPublishTargetName(
        target?.name?.trim() || `${currentProject?.name?.trim() || 'Project'} Production`,
      );
    },
    [currentProject?.name],
  );

  const loadProjectCollaborators = useCallback(async () => {
    const projectId = currentProject?.id?.trim();
    if (!projectId) {
      setProjectCollaborators([]);
      return;
    }

    setIsLoadingCollaborators(true);
    try {
      const collaborators = await collaborationService.listProjectCollaborators(projectId);
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
  }, [addToast, collaborationService, currentProject?.id]);

  const loadDeploymentTargets = useCallback(async () => {
    const projectId = currentProject?.id?.trim();
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
  }, [addToast, applyPublishTargetDraft, currentProject?.id, deploymentService]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    
    try {
      const repositoryPath = requireDesktopGitRepositoryPath(currentProject?.path);
      await executeGitCommand(repositoryPath, ['add', '--all']);
      await executeGitCommand(repositoryPath, ['commit', '-m', commitMessage.trim()]);
      addToast(t('code.changesCommitted'), 'success');
    } catch (err) {
      addToast(t('code.failedToCommit', { error: String(err) }), 'error');
    }
    
    setShowCommitModal(false);
    setCommitMessage('');
  };

  const handlePush = async () => {
    try {
      const repositoryPath = requireDesktopGitRepositoryPath(currentProject?.path);
      const branchName = normalizeGitBranchName(selectedBranch);
      addToast(t('code.pushingToRemote'), 'info');
      await executeGitCommand(repositoryPath, ['push', 'origin', branchName]);
      addToast(t('code.pushedToRemote'), 'success');
    } catch (err) {
      addToast(t('code.failedToPush', { error: String(err) }), 'error');
    }
    setShowPushModal(false);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    
    try {
      const repositoryPath = requireDesktopGitRepositoryPath(currentProject?.path);
      const branchName = normalizeGitBranchName(newBranchName);
      await executeGitCommand(repositoryPath, ['switch', '-c', branchName]);
      setSelectedBranch(branchName);
      setBranches((previousBranches) =>
        previousBranches.includes(branchName) ? previousBranches : [branchName, ...previousBranches],
      );
      addToast(t('code.createdAndSwitchedBranch', { branch: branchName }), 'success');
    } catch (err) {
      addToast(t('code.failedToCreateBranch', { error: String(err) }), 'error');
    }
    
    setShowBranchModal(false);
    setNewBranchName('');
  };

  const handleSwitchBranch = async (branch: string) => {
    try {
      const repositoryPath = requireDesktopGitRepositoryPath(currentProject?.path);
      const branchName = normalizeGitBranchName(branch);
      await executeGitCommand(repositoryPath, ['switch', branchName]);
      setSelectedBranch(branchName);
      addToast(t('code.switchedToBranch', { branch: branchName }), 'success');
    } catch (err) {
      addToast(t('code.failedToSwitchBranch', { error: String(err) }), 'error');
    }
    setShowBranchMenu(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (branchMenuRef.current && !branchMenuRef.current.contains(event.target as Node)) {
        setShowBranchMenu(false);
      }
      if (submitMenuRef.current && !submitMenuRef.current.contains(event.target as Node)) {
        setShowSubmitMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showShareModal || shareAccess !== 'private') {
      return;
    }
    void loadProjectCollaborators();
  }, [loadProjectCollaborators, shareAccess, showShareModal]);

  useEffect(() => {
    if (!showShareModal) {
      setInviteEmail('');
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
    const projectId = currentProject?.id?.trim();
    const email = inviteEmail.trim();
    if (!projectId) {
      addToast('Please select a project before inviting collaborators.', 'error');
      return;
    }
    if (!email || isInvitingCollaborator) {
      return;
    }

    setIsInvitingCollaborator(true);
    try {
      await collaborationService.upsertProjectCollaborator(projectId, {
        email,
        role: 'member',
        status: 'invited',
      });
      setInviteEmail('');
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

  const handlePublishProject = async () => {
    const projectId = currentProject?.id?.trim();
    if (!projectId) {
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
      addToast(`Published ${currentProject?.name || 'project'} release ${result.release.releaseVersion}.`, 'success');
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
      <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 text-sm shrink-0 bg-[#0e0e11] relative">
        <div className="font-medium text-gray-200 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 fill-mode-both" style={{ animationDelay: '100ms' }}>
          <span className="text-sm font-semibold text-gray-200 transition-colors">
            {currentProject?.name || '-'}
          </span>
          <span className="text-gray-600 text-xs">/</span>
          <span className="text-sm text-gray-400 transition-colors truncate max-w-[150px]">
            {selectedCodingSession ? selectedCodingSession.title : '-'}
          </span>
        </div>
        
        <div className="flex items-center gap-1 bg-[#18181b] p-1 rounded-lg border border-white/5 animate-in fade-in slide-in-from-top-2 fill-mode-both" style={{ animationDelay: '125ms' }}>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${activeTab === 'ai' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
          >
            {t('app.menu.aiMode')}
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${activeTab === 'editor' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
          >
            {t('app.menu.editorMode')}
          </button>
        </div>

        <div className="flex items-center gap-3 text-gray-400">
          <div className="relative animate-in fade-in slide-in-from-top-2 fill-mode-both" style={{ animationDelay: '150ms' }}>
            <div 
              className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer hover:bg-white/10 transition-colors border border-white/5"
              onClick={() => setShowBranchMenu(!showBranchMenu)}
            >
              <GitBranch size={14} className="text-blue-400" />
              <span className="font-medium">{selectedBranch}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </div>

            {showBranchMenu && (
              <div ref={branchMenuRef} className="absolute right-0 top-full mt-1.5 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="px-3 py-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('app.menu.switchBranch')}</div>
                {branches.map(branch => (
                  <div key={branch} className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center justify-between transition-colors" onClick={() => handleSwitchBranch(branch)}>
                    <span>{branch}</span>
                    {selectedBranch === branch && <Check size={14} className="text-blue-400" />}
                  </div>
                ))}
                <div className="h-px bg-white/10 my-1.5"></div>
                <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center gap-2 transition-colors" onClick={() => { setShowBranchMenu(false); setShowBranchModal(true); }}>
                  <Plus size={14} className="text-gray-400" />
                  <span>{t('app.menu.newBranch')}</span>
                </div>
              </div>
            )}
          </div>
          <div className="relative animate-in fade-in slide-in-from-top-2 fill-mode-both" style={{ animationDelay: '200ms' }}>
            <div 
              className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-white/10"
              onClick={() => setShowSubmitMenu(!showSubmitMenu)}
            >
              <CheckCircle2 size={14} className="text-gray-400" />
              <span className="font-medium">{t('app.menu.commit')}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </div>

            {showSubmitMenu && (
              <div ref={submitMenuRef} className="absolute right-0 top-full mt-1.5 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 py-1.5 text-[13px] text-gray-300 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center gap-2 transition-colors" onClick={() => { setShowSubmitMenu(false); setShowCommitModal(true); }}>
                  <span>{t('app.menu.commitChanges')}</span>
                </div>
                <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center gap-2 transition-colors" onClick={() => { setShowSubmitMenu(false); setShowPushModal(true); }}>
                  <span>{t('app.menu.pushToRemote')}</span>
                </div>
                <div className="h-px bg-white/10 my-1.5"></div>
                <div className="px-3 py-1.5 hover:bg-white/10 hover:text-white cursor-pointer flex items-center gap-2 transition-colors" onClick={() => { 
                  setShowSubmitMenu(false); 
                  globalEventBus.emit('toggleDiffPanel');
                }}>
                  <span>{t('app.menu.viewDiff')}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 px-2 text-xs transition-colors animate-in fade-in slide-in-from-top-2 fill-mode-both ${isTerminalOpen ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'}`}
            style={{ animationDelay: '225ms' }}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
          >
            <Terminal size={14} className="mr-1.5" /> {t('app.terminal')}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-xs animate-in fade-in slide-in-from-top-2 fill-mode-both"
            style={{ animationDelay: '250ms' }}
            onClick={() => setShowShareModal(true)}
          >
            <Share size={14} className="mr-1" /> {t('app.menu.share')}
          </Button>
          <Button 
            size="sm" 
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs animate-in fade-in slide-in-from-top-2 fill-mode-both shadow-sm shadow-blue-900/20"
            style={{ animationDelay: '300ms' }}
            onClick={() => setShowPublishModal(true)}
          >
            <Upload size={14} className="mr-1" /> {t('app.menu.publish')}
          </Button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Share size={18} className="text-blue-400" />
                {t('app.shareProject')}
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">{t('app.accessLevel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${shareAccess === 'private' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#121214] border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                    onClick={() => setShareAccess('private')}
                  >
                    <Lock size={24} />
                    <span className="text-sm font-medium">{t('app.private')}</span>
                  </button>
                  <button 
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${shareAccess === 'public' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-[#121214] border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                    onClick={() => setShareAccess('public')}
                  >
                    <Globe size={24} />
                    <span className="text-sm font-medium">{t('app.publicLink')}</span>
                  </button>
                </div>
              </div>

              {shareAccess === 'public' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-gray-300">{t('app.publicLink')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={`https://ide.sdkwork.com/p/${currentProject?.id || 'demo'}`}
                      className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(`https://ide.sdkwork.com/p/${currentProject?.id || 'demo'}`);
                        addToast(t('code.linkCopied'), 'success');
                      }}
                      className="bg-[#18181b] hover:bg-white/10 text-white border border-white/10"
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
              )}

              {shareAccess === 'private' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-gray-300">{t('app.inviteCollaborators')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleInviteCollaborator();
                        }
                      }}
                      placeholder={t('app.emailPlaceholder')} 
                      className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <Button 
                      onClick={() => void handleInviteCollaborator()}
                      disabled={!inviteEmail.trim() || isInvitingCollaborator || !currentProject?.id}
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
              )}
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
                Publish Project
              </h3>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {!currentProject?.id ? (
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
                          Reuse an existing target or create a new target before the release flow is recorded.
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
                  !currentProject?.id ||
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

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <GitBranch size={18} className="text-blue-400" />
                {t('app.createNewBranch')}
              </h3>
              <button 
                onClick={() => setShowBranchModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">{t('app.branchName')}</label>
                <input 
                  type="text" 
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder={t('app.branchNamePlaceholder')}
                  className="w-full bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowBranchModal(false)}>{t('app.cancel')}</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-500 text-white"
                disabled={!newBranchName.trim()}
                onClick={handleCreateBranch}
              >
                {t('app.createBranch')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Commit Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-400" />
                {t('app.commitChanges')}
              </h3>
              <button 
                onClick={() => setShowCommitModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">{t('app.commitMessage')}</label>
                <textarea 
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={t('app.commitMessagePlaceholder')}
                  className="w-full bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 min-h-[100px] resize-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCommitModal(false)}>{t('app.cancel')}</Button>
              <Button 
                className="bg-green-600 hover:bg-green-500 text-white"
                disabled={!commitMessage.trim()}
                onClick={handleCommit}
              >
                {t('app.commit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Push Modal */}
      {showPushModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload size={18} className="text-blue-400" />
                {t('app.pushToRemote')}
              </h3>
              <button 
                onClick={() => setShowPushModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-center">
              <p className="text-sm text-gray-300">
                {t('app.pushToRemoteDesc')}
              </p>
              <div className="text-xs text-gray-500 bg-[#0e0e11] p-2 rounded border border-white/5 font-mono">
                git push origin {selectedBranch}
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPushModal(false)}>{t('app.cancel')}</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={handlePush}
              >
                {t('app.push')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
