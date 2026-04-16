import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import type { BirdCoderChatMessage, BirdCoderProject, FileChange } from '@sdkwork/birdcoder-types';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Folder,
  FolderOpen,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface StudioChatSidebarProps {
  isVisible: boolean;
  width: number;
  projects: BirdCoderProject[];
  currentProjectId: string;
  selectedCodingSessionId: string;
  menuActiveProjectId: string;
  projectSearchQuery: string;
  messages: BirdCoderChatMessage[];
  inputValue: string;
  isSending: boolean;
  selectedEngineId: string;
  selectedModelId: string;
  disabled: boolean;
  onResize: (delta: number) => void;
  onProjectSearchQueryChange: (value: string) => void;
  onMenuActiveProjectIdChange: (projectId: string) => void;
  onInputValueChange: (value: string) => void;
  onSelectedEngineIdChange: (engineId: string) => void;
  onSelectedModelIdChange: (modelId: string) => void;
  onSendMessage: (text?: string) => void;
  onSelectCodingSession: (projectId: string, codingSessionId: string) => void;
  onCreateProject: () => Promise<void>;
  onOpenFolder: () => Promise<void>;
  onCreateCodingSession: (projectId: string) => Promise<void>;
  onRefreshProjectSessions: (projectId: string) => Promise<void>;
  onRefreshCodingSessionMessages: (codingSessionId: string) => Promise<void>;
  refreshingProjectId: string | null;
  refreshingCodingSessionId: string | null;
  onViewChanges: (file: FileChange) => void;
  onEditMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: () => void;
  onRestoreMessage: (messageId: string) => void;
  onStopSending: () => void;
}

