import { useCallback, useRef } from 'react';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { ProjectRuntimeLocationExecutionUnavailableError } from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';

import type { ToastType } from '../contexts/ToastProvider.ts';
import {
  buildCreateNewAgentSessionInFlightKey,
  focusWorkbenchChatInputSoon,
  normalizeCreateNewAgentSessionRequest,
  type CreateAgentSessionActionOptions,
  type CreateNewAgentSessionRequest,
  type CreateWorkbenchAgentSessionWithSelection,
  type SelectWorkbenchAgentSession,
  type ShouldSelectWorkbenchAgentSession,
  type WorkbenchAgentSessionSelectionContext,
} from '../workbench/agentSessionCreation.ts';

interface InFlightAgentSessionCreation {
  failureLogged: boolean;
  failureNotified: boolean;
  promise: Promise<AgentSessionView>;
  selected: boolean;
  successNotified: boolean;
}

interface UseWorkbenchAgentSessionCreationActionsOptions {
  addToast: (message: string, type?: ToastType) => void;
  createAgentSessionWithSelection: CreateWorkbenchAgentSessionWithSelection;
  currentProjectId: string;
  selectAgentSession: SelectWorkbenchAgentSession;
  labels: {
    creationFailed: string;
    creationSucceeded: string;
    noProjectSelected: string;
  };
}

export function useWorkbenchAgentSessionCreationActions({
  addToast,
  createAgentSessionWithSelection,
  currentProjectId,
  selectAgentSession,
  labels,
}: UseWorkbenchAgentSessionCreationActionsOptions) {
  const inFlightCreationsRef = useRef(
    new Map<string, InFlightAgentSessionCreation>(),
  );
  const createAgentSessionFromRequest = useCallback(
    async (
      request?: CreateNewAgentSessionRequest,
      actionOptions?: CreateAgentSessionActionOptions,
    ): Promise<AgentSessionView | null> => {
      const normalizedRequest = normalizeCreateNewAgentSessionRequest(
        request,
        currentProjectId,
      );
      if (!normalizedRequest) {
        if (actionOptions?.showFailureToast !== false) {
          addToast(labels.noProjectSelected, 'error');
        }
        if (actionOptions?.rethrowError) {
          throw new Error(labels.noProjectSelected);
        }
        return null;
      }
      const inFlightKey = buildCreateNewAgentSessionInFlightKey(normalizedRequest);
      let creation = inFlightCreationsRef.current.get(inFlightKey);
      if (!creation) {
        const promise = createAgentSessionWithSelection(
          normalizedRequest.projectId,
          normalizedRequest.title,
          normalizedRequest.engineId || normalizedRequest.modelId
            ? {
                engineId: normalizedRequest.engineId,
                modelId: normalizedRequest.modelId,
              }
            : undefined,
        );
        creation = {
          failureLogged: false,
          failureNotified: false,
          promise,
          selected: false,
          successNotified: false,
        };
        inFlightCreationsRef.current.set(inFlightKey, creation);
        void promise.finally(() => {
          if (inFlightCreationsRef.current.get(inFlightKey) === creation) {
            inFlightCreationsRef.current.delete(inFlightKey);
          }
        }).catch(() => undefined);
      }

      let newSession: AgentSessionView;
      try {
        newSession = await creation.promise;
      } catch (error) {
        const cancelled =
          error instanceof ProjectRuntimeLocationExecutionUnavailableError
          && error.code === 'cancelled';
        if (!cancelled && !creation.failureLogged) {
          creation.failureLogged = true;
          console.error('Failed to create session', error);
        }
        if (
          !cancelled
          && !creation.failureNotified
          && actionOptions?.showFailureToast !== false
        ) {
          try {
            addToast(
              error instanceof ProjectRuntimeLocationExecutionUnavailableError
                ? error.message
                : labels.creationFailed,
              'error',
            );
            creation.failureNotified = true;
          } catch (notificationError) {
            console.error('Failed to report coding session creation failure', notificationError);
          }
        }
        if (actionOptions?.rethrowError) {
          throw error;
        }
        return null;
      }

      const selectionContext: WorkbenchAgentSessionSelectionContext = {
        projectId: normalizedRequest.projectId,
        ...(normalizedRequest.engineId
          ? { requestedEngineId: normalizedRequest.engineId }
          : {}),
        ...(normalizedRequest.modelId
          ? { requestedModelId: normalizedRequest.modelId }
          : {}),
        ...(normalizedRequest.title ? { title: normalizedRequest.title } : {}),
      };
      if (!creation.selected) {
        let shouldSelectCreatedSession = false;
        try {
          shouldSelectCreatedSession =
            actionOptions?.shouldSelectCreatedSession?.(newSession, selectionContext) !== false;
        } catch (selectionGuardError) {
          console.error('Failed to evaluate coding session selection', selectionGuardError);
        }
        if (shouldSelectCreatedSession) {
          try {
            selectAgentSession(newSession.id, { projectId: normalizedRequest.projectId });
            creation.selected = true;
            focusWorkbenchChatInputSoon();
          } catch (selectionError) {
            console.error('Failed to select created coding session', selectionError);
          }
        }
      }
      if (!creation.successNotified && actionOptions?.showSuccessToast !== false) {
        try {
          addToast(labels.creationSucceeded, 'success');
          creation.successNotified = true;
        } catch (notificationError) {
          console.error('Failed to report coding session creation success', notificationError);
        }
      }
      return newSession;
    },
    [
      addToast,
      createAgentSessionWithSelection,
      labels.creationFailed,
      labels.creationSucceeded,
      labels.noProjectSelected,
      selectAgentSession,
      currentProjectId,
    ],
  );

  const createAgentSessionInProject = useCallback(
    (
      projectId: string,
      requestedEngineId?: string,
      options?: {
        modelId?: string;
        shouldSelectCreatedSession?: ShouldSelectWorkbenchAgentSession;
        source?: CreateNewAgentSessionRequest['source'];
        title?: string;
      },
    ) => createAgentSessionFromRequest(
      {
        engineId: requestedEngineId,
        modelId: options?.modelId,
        projectId,
        source: options?.source,
        title: options?.title,
      },
      { shouldSelectCreatedSession: options?.shouldSelectCreatedSession },
    ),
    [createAgentSessionFromRequest],
  );

  const createAgentSessionFromCurrentProject = useCallback(
    (requestedEngineId?: string, requestedModelId?: string) => {
      return createAgentSessionFromRequest({
        engineId: requestedEngineId,
        modelId: requestedModelId,
        source: 'global-event',
      });
    },
    [createAgentSessionFromRequest],
  );

  return {
    createAgentSessionFromCurrentProject,
    createAgentSessionFromRequest,
    createAgentSessionInProject,
  } as const;
}
