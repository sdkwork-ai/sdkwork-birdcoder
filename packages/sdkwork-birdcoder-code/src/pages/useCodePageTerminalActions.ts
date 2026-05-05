import { useCallback } from 'react';
import {
  emitOpenTerminalRequest,
  getTerminalProfile,
  type ToastType,
} from '@sdkwork/birdcoder-commons';
import {
  buildWorkbenchCodeEngineCliResumeCommand,
  normalizeBirdCoderCodeEngineNativeSessionId,
} from '@sdkwork/birdcoder-codeengine';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import { copyTextToClipboard } from '@sdkwork/birdcoder-ui';
import { buildCodingSessionTerminalLaunchPlan } from './codingSessionTerminal';

interface CodePageTerminalProjectLike {
  name: string;
  path?: string;
}

interface CodePageTerminalProjectTarget {
  project: CodePageTerminalProjectLike;
  projectPath: string;
}

interface CodePageTerminalSessionLocation {
  codingSession?: Pick<BirdCoderCodingSession, 'id' | 'engineId' | 'title' | 'nativeSessionId'> | null;
  project?: CodePageTerminalProjectLike | null;
}

interface UseCodePageTerminalActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  resolveProjectActionTarget: (
    project?: CodePageTerminalProjectLike | null,
  ) => CodePageTerminalProjectTarget | null;
  resolveCodingSessionNativeSessionId: (
    codingSessionId: string,
  ) => Promise<string | null> | string | null;
  resolveProjectById: (projectId: string) => CodePageTerminalProjectLike | null;
  resolveSession: (
    codingSessionId: string,
    projectId?: string | null,
  ) => CodePageTerminalSessionLocation | null;
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
  resolveCodingSessionNativeSessionId,
  resolveProjectActionTarget,
  resolveProjectById,
  resolveSession,
  t,
}: UseCodePageTerminalActionsOptions) {
  const handleOpenInTerminal = useCallback((projectId: string, profileId?: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const terminalProfile = profileId ? getTerminalProfile(profileId) : null;
    emitOpenTerminalRequest({
      surface: 'workspace',
      path: target.projectPath,
      profileId: terminalProfile?.id,
      timestamp: Date.now(),
    });
    addToast(
      terminalProfile
        ? `Opened ${terminalProfile.title} terminal: ${target.project.name}`
        : `Opened project in terminal: ${target.project.name}`,
      'info',
    );
  }, [addToast, resolveProjectActionTarget, resolveProjectById]);

  const handleOpenCodingSessionInTerminal = useCallback(async (
    codingSessionId: string,
    nativeSessionIdFromList?: string | null,
  ) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
    const codingSession = resolvedSessionLocation?.codingSession;
    const target = resolveProjectActionTarget(resolvedSessionLocation?.project);
    if (!codingSession || !target) {
      return;
    }

    const nativeSessionId = normalizeCodingSessionNativeSessionId(
      nativeSessionIdFromList?.trim() ||
      (await resolveCodingSessionNativeSessionId(codingSessionId))?.trim() ||
      null,
      codingSession.engineId,
    );
    if (!nativeSessionId) {
      addToast(t('code.sessionNativeIdUnavailable'), 'error');
      return;
    }

    const launchPlan = buildCodingSessionTerminalLaunchPlan({
      codingSession: { ...codingSession, nativeSessionId },
      projectPath: target.projectPath,
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
    t,
  ]);

  const handleCopySessionId = useCallback(async (
    codingSessionId: string,
    nativeSessionIdFromList?: string | null,
  ) => {
    const resolvedSessionLocation = resolveSession(codingSessionId);
    const nativeSessionId = normalizeCodingSessionNativeSessionId(
      nativeSessionIdFromList?.trim() ||
      (await resolveCodingSessionNativeSessionId(codingSessionId))?.trim() ||
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
      (await resolveCodingSessionNativeSessionId(codingSessionId))?.trim() ||
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
  };
}
