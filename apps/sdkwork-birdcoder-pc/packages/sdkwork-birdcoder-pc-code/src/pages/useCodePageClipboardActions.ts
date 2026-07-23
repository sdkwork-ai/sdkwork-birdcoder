import { useCallback } from 'react';
import type { ToastType } from '@sdkwork/birdcoder-pc-workbench/contexts/ToastProvider';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui/components/clipboard';

interface CodePageClipboardProjectLike {
  id: string;
  name: string;
  workspaceId?: string;
}

interface CodePageClipboardSessionLocation {
  project?: CodePageClipboardProjectLike | null;
}

interface UseCodePageClipboardActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  resolveProjectActionTarget: (
    project?: CodePageClipboardProjectLike | null,
  ) => CodePageClipboardProjectLike | null;
  resolveLocalWorkingDirectory: (projectId: string) => Promise<string | null>;
  resolveProjectById: (projectId: string) => CodePageClipboardProjectLike | null;
  resolveSession: (
    agentSessionId: string,
    projectId?: string | null,
  ) => CodePageClipboardSessionLocation | null;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useCodePageClipboardActions({
  addToast,
  resolveProjectActionTarget,
  resolveLocalWorkingDirectory,
  resolveProjectById,
  resolveSession,
  t,
}: UseCodePageClipboardActionsOptions) {
  const handleCopyWorkingDirectory = useCallback(async (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const localWorkingDirectory = await resolveLocalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      addToast('A local desktop folder must be mounted before copying its directory.', 'error');
      return;
    }

    const didCopy = await copyTextToClipboard(localWorkingDirectory);
    addToast(
      didCopy ? 'Copied workspace directory' : 'Unable to copy workspace directory',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveLocalWorkingDirectory, resolveProjectActionTarget, resolveProjectById]);

  const handleCopyProjectPath = useCallback(async (projectId: string) => {
    const target = resolveProjectActionTarget(resolveProjectById(projectId));
    if (!target) {
      return;
    }

    const localWorkingDirectory = await resolveLocalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      addToast('A local desktop folder must be mounted before copying its path.', 'error');
      return;
    }

    const didCopy = await copyTextToClipboard(localWorkingDirectory);
    addToast(
      didCopy ? 'Copied local path' : 'Unable to copy local path',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveLocalWorkingDirectory, resolveProjectActionTarget, resolveProjectById]);

  const handleCopySessionWorkingDirectory = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const target = resolveProjectActionTarget(
      resolveSession(agentSessionId, projectId)?.project,
    );
    if (!target) {
      return;
    }

    const localWorkingDirectory = await resolveLocalWorkingDirectory(target.id);
    if (!localWorkingDirectory) {
      addToast('A local desktop folder must be mounted before copying its directory.', 'error');
      return;
    }

    const didCopy = await copyTextToClipboard(localWorkingDirectory);
    addToast(
      didCopy ? 'Copied session workspace directory' : 'Unable to copy session workspace directory',
      didCopy ? 'success' : 'error',
    );
  }, [addToast, resolveLocalWorkingDirectory, resolveProjectActionTarget, resolveSession]);

  const handleCopySessionDeeplink = useCallback(async (
    agentSessionId: string,
    projectId: string,
  ) => {
    const sessionLocation = resolveSession(agentSessionId, projectId);
    const linkUrl = new URL(window.location.href);
    linkUrl.searchParams.delete('sessionId');
    linkUrl.searchParams.delete('workspaceId');
    linkUrl.searchParams.set('tab', 'code');
    linkUrl.searchParams.set('projectId', projectId);
    linkUrl.searchParams.set('agentSessionId', agentSessionId);
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

