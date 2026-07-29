import { useCallback } from 'react';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { resolveAgentSessionTerminalResume } from '@sdkwork/birdcoder-pc-workbench/terminal/agentSessionResume';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { getTerminalProfile } from '@sdkwork/birdcoder-pc-workbench/terminal/profiles';
import { resolveBirdcoderWorkbenchHostMode } from '@sdkwork/birdcoder-pc-workbench/terminal/runtimeTarget';
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

interface CodePageTerminalSessionLocation {
  agentSession: AgentSessionView;
  project: CodePageTerminalProjectLike;
}

interface UseCodePageTerminalActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  currentProject: CodePageTerminalProjectLike | null;
  resolveProjectActionTarget: (
    project?: CodePageTerminalProjectLike | null,
  ) => CodePageTerminalProjectLike | null;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  resolveProjectById: (projectId: string) => CodePageTerminalProjectLike | null;
  resolveSessionActionLocation: (
    agentSessionId: string,
    projectId?: string | null,
  ) => CodePageTerminalSessionLocation | null;
  setIsTerminalOpen: (isOpen: boolean) => void;
  setTerminalRequest: (request: TerminalCommandRequest) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useCodePageTerminalActions({
  addToast,
  currentProject,
  resolveProjectRuntimeLocation,
  resolveProjectActionTarget,
  resolveProjectById,
  resolveSessionActionLocation,
  setIsTerminalOpen,
  setTerminalRequest,
  t,
}: UseCodePageTerminalActionsOptions) {
  const resolveTerminalWorkingDirectory = useCallback(async (
    project: CodePageTerminalProjectLike,
    allowFolderSelection: boolean,
  ) => {
    const resolution = await resolveProjectRuntimeLocation(project, {
      allowFolderSelection,
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
      if (!currentProject) {
        return;
      }
      if (resolveBirdcoderWorkbenchHostMode() === 'web') {
        setTerminalRequest({
          surface: 'embedded',
          timestamp: Date.now(),
        });
        setIsTerminalOpen(true);
        return;
      }

      const localWorkingDirectory = await resolveTerminalWorkingDirectory(
        currentProject,
        false,
      );
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
    currentProject,
    resolveTerminalWorkingDirectory,
    setIsTerminalOpen,
    setTerminalRequest,
  ]);

  const handleOpenInTerminal = useCallback(async (projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const terminalProfile = profileId ? getTerminalProfile(profileId) : null;
    if (resolveBirdcoderWorkbenchHostMode() === 'web') {
      emitOpenTerminalRequest({
        surface: 'project',
        profileId: terminalProfile?.id,
        projectId: target.projectId,
        timestamp: Date.now(),
      });
      addToast(
        terminalProfile
          ? `Opened ${terminalProfile.title} terminal: ${target.name}`
          : `Opened project in terminal: ${target.name}`,
        'info',
      );
      return;
    }

    const localWorkingDirectory = await resolveTerminalWorkingDirectory(target, false);
    if (!localWorkingDirectory) {
      return;
    }

    emitOpenTerminalRequest({
      surface: 'project',
      path: localWorkingDirectory,
      profileId: terminalProfile?.id,
      projectId: target.projectId,
      timestamp: Date.now(),
    });
    addToast(
      terminalProfile
        ? `Opened ${terminalProfile.title} terminal: ${target.name}`
        : `Opened project in terminal: ${target.name}`,
      'info',
    );
  }, [addToast, resolveProjectActionTarget, resolveProjectById, resolveTerminalWorkingDirectory]);

  const handleOpenAgentSessionInTerminal = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const location = resolveSessionActionLocation(agentSessionId, projectId);
    if (!location) {
      addToast(t('chat.sendMessageSessionUnavailable'), 'error');
      return;
    }

    const resumeResolution = resolveAgentSessionTerminalResume(location.agentSession);
    if (resumeResolution.status === 'unsupported') {
      const message = resumeResolution.reason === 'invalid-provider-session-id'
        ? t('code.providerSessionIdInvalid')
        : t('code.sessionTerminalProviderUnsupported', {
            provider: location.agentSession.engineId || location.agentSession.providerId,
          });
      addToast(message, 'error');
      return;
    }

    const target = resolveProjectActionTarget(location.project);
    if (!target) {
      return;
    }

    const hostMode = resolveBirdcoderWorkbenchHostMode();
    const localWorkingDirectory = hostMode === 'web'
      ? null
      : await resolveTerminalWorkingDirectory(target, false);
    if (hostMode !== 'web' && !localWorkingDirectory) {
      return;
    }

    emitOpenTerminalRequest({
      agentId: location.agentSession.agentId,
      agentSessionId: location.agentSession.id,
      command: resumeResolution.command,
      path: localWorkingDirectory ?? undefined,
      projectId: target.projectId,
      runtimeLocationId: location.agentSession.runtimeLocationId,
      surface: 'project',
      timestamp: Date.now(),
    });
    addToast(t('code.openedSessionInProviderTerminal', {
      engine: resumeResolution.providerLabel,
      name: location.agentSession.title,
    }), 'info');
  }, [
    addToast,
    resolveProjectActionTarget,
    resolveSessionActionLocation,
    resolveTerminalWorkingDirectory,
    t,
  ]);

  const handleCopyProviderSessionId = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const location = resolveSessionActionLocation(agentSessionId, projectId);
    const providerSessionId = location?.agentSession.providerSessionId?.trim() ?? '';
    if (!providerSessionId) {
      addToast(t('code.providerSessionIdInvalid'), 'error');
      return;
    }

    const didCopy = await copyTextToClipboard(providerSessionId);
    addToast(
      didCopy
        ? t('code.copiedProviderSessionId', { id: providerSessionId })
        : t('code.copyProviderSessionIdFailed'),
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveSessionActionLocation, t]);

  return {
    handleCopyProviderSessionId,
    handleOpenAgentSessionInTerminal,
    handleOpenInTerminal,
    handleTopBarTerminalVisibilityChange,
  };
}

