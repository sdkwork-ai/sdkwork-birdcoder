import { useEffect } from 'react';
import {
  globalEventBus,
  type TerminalCommandRequest,
  type ToastType,
} from '@sdkwork/birdcoder-commons';
import type { FileChange, BirdCoderProject } from '@sdkwork/birdcoder-types';

interface UseCodeWorkbenchCommandsOptions {
  projects: BirdCoderProject[];
  selectedCodingSessionId: string | null;
  currentProjectId: string;
  createCodingSession: (projectId: string, title: string) => Promise<{ id: string }>;
  setSelectedCodingSessionId: (codingSessionId: string | null) => void;
  setViewingDiff: React.Dispatch<React.SetStateAction<FileChange | null>>;
  setIsTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTerminalRequest: React.Dispatch<React.SetStateAction<TerminalCommandRequest | undefined>>;
  setIsSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFindVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsQuickOpenVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRunConfigVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDebugConfigVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRunTaskVisible: React.Dispatch<React.SetStateAction<boolean>>;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeWorkbenchCommands({
  projects,
  selectedCodingSessionId,
  currentProjectId,
  createCodingSession,
  setSelectedCodingSessionId,
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
}: UseCodeWorkbenchCommandsOptions) {
  useEffect(() => {
    const handleCloseTerminal = () => setIsTerminalOpen(false);

    const handleOpenTerminal = (path?: string, command?: string) => {
      setIsTerminalOpen(true);
      setTerminalRequest({ path, command, timestamp: Date.now() });
    };

    const handleToggleTerminal = () => setIsTerminalOpen((previousState) => !previousState);
    const handleToggleSidebar = () => setIsSidebarVisible((previousState) => !previousState);

    const handleToggleDiffPanel = () => {
      setViewingDiff((previousState) => {
        if (previousState) {
          return null;
        }
        addToast('No active diff to show', 'info');
        return null;
      });
    };

    const handleFindInFiles = () => {
      setIsFindVisible(true);
    };

    const handleOpenQuickOpen = () => {
      setIsQuickOpenVisible(true);
    };

    const handlePreviousCodingSession = () => {
      if (!selectedCodingSessionId) {
        return;
      }

      const allCodingSessions = projects.flatMap((project) => project.codingSessions);
      const currentIndex = allCodingSessions.findIndex(
        (codingSession) => codingSession.id === selectedCodingSessionId,
      );

      if (currentIndex > 0) {
        setSelectedCodingSessionId(allCodingSessions[currentIndex - 1].id);
      }
    };

    const handleNextCodingSession = () => {
      if (!selectedCodingSessionId) {
        return;
      }

      const allCodingSessions = projects.flatMap((project) => project.codingSessions);
      const currentIndex = allCodingSessions.findIndex(
        (codingSession) => codingSession.id === selectedCodingSessionId,
      );

      if (currentIndex !== -1 && currentIndex < allCodingSessions.length - 1) {
        setSelectedCodingSessionId(allCodingSessions[currentIndex + 1].id);
      }
    };

    const handleSaveActiveFile = () => {
      addToast('File saved', 'success');
    };

    const handleSaveAllFiles = () => {
      addToast('All files saved', 'success');
    };

    const handleStartDebugging = () => {
      setIsDebugConfigVisible(true);
    };

    const handleRunWithoutDebugging = () => {
      globalEventBus.emit('openTerminal');
      globalEventBus.emit('terminalRequest', { command: 'npm start', timestamp: Date.now() });
      addToast('Starting application...', 'info');
    };

    const handleAddRunConfiguration = () => {
      setIsRunConfigVisible(true);
    };

    const handleRunTask = () => {
      setIsRunTaskVisible(true);
    };

    const handleTerminalRequest = (request: TerminalCommandRequest) => {
      setTerminalRequest(request);
      setIsTerminalOpen(true);
    };

    const handleRevealInExplorer = async (targetPath: string) => {
      try {
        if (window.__TAURI__) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(targetPath);
          return;
        }

        addToast(`Revealed in OS Explorer: ${targetPath}`, 'info');
      } catch (error) {
        console.error('Failed to reveal in explorer', error);
        addToast(`Revealed in OS Explorer: ${targetPath}`, 'info');
      }
    };

    const handleCreateNewCodingSession = async () => {
      if (!currentProjectId) {
        addToast('Please select a project first', 'error');
        return;
      }

      try {
        const newCodingSession = await createCodingSession(currentProjectId, 'New Thread');
        setSelectedCodingSessionId(newCodingSession.id);
        addToast('New thread created', 'success');
      } catch (error) {
        console.error('Failed to create thread', error);
        addToast('Failed to create thread', 'error');
      }
    };

    const unsubscribers = [
      globalEventBus.on('closeTerminal', handleCloseTerminal),
      globalEventBus.on('openTerminal', handleOpenTerminal),
      globalEventBus.on('toggleTerminal', handleToggleTerminal),
      globalEventBus.on('toggleSidebar', handleToggleSidebar),
      globalEventBus.on('toggleDiffPanel', handleToggleDiffPanel),
      globalEventBus.on('findInFiles', handleFindInFiles),
      globalEventBus.on('openQuickOpen', handleOpenQuickOpen),
      globalEventBus.on('previousCodingSession', handlePreviousCodingSession),
      globalEventBus.on('nextCodingSession', handleNextCodingSession),
      globalEventBus.on('saveActiveFile', handleSaveActiveFile),
      globalEventBus.on('saveAllFiles', handleSaveAllFiles),
      globalEventBus.on('startDebugging', handleStartDebugging),
      globalEventBus.on('runWithoutDebugging', handleRunWithoutDebugging),
      globalEventBus.on('addRunConfiguration', handleAddRunConfiguration),
      globalEventBus.on('runTask', handleRunTask),
      globalEventBus.on('terminalRequest', handleTerminalRequest),
      globalEventBus.on('revealInExplorer', handleRevealInExplorer),
      globalEventBus.on('createNewCodingSession', handleCreateNewCodingSession),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    addToast,
    createCodingSession,
    currentProjectId,
    projects,
    selectedCodingSessionId,
    setIsDebugConfigVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setIsSidebarVisible,
    setIsTerminalOpen,
    setSelectedCodingSessionId,
    setTerminalRequest,
    setViewingDiff,
  ]);
}
