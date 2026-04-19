import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  buildTerminalProfileBlockedMessage,
  getDefaultRunConfigurations,
  globalEventBus,
  resolveRunConfigurationTerminalLaunch,
} from '@sdkwork/birdcoder-commons/workbench';
import type {
  RunConfigurationRecord,
  TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons/workbench';
import type { BirdCoderProject, FileChange } from '@sdkwork/birdcoder-types';

type ToastVariant = 'success' | 'info' | 'error';

interface UseStudioWorkbenchEventBindingsOptions {
  addToast: (message: string, variant: ToastVariant) => void;
  createCodingSessionWithSelectionRef: MutableRefObject<
    (projectId: string, title: string) => Promise<{ id: string }>
  >;
  currentProjectIdRef: MutableRefObject<string>;
  defaultWorkingDirectoryRef: MutableRefObject<string>;
  projectsRef: MutableRefObject<BirdCoderProject[]>;
  runConfigurationsRef: MutableRefObject<RunConfigurationRecord[]>;
  selectedCodingSessionIdRef: MutableRefObject<string>;
  selectCodingSessionRef: MutableRefObject<
    (nextCodingSessionId: string, options?: { projectId?: string }) => void
  >;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsFindVisible: Dispatch<SetStateAction<boolean>>;
  setIsQuickOpenVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  setIsTerminalOpen: Dispatch<SetStateAction<boolean>>;
  setTerminalRequest: Dispatch<SetStateAction<TerminalCommandRequest | undefined>>;
  setViewingDiff: Dispatch<SetStateAction<FileChange | null>>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function listCodingSessions(projects: BirdCoderProject[]) {
  return projects.flatMap((project) => project.codingSessions);
}

export function useStudioWorkbenchEventBindings({
  addToast,
  createCodingSessionWithSelectionRef,
  currentProjectIdRef,
  defaultWorkingDirectoryRef,
  projectsRef,
  runConfigurationsRef,
  selectedCodingSessionIdRef,
  selectCodingSessionRef,
  setIsDebugConfigVisible,
  setIsFindVisible,
  setIsQuickOpenVisible,
  setIsRunConfigVisible,
  setIsRunTaskVisible,
  setIsTerminalOpen,
  setTerminalRequest,
  setViewingDiff,
  t,
}: UseStudioWorkbenchEventBindingsOptions) {
  useEffect(() => {
    const handleOpenTerminal = (path?: string, command?: string) => {
      setIsTerminalOpen(true);
      setTerminalRequest({ path, command, timestamp: Date.now() });
    };
    const handleCloseTerminal = () => {
      setIsTerminalOpen(false);
    };
    const handleToggleTerminal = () => {
      setIsTerminalOpen((previousState) => !previousState);
    };
    const handleSplitTerminal = () => {
      addToast(t('terminal.splitTerminalNotSupported'), 'info');
    };
    const handleTerminalRequest = (request: TerminalCommandRequest) => {
      setTerminalRequest(request);
      setIsTerminalOpen(true);
    };
    const handleSaveActiveFile = () => {
      addToast(t('studio.fileSaved'), 'success');
    };
    const handleSaveAllFiles = () => {
      addToast(t('studio.allFilesSaved'), 'success');
    };
    const handlePreviousCodingSession = () => {
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      if (!activeCodingSessionId) {
        return;
      }

      const allSessions = listCodingSessions(projectsRef.current);
      const currentIndex = allSessions.findIndex((session) => session.id === activeCodingSessionId);
      if (currentIndex > 0) {
        selectCodingSessionRef.current(allSessions[currentIndex - 1].id);
      }
    };
    const handleNextCodingSession = () => {
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      if (!activeCodingSessionId) {
        return;
      }

      const allSessions = listCodingSessions(projectsRef.current);
      const currentIndex = allSessions.findIndex((session) => session.id === activeCodingSessionId);
      if (currentIndex !== -1 && currentIndex < allSessions.length - 1) {
        selectCodingSessionRef.current(allSessions[currentIndex + 1].id);
      }
    };
    const handleRevealInExplorer = async (targetPath: string) => {
      try {
        if (window.__TAURI__) {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(targetPath);
          return;
        }

        addToast(t('studio.revealedInExplorer', { path: targetPath }), 'info');
      } catch (error) {
        console.error('Failed to reveal in explorer', error);
        addToast(t('studio.revealedInExplorer', { path: targetPath }), 'info');
      }
    };
    const handleCreateNewCodingSession = async () => {
      const activeProjectId = currentProjectIdRef.current;
      if (!activeProjectId) {
        addToast(t('studio.pleaseSelectProject'), 'error');
        return;
      }

      try {
        const newThread = await createCodingSessionWithSelectionRef.current(
          activeProjectId,
          t('studio.newThread'),
        );
        selectCodingSessionRef.current(newThread.id, { projectId: activeProjectId });
        addToast(t('studio.newThreadCreated'), 'success');
      } catch (error) {
        console.error('Failed to create thread', error);
        addToast(t('studio.failedToCreateThread'), 'error');
      }
    };
    const handleRunTask = () => {
      setIsRunTaskVisible(true);
    };
    const handleStartDebugging = () => {
      setIsDebugConfigVisible(true);
    };
    const handleRunWithoutDebugging = () => {
      const configuration =
        runConfigurationsRef.current.find((entry) => entry.group === 'dev')
        ?? runConfigurationsRef.current[0]
        ?? getDefaultRunConfigurations()[0];

      void (async () => {
        const activeProject = projectsRef.current.find(
          (project) => project.id === currentProjectIdRef.current,
        );
        const normalizedProjectPath = activeProject?.path?.trim() ?? '';
        const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
          projectDirectory:
            normalizedProjectPath.length > 0
              ? normalizedProjectPath
              : defaultWorkingDirectoryRef.current,
          workspaceDirectory: defaultWorkingDirectoryRef.current,
        });

        if (!launch.request) {
          addToast(
            buildTerminalProfileBlockedMessage(configuration.profileId, {
              launchState: launch.launchPresentation,
              blockedAction: launch.blockedAction,
            }) ?? 'Blocked terminal profile.',
            'error',
          );
          if (launch.blockedAction.actionId === 'open-settings') {
            globalEventBus.emit('openSettings');
          }
          return;
        }

        globalEventBus.emit('openTerminal');
        globalEventBus.emit('terminalRequest', launch.request);
        addToast(t('studio.startingApplication'), 'info');
      })();
    };
    const handleAddRunConfiguration = () => {
      setIsRunConfigVisible(true);
    };
    const handleToggleDiffPanel = () => {
      setViewingDiff((previousState) => {
        if (previousState) {
          return null;
        }

        addToast(t('studio.noActiveDiff'), 'info');
        return null;
      });
    };
    const handleFindInFiles = () => {
      setIsFindVisible(true);
    };
    const handleOpenQuickOpen = () => {
      setIsQuickOpenVisible(true);
    };

    globalEventBus.on('openTerminal', handleOpenTerminal);
    globalEventBus.on('closeTerminal', handleCloseTerminal);
    globalEventBus.on('toggleTerminal', handleToggleTerminal);
    globalEventBus.on('splitTerminal', handleSplitTerminal);
    globalEventBus.on('terminalRequest', handleTerminalRequest);
    globalEventBus.on('saveActiveFile', handleSaveActiveFile);
    globalEventBus.on('saveAllFiles', handleSaveAllFiles);
    globalEventBus.on('previousCodingSession', handlePreviousCodingSession);
    globalEventBus.on('nextCodingSession', handleNextCodingSession);
    globalEventBus.on('revealInExplorer', handleRevealInExplorer);
    globalEventBus.on('createNewCodingSession', handleCreateNewCodingSession);
    globalEventBus.on('runTask', handleRunTask);
    globalEventBus.on('startDebugging', handleStartDebugging);
    globalEventBus.on('runWithoutDebugging', handleRunWithoutDebugging);
    globalEventBus.on('addRunConfiguration', handleAddRunConfiguration);
    globalEventBus.on('toggleDiffPanel', handleToggleDiffPanel);
    globalEventBus.on('findInFiles', handleFindInFiles);
    globalEventBus.on('openQuickOpen', handleOpenQuickOpen);

    return () => {
      globalEventBus.off('openTerminal', handleOpenTerminal);
      globalEventBus.off('closeTerminal', handleCloseTerminal);
      globalEventBus.off('toggleTerminal', handleToggleTerminal);
      globalEventBus.off('splitTerminal', handleSplitTerminal);
      globalEventBus.off('terminalRequest', handleTerminalRequest);
      globalEventBus.off('saveActiveFile', handleSaveActiveFile);
      globalEventBus.off('saveAllFiles', handleSaveAllFiles);
      globalEventBus.off('previousCodingSession', handlePreviousCodingSession);
      globalEventBus.off('nextCodingSession', handleNextCodingSession);
      globalEventBus.off('revealInExplorer', handleRevealInExplorer);
      globalEventBus.off('createNewCodingSession', handleCreateNewCodingSession);
      globalEventBus.off('runTask', handleRunTask);
      globalEventBus.off('startDebugging', handleStartDebugging);
      globalEventBus.off('runWithoutDebugging', handleRunWithoutDebugging);
      globalEventBus.off('addRunConfiguration', handleAddRunConfiguration);
      globalEventBus.off('toggleDiffPanel', handleToggleDiffPanel);
      globalEventBus.off('findInFiles', handleFindInFiles);
      globalEventBus.off('openQuickOpen', handleOpenQuickOpen);
    };
  }, [
    addToast,
    createCodingSessionWithSelectionRef,
    currentProjectIdRef,
    defaultWorkingDirectoryRef,
    projectsRef,
    runConfigurationsRef,
    selectedCodingSessionIdRef,
    selectCodingSessionRef,
    setIsDebugConfigVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setIsTerminalOpen,
    setTerminalRequest,
    setViewingDiff,
    t,
  ]);
}
