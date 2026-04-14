import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, GitBranch, CheckCircle2, Share, Upload, Terminal, X, Copy, Globe, Lock, Users, Plus } from 'lucide-react';
import type { BirdCoderCodingSession, BirdCoderProject } from '@sdkwork/birdcoder-types';
import { Button } from '@sdkwork/birdcoder-ui';
import { useToast } from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import {
  executeGitCommand,
  listGitBranches,
  normalizeGitBranchName,
  requireDesktopGitRepositoryPath,
} from './gitRuntime';

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
                  import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
                    globalEventBus.emit('toggleDiffPanel');
                  });
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
                      placeholder={t('app.emailPlaceholder')} 
                      className="flex-1 bg-[#0e0e11] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    />
                    <Button 
                      onClick={() => addToast(t('code.invitationSent'), 'success')}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {t('app.invite')}
                    </Button>
                  </div>
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
          <div className="bg-[#18181b] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#121214]">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Upload size={18} className="text-blue-400" />
                {t('app.publishUnavailable')}
              </h3>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Upload size={20} className="text-amber-300 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-100">{t('app.publishUnavailableTitle')}</h4>
                    <p className="text-xs text-amber-200/80 mt-1">{t('app.publishUnavailableDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end">
              <Button variant="outline" onClick={() => setShowPublishModal(false)}>{t('app.done')}</Button>
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
