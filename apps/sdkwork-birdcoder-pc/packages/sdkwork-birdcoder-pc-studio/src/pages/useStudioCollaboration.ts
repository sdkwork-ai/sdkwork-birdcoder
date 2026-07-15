import { useCallback, useEffect, useState } from 'react';

import type { BirdCoderProjectCollaboratorSummary } from '@sdkwork/birdcoder-pc-types';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;

type CollaborationServiceLike = {
  listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]>;
  upsertProjectCollaborator(
    projectId: string,
    request: {
      userId: string;
      role: 'member';
      status: 'invited';
    },
  ): Promise<unknown>;
};

interface UseStudioCollaborationMessages {
  failedToInvite: string;
  failedToLoad: string;
  invitationSent: string;
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
  const [inviteUserId, setInviteUserId] = useState('');
  const [projectCollaborators, setProjectCollaborators] = useState<
    BirdCoderProjectCollaboratorSummary[]
  >([]);
  const [isCollaboratorsLoading, setIsCollaboratorsLoading] = useState(false);
  const [isInvitePending, setIsInvitePending] = useState(false);

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
    if (!showShareModal) {
      return;
    }

    void loadProjectCollaborators();
  }, [loadProjectCollaborators, showShareModal]);

  useEffect(() => {
    if (!showShareModal) {
      setInviteUserId('');
    }
  }, [showShareModal]);

  const handleInviteCollaborator = useCallback(async () => {
    const normalizedProjectId = currentProjectId.trim();
    const userId = inviteUserId.trim();
    if (!normalizedProjectId) {
      addToast(messages.noProjectSelected, 'error');
      return;
    }
    if (!userId || isInvitePending) {
      return;
    }

    setIsInvitePending(true);
    try {
      await collaborationService.upsertProjectCollaborator(normalizedProjectId, {
        userId,
        role: 'member',
        status: 'invited',
      });
      setInviteUserId('');
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
    inviteUserId,
    isInvitePending,
    loadProjectCollaborators,
    messages.failedToInvite,
    messages.invitationSent,
    messages.noProjectSelected,
  ]);

  return {
    handleInviteCollaborator,
    inviteUserId,
    isCollaboratorsLoading,
    isInvitePending,
    projectCollaborators,
    setInviteUserId,
    setShowShareModal,
    showShareModal,
  } as const;
}

