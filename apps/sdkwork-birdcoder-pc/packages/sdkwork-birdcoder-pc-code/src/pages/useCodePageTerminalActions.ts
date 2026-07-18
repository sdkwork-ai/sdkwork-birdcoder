import { useCallback } from 'react';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import { getTerminalProfile } from '@sdkwork/birdcoder-pc-workbench/terminal/profiles';
import type { ToastType } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-workbench/terminal/runtime';
import {
  buildWorkbenchCodeEngineCliResumeCommand,
  normalizeBirdCoderCodeEngineNativeSessionId,
} from '@sdkwork/birdcoder-pc-codeengine';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-contracts-commons';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';
import {
  getProjectRuntimeLocationFailureMessage,
  getResolvedProjectRuntimeLocationWorkingDirectory,
} from '@sdkwork/birdcoder-pc-workbench/workbench/projectRuntimeLocationResolution';
import type { ProjectRuntimeLocationResolver } from '@sdkwork/birdcoder-pc-workbench/hooks/useProjectRuntimeLocation';
import { buildCodingSessionTerminalLaunchPlan } from './codingSessionTerminal';

interface CodePageTerminalProjectLike {
  id: string;
  name: string;
}

interface CodePageTerminalSessionLocation {
  codingSession?: Pick<BirdCoderCodingSession, 'id' | 'engineId' | 'title' | 'nativeSessionId'> | null;
  project?: CodePageTerminalProjectLike | null;
}

interface UseCodePageTerminalActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  currentProjectId: string;
  resolveProjectActionTarget: (
    project?: CodePageTerminalProjectLike | null,
  ) => CodePageTerminalProjectLike | null;
  resolveProjectRuntimeLocation: ProjectRuntimeLocationResolver;
  resolveCodingSessionNativeSessionId: (
    codingSessionId: string,
    projectId?: string | null,
  ) => Promise<string | null> | string | null;
  resolveProjectById: (projectId: string) => CodePageTerminalProjectLike | null;
  resolveSession: (
    codingSessionId: string,
    projectId?: string | null,
  ) => CodePageTerminalSessionLocation | null;
  setIsTerminalOpen: (isOpen: boolean) => void;
  setTerminalRequest: (request: TerminalCommandRequest) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

function normalizeCodingSessionNativeSessionId(
  nativeSessionId: string | null | undefined,
  engineId: string | null | undefined,
): string | null {
  return normalizeBirdCoderCodeEngineNativeSessionId(nativeSessionId, engineId);
}

export function useCodePageTerminalActions({
  addToast,
  currentProjectId,
  resolveCodingSessionNativeSessionId,
  resolveProjectRuntimeLocation,
  resolveProjectActionTarget,
  resolveProjectById,
  resolveSession,
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

    const localWorkingDirectory = await resolveTerminalWorkingDirectory(target.id);
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

  const handleOpenCodingSessionInTerminal = useCallback(async (
    codingSessionId: string,
    projectId: string,
    nativeSessionIdFromList?: string | null,
  ) => {
    const resolvedSessionLocation = resolveSession(codingSessionId, projectId);
    const codingSession = resolvedSessionLocation?.codingSession;
    const target = resolveProjectActionTarget(resolvedSessionLocation?.project);
    if (!codingSession || !target) {
      return;
    }

    const localWorkingDirectory = await resolveTerminalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      return;
    }

    const nativeSessionId = normalizeCodingSessionNativeSessionId(
      nativeSessionIdFromList?.trim() ||
      (await resolveCodingSessionNativeSessionId(codingSessionId, projectId))?.trim() ||
      null,
      codingSession.engineId,
    );
    if (!nativeSessionId) {
      addToast(t('code.sessionNativeIdUnavailable'), 'error');
      return;
    }

    const launchPlan = buildCodingSessionTerminalLaunchPlan({
      codingSession: { ...codingSession, nativeSessionId },
      localWorkingDirectory,
    });
    emitOpenTerminalRequest(launchPlan.request);
    addToast(
      t('code.openedSessionInEngineTerminal', {
        engine: launchPlan.terminalProfileTitle,
        name: codingSession.title,
      }),
      'info',
    );
  }, [
    addToast,
    resolveCodingSessionNativeSessionId,
    resolveProjectActionTarget,
    resolveSession,
    resolveTerminalWorkingDirectory,
    t,
  ]);

  const handleCopySessionId = useCallback(async (
    codingSessionId: string,
    projectId: string,
    nativeSessionIdFromList?: string | null,
  ) => {
    const resolvedSessionLocation = resolveSession(codingSessionId, projectId);
    const nativeSessionId = normalizeCodingSessionNativeSessionId(
      nativeSessionIdFromList?.trim() ||
      (await resolveCodingSessionNativeSessionId(codingSessionId, projectId))?.trim() ||
      null,
      resolvedSessionLocation?.codingSession?.engineId,
    );
    if (!nativeSessionId) {
      addToast(t('code.sessionNativeIdUnavailable'), 'error');
      return;
    }

    const didCopy = await copyTextToClipboard(nativeSessionId);
    addToast(
      didCopy
        ? t('code.copiedSessionId', { id: nativeSessionId })
        : 'Unable to copy session id',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveCodingSessionNativeSessionId, resolveSession, t]);

  const handleCopySessionResumeCommand = useCallback(async (
    codingSessionId: string,
    projectId: string,
    nativeSessionIdFromList?: string | null,
  ) => {
    const resolvedSessionLocation = resolveSession(codingSessionId, projectId);
    const codingSession = resolvedSessionLocation?.codingSession;
    const nativeSessionId = normalizeCodingSessionNativeSessionId(
      nativeSessionIdFromList?.trim() ||
      (await resolveCodingSessionNativeSessionId(codingSessionId, projectId))?.trim() ||
      null,
      codingSession?.engineId,
    );
    if (!codingSession || !nativeSessionId) {
      addToast(t('code.sessionNativeIdUnavailable'), 'error');
      return;
    }

    const command = buildWorkbenchCodeEngineCliResumeCommand({
      engineId: codingSession.engineId,
      nativeSessionId,
    });
    const didCopy = await copyTextToClipboard(command);
    addToast(
      didCopy
        ? t('code.copiedSessionResumeCommand', { command })
        : 'Unable to copy session resume command',
      didCopy ? 'success' : 'error',
    );
  }, [
    addToast,
    resolveCodingSessionNativeSessionId,
    resolveSession,
    t,
  ]);

  return {
    handleCopySessionResumeCommand,
    handleCopySessionId,
    handleOpenCodingSessionInTerminal,
    handleOpenInTerminal,
    handleTopBarTerminalVisibilityChange,
  };
}

