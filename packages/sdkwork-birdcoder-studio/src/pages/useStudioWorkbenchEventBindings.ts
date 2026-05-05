import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  buildCodingSessionProjectScopedKey,
  buildProjectCodingSessionIndex,
  buildTerminalProfileBlockedMessage,
  emitOpenTerminalRequest,
  getDefaultRunConfigurations,
  globalEventBus,
  openTauriShellPath,
  resolveRunConfigurationTerminalLaunch,
  type BirdCoderProjectCodingSessionIndex,
  type RunConfigurationRecord,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-commons';
import type { BirdCoderProject, FileChange } from '@sdkwork/birdcoder-types';

type ToastVariant = 'success' | 'info' | 'error';

interface UseStudioWorkbenchEventBindingsOptions {
  addToast: (message: string, variant: ToastVariant) => void;
  isActive?: boolean;
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

export function useStudioWorkbenchEventBindings({
  addToast,
  isActive = true,
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
  const projectCodingSessionIndexProjectsRef = useRef(projectsRef.current);
  const projectCodingSessionIndexRef = useRef<BirdCoderProjectCodingSessionIndex | null>(null);

  const resolveProjectCodingSessionIndex = useCallback(() => {
    if (
      projectCodingSessionIndexProjectsRef.current !== projectsRef.current ||
      !projectCodingSessionIndexRef.current
    ) {
      projectCodingSessionIndexProjectsRef.current = projectsRef.current;
      projectCodingSessionIndexRef.current = buildProjectCodingSessionIndex(projectsRef.current);
    }

    return projectCodingSessionIndexRef.current;
  }, [projectsRef]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleOpenTerminal = () => {
      setIsTerminalOpen(true);
    };
    const handleCloseTerminal = () => {
      setIsTerminalOpen(false);
    };
    const handleToggleTerminal = () => {
      setIsTerminalOpen((previousState) => !previousState);
    };
    const handleTerminalRequest = (request: TerminalCommandRequest) => {
      if (request.surface !== 'embedded') {
        return;
      }

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

      const activeProjectId = currentProjectIdRef.current;
      const previousCodingSessionReference =
        activeProjectId
          ? resolveProjectCodingSessionIndex().previousCodingSessionReferenceByProjectIdAndId.get(
              buildCodingSessionProjectScopedKey(activeProjectId, activeCodingSessionId),
            ) ?? null
          : null;
      if (previousCodingSessionReference) {
        selectCodingSessionRef.current(previousCodingSessionReference.codingSessionId, {
          projectId: previousCodingSessionReference.projectId,
        });
      }
    };
    const handleNextCodingSession = () => {
      const activeCodingSessionId = selectedCodingSessionIdRef.current;
      if (!activeCodingSessionId) {
        return;
      }

      const activeProjectId = currentProjectIdRef.current;
      const nextCodingSessionReference =
        activeProjectId
          ? resolveProjectCodingSessionIndex().nextCodingSessionReferenceByProjectIdAndId.get(
              buildCodingSessionProjectScopedKey(activeProjectId, activeCodingSessionId),
            ) ?? null
          : null;
      if (nextCodingSessionReference) {
        selectCodingSessionRef.current(nextCodingSessionReference.codingSessionId, {
          projectId: nextCodingSessionReference.projectId,
        });
      }
    };
    const handleRevealInExplorer = async (targetPath: string) => {
      try {
        if (await openTauriShellPath(targetPath)) {
          return;
        }

        addToast(t('studio.revealedInExplorer', { path: targetPath }), 'info');
      } catch (error) {
        console.error('Failed to reveal in explorer', error);
        addToast(t('studio.revealedInExplorer', { path: targetPath }), 'info');
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

        emitOpenTerminalRequest(launch.request);
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
    globalEventBus.on('terminalRequest', handleTerminalRequest);
    globalEventBus.on('saveActiveFile', handleSaveActiveFile);
    globalEventBus.on('saveAllFiles', handleSaveAllFiles);
    globalEventBus.on('previousCodingSession', handlePreviousCodingSession);
    globalEventBus.on('nextCodingSession', handleNextCodingSession);
    globalEventBus.on('revealInExplorer', handleRevealInExplorer);
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
      globalEventBus.off('terminalRequest', handleTerminalRequest);
      globalEventBus.off('saveActiveFile', handleSaveActiveFile);
      globalEventBus.off('saveAllFiles', handleSaveAllFiles);
      globalEventBus.off('previousCodingSession', handlePreviousCodingSession);
      globalEventBus.off('nextCodingSession', handleNextCodingSession);
      globalEventBus.off('revealInExplorer', handleRevealInExplorer);
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
    currentProjectIdRef,
    defaultWorkingDirectoryRef,
    isActive,
    projectsRef,
    resolveProjectCodingSessionIndex,
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
