import { useCallback } from 'react';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { getTerminalProfile } from '@sdkwork/birdcoder-pc-workbench/terminal/profiles';
import type { ToastType } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';
import {
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectRuntimeLocationResolution';
import type { ProjectRuntimeLocationResolver } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectRuntimeLocation';

interface CodePageTerminalProjectLike {
  projectId: string;
  name: string;
}

interface UseCodePageTerminalActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  currentProjectId: string;
  resolveProjectActionTarget: (
    project?: CodePageTerminalProjectLike | null,
  ) => CodePageTerminalProjectLike | null;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  resolveProjectById: (projectId: string) => CodePageTerminalProjectLike | null;
  setIsTerminalOpen: (isOpen: boolean) => void;
  setTerminalRequest: (request: TerminalCommandRequest) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useCodePageTerminalActions({
  addToast,
  currentProjectId,
  resolveProjectRuntimeLocation,
  resolveProjectActionTarget,
  resolveProjectById,
  setIsTerminalOpen,
  setTerminalRequest,
  t,
}: UseCodePageTerminalActionsOptions) {
  const resolveTerminalWorkingDirectory = useCallback(async (projectId: string) => {
    const resolution = await resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: true,
      capability: 'terminal',
    });
    const localWorkingDirectory = getResolvedProjectRuntimeLocationWorkingDirectory(resolution);
    if (localWorkingDirectory) {
      return localWorkingDirectory;
    }

    const message = getProjectRuntimeLocationFailureMessage(
      resolution,
      'A local desktop folder must be mounted before opening a terminal.',
    );
    if (message) {
      addToast(message, 'error');
    }
    return null;
  }, [addToast, resolveProjectRuntimeLocation]);

  const handleTopBarTerminalVisibilityChange = useCallback(async (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      const localWorkingDirectory = currentProjectId
        ? await resolveTerminalWorkingDirectory(currentProjectId)
        : null;
      if (!localWorkingDirectory) {
        return;
      }
      setTerminalRequest({
        surface: 'embedded',
        path: localWorkingDirectory,
        timestamp: Date.now(),
      });
    }

    setIsTerminalOpen(nextIsOpen);
  }, [
    currentProjectId,
    resolveTerminalWorkingDirectory,
    setIsTerminalOpen,
    setTerminalRequest,
  ]);

  const handleOpenInTerminal = useCallback(async (projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const localWorkingDirectory = await resolveTerminalWorkingDirectory(target.projectId);
    if (!localWorkingDirectory) {
      return;
    }

    const terminalProfile = profileId ? getTerminalProfile(profileId) : null;
    emitOpenTerminalRequest({
      surface: 'workspace',
      path: localWorkingDirectory,
      profileId: terminalProfile?.id,
      timestamp: Date.now(),
    });
    addToast(
      terminalProfile
        ? `Opened ${terminalProfile.title} terminal: ${target.name}`
        : `Opened project in terminal: ${target.name}`,
      'info',
    );
  }, [addToast, resolveProjectActionTarget, resolveProjectById, resolveTerminalWorkingDirectory]);

  const handleCopySessionId = useCallback(async (agentSessionId: string) => {
    const normalizedAgentSessionId = agentSessionId.trim();
    if (!normalizedAgentSessionId) {
      return;
    }

    const didCopy = await copyTextToClipboard(normalizedAgentSessionId);
    addToast(
      didCopy
        ? t('code.copiedSessionId', { id: normalizedAgentSessionId })
        : 'Unable to copy session id',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, t]);

  return {
    handleCopySessionId,
    handleOpenInTerminal,
    handleTopBarTerminalVisibilityChange,
  };
}

