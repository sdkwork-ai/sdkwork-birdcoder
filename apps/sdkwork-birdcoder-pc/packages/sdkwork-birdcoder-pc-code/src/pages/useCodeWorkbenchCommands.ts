import { useEffect, useRef } from 'react';
import { buildProjectCodingSessionIndex, buildCodingSessionProjectScopedKey } from '@sdkwork/birdcoder-pc-commons/workbench/codingSessionSelection';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-commons/terminal/runtime';
import { globalEventBus } from '@sdkwork/birdcoder-pc-commons/utils/EventBus';
import type { BirdCoderProjectCodingSessionIndex } from '@sdkwork/birdcoder-pc-commons/workbench/codingSessionSelection';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-commons/terminal/runtime';
import type { ToastType } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-types';
import { useTranslation } from 'react-i18next';

interface UseCodeWorkbenchCommandsOptions {
  isActive?: boolean;
  projects: BirdCoderProject[];
  selectedCodingSessionId: string | null;
  selectedProjectId: string | null;
  resolveLocalWorkingDirectory: (projectId: string) => Promise<string | null>;
  selectCodingSession: (
    codingSessionId: string,
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
  selectedCodingSessionId,
  selectedProjectId,
  resolveLocalWorkingDirectory,
  selectCodingSession,
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
  const projectCodingSessionIndexRef = useRef<BirdCoderProjectCodingSessionIndex | null>(null);
  const selectedCodingSessionIdRef = useRef(selectedCodingSessionId);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const resolveLocalWorkingDirectoryRef = useRef(resolveLocalWorkingDirectory);
  const selectCodingSessionRef = useRef(selectCodingSession);
  const onRunWithoutDebuggingRef = useRef(onRunWithoutDebugging);
  const flushPendingAutosaveRef = useRef(flushPendingAutosave);

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
    resolveLocalWorkingDirectoryRef.current = resolveLocalWorkingDirectory;
    selectCodingSessionRef.current = selectCodingSession;
    onRunWithoutDebuggingRef.current = onRunWithoutDebugging;
    flushPendingAutosaveRef.current = flushPendingAutosave;
  }, [
    resolveLocalWorkingDirectory,
    onRunWithoutDebugging,
    flushPendingAutosave,
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

      void resolveLocalWorkingDirectoryRef.current(currentProjectId).then((localWorkingDirectory) => {
        if (!localWorkingDirectory) {
          addToast('A local desktop folder must be mounted before running this project.', 'error');
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
      globalEventBus.on('previousCodingSession', handlePreviousCodingSession),
      globalEventBus.on('nextCodingSession', handleNextCodingSession),
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
