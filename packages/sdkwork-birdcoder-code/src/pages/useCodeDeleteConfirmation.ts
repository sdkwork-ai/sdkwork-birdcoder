import { useCallback, useState } from 'react';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';
import { deleteWorkbenchCodingSessionMessages } from '@sdkwork/birdcoder-commons';
import type { CodeDeleteConfirmation } from './CodePageDialogs';

type ToastTone = 'error' | 'success';

interface CodingSessionLocation {
  project: BirdCoderProject;
}

interface UseCodeDeleteConfirmationOptions {
  addToast: (message: string, tone: ToastTone) => void;
  currentProjectId: string;
  deleteCodingSession: (projectId: string, codingSessionId: string) => Promise<void>;
  deleteCodingSessionMessage: (
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  onProjectChange?: (projectId: string) => void;
  projectRemovedMessage: string;
  resolveProjectById: (projectId: string) => BirdCoderProject | null;
  resolveSession: (codingSessionId: string) => CodingSessionLocation | null;
  sessionId: string | null;
  setSelectedSessionId: (codingSessionId: string | null) => void;
  sessionDeletedMessage: string;
}

export function useCodeDeleteConfirmation({
  addToast,
  currentProjectId,
  deleteCodingSession,
  deleteCodingSessionMessage,
  deleteProject,
  onProjectChange,
  projectRemovedMessage,
  resolveProjectById,
  resolveSession,
  sessionId,
  setSelectedSessionId,
  sessionDeletedMessage,
}: UseCodeDeleteConfirmationOptions) {
  const [deleteConfirmation, setDeleteConfirmation] = useState<CodeDeleteConfirmation | null>(null);

  const requestDeleteSession = useCallback((codingSessionId: string) => {
    setDeleteConfirmation({ type: 'session', id: codingSessionId });
  }, []);

  const requestDeleteProject = useCallback((projectId: string) => {
    setDeleteConfirmation({ type: 'project', id: projectId });
  }, []);

  const requestDeleteMessage = useCallback((codingSessionId: string, messageIds: string[]) => {
    const normalizedMessageIds = messageIds
      .map((messageId) => messageId.trim())
      .filter((messageId) => messageId.length > 0);
    if (normalizedMessageIds.length === 0) {
      return;
    }

    setDeleteConfirmation({
      type: 'message',
      id: normalizedMessageIds[normalizedMessageIds.length - 1]!,
      ids: normalizedMessageIds,
      parentId: codingSessionId,
    });
  }, []);

  const cancelDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation(null);
  }, []);

  const confirmDeleteConfirmation = useCallback(async () => {
    const confirmation = deleteConfirmation;
    if (!confirmation) {
      return;
    }

    if (confirmation.type === 'session') {
      const project = resolveSession(confirmation.id)?.project;
      if (project) {
        await deleteCodingSession(project.id, confirmation.id);
        if (sessionId === confirmation.id) {
          setSelectedSessionId(null);
        }
        addToast(sessionDeletedMessage, 'success');
      }
      setDeleteConfirmation(null);
      return;
    }

    if (confirmation.type === 'project') {
      await deleteProject(confirmation.id);
      const project = resolveProjectById(confirmation.id);
      if (
        project &&
        project.codingSessions.some((codingSession) => codingSession.id === sessionId)
      ) {
        setSelectedSessionId(null);
      }
      if (currentProjectId === confirmation.id) {
        onProjectChange?.('');
      }
      addToast(projectRemovedMessage, 'success');
      setDeleteConfirmation(null);
      return;
    }

    if (confirmation.parentId) {
      const project = resolveSession(confirmation.parentId)?.project;
      if (project) {
        try {
          const deletedMessageCount = await deleteWorkbenchCodingSessionMessages({
            codingSessionId: confirmation.parentId,
            deleteCodingSessionMessage,
            messageIds: confirmation.ids?.length
            ? confirmation.ids
            : [confirmation.id],
            projectId: project.id,
          });
          addToast(
            deletedMessageCount > 1 ? 'Reply deleted successfully' : 'Message deleted successfully',
            'success',
          );
        } catch (error) {
          console.error('Failed to delete coding session message', error);
          addToast('Failed to delete reply', 'error');
        }
      }
    }

    setDeleteConfirmation(null);
  }, [
    addToast,
    currentProjectId,
    deleteCodingSession,
    deleteCodingSessionMessage,
    deleteConfirmation,
    deleteProject,
    onProjectChange,
    projectRemovedMessage,
    resolveProjectById,
    resolveSession,
    sessionId,
    setSelectedSessionId,
    sessionDeletedMessage,
  ]);

  return {
    cancelDeleteConfirmation,
    confirmDeleteConfirmation,
    deleteConfirmation,
    requestDeleteMessage,
    requestDeleteProject,
    requestDeleteSession,
  };
}
