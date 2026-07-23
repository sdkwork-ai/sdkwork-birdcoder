import { useCallback, useState } from 'react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { deleteWorkbenchAgentSessionItems } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionCreation';
import type { CodeDeleteConfirmation } from './CodePageDialogs';

type ToastTone = 'error' | 'success';

interface AgentSessionLocation {
  project: AgentProjectView;
}

interface UseCodeDeleteConfirmationOptions {
  addToast: (message: string, tone: ToastTone) => void;
  currentProjectId: string;
  deleteAgentSession: (projectId: string, agentSessionId: string) => Promise<void>;
  deleteAgentSessionItem: (
    projectId: string,
    agentSessionId: string,
    messageId: string,
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  onProjectChange?: (projectId: string) => void;
  projectDeletedMessage: string;
  resolveProjectById: (projectId: string) => AgentProjectView | null;
  resolveSession: (
    agentSessionId: string,
    projectId?: string | null,
  ) => AgentSessionLocation | null;
  sessionId: string | null;
  setSelectedSessionId: (agentSessionId: string | null) => void;
  setSelectedSessionProjectId: (projectId: string | null) => void;
  sessionDeletedMessage: string;
}

export function useCodeDeleteConfirmation({
  addToast,
  currentProjectId,
  deleteAgentSession,
  deleteAgentSessionItem,
  deleteProject,
  onProjectChange,
  projectDeletedMessage,
  resolveProjectById,
  resolveSession,
  sessionId,
  setSelectedSessionId,
  setSelectedSessionProjectId,
  sessionDeletedMessage,
}: UseCodeDeleteConfirmationOptions) {
  const [deleteConfirmation, setDeleteConfirmation] = useState<CodeDeleteConfirmation | null>(null);

  const requestDeleteSession = useCallback((agentSessionId: string, projectId: string) => {
    setDeleteConfirmation({ type: 'session', id: agentSessionId, projectId });
  }, []);

  const requestDeleteProject = useCallback((projectId: string) => {
    setDeleteConfirmation({ type: 'project', id: projectId });
  }, []);

  const requestDeleteMessage = useCallback((
    agentSessionId: string,
    projectId: string,
    sessionItemIds: string[],
  ) => {
    const normalizedMessageIds = sessionItemIds
      .map((messageId) => messageId.trim())
      .filter((messageId) => messageId.length > 0);
    if (normalizedMessageIds.length === 0) {
      return;
    }

    setDeleteConfirmation({
      type: 'message',
      id: normalizedMessageIds[normalizedMessageIds.length - 1]!,
      ids: normalizedMessageIds,
      parentId: agentSessionId,
      projectId,
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
      const project = resolveSession(confirmation.id, confirmation.projectId)?.project;
      if (project) {
        await deleteAgentSession(project.projectId, confirmation.id);
        if (sessionId === confirmation.id && currentProjectId === project.projectId) {
          setSelectedSessionId(null);
          setSelectedSessionProjectId(project.projectId);
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
        currentProjectId === confirmation.id &&
        project &&
        project.agentSessions.some((agentSession) => agentSession.id === sessionId)
      ) {
        setSelectedSessionId(null);
        setSelectedSessionProjectId(null);
      }
      if (currentProjectId === confirmation.id) {
        onProjectChange?.('');
      }
      addToast(projectDeletedMessage, 'success');
      setDeleteConfirmation(null);
      return;
    }

    if (confirmation.parentId) {
      const project = resolveSession(confirmation.parentId, confirmation.projectId)?.project;
      if (project) {
        try {
          const deletedMessageCount = await deleteWorkbenchAgentSessionItems({
            agentSessionId: confirmation.parentId,
            deleteAgentSessionItem,
            sessionItemIds: confirmation.ids?.length
            ? confirmation.ids
            : [confirmation.id],
            projectId: project.projectId,
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
    deleteAgentSession,
    deleteAgentSessionItem,
    deleteConfirmation,
    deleteProject,
    onProjectChange,
    projectDeletedMessage,
    resolveProjectById,
    resolveSession,
    sessionId,
    setSelectedSessionId,
    setSelectedSessionProjectId,
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
