import { useCallback, useRef } from 'react';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-pc-contracts-commons';
import { ProjectRuntimeLocationExecutionUnavailableError } from '@sdkwork/birdcoder-pc-infrastructure-runtime/projectRuntimeLocation';

import type { ToastType } from '../contexts/ToastProvider.ts';
import {
  buildCreateNewCodingSessionInFlightKey,
  focusWorkbenchChatInputSoon,
  normalizeCreateNewCodingSessionRequest,
  type CreateCodingSessionActionOptions,
  type CreateNewCodingSessionRequest,
  type CreateWorkbenchCodingSessionWithSelection,
  type SelectWorkbenchCodingSession,
  type ShouldSelectWorkbenchCodingSession,
  type WorkbenchCodingSessionSelectionContext,
} from '../workbench/codingSessionCreation.ts';

interface InFlightCodingSessionCreation {
  failureLogged: boolean;
  failureNotified: boolean;
  promise: Promise<BirdCoderCodingSession>;
  selected: boolean;
  successNotified: boolean;
}

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
  const inFlightCreationsRef = useRef(
    new Map<string, InFlightCodingSessionCreation>(),
  );
  const createCodingSessionFromRequest = useCallback(
    async (
      request?: CreateNewCodingSessionRequest,
      actionOptions?: CreateCodingSessionActionOptions,
    ): Promise<BirdCoderCodingSession | null> => {
      const normalizedRequest = normalizeCreateNewCodingSessionRequest(
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
      const inFlightKey = buildCreateNewCodingSessionInFlightKey(normalizedRequest);
      let creation = inFlightCreationsRef.current.get(inFlightKey);
      if (!creation) {
        const promise = createCodingSessionWithSelection(
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

      let newSession: BirdCoderCodingSession;
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

      const selectionContext: WorkbenchCodingSessionSelectionContext = {
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
            selectCodingSession(newSession.id, { projectId: normalizedRequest.projectId });
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
      createCodingSessionWithSelection,
      labels.creationFailed,
      labels.creationSucceeded,
      labels.noProjectSelected,
      selectCodingSession,
      currentProjectId,
    ],
  );

  const createCodingSessionInProject = useCallback(
    (
      projectId: string,
      requestedEngineId?: string,
      options?: {
        modelId?: string;
        shouldSelectCreatedSession?: ShouldSelectWorkbenchCodingSession;
        source?: CreateNewCodingSessionRequest['source'];
        title?: string;
      },
    ) => createCodingSessionFromRequest(
      {
        engineId: requestedEngineId,
        modelId: options?.modelId,
        projectId,
        source: options?.source,
        title: options?.title,
      },
      { shouldSelectCreatedSession: options?.shouldSelectCreatedSession },
    ),
    [createCodingSessionFromRequest],
  );

  const createCodingSessionFromCurrentProject = useCallback(
    (requestedEngineId?: string, requestedModelId?: string) => {
      return createCodingSessionFromRequest({
        engineId: requestedEngineId,
        modelId: requestedModelId,
        source: 'global-event',
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
