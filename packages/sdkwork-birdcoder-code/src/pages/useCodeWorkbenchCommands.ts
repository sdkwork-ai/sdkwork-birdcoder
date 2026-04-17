import { useEffect } from 'react';
import {
  globalEventBus,
  type TerminalCommandRequest,
  type ToastType,
} from '@sdkwork/birdcoder-commons/workbench';
import type { FileChange, BirdCoderProject } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';

interface UseCodeWorkbenchCommandsOptions {
  projects: BirdCoderProject[];
  selectedCodingSessionId: string | null;
  currentProjectId: string;
  currentProjectPath?: string;
  defaultWorkingDirectory: string;
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
  onRunWithoutDebugging?: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeWorkbenchCommands({
  projects,
  selectedCodingSessionId,
  currentProjectId,
  currentProjectPath,
  defaultWorkingDirectory,
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
  onRunWithoutDebugging,
  addToast,
}: UseCodeWorkbenchCommandsOptions) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleCloseTerminal = () => setIsTerminalOpen(false);

    const handleOpenTerminal = (path?: string, command?: string) => {
      setIsTerminalOpen(true);
      setTerminalRequest({ path, command, timestamp: Date.now() });
    };

    const handleToggleTerminal = () => setIsTerminalOpen((previousState) => !previousState);
    const handleToggleSidebar = () => setIsSidebarVisible((previousState) => !previousState);
    const handleSplitTerminal = () => {
      addToast(t('terminal.splitTerminalNotSupported'), 'info');
    };

    const handleToggleDiffPanel = () => {
      setViewingDiff((previousState) => {
        if (previousState) {
          return null;
        }
        addToast(t('code.noActiveDiff'), 'info');
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
      addToast(t('code.fileSaved'), 'success');
    };

    const handleSaveAllFiles = () => {
      addToast(t('code.allFilesSaved'), 'success');
    };

    const handleStartDebugging = () => {
      setIsDebugConfigVisible(true);
    };

    const handleRunWithoutDebugging = () => {
      if (onRunWithoutDebugging) {
        onRunWithoutDebugging();
        return;
      }

      globalEventBus.emit('openTerminal');
      globalEventBus.emit('terminalRequest', {
        command: 'npm start',
        path: currentProjectPath?.trim() || defaultWorkingDirectory,
        timestamp: Date.now(),
      });
      addToast(t('code.startingApplication'), 'info');
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

        addToast(t('code.revealedInExplorer', { path: targetPath }), 'info');
      } catch (error) {
        console.error('Failed to reveal in explorer', error);
        addToast(t('code.revealedInExplorer', { path: targetPath }), 'info');
      }
    };

    const handleCreateNewCodingSession = async () => {
      if (!currentProjectId) {
        addToast(t('code.selectProjectFirst'), 'error');
        return;
      }

      try {
        const newCodingSession = await createCodingSession(currentProjectId, t('app.menu.newThread'));
        setSelectedCodingSessionId(newCodingSession.id);
        addToast(t('code.newThreadCreated'), 'success');
      } catch (error) {
        console.error('Failed to create thread', error);
        addToast(t('code.failedToCreateThread'), 'error');
      }
    };

    const unsubscribers = [
      globalEventBus.on('closeTerminal', handleCloseTerminal),
      globalEventBus.on('openTerminal', handleOpenTerminal),
      globalEventBus.on('toggleTerminal', handleToggleTerminal),
      globalEventBus.on('splitTerminal', handleSplitTerminal),
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
    currentProjectPath,
    defaultWorkingDirectory,
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
    onRunWithoutDebugging,
    t,
  ]);
}
