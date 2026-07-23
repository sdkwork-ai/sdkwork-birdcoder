import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  buildAgentSessionProjectScopedKey,
  buildProjectAgentSessionIndex,
  buildTerminalProfileBlockedMessage,
  emitOpenTerminalRequest,
  getDefaultRunConfigurations,
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
  globalEventBus,
  resolveRunConfigurationTerminalLaunch,
  type BirdCoderProjectAgentSessionIndex,
  type RunConfigurationRecord,
  type ProjectRuntimeLocationResolver,
  type TerminalCommandRequest,
} from '@sdkwork/birdcoder-pc-workbench';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

type ToastVariant = 'success' | 'info' | 'error';

interface UseStudioWorkbenchEventBindingsOptions {
  addToast: (message: string, variant: ToastVariant) => void;
  saveError?: string | null;
  isActive?: boolean;
  currentProjectIdRef: MutableRefObject<string>;
  projectsRef: MutableRefObject<BirdCoderProject[]>;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  runConfigurationsRef: MutableRefObject<RunConfigurationRecord[]>;
  selectedAgentSessionIdRef: MutableRefObject<string>;
  selectAgentSessionRef: MutableRefObject<
    (nextAgentSessionId: string, options?: { projectId?: string }) => void
  >;
  flushPendingAutosave: () => Promise<void>;
  setIsDebugConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsFindVisible: Dispatch<SetStateAction<boolean>>;
  setIsQuickOpenVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunConfigVisible: Dispatch<SetStateAction<boolean>>;
  setIsRunTaskVisible: Dispatch<SetStateAction<boolean>>;
  setIsTerminalOpen: Dispatch<SetStateAction<boolean>>;
  setTerminalRequest: Dispatch<SetStateAction<TerminalCommandRequest | undefined>>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function useStudioWorkbenchEventBindings({
  addToast,
  saveError,
  isActive = true,
  currentProjectIdRef,
  projectsRef,
  resolveProjectRuntimeLocation,
  runConfigurationsRef,
  selectedAgentSessionIdRef,
  selectAgentSessionRef,
  flushPendingAutosave,
  setIsDebugConfigVisible,
  setIsFindVisible,
  setIsQuickOpenVisible,
  setIsRunConfigVisible,
  setIsRunTaskVisible,
  setIsTerminalOpen,
  setTerminalRequest,
  t,
}: UseStudioWorkbenchEventBindingsOptions) {
  const projectAgentSessionIndexProjectsRef = useRef(projectsRef.current);
  const projectAgentSessionIndexRef = useRef<BirdCoderProjectAgentSessionIndex | null>(null);
  const flushPendingAutosaveRef = useRef(flushPendingAutosave);
  const resolveProjectRuntimeLocationRef = useRef(resolveProjectRuntimeLocation);

  useEffect(() => {
    if (saveError) {
      addToast(saveError, 'error');
    }
  }, [addToast, saveError]);

  useEffect(() => {
    flushPendingAutosaveRef.current = flushPendingAutosave;
  }, [flushPendingAutosave]);

  useEffect(() => {
    resolveProjectRuntimeLocationRef.current = resolveProjectRuntimeLocation;
  }, [resolveProjectRuntimeLocation]);

  const resolveProjectAgentSessionIndex = useCallback(() => {
    if (
      projectAgentSessionIndexProjectsRef.current !== projectsRef.current ||
      !projectAgentSessionIndexRef.current
    ) {
      projectAgentSessionIndexProjectsRef.current = projectsRef.current;
      projectAgentSessionIndexRef.current = buildProjectAgentSessionIndex(projectsRef.current);
    }

    return projectAgentSessionIndexRef.current;
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
    const handlePreviousAgentSession = () => {
      const activeAgentSessionId = selectedAgentSessionIdRef.current;
      if (!activeAgentSessionId) {
        return;
      }

      const activeProjectId = currentProjectIdRef.current;
      const previousAgentSessionReference =
        activeProjectId
          ? resolveProjectAgentSessionIndex().previousAgentSessionReferenceByProjectIdAndId.get(
              buildAgentSessionProjectScopedKey(activeProjectId, activeAgentSessionId),
            ) ?? null
          : null;
      if (previousAgentSessionReference) {
        selectAgentSessionRef.current(previousAgentSessionReference.agentSessionId, {
          projectId: previousAgentSessionReference.projectId,
        });
      }
    };
    const handleNextAgentSession = () => {
      const activeAgentSessionId = selectedAgentSessionIdRef.current;
      if (!activeAgentSessionId) {
        return;
      }

      const activeProjectId = currentProjectIdRef.current;
      const nextAgentSessionReference =
        activeProjectId
          ? resolveProjectAgentSessionIndex().nextAgentSessionReferenceByProjectIdAndId.get(
              buildAgentSessionProjectScopedKey(activeProjectId, activeAgentSessionId),
            ) ?? null
          : null;
      if (nextAgentSessionReference) {
        selectAgentSessionRef.current(nextAgentSessionReference.agentSessionId, {
          projectId: nextAgentSessionReference.projectId,
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
        const resolution = currentProjectId
          ? await resolveProjectRuntimeLocationRef.current(currentProjectId, {
              allowFolderSelection: true,
              capability: 'build',
            })
          : null;
        const localWorkingDirectory = resolution
          ? getResolvedProjectRuntimeLocationWorkingDirectory(resolution)
          : null;
        if (!localWorkingDirectory) {
          const message = resolution
            ? getProjectRuntimeLocationFailureMessage(
                resolution,
                'A local desktop folder must be mounted before running this project.',
              )
            : 'Select a project before running this project.';
          if (message) {
            addToast(message, 'error');
          }
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
    globalEventBus.on('previousAgentSession', handlePreviousAgentSession);
    globalEventBus.on('nextAgentSession', handleNextAgentSession);
    globalEventBus.on('runTask', handleRunTask);
    globalEventBus.on('startDebugging', handleStartDebugging);
    globalEventBus.on('runWithoutDebugging', handleRunWithoutDebugging);
    globalEventBus.on('addRunConfiguration', handleAddRunConfiguration);
    globalEventBus.on('findInFiles', handleFindInFiles);
    globalEventBus.on('openQuickOpen', handleOpenQuickOpen);

    return () => {
      globalEventBus.off('openTerminal', handleOpenTerminal);
      globalEventBus.off('closeTerminal', handleCloseTerminal);
      globalEventBus.off('toggleTerminal', handleToggleTerminal);
      globalEventBus.off('terminalRequest', handleTerminalRequest);
      globalEventBus.off('saveActiveFile', handleSaveActiveFile);
      globalEventBus.off('saveAllFiles', handleSaveAllFiles);
      globalEventBus.off('previousAgentSession', handlePreviousAgentSession);
      globalEventBus.off('nextAgentSession', handleNextAgentSession);
      globalEventBus.off('runTask', handleRunTask);
      globalEventBus.off('startDebugging', handleStartDebugging);
      globalEventBus.off('runWithoutDebugging', handleRunWithoutDebugging);
      globalEventBus.off('addRunConfiguration', handleAddRunConfiguration);
      globalEventBus.off('findInFiles', handleFindInFiles);
      globalEventBus.off('openQuickOpen', handleOpenQuickOpen);
    };
  }, [
    addToast,
    currentProjectIdRef,
    isActive,
    projectsRef,
    resolveProjectRuntimeLocationRef,
    resolveProjectAgentSessionIndex,
    runConfigurationsRef,
    selectedAgentSessionIdRef,
    selectAgentSessionRef,
    setIsDebugConfigVisible,
    setIsFindVisible,
    setIsQuickOpenVisible,
    setIsRunConfigVisible,
    setIsRunTaskVisible,
    setIsTerminalOpen,
    setTerminalRequest,
    t,
  ]);
}
