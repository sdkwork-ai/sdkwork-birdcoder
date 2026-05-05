import { useEffect, useRef } from 'react';
import {
  buildProjectCodingSessionIndex,
  buildCodingSessionProjectScopedKey,
  emitOpenTerminalRequest,
  globalEventBus,
  openTauriShellPath,
  type BirdCoderProjectCodingSessionIndex,
  type TerminalCommandRequest,
  type ToastType,
} from '@sdkwork/birdcoder-commons';
import type { FileChange, BirdCoderProject } from '@sdkwork/birdcoder-types';
import { useTranslation } from 'react-i18next';

interface UseCodeWorkbenchCommandsOptions {
  isActive?: boolean;
  projects: BirdCoderProject[];
  selectedCodingSessionId: string | null;
  selectedProjectId: string | null;
  currentProjectPath?: string;
  defaultWorkingDirectory: string;
  selectCodingSession: (
    codingSessionId: string,
    options?: { projectId?: string },
  ) => void;
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
  selectedProjectId,
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
  const projectCodingSessionIndexRef = useRef<BirdCoderProjectCodingSessionIndex | null>(null);
  const selectedCodingSessionIdRef = useRef(selectedCodingSessionId);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const currentProjectPathRef = useRef(currentProjectPath);
  const defaultWorkingDirectoryRef = useRef(defaultWorkingDirectory);
  const selectCodingSessionRef = useRef(selectCodingSession);
  const onRunWithoutDebuggingRef = useRef(onRunWithoutDebugging);

  useEffect(() => {
    projectsRef.current = projects;
    projectCodingSessionIndexRef.current = buildProjectCodingSessionIndex(projectsRef.current);
  }, [projects]);

  const resolveProjectCodingSessionIndex = () => {
    let projectCodingSessionIndex = projectCodingSessionIndexRef.current;
    if (!projectCodingSessionIndex) {
      projectCodingSessionIndex = buildProjectCodingSessionIndex(projectsRef.current);
      projectCodingSessionIndexRef.current = projectCodingSessionIndex;
    }

    return projectCodingSessionIndex;
  };

  useEffect(() => {
    selectedCodingSessionIdRef.current = selectedCodingSessionId;
    selectedProjectIdRef.current = selectedProjectId;
    currentProjectPathRef.current = currentProjectPath;
    defaultWorkingDirectoryRef.current = defaultWorkingDirectory;
    selectCodingSessionRef.current = selectCodingSession;
    onRunWithoutDebuggingRef.current = onRunWithoutDebugging;
  }, [
    currentProjectPath,
    defaultWorkingDirectory,
    onRunWithoutDebugging,
    selectCodingSession,
    selectedCodingSessionId,
    selectedProjectId,
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
      const activeProjectId = selectedProjectIdRef.current;
      if (!activeCodingSessionId || !activeProjectId) {
        return;
      }

      const previousCodingSession =
        resolveProjectCodingSessionIndex().previousCodingSessionReferenceByProjectIdAndId.get(
          buildCodingSessionProjectScopedKey(activeProjectId, activeCodingSessionId),
        ) ?? null;

      if (previousCodingSession) {
        selectCodingSessionRef.current(previousCodingSession.codingSessionId, {
          projectId: previousCodingSession.projectId,
        });
      }
    };

    const handleNextCodingSession = () => {
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      const activeProjectId = selectedProjectIdRef.current;
      if (!activeCodingSessionId || !activeProjectId) {
        return;
      }

      const nextCodingSession =
        resolveProjectCodingSessionIndex().nextCodingSessionReferenceByProjectIdAndId.get(
          buildCodingSessionProjectScopedKey(activeProjectId, activeCodingSessionId),
        ) ?? null;

      if (nextCodingSession) {
        selectCodingSessionRef.current(nextCodingSession.codingSessionId, {
          projectId: nextCodingSession.projectId,
        });
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
        if (await openTauriShellPath(targetPath)) {
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
