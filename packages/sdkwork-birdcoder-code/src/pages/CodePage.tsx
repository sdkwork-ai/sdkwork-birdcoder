import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import {
  getTerminalProfile,
  globalEventBus,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  openLocalFolder,
  resolveWorkbenchChatSelection,
  useFileSystem,
  useIDEServices,
  useProjects,
  useCodingSessionActions,
  useToast,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-commons';
import { ResizeHandle } from '@sdkwork/birdcoder-ui';
import { UniversalChat } from '@sdkwork/birdcoder-ui/chat';
import { FileChange } from '@sdkwork/birdcoder-types';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CodeEditorWorkspacePanel } from './CodeEditorWorkspacePanel';
import { CodePageDialogs, type CodeDeleteConfirmation } from './CodePageDialogs';
import { CodeTerminalIntegrationPanel } from './CodeTerminalIntegrationPanel';
import { CodeWorkspaceOverlays } from './CodeWorkspaceOverlays';
import { useCodeRunEntryActions } from './useCodeRunEntryActions';
import { useCodeWorkbenchCommands } from './useCodeWorkbenchCommands';

interface CodePageProps {
  workspaceId?: string;
  projectId?: string;
  onProjectChange?: (projectId: string) => void;
}

export function CodePage({ workspaceId, projectId, onProjectChange }: CodePageProps) {
  const { t } = useTranslation();
  const {
    projects,
    searchQuery,
    setSearchQuery,
    createProject,
    createCodingSession,
    renameProject,
    updateProject,
    deleteProject,
    renameCodingSession,
    updateCodingSession,
    deleteCodingSession,
    deleteCodingSessionMessage,
    sendMessage,
    forkCodingSession,
  } = useProjects(workspaceId);

  const { addToast } = useToast();
  const { switchChatEngine } = useIDEServices();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const [selectedCodingSessionId, setSelectedThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'editor'>('ai');
  const selectedEngineId = preferences.codeEngineId;
  const selectedModelId = preferences.codeModelId;
  
  useEffect(() => {
    switchChatEngine(selectedEngineId);
  }, [selectedEngineId, switchChatEngine]);

  const setSelectedEngineId = (engineId: string) => {
    updatePreferences((previousState) =>
      resolveWorkbenchChatSelection({
        codeEngineId: normalizeWorkbenchCodeEngineId(engineId),
        codeModelId: previousState.codeModelId,
      }),
    );
  };

  const setSelectedModelId = (modelId: string) => {
    updatePreferences((previousState) => ({
      codeModelId: normalizeWorkbenchCodeModelId(previousState.codeEngineId, modelId),
    }));
  };

  const [viewingDiff, setViewingDiff] = useState<FileChange | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalRequest, setTerminalRequest] = useState<TerminalCommandRequest>();
  const [terminalHeight, setTerminalHeight] = useState(256);
  const [chatWidth, setChatWidth] = useState(400);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isRunConfigVisible, setIsRunConfigVisible] = useState(false);
  const [isDebugConfigVisible, setIsDebugConfigVisible] = useState(false);
  const [isRunTaskVisible, setIsRunTaskVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<CodeDeleteConfirmation | null>(null);

  // Determine the current project ID based on selected thread, or the prop
  const threadProjectId = projects.find((project) =>
    project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
  )?.id;
  const currentProjectId = threadProjectId || projectId || '';
  const currentProject = projects.find((project) => project.id === currentProjectId);

  // Sync the current project ID up to the AppContent state if it changes due to thread selection
  useEffect(() => {
    if (threadProjectId && threadProjectId !== projectId && onProjectChange) {
      onProjectChange(threadProjectId);
    }
  }, [threadProjectId, projectId, onProjectChange]);

  // Clear selectedCodingSessionId if it's no longer in the current projects (e.g., workspace changed)
  useEffect(() => {
    if (
      selectedCodingSessionId &&
      !projects.some((project) =>
        project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId),
      )
    ) {
      setSelectedThreadId(null);
    }
  }, [projects, selectedCodingSessionId]);

  useCodeWorkbenchCommands({
    projects,
    selectedCodingSessionId,
    currentProjectId,
    createCodingSession,
    setSelectedCodingSessionId: setSelectedThreadId,
    setViewingDiff,
    setIsTerminalOpen,
    setTerminalRequest,
    setIsSidebarVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    addToast,
  });

  const {
    files,
    selectedFile,
    fileContent,
    selectFile,
    saveFile,
    saveFileContent,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameNode,
    searchFiles,
    mountFolder,
  } = useFileSystem(currentProjectId);

  const getLanguageFromPath = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.css')) return 'css';
    return 'plaintext';
  };

  useCodingSessionActions(currentProjectId, createCodingSession, setSelectedThreadId);

  const {
    runConfigurations,
    runConfigurationDraft,
    setRunConfigurationDraft,
    handleSubmitRunConfiguration,
    handleRunTaskExecution,
    handleSaveDebugConfiguration,
  } = useCodeRunEntryActions({
    currentProjectId,
    currentProjectName: currentProject?.name,
    defaultWorkingDirectory: preferences.defaultWorkingDirectory,
    isRunConfigVisible,
    setIsRunConfigVisible,
    setIsDebugConfigVisible,
    setIsRunTaskVisible,
    addToast,
  });

  const handleRenameThread = async (threadId: string, newName?: string) => {
    if (newName && newName.trim()) {
      const project = projects.find((candidate) =>
        candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
      );
      if (project) {
        await renameCodingSession(project.id, threadId, newName.trim());
      }
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    setDeleteConfirmation({ type: 'thread', id: threadId });
  };

  const executeDeleteThread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      await deleteCodingSession(project.id, threadId);
      if (selectedCodingSessionId === threadId) {
        setSelectedThreadId(null);
      }
      addToast('Thread deleted successfully', 'success');
    }
  };

  const handleRenameProject = async (projectId: string, newName?: string) => {
    if (newName && newName.trim()) {
      await renameProject(projectId, newName.trim());
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setDeleteConfirmation({ type: 'project', id: projectId });
  };

  const executeDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    const project = projects.find(p => p.id === projectId);
    if (
      project &&
      project.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId)
    ) {
      setSelectedThreadId(null);
    }
    addToast('Project deleted successfully', 'success');
  };

  const handleNewProject = async () => {
    try {
      const newProject = await createProject('New Project');
      if (onProjectChange) onProjectChange(newProject.id);
      addToast('Project created successfully', 'success');
      return newProject.id;
    } catch (error) {
      console.error("Failed to create project", error);
      addToast('Failed to create project', 'error');
      return undefined;
    }
  };

  const handleOpenFolder = async () => {
    try {
      const folderInfo = await openLocalFolder();
      if (folderInfo) {
        let projectName = 'Local Folder';
        if (folderInfo.type === 'browser') {
          projectName = folderInfo.handle.name;
        } else {
          const parts = folderInfo.path.split(/[/\\]/);
          projectName = parts[parts.length - 1] || 'Local Folder';
        }
        
        const newProject = await createProject(projectName);
        await mountFolder(newProject.id, folderInfo);
        
        if (onProjectChange) onProjectChange(newProject.id);
        addToast(`Opened folder: ${projectName}`, 'success');
      }
    } catch (error) {
      console.error("Failed to open folder", error);
      addToast('Failed to open folder', 'error');
    }
  };

  const handleNewThreadInProject = async (projectId: string) => {
    try {
      const newThread = await createCodingSession(projectId, 'New Thread');
      setSelectedThreadId(newThread.id);
      addToast('Thread created successfully', 'success');
      setTimeout(() => {
        import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
          globalEventBus.emit('focusChatInput');
        });
      }, 100);
    } catch (error) {
      console.error("Failed to create thread", error);
      addToast('Failed to create thread', 'error');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      await updateProject(projectId, { archived: !project.archived });
      addToast(`${!project.archived ? 'Archived' : 'Unarchived'} project: ${project.name}`, 'info');
    }
  };

  const handleCopyWorkingDirectory = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      navigator.clipboard.writeText(`/workspace/${project.name}`);
      addToast(`Copied workspace directory: /workspace/${project.name}`, 'success');
    }
  };

  const handleOpenInTerminal = (projectId: string, profileId?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const request = {
        path: `/workspace/${project.name}`,
        profileId: profileId ? getTerminalProfile(profileId).id : undefined,
        timestamp: Date.now(),
      };
      import('@sdkwork/birdcoder-commons').then(({ globalEventBus }) => {
        globalEventBus.emit('openTerminal');
        globalEventBus.emit('terminalRequest', request);
      });
      addToast(
        profileId
          ? `Opened ${getTerminalProfile(profileId).title} terminal: ${project.name}`
          : `Opened project in terminal: ${project.name}`,
        'info',
      );
    }
  };

  const handlePinThread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
      if (thread) {
        await updateCodingSession(project.id, threadId, { pinned: !thread.pinned });
        addToast(`${!thread.pinned ? 'Pinned' : 'Unpinned'} thread: ${thread.title}`, 'success');
      }
    }
  };

  const handleArchiveThread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      await updateCodingSession(project.id, threadId, { archived: true });
      addToast(`Archived thread: ${threadId}`, 'info');
    }
  };

  const handleMarkThreadUnread = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
      if (thread) {
        await updateCodingSession(project.id, threadId, { unread: !thread.unread });
        addToast(`Marked as ${!thread.unread ? 'unread' : 'read'}: ${thread.title}`, 'info');
      }
    }
  };

  const handleCopyThreadWorkingDirectory = (threadId: string) => {
    navigator.clipboard.writeText(`/workspace/thread/${threadId}`);
    addToast(`Copied thread workspace directory: /workspace/thread/${threadId}`, 'success');
  };

  const handleCopyThreadSessionId = (threadId: string) => {
    navigator.clipboard.writeText(threadId);
    addToast(`Copied session ID: ${threadId}`, 'success');
  };

  const handleCopyThreadDeeplink = (threadId: string) => {
    const link = `${window.location.origin}/thread/${threadId}`;
    navigator.clipboard.writeText(link);
    addToast(`Copied Deeplink: ${link}`, 'success');
  };

  const handleForkThreadLocal = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      try {
        const newThread = await forkCodingSession(project.id, threadId);
        setSelectedThreadId(newThread.id);
        addToast(`Forked to local: ${newThread.name}`, 'success');
      } catch (err) {
        addToast('Failed to fork thread', 'error');
      }
    }
  };

  const handleForkThreadNewTree = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      try {
        const newThread = await forkCodingSession(
          project.id,
          threadId,
          `${project.codingSessions.find((codingSession) => codingSession.id === threadId)?.title} (New Tree)`,
        );
        setSelectedThreadId(newThread.id);
        addToast(`Forked to new worktree: ${newThread.name}`, 'success');
      } catch (err) {
        addToast('Failed to fork thread', 'error');
      }
    }
  };

  const handleEditMessage = (threadId: string, messageId: string) => {
    const thread = projects
      .flatMap((project) => project.codingSessions)
      .find((codingSession) => codingSession.id === threadId);
    const msg = thread?.messages?.find(m => m.id === messageId);
    if (msg) {
      setInputValue(msg.content);
    }
  };

  const handleDeleteMessage = async (threadId: string, messageId: string) => {
    setDeleteConfirmation({ type: 'message', id: messageId, parentId: threadId });
  };

  const executeDeleteMessage = async (threadId: string, messageId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      await deleteCodingSessionMessage(project.id, threadId, messageId);
      addToast('Message deleted successfully', 'success');
    }
  };

  const handleRegenerateMessage = async (threadId: string) => {
    const project = projects.find((candidate) =>
      candidate.codingSessions.some((codingSession) => codingSession.id === threadId),
    );
    if (project) {
      const thread = project.codingSessions.find((codingSession) => codingSession.id === threadId);
      if (thread && thread.messages && thread.messages.length > 0) {
        // Find the last user message
        const lastUserMsgIndex = [...thread.messages].reverse().findIndex(m => m.role === 'user');
        if (lastUserMsgIndex !== -1) {
          const actualIndex = thread.messages.length - 1 - lastUserMsgIndex;
          const lastUserMsg = thread.messages[actualIndex];
          
          // Delete all messages including the last user message
          for (let i = thread.messages.length - 1; i >= actualIndex; i--) {
            await deleteCodingSessionMessage(project.id, threadId, thread.messages[i].id);
          }
          
          // Resend the last user message content
          setIsSending(true);
          try {
            const context = {
              workspaceId,
              projectId: project.id,
              threadId: thread.id,
              currentFile: selectedFile ? {
                path: selectedFile,
                content: fileContent,
                language: getLanguageFromPath(selectedFile)
              } : undefined
            };
            await sendMessage(project.id, threadId, lastUserMsg.content, context);
          } finally {
            setIsSending(false);
          }
        }
      }
    }
  };

  const handleRestoreMessage = async (threadId: string, messageId: string) => {
    const thread = projects
      .flatMap((project) => project.codingSessions)
      .find((codingSession) => codingSession.id === threadId);
    const msg = thread?.messages?.find(m => m.id === messageId);
    if (msg && msg.fileChanges) {
      for (const change of msg.fileChanges) {
        if (change.originalContent !== undefined) {
          await saveFileContent(change.path, change.originalContent);
        } else {
          // If originalContent is undefined, it means the file was created in this message.
          // So restoring means deleting the file.
          await deleteFile(change.path);
        }
      }
      addToast('Restored files to previous state', 'success');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    let currentThreadId = selectedCodingSessionId;
    let projectIdToUse = currentProjectId;

    if (!currentThreadId) {
      if (!projectIdToUse) {
        if (projects.length === 0) {
          const newProject = await createProject('New Project');
          projectIdToUse = newProject.id;
        } else {
          projectIdToUse = projects[0].id;
        }
      }
      const newTitle = inputValue.slice(0, 20) + (inputValue.length > 20 ? '...' : '');
      const newThread = await createCodingSession(projectIdToUse, newTitle);
      currentThreadId = newThread.id;
      if (onProjectChange) onProjectChange(projectIdToUse);
      setSelectedThreadId(currentThreadId);
    }

    if (projectIdToUse && currentThreadId) {
      const content = inputValue;
      setInputValue('');
      setIsSending(true);
      try {
        const context = {
          workspaceId,
          projectId: projectIdToUse,
          threadId: currentThreadId,
          currentFile: selectedFile ? {
            path: selectedFile,
            content: fileContent,
            language: getLanguageFromPath(selectedFile)
          } : undefined
        };
        await sendMessage(projectIdToUse, currentThreadId, content, context);
      } finally {
        setIsSending(false);
      }
    }
  };

  const selectedCodingSession = projects
    .flatMap((project) => project.codingSessions)
    .find((codingSession) => codingSession.id === selectedCodingSessionId);

  const handleProjectSelect = (id: string | null) => {
    if (id && onProjectChange) {
      onProjectChange(id);
      // If the selected thread doesn't belong to the newly selected project, clear it
      if (selectedCodingSessionId) {
        const threadBelongsToProject = projects
          .find((project) => project.id === id)
          ?.codingSessions.some((codingSession) => codingSession.id === selectedCodingSessionId);
        if (!threadBelongsToProject) {
          setSelectedThreadId(null);
        }
      }
    }
  };

  const handleCreateRootFile = () => {
    globalEventBus.emit('createRootFile');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation?.type === 'thread') {
      void executeDeleteThread(deleteConfirmation.id);
    } else if (deleteConfirmation?.type === 'project') {
      void executeDeleteProject(deleteConfirmation.id);
    } else if (deleteConfirmation?.type === 'message' && deleteConfirmation.parentId) {
      void executeDeleteMessage(deleteConfirmation.parentId, deleteConfirmation.id);
    }
    setDeleteConfirmation(null);
  };

  return (
    <div className="flex h-full w-full bg-[#0e0e11] text-gray-100 font-sans selection:bg-white/10 selection:text-white">
      {isSidebarVisible && (
        <>
          <Sidebar 
            width={sidebarWidth}
            projects={projects}
            selectedProjectId={currentProjectId}
            selectedCodingSessionId={selectedCodingSessionId}
            onSelectProject={handleProjectSelect}
            onSelectCodingSession={setSelectedThreadId}
            onRenameCodingSession={handleRenameThread}
            onDeleteCodingSession={handleDeleteThread}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onNewProject={handleNewProject}
            onOpenFolder={handleOpenFolder}
            onNewCodingSessionInProject={handleNewThreadInProject}
            onArchiveProject={handleArchiveProject}
            onCopyWorkingDirectory={handleCopyWorkingDirectory}
            onOpenInTerminal={handleOpenInTerminal}
            onPinCodingSession={handlePinThread}
            onArchiveCodingSession={handleArchiveThread}
            onMarkCodingSessionUnread={handleMarkThreadUnread}
            onCopyCodingSessionWorkingDirectory={handleCopyThreadWorkingDirectory}
            onCopyCodingSessionSessionId={handleCopyThreadSessionId}
            onCopyCodingSessionDeeplink={handleCopyThreadDeeplink}
            onForkCodingSessionLocal={handleForkThreadLocal}
            onForkCodingSessionNewTree={handleForkThreadNewTree}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          <ResizeHandle 
            direction="horizontal" 
            onResize={(delta) => setSidebarWidth(prev => Math.max(200, Math.min(600, prev + delta)))} 
          />
        </>
      )}

      <div className="flex-1 flex flex-col relative bg-[#0e0e11] shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)] overflow-hidden">
        <CodeWorkspaceOverlays
          files={files}
          isFindVisible={isFindVisible}
          isQuickOpenVisible={isQuickOpenVisible}
          searchFiles={searchFiles}
          onSelectFile={(path) => {
            setViewingDiff(null);
            selectFile(path);
          }}
          onCloseFind={() => setIsFindVisible(false)}
          onCloseQuickOpen={() => setIsQuickOpenVisible(false)}
          onNotifyNoResults={() => addToast(t('code.noResultsFound'), 'info')}
        />

        <CodePageDialogs
          isRunConfigVisible={isRunConfigVisible}
          runConfigurationDraft={runConfigurationDraft}
          onRunConfigurationDraftChange={setRunConfigurationDraft}
          onCloseRunConfig={() => setIsRunConfigVisible(false)}
          onSubmitRunConfig={() => {
            void handleSubmitRunConfiguration();
          }}
          isDebugConfigVisible={isDebugConfigVisible}
          onCloseDebugConfig={() => setIsDebugConfigVisible(false)}
          onSaveDebugConfig={handleSaveDebugConfiguration}
          isRunTaskVisible={isRunTaskVisible}
          runConfigurations={runConfigurations}
          onCloseRunTask={() => setIsRunTaskVisible(false)}
          onRunTask={handleRunTaskExecution}
          deleteConfirmation={deleteConfirmation}
          onCancelDelete={() => setDeleteConfirmation(null)}
          onConfirmDelete={handleConfirmDelete}
        />

        <TopBar currentProject={currentProject} selectedCodingSession={selectedCodingSession} activeTab={activeTab} setActiveTab={setActiveTab} isTerminalOpen={isTerminalOpen} setIsTerminalOpen={setIsTerminalOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'ai' ? (
            <UniversalChat 
              chatId={selectedCodingSessionId || undefined}
              messages={selectedCodingSession?.messages || []}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSendMessage={handleSendMessage}
              isSending={isSending}
              selectedEngineId={selectedEngineId}
              selectedModelId={selectedModelId}
              setSelectedEngineId={setSelectedEngineId}
              setSelectedModelId={setSelectedModelId}
              layout="main"
              onEditMessage={(msgId) => selectedCodingSession && handleEditMessage(selectedCodingSession.id, msgId)}
              onDeleteMessage={(msgId) => selectedCodingSession && handleDeleteMessage(selectedCodingSession.id, msgId)}
              onRegenerateMessage={() => selectedCodingSession && handleRegenerateMessage(selectedCodingSession.id)}
              onStop={() => setIsSending(false)}
              onViewChanges={(file) => {
                setViewingDiff(file);
                setActiveTab('editor');
              }}
              onRestore={(msgId) => selectedCodingSession && handleRestoreMessage(selectedCodingSession.id, msgId)}
              emptyState={
                <div className="flex-1 flex flex-col items-center justify-center pb-32 bg-[#0e0e11]">
                  <div className="mb-6 flex flex-col items-center max-w-md text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-500">
                      <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                      <Zap size={36} className="text-blue-400 relative z-10" />
                    </div>
                    <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '50ms' }}>
                      What do you want to build?
                    </h1>
                    <p className="text-[15px] text-gray-400 leading-relaxed animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '100ms' }}>
                      Describe your idea, ask a question, or paste some code to get started. I can help you write code, debug errors, or build entire features.
                    </p>
                  </div>
                </div>
              }
            />
          ) : (
            <CodeEditorWorkspacePanel
              files={files}
              selectedFile={selectedFile}
              currentProjectName={currentProject?.name}
              viewingDiff={viewingDiff}
              fileContent={fileContent}
              chatWidth={chatWidth}
              selectedCodingSessionId={selectedCodingSessionId}
              messages={selectedCodingSession?.messages || []}
              inputValue={inputValue}
              isSending={isSending}
              selectedEngineId={selectedEngineId}
              selectedModelId={selectedModelId}
              onSelectFile={(path) => {
                setViewingDiff(null);
                selectFile(path);
              }}
              onClearSelectedFile={() => selectFile('')}
              onCreateFile={createFile}
              onCreateFolder={createFolder}
              onDeleteFile={deleteFile}
              onDeleteFolder={deleteFolder}
              onRenameNode={renameNode}
              onAcceptDiff={async () => {
                if (!viewingDiff) {
                  return;
                }
                await saveFileContent(viewingDiff.path, viewingDiff.content || '');
                addToast(t('code.appliedChanges', { path: viewingDiff.path }), 'success');
                setViewingDiff(null);
              }}
              onRejectDiff={() => setViewingDiff(null)}
              onFileContentChange={saveFile}
              onChatResize={(delta) => setChatWidth((previousState) => Math.max(200, Math.min(800, previousState - delta)))}
              onInputValueChange={setInputValue}
              onSelectedEngineIdChange={setSelectedEngineId}
              onSelectedModelIdChange={setSelectedModelId}
              onSendMessage={handleSendMessage}
              onViewChanges={(file) => setViewingDiff(file)}
              onRestoreMessage={(messageId) => {
                if (selectedCodingSession) {
                  void handleRestoreMessage(selectedCodingSession.id, messageId);
                }
              }}
              onEditMessage={(messageId) => {
                if (selectedCodingSession) {
                  handleEditMessage(selectedCodingSession.id, messageId);
                }
              }}
              onDeleteMessage={(messageId) => {
                if (selectedCodingSession) {
                  void handleDeleteMessage(selectedCodingSession.id, messageId);
                }
              }}
              onRegenerateMessage={() => {
                if (selectedCodingSession) {
                  void handleRegenerateMessage(selectedCodingSession.id);
                }
              }}
              onStopSending={() => setIsSending(false)}
              onCreateRootFile={handleCreateRootFile}
              getLanguageFromPath={getLanguageFromPath}
            />
          )}
        </div>

        <CodeTerminalIntegrationPanel
          isOpen={isTerminalOpen}
          height={terminalHeight}
          terminalRequest={terminalRequest}
          workspaceId={workspaceId}
          projectId={currentProjectId}
          onResize={(delta) => setTerminalHeight((previousState) => Math.max(100, Math.min(800, previousState - delta)))}
        />
      </div>
    </div>
  );
}

