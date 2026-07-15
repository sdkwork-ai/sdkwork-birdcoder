import { useCallback } from 'react';
import { emitOpenTerminalRequest } from '@sdkwork/birdcoder-pc-commons/terminal/runtime';
import { getTerminalProfile } from '@sdkwork/birdcoder-pc-commons/terminal/profiles';
import type { ToastType } from '@sdkwork/birdcoder-pc-commons/contexts/ToastProvider';
import type { TerminalCommandRequest } from '@sdkwork/birdcoder-pc-commons/terminal/runtime';
import {
  buildWorkbenchCodeEngineCliResumeCommand,
  normalizeBirdCoderCodeEngineNativeSessionId,
} from '@sdkwork/birdcoder-pc-codeengine';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-types';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';
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
  resolveLocalWorkingDirectory: (projectId: string) => Promise<string | null>;
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
  resolveLocalWorkingDirectory,
  resolveProjectActionTarget,
  resolveProjectById,
  resolveSession,
  setIsTerminalOpen,
  setTerminalRequest,
  t,
}: UseCodePageTerminalActionsOptions) {
  const handleTopBarTerminalVisibilityChange = useCallback(async (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      const localWorkingDirectory = currentProjectId
        ? await resolveLocalWorkingDirectory(currentProjectId)
        : null;
      if (!localWorkingDirectory) {
        addToast('A local desktop folder must be mounted before opening a terminal.', 'error');
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
    addToast,
    currentProjectId,
    resolveLocalWorkingDirectory,
    setIsTerminalOpen,
    setTerminalRequest,
  ]);

  const handleOpenInTerminal = useCallback(async (projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const localWorkingDirectory = await resolveLocalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      addToast('A local desktop folder must be mounted before opening a terminal.', 'error');
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
  }, [addToast, resolveLocalWorkingDirectory, resolveProjectActionTarget, resolveProjectById]);

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

    const localWorkingDirectory = await resolveLocalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      addToast('A local desktop folder must be mounted before opening a terminal.', 'error');
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
    resolveLocalWorkingDirectory,
    resolveProjectActionTarget,
    resolveSession,
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