export function StudioChatSidebar({
  isVisible,
  width,
  projects,
  currentProjectId,
  selectedCodingSessionId,
  menuActiveProjectId,
  projectSearchQuery,
  messages,
  inputValue,
  isSending,
  selectedEngineId,
  selectedModelId,
  disabled,
  onResize,
  onProjectSearchQueryChange,
  onMenuActiveProjectIdChange,
  onInputValueChange,
  onSelectedEngineIdChange,
  onSelectedModelIdChange,
  onSendMessage,
  onSelectCodingSession,
  onCreateProject,
  onOpenFolder,
  onCreateCodingSession,
  onRefreshProjectSessions,
  onRefreshCodingSessionMessages,
  refreshingProjectId,
  refreshingCodingSessionId,
  onViewChanges,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onRestoreMessage,
  onStopSending,
}: StudioChatSidebarProps) {
  const { t } = useTranslation();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isVisible) {
    return null;
  }

  const currentProject = projects.find((project) => project.id === currentProjectId);
  const currentCodingSessionTitle = currentProject?.codingSessions.find(
    (codingSession) => codingSession.id === selectedCodingSessionId,
  )?.title;
  const menuSelectedSessionId =
    currentProjectId === menuActiveProjectId ? selectedCodingSessionId : '';

  const handleToggleProjectMenu = () => {
    if (!showProjectMenu) {
      onMenuActiveProjectIdChange(currentProjectId);
      onProjectSearchQueryChange('');
    }
    setShowProjectMenu((previousState) => !previousState);
  };

  return (
    <>
      <div
        className="flex min-h-0 flex-col border-r border-white/10 bg-[#0e0e11] text-sm shrink-0 relative"
        style={{ width }}
      >
        <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0 bg-[#0e0e11]">
          <div className="relative" ref={projectMenuRef}>
            <button
              onClick={handleToggleProjectMenu}
              className="flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-white/5 transition-all text-gray-200 font-medium group"
            >
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center shadow-sm shrink-0">
                <Code2 size={12} className="text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                  {currentProject?.name || '-'}
                </span>
                <span className="text-gray-600 text-xs">/</span>
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors truncate max-w-[150px]">
                  {currentCodingSessionTitle || '-'}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform duration-200 ${showProjectMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showProjectMenu && (
              <div className="absolute top-full left-0 mt-2 w-[600px] bg-[#18181b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-white/10 bg-[#0e0e11]/50 backdrop-blur-sm">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="text"
                      value={projectSearchQuery}
                      onChange={(event) => onProjectSearchQueryChange(event.target.value)}
                      placeholder={t('studio.searchProjects')}
                      className="w-full bg-[#0e0e11] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div className="flex h-[360px]">
                  <div className="w-[40%] border-r border-white/10 overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/30 flex flex-col gap-1">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {t('studio.projects')}
                    </div>
                    {projects.length > 0 ? (
                      projects.map((project, index) => {
                        const isMenuSelected = menuActiveProjectId === project.id;
                        const isActualSelected = currentProjectId === project.id;
                        return (
                          <button
                            key={project.id}
                            onClick={() => onMenuActiveProjectIdChange(project.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group animate-in fade-in slide-in-from-left-2 fill-mode-both ${
                              isMenuSelected
                                ? 'bg-white/5 text-gray-100 shadow-sm'
                                : 'text-gray-400 hover:bg-white/5/60 hover:text-gray-200'
                            }`}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {isMenuSelected ? (
                                <FolderOpen size={14} className="text-blue-400 shrink-0" />
                              ) : (
                                <Folder
                                  size={14}
                                  className="text-gray-500 group-hover:text-gray-400 shrink-0"
                                />
                              )}
                              <span className="truncate font-medium">{project.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isActualSelected && <Check size={14} className="text-gray-500" />}
                              {isMenuSelected && <ChevronRight size={14} className="text-gray-500" />}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-gray-500 text-xs">
                        {t('studio.noProjectsFound')}
                      </div>
                    )}
                  </div>

                  <div className="w-[60%] overflow-y-auto p-2 custom-scrollbar bg-[#0e0e11]/10 flex flex-col gap-1">
                    <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {t('studio.threads')}
                    </div>
                    {projects
                      .find((project) => project.id === menuActiveProjectId)
                      ?.codingSessions.map((thread, index) => {
                        const isSelected =
                          currentProjectId === menuActiveProjectId &&
                          selectedCodingSessionId === thread.id;
                        return (
                          <button
                            key={thread.id}
                            onClick={() => {
                              onSelectCodingSession(menuActiveProjectId, thread.id);
                              setShowProjectMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group animate-in fade-in slide-in-from-left-2 fill-mode-both ${
                              isSelected
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            }`}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <MessageSquare
                                size={14}
                                className={
                                  isSelected
                                    ? 'text-blue-400'
                                    : 'text-gray-500 group-hover:text-gray-400 shrink-0'
                                }
                              />
                              <div className="flex flex-col items-start truncate">
                                <span className="truncate font-medium">{thread.title}</span>
                                <span
                                  className={`text-[10px] ${
                                    isSelected
                                      ? 'text-blue-400/70'
                                      : 'text-gray-600 group-hover:text-gray-500'
                                  }`}
                                >
                                  {thread.displayTime}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="flex border-t border-white/10 bg-[#0e0e11]/80 backdrop-blur-sm">
                  <div className="w-[40%] p-2 border-r border-white/10 grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        void onCreateProject();
                      }}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                      title={t('studio.newProject')}
                    >
                      <Plus size={12} />
                      {t('studio.new')}
                    </button>
                    <button
                      onClick={() => {
                        void onOpenFolder();
                      }}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
                      title={t('studio.openFolder')}
                    >
                      <Folder size={12} />
                      {t('studio.open')}
                    </button>
                    <button
                      onClick={() => {
                        if (!menuActiveProjectId) {
                          return;
                        }
                        void onRefreshProjectSessions(menuActiveProjectId);
                      }}
                      disabled={!menuActiveProjectId || refreshingProjectId === menuActiveProjectId}
                      className="flex items-center justify-center gap-2 flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      title={t('studio.refreshSessions')}
                    >
                      <RefreshCw
                        size={12}
                        className={refreshingProjectId === menuActiveProjectId ? 'animate-spin' : ''}
                      />
                      {t('studio.refreshSessions')}
                    </button>
                  </div>
                  <div className="w-[60%] p-2 flex gap-1">
                    <button
                      onClick={() => {
                        void onCreateCodingSession(menuActiveProjectId).then(() => {
                          setShowProjectMenu(false);
                        });
                      }}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-dashed border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all font-medium"
                    >
                      <Plus size={12} />
                      {t('studio.newThread')}
                    </button>
                    <button
                      onClick={() => {
                        if (!menuSelectedSessionId) {
                          return;
                        }
                        void onRefreshCodingSessionMessages(menuSelectedSessionId);
                      }}
                      disabled={!menuSelectedSessionId || refreshingCodingSessionId === menuSelectedSessionId}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        size={12}
                        className={refreshingCodingSessionId === menuSelectedSessionId ? 'animate-spin' : ''}
                      />
                      {t('studio.refreshMessages')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-gray-500 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              disabled={refreshingProjectId === currentProjectId}
              title={t(
                refreshingProjectId === currentProjectId
                  ? 'studio.refreshingSessions'
                  : 'studio.refreshSessions',
              )}
              onClick={() => {
                if (!currentProjectId) {
                  return;
                }
                void onRefreshProjectSessions(currentProjectId);
              }}
            >
              <RefreshCw
                size={14}
                className={refreshingProjectId === currentProjectId ? 'animate-spin' : ''}
              />
            </button>
            <button
              type="button"
              className="text-gray-500 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedCodingSessionId || refreshingCodingSessionId === selectedCodingSessionId}
              title={t(
                refreshingCodingSessionId === selectedCodingSessionId
                  ? 'studio.refreshingMessages'
                  : 'studio.refreshMessages',
              )}
              onClick={() => {
                if (!selectedCodingSessionId) {
                  return;
                }
                void onRefreshCodingSessionMessages(selectedCodingSessionId);
              }}
            >
              <RefreshCw
                size={14}
                className={refreshingCodingSessionId === selectedCodingSessionId ? 'animate-spin' : ''}
              />
            </button>
            <div className="text-xs text-gray-500">{t('studio.ranFor', { time: '335s' })}</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <UniversalChat
            chatId={selectedCodingSessionId || undefined}
            messages={messages}
            inputValue={inputValue}
            setInputValue={onInputValueChange}
            onSendMessage={onSendMessage}
            isSending={isSending}
            selectedEngineId={selectedEngineId}
            selectedModelId={selectedModelId}
            setSelectedEngineId={onSelectedEngineIdChange}
            setSelectedModelId={onSelectedModelIdChange}
            layout="sidebar"
            onViewChanges={onViewChanges}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onRegenerateMessage={onRegenerateMessage}
            onRestore={onRestoreMessage}
            onStop={onStopSending}
            disabled={disabled}
            emptyState={
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                  <Zap size={32} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                  {currentProjectId ? t('studio.whatToBuild') : t('studio.selectProjectToStart')}
                </h2>
                <p className="text-gray-400 max-w-md text-[15px] leading-relaxed">
                  {currentProjectId
                    ? t('studio.buildDescription')
                    : t('studio.selectProjectDescription')}
                </p>
              </div>
            }
          />
        </div>
      </div>

      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => onResize(delta)}
      />
    </>
  );
}
