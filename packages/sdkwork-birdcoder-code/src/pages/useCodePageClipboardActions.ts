import { useCallback } from 'react';
import type { ToastType } from '@sdkwork/birdcoder-commons';
import { copyTextToClipboard } from '@sdkwork/birdcoder-ui';

interface CodePageClipboardProjectLike {
  name: string;
  path?: string;
  workspaceId?: string;
}

interface CodePageClipboardProjectTarget {
  project: CodePageClipboardProjectLike;
  projectPath: string;
}

interface CodePageClipboardSessionLocation {
  project?: CodePageClipboardProjectLike | null;
}

interface UseCodePageClipboardActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  resolveProjectActionTarget: (
    project?: CodePageClipboardProjectLike | null,
  ) => CodePageClipboardProjectTarget | null;
  resolveProjectById: (projectId: string) => CodePageClipboardProjectLike | null;
  resolveSession: (
    codingSessionId: string,
    projectId?: string | null,
  ) => CodePageClipboardSessionLocation | null;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useCodePageClipboardActions({
  addToast,
  resolveProjectActionTarget,
  resolveProjectById,
  resolveSession,
  t,
}: UseCodePageClipboardActionsOptions) {
  const handleCopyWorkingDirectory = useCallback(async (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const didCopy = await copyTextToClipboard(target.projectPath);
    addToast(
      didCopy
        ? `Copied workspace directory: ${target.projectPath}`
        : 'Unable to copy workspace directory',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveProjectActionTarget, resolveProjectById]);

  const handleCopyProjectPath = useCallback(async (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const didCopy = await copyTextToClipboard(target.projectPath);
    addToast(
      didCopy ? `Copied path: ${target.projectPath}` : 'Unable to copy project path',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveProjectActionTarget, resolveProjectById]);

  const handleCopySessionWorkingDirectory = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const target = resolveProjectActionTarget(
      resolveSession(codingSessionId, projectId)?.project,
    );
    if (!target) {
      return;
    }

    const didCopy = await copyTextToClipboard(target.projectPath);
    addToast(
      didCopy
        ? t('code.copiedSessionWorkspaceDir', { path: target.projectPath })
        : 'Unable to copy session workspace directory',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveProjectActionTarget, resolveSession, t]);

  const handleCopySessionDeeplink = useCallback(async (
    codingSessionId: string,
    projectId: string,
  ) => {
    const sessionLocation = resolveSession(codingSessionId, projectId);
    const linkUrl = new URL(window.location.href);
    linkUrl.searchParams.delete('sessionId');
    linkUrl.searchParams.delete('workspaceId');
    linkUrl.searchParams.set('tab', 'code');
    linkUrl.searchParams.set('projectId', projectId);
    linkUrl.searchParams.set('codingSessionId', codingSessionId);
    const workspaceId = sessionLocation?.project?.workspaceId?.trim();
    if (workspaceId) {
      linkUrl.searchParams.set('workspaceId', workspaceId);
    }
    const link = linkUrl.toString();
    const didCopy = await copyTextToClipboard(link);
    addToast(
      didCopy ? t('code.copiedDeeplink', { link }) : 'Unable to copy session link',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveSession, t]);

  return {
    handleCopyProjectPath,
    handleCopySessionDeeplink,
    handleCopySessionWorkingDirectory,
    handleCopyWorkingDirectory,
  };
}
