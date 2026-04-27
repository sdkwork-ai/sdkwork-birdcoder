import { useEffect, useRef } from 'react';
import {
  buildProjectCodingSessionIndex,
  emitOpenTerminalRequest,
  globalEventBus,
  type TerminalCommandRequest,
  type ToastType,
} from '@sdkwork/birdcoder-commons';
import type { FileChange, BirdCoderProject } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';

interface UseCodeWorkbenchCommandsOptions {
  isActive?: boolean;
  projects: BirdCoderProject[];
  selectedCodingSessionId: string | null;
  currentProjectPath?: string;
  defaultWorkingDirectory: string;
  selectCodingSession: (codingSessionId: string) => void;
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
  isActive = true,
  projects,
  selectedCodingSessionId,
  currentProjectPath,
  defaultWorkingDirectory,
  selectCodingSession,
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
  const projectsRef = useRef(projects);
  const selectedCodingSessionIdRef = useRef(selectedCodingSessionId);
  const currentProjectPathRef = useRef(currentProjectPath);
  const defaultWorkingDirectoryRef = useRef(defaultWorkingDirectory);
  const selectCodingSessionRef = useRef(selectCodingSession);
  const onRunWithoutDebuggingRef = useRef(onRunWithoutDebugging);

  useEffect(() => {
    projectsRef.current = projects;
    selectedCodingSessionIdRef.current = selectedCodingSessionId;
    currentProjectPathRef.current = currentProjectPath;
    defaultWorkingDirectoryRef.current = defaultWorkingDirectory;
    selectCodingSessionRef.current = selectCodingSession;
    onRunWithoutDebuggingRef.current = onRunWithoutDebugging;
  }, [
    currentProjectPath,
    defaultWorkingDirectory,
    onRunWithoutDebugging,
    projects,
    selectCodingSession,
    selectedCodingSessionId,
  ]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleCloseTerminal = () => setIsTerminalOpen(false);

    const handleOpenTerminal = () => setIsTerminalOpen(true);

    const handleToggleTerminal = () => setIsTerminalOpen((previousState) => !previousState);
    const handleToggleSidebar = () => setIsSidebarVisible((previousState) => !previousState);

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
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      if (!activeCodingSessionId) {
        return;
      }

      const previousCodingSessionId =
        buildProjectCodingSessionIndex(projectsRef.current).previousCodingSessionIdById.get(
          activeCodingSessionId,
        ) ?? null;

      if (previousCodingSessionId) {
        selectCodingSessionRef.current(previousCodingSessionId);
      }
    };

    const handleNextCodingSession = () => {
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      if (!activeCodingSessionId) {
        return;
      }

      const nextCodingSessionId =
        buildProjectCodingSessionIndex(projectsRef.current).nextCodingSessionIdById.get(
          activeCodingSessionId,
        ) ?? null;

      if (nextCodingSessionId) {
        selectCodingSessionRef.current(nextCodingSessionId);
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
      if (onRunWithoutDebuggingRef.current) {
        onRunWithoutDebuggingRef.current();
        return;
      }

      emitOpenTerminalRequest({
        surface: 'embedded',
        command: 'npm start',
        path:
          currentProjectPathRef.current?.trim() || defaultWorkingDirectoryRef.current,
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
      if (request.surface !== 'embedded') {
        return;
      }

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
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    addToast,
    isActive,
    t,
  ]);
}
