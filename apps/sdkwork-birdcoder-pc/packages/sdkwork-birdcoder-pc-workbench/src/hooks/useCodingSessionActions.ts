import { useEffect, useRef } from 'react';
import { globalEventBus } from '../utils/EventBus.ts';
import {
  createWorkbenchCodingSessionInProject,
  type CreateNewCodingSessionRequest,
  type CreateWorkbenchCodingSessionWithSelection,
  type SelectWorkbenchCodingSession,
} from '../workbench/codingSessionCreation.ts';

type CreateCodingSessionFromRequestAction = (
  request: CreateNewCodingSessionRequest,
) => Promise<unknown> | unknown;

export function useCodingSessionActions(
  currentProjectId: string,
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection,
  selectCodingSession: SelectWorkbenchCodingSession,
  options?: {
    isActive?: boolean;
    createCodingSessionFromRequest?: CreateCodingSessionFromRequestAction;
  },
) {
  const isActive = options?.isActive ?? true;
  const createCodingSessionFromRequest = options?.createCodingSessionFromRequest;
  const currentProjectIdRef = useRef(currentProjectId);
  const createCodingSessionWithSelectionRef = useRef(createCodingSessionWithSelection);
  const selectCodingSessionRef = useRef(selectCodingSession);
  const createCodingSessionFromRequestRef = useRef(createCodingSessionFromRequest);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
    createCodingSessionWithSelectionRef.current = createCodingSessionWithSelection;
    selectCodingSessionRef.current = selectCodingSession;
    createCodingSessionFromRequestRef.current = createCodingSessionFromRequest;
  }, [
    createCodingSessionFromRequest,
    createCodingSessionWithSelection,
    currentProjectId,
    selectCodingSession,
  ]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleCreateNewCodingSession = async (request?: CreateNewCodingSessionRequest) => {
      const targetProjectId = request?.projectId?.trim() || currentProjectIdRef.current.trim();

      try {
        if (createCodingSessionFromRequestRef.current) {
          await createCodingSessionFromRequestRef.current({
            ...request,
            ...(targetProjectId ? { projectId: targetProjectId } : {}),
            source: request?.source ?? 'global-event',
          });
          return;
        }
        if (!targetProjectId) {
          return;
        }

        await createWorkbenchCodingSessionInProject({
          createCodingSessionWithSelection: createCodingSessionWithSelectionRef.current,
          projectId: targetProjectId,
          requestedEngineId: request?.engineId,
          requestedModelId: request?.modelId,
          selectCodingSession: selectCodingSessionRef.current,
          title: request?.title,
        });
      } catch (error) {
        console.error('Failed to create session', error);
      }
    };

    const unsubscribe = globalEventBus.on('createNewCodingSession', handleCreateNewCodingSession);
    return () => {
      unsubscribe();
    };
  }, [isActive]);
}
