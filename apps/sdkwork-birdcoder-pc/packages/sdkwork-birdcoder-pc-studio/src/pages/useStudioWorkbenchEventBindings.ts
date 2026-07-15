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
  resolveRunConfigurationTerminalLaunch,
  type BirdCoderProjectCodingSessionIndex,
  type RunConfigurationRecord,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-commons';
import type { BirdCoderProject, FileChange } from '@sdkwork/birdcoder-pc-types';

type ToastVariant = 'success' | 'info' | 'error';

interface UseStudioWorkbenchEventBindingsOptions {
  addToast: (message: string, variant: ToastVariant) => void;
  saveError?: string | null;
  isActive?: boolean;
  currentProjectIdRef: MutableRefObject<string>;
  projectsRef: MutableRefObject<BirdCoderProject[]>;
  resolveLocalWorkingDirectory: (projectId: string) => Promise<string | null>;
  runConfigurationsRef: MutableRefObject<RunConfigurationRecord[]>;
  selectedCodingSessionIdRef: MutableRefObject<string>;
  selectCodingSessionRef: MutableRefObject<
    (nextCodingSessionId: string, options?: { projectId?: string }) => void
  >;
  flushPendingAutosave: () => Promise<void>;
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
  saveError,
  isActive = true,
  currentProjectIdRef,
  projectsRef,
  resolveLocalWorkingDirectory,
  runConfigurationsRef,
  selectedCodingSessionIdRef,
  selectCodingSessionRef,
  flushPendingAutosave,
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
  const flushPendingAutosaveRef = useRef(flushPendingAutosave);
  const resolveLocalWorkingDirectoryRef = useRef(resolveLocalWorkingDirectory);

  useEffect(() => {
    if (saveError) {
      addToast(saveError, 'error');
    }
  }, [addToast, saveError]);

  useEffect(() => {
    flushPendingAutosaveRef.current = flushPendingAutosave;
  }, [flushPendingAutosave]);

  useEffect(() => {
    resolveLocalWorkingDirectoryRef.current = resolveLocalWorkingDirectory;
  }, [resolveLocalWorkingDirectory]);

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
    const savePendingFileChanges = (successMessage: string) => {
      void flushPendingAutosaveRef.current()
        .then(() => {
          addToast(successMessage, 'success');
        })
        .catch((error: unknown) => {
          console.error('Failed to save pending studio workbench changes', error);
        });
    };
    const handleSaveActiveFile = () => {
      savePendingFileChanges(t('studio.fileSaved'));
    };
    const handleSaveAllFiles = () => {
      savePendingFileChanges(t('studio.allFilesSaved'));
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
        const currentProjectId = currentProjectIdRef.current.trim();
        const localWorkingDirectory = currentProjectId
          ? await resolveLocalWorkingDirectoryRef.current(currentProjectId)
          : null;
        if (!localWorkingDirectory) {
          addToast('A local desktop folder must be mounted before running this project.', 'error');
          return;
        }
        const launch = await resolveRunConfigurationTerminalLaunch(configuration, {
          projectDirectory: localWorkingDirectory,
          workspaceDirectory: localWorkingDirectory,
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
    isActive,
    projectsRef,
    resolveLocalWorkingDirectoryRef,
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
