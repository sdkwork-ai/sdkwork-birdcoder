import { useCallback } from 'react';

import type { ToastType } from '../contexts/ToastProvider.ts';
import {
  createWorkbenchCodingSessionInProject,
  type CreateNewCodingSessionRequest,
  type CreateWorkbenchCodingSessionWithSelection,
  type SelectWorkbenchCodingSession,
  type ShouldSelectWorkbenchCodingSession,
} from '../workbench/codingSessionCreation.ts';

interface UseWorkbenchCodingSessionCreationActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection;
  currentProjectId: string;
  selectCodingSession: SelectWorkbenchCodingSession;
  labels: {
    creationFailed: string;
    creationSucceeded: string;
    noProjectSelected: string;
  };
}

export function useWorkbenchCodingSessionCreationActions({
  addToast,
  createCodingSessionWithSelection,
  currentProjectId,
  selectCodingSession,
  labels,
}: UseWorkbenchCodingSessionCreationActionsOptions) {
  const createCodingSessionInProject = useCallback(
    async (
      projectId: string,
      requestedEngineId?: string,
      options?: {
        modelId?: string;
        shouldSelectCreatedSession?: ShouldSelectWorkbenchCodingSession;
      },
    ) => {
      const normalizedProjectId = projectId.trim();
      if (!normalizedProjectId) {
        addToast(labels.noProjectSelected, 'error');
        return null;
      }

      try {
        const newSession = await createWorkbenchCodingSessionInProject({
          createCodingSessionWithSelection,
          projectId: normalizedProjectId,
          requestedEngineId,
          requestedModelId: options?.modelId,
          selectCodingSession,
          shouldSelectCreatedSession: options?.shouldSelectCreatedSession,
        });
        addToast(labels.creationSucceeded, 'success');
        return newSession;
      } catch (error) {
        console.error('Failed to create session', error);
        addToast(labels.creationFailed, 'error');
        return null;
      }
    },
    [
      addToast,
      createCodingSessionWithSelection,
      labels.creationFailed,
      labels.creationSucceeded,
      labels.noProjectSelected,
      selectCodingSession,
    ],
  );

  const createCodingSessionFromRequest = useCallback(
    (request?: CreateNewCodingSessionRequest) => {
      const targetProjectId = request?.projectId?.trim() || currentProjectId.trim();
      if (!targetProjectId) {
        addToast(labels.noProjectSelected, 'error');
        return;
      }

      void createCodingSessionInProject(targetProjectId, request?.engineId, {
        modelId: request?.modelId,
      });
    },
    [
      addToast,
      createCodingSessionInProject,
      currentProjectId,
      labels.noProjectSelected,
    ],
  );

  const createCodingSessionFromCurrentProject = useCallback(
    (requestedEngineId?: string, requestedModelId?: string) => {
      createCodingSessionFromRequest({
        engineId: requestedEngineId,
        modelId: requestedModelId,
      });
    },
    [createCodingSessionFromRequest],
  );

  return {
    createCodingSessionFromCurrentProject,
    createCodingSessionFromRequest,
    createCodingSessionInProject,
  } as const;
}
