import { useEffect, useRef } from 'react';
import { buildProjectAgentSessionIndex, buildAgentSessionProjectScopedKey } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/requests';
import { globalEventBus } from '@sdkwork/birdcoder-pc-workbench/utils/EventBus';
import type { BirdCoderProjectAgentSessionIndex } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/requests';
import type { ToastType } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import type { ProjectRuntimeLocationResolver } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectRuntimeLocation';
import {
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectRuntimeLocationResolution';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';
import { useTranslation } from 'react-i18next';

interface UseCodeWorkbenchCommandsOptions {
  isActive?: boolean;
  projects: BirdCoderProject[];
  selectedAgentSessionId: string | null;
  selectedProjectId: string | null;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  selectAgentSession: (
    agentSessionId: string,
    options?: { projectId?: string },
  ) => void;
  setIsTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTerminalRequest: React.Dispatch<React.SetStateAction<TerminalCommandRequest | undefined>>;
  setIsSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFindVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsQuickOpenVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRunConfigVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDebugConfigVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRunTaskVisible: React.Dispatch<React.SetStateAction<boolean>>;
  onRunWithoutDebugging?: () => void;
  flushPendingAutosave: () => Promise<void>;
  addToast: (message: string, type?: ToastType) => void;
}

export function useCodeWorkbenchCommands({
  isActive = true,
  projects,
  selectedAgentSessionId,
  selectedProjectId,
  resolveProjectRuntimeLocation,
  selectAgentSession,
  setIsTerminalOpen,
  setTerminalRequest,
  setIsSidebarVisible,
  setIsFindVisible,
  setIsQuickOpenVisible,
  setIsRunConfigVisible,
  setIsDebugConfigVisible,
  setIsRunTaskVisible,
  onRunWithoutDebugging,
  flushPendingAutosave,
  addToast,
}: UseCodeWorkbenchCommandsOptions) {
  const { t } = useTranslation();
  const projectsRef = useRef(projects);
  const projectAgentSessionIndexRef = useRef<BirdCoderProjectAgentSessionIndex | null>(null);
  const selectedAgentSessionIdRef = useRef(selectedAgentSessionId);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const resolveProjectRuntimeLocationRef = useRef(resolveProjectRuntimeLocation);
  const selectAgentSessionRef = useRef(selectAgentSession);
  const onRunWithoutDebuggingRef = useRef(onRunWithoutDebugging);
  const flushPendingAutosaveRef = useRef(flushPendingAutosave);

  useEffect(() => {
    projectsRef.current = projects;
    projectAgentSessionIndexRef.current = buildProjectAgentSessionIndex(projectsRef.current);
  }, [projects]);

  const resolveProjectAgentSessionIndex = () => {
    let projectAgentSessionIndex = projectAgentSessionIndexRef.current;
    if (!projectAgentSessionIndex) {
      projectAgentSessionIndex = buildProjectAgentSessionIndex(projectsRef.current);
      projectAgentSessionIndexRef.current = projectAgentSessionIndex;
    }

    return projectAgentSessionIndex;
  };

  useEffect(() => {
    selectedAgentSessionIdRef.current = selectedAgentSessionId;
    selectedProjectIdRef.current = selectedProjectId;
    resolveProjectRuntimeLocationRef.current = resolveProjectRuntimeLocation;
    selectAgentSessionRef.current = selectAgentSession;
    onRunWithoutDebuggingRef.current = onRunWithoutDebugging;
    flushPendingAutosaveRef.current = flushPendingAutosave;
  }, [
    resolveProjectRuntimeLocation,
    onRunWithoutDebugging,
    flushPendingAutosave,
    selectAgentSession,
    selectedAgentSessionId,
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

    const handleFindInFiles = () => {
      setIsFindVisible(true);
    };

    const handleOpenQuickOpen = () => {
      setIsQuickOpenVisible(true);
    };

    const handlePreviousAgentSession = () => {
      const activeAgentSessionId = selectedAgentSessionIdRef.current;
      const activeProjectId = selectedProjectIdRef.current;
      if (!activeAgentSessionId || !activeProjectId) {
        return;
      }

      const previousAgentSession =
        resolveProjectAgentSessionIndex().previousAgentSessionReferenceByProjectIdAndId.get(
          buildAgentSessionProjectScopedKey(activeProjectId, activeAgentSessionId),
        ) ?? null;

      if (previousAgentSession) {
        selectAgentSessionRef.current(previousAgentSession.agentSessionId, {
          projectId: previousAgentSession.projectId,
        });
      }
    };

    const handleNextAgentSession = () => {
      const activeAgentSessionId = selectedAgentSessionIdRef.current;
      const activeProjectId = selectedProjectIdRef.current;
      if (!activeAgentSessionId || !activeProjectId) {
        return;
      }

      const nextAgentSession =
        resolveProjectAgentSessionIndex().nextAgentSessionReferenceByProjectIdAndId.get(
          buildAgentSessionProjectScopedKey(activeProjectId, activeAgentSessionId),
        ) ?? null;

      if (nextAgentSession) {
        selectAgentSessionRef.current(nextAgentSession.agentSessionId, {
          projectId: nextAgentSession.projectId,
        });
      }
    };

    const savePendingFileChanges = (successMessage: string) => {
      void flushPendingAutosaveRef.current()
        .then(() => {
          addToast(successMessage, 'success');
        })
        .catch((error: unknown) => {
          console.error('Failed to save pending code workbench changes', error);
        });
    };

    const handleSaveActiveFile = () => {
      savePendingFileChanges(t('code.fileSaved'));
    };

    const handleSaveAllFiles = () => {
      savePendingFileChanges(t('code.allFilesSaved'));
    };

    const handleStartDebugging = () => {
      setIsDebugConfigVisible(true);
    };

    const handleRunWithoutDebugging = () => {
      if (onRunWithoutDebuggingRef.current) {
        onRunWithoutDebuggingRef.current();
        return;
      }

      const currentProjectId = selectedProjectIdRef.current?.trim();
      if (!currentProjectId) {
        addToast(t('code.projectNotFound'), 'error');
        return;
      }

      void resolveProjectRuntimeLocationRef.current(currentProjectId, {
        allowFolderSelection: true,
        capability: 'build',
      }).then((resolution) => {
        const localWorkingDirectory = getResolvedProjectRuntimeLocationWorkingDirectory(resolution);
        if (!localWorkingDirectory) {
          const message = getProjectRuntimeLocationFailureMessage(
            resolution,
            'A local desktop folder must be mounted before running this project.',
          );
          if (message) {
            addToast(message, 'error');
          }
          return;
        }

        emitOpenTerminalRequest({
          surface: 'embedded',
          command: 'npm start',
          path: localWorkingDirectory,
          timestamp: Date.now(),
        });
        addToast(t('code.startingApplication'), 'info');
      });
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

    const unsubscribers = [
      globalEventBus.on('closeTerminal', handleCloseTerminal),
      globalEventBus.on('openTerminal', handleOpenTerminal),
      globalEventBus.on('toggleTerminal', handleToggleTerminal),
      globalEventBus.on('toggleSidebar', handleToggleSidebar),
      globalEventBus.on('findInFiles', handleFindInFiles),
      globalEventBus.on('openQuickOpen', handleOpenQuickOpen),
      globalEventBus.on('previousAgentSession', handlePreviousAgentSession),
      globalEventBus.on('nextAgentSession', handleNextAgentSession),
      globalEventBus.on('saveActiveFile', handleSaveActiveFile),
      globalEventBus.on('saveAllFiles', handleSaveAllFiles),
      globalEventBus.on('startDebugging', handleStartDebugging),
      globalEventBus.on('runWithoutDebugging', handleRunWithoutDebugging),
      globalEventBus.on('addRunConfiguration', handleAddRunConfiguration),
      globalEventBus.on('runTask', handleRunTask),
      globalEventBus.on('terminalRequest', handleTerminalRequest),
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
