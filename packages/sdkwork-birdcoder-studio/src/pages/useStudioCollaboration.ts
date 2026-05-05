import { useCallback, useEffect, useState } from 'react';

import type { BirdCoderProjectCollaboratorSummary } from '@sdkwork/birdcoder-types';
import { copyTextToClipboard } from '@sdkwork/birdcoder-ui';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;

type CollaborationServiceLike = {
  listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]>;
  upsertProjectCollaborator(
    projectId: string,
    request: {
      email: string;
      role: 'member';
      status: 'invited';
    },
  ): Promise<unknown>;
};

interface UseStudioCollaborationMessages {
  failedToInvite: string;
  failedToLoad: string;
  invitationSent: string;
  linkCopied: string;
  noProjectSelected: string;
}

interface UseStudioCollaborationOptions {
  addToast: ToastFn;
  collaborationService: CollaborationServiceLike;
  currentProjectId: string;
  messages: UseStudioCollaborationMessages;
}

export function useStudioCollaboration({
  addToast,
  collaborationService,
  currentProjectId,
  messages,
}: UseStudioCollaborationOptions) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareAccess, setShareAccess] = useState<'private' | 'public'>('private');
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectCollaborators, setProjectCollaborators] = useState<
    BirdCoderProjectCollaboratorSummary[]
  >([]);
  const [isCollaboratorsLoading, setIsCollaboratorsLoading] = useState(false);
  const [isInvitePending, setIsInvitePending] = useState(false);

  const publicShareUrl = `https://ide.sdkwork.com/p/${currentProjectId || 'demo'}`;

  const loadProjectCollaborators = useCallback(async () => {
    const normalizedProjectId = currentProjectId.trim();
    if (!normalizedProjectId) {
      setProjectCollaborators([]);
      return;
    }

    setIsCollaboratorsLoading(true);
    try {
      const collaborators = await collaborationService.listProjectCollaborators(normalizedProjectId);
      setProjectCollaborators(collaborators);
    } catch (error) {
      console.error('Failed to load project collaborators', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : messages.failedToLoad,
        'error',
      );
    } finally {
      setIsCollaboratorsLoading(false);
    }
  }, [addToast, collaborationService, currentProjectId, messages.failedToLoad]);

  useEffect(() => {
    if (!showShareModal || shareAccess !== 'private') {
      return;
    }

    void loadProjectCollaborators();
  }, [loadProjectCollaborators, shareAccess, showShareModal]);

  useEffect(() => {
    if (!showShareModal) {
      setInviteEmail('');
    }
  }, [showShareModal]);

  const handleCopyPublicLink = useCallback(() => {
    void copyTextToClipboard(publicShareUrl).then((didCopy) => {
      addToast(
        didCopy ? messages.linkCopied : 'Unable to copy public link',
        didCopy ? 'success' : 'error',
      );
    });
  }, [addToast, messages.linkCopied, publicShareUrl]);

  const handleInviteCollaborator = useCallback(async () => {
    const normalizedProjectId = currentProjectId.trim();
    const email = inviteEmail.trim();
    if (!normalizedProjectId) {
      addToast(messages.noProjectSelected, 'error');
      return;
    }
    if (!email || isInvitePending) {
      return;
    }

    setIsInvitePending(true);
    try {
      await collaborationService.upsertProjectCollaborator(normalizedProjectId, {
        email,
        role: 'member',
        status: 'invited',
      });
      setInviteEmail('');
      addToast(messages.invitationSent, 'success');
      await loadProjectCollaborators();
    } catch (error) {
      console.error('Failed to invite collaborator', error);
      addToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : messages.failedToInvite,
        'error',
      );
    } finally {
      setIsInvitePending(false);
    }
  }, [
    addToast,
    collaborationService,
    currentProjectId,
    inviteEmail,
    isInvitePending,
    loadProjectCollaborators,
    messages.failedToInvite,
    messages.invitationSent,
    messages.noProjectSelected,
  ]);

  return {
    handleCopyPublicLink,
    handleInviteCollaborator,
    inviteEmail,
    isCollaboratorsLoading,
    isInvitePending,
    projectCollaborators,
    publicShareUrl,
    setInviteEmail,
    setShareAccess,
    setShowShareModal,
    shareAccess,
    showShareModal,
  } as const;
}
