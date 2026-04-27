import { useEffect, useRef } from 'react';
import { globalEventBus } from '../utils/EventBus.ts';
import {
  createWorkbenchCodingSessionInProject,
  type CreateNewCodingSessionRequest,
  type CreateWorkbenchCodingSessionWithSelection,
  type SelectWorkbenchCodingSession,
} from '../workbench/codingSessionCreation.ts';

type CreateCodingSessionInProjectAction = (
  projectId: string,
  requestedEngineId?: string,
) => Promise<unknown> | unknown;

export function useCodingSessionActions(
  currentProjectId: string,
  createCodingSessionWithSelection: CreateWorkbenchCodingSessionWithSelection,
  selectCodingSession: SelectWorkbenchCodingSession,
  options?: {
    isActive?: boolean;
    createCodingSessionInProject?: CreateCodingSessionInProjectAction;
  },
) {
  const isActive = options?.isActive ?? true;
  const createCodingSessionInProject = options?.createCodingSessionInProject;
  const currentProjectIdRef = useRef(currentProjectId);
  const createCodingSessionWithSelectionRef = useRef(createCodingSessionWithSelection);
  const selectCodingSessionRef = useRef(selectCodingSession);
  const createCodingSessionInProjectRef = useRef(createCodingSessionInProject);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
    createCodingSessionWithSelectionRef.current = createCodingSessionWithSelection;
    selectCodingSessionRef.current = selectCodingSession;
    createCodingSessionInProjectRef.current = createCodingSessionInProject;
  }, [
    createCodingSessionInProject,
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
      if (!targetProjectId) {
        return;
      }

      try {
        if (createCodingSessionInProjectRef.current) {
          await createCodingSessionInProjectRef.current(targetProjectId, request?.engineId);
          return;
        }

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
