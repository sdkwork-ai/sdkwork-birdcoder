import { useEffect, useRef } from 'react';
import { globalEventBus } from '../utils/EventBus.ts';
import {
  createWorkbenchCodingSessionInProject,
  type CreateNewCodingSessionRequest,
  type CreateWorkbenchCodingSessionWithSelection,
  type SelectWorkbenchCodingSession,
} from '../workbench/codingSessionCreation.ts';

export function useCodingSessionActions(
  currentProjectId: string,
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection,
  selectCodingSession: SelectWorkbenchCodingSession,
  options?: {
    isActive?: boolean;
  },
) {
  const isActive = options?.isActive ?? true;
  const currentProjectIdRef = useRef(currentProjectId);
  const createCodingSessionWithSelectionRef = useRef(createCodingSessionWithSelection);
  const selectCodingSessionRef = useRef(selectCodingSession);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
    createCodingSessionWithSelectionRef.current = createCodingSessionWithSelection;
    selectCodingSessionRef.current = selectCodingSession;
  }, [createCodingSessionWithSelection, currentProjectId, selectCodingSession]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleCreateNewCodingSession = async (request?: CreateNewCodingSessionRequest) => {
      const targetProjectId = request?.projectId?.trim() || currentProjectIdRef.current.trim();
      if (!targetProjectId) {
        return;
      }

      try {
        await createWorkbenchCodingSessionInProject({
          createCodingSessionWithSelection: createCodingSessionWithSelectionRef.current,
          projectId: targetProjectId,
          requestedEngineId: request?.engineId,
          selectCodingSession: selectCodingSessionRef.current,
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
