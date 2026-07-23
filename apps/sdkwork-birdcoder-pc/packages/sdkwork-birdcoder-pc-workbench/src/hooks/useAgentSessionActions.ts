import { useEffect, useRef } from 'react';
import { globalEventBus } from '../utils/EventBus.ts';
import {
  createWorkbenchAgentSessionInProject,
  type CreateNewAgentSessionRequest,
  type CreateWorkbenchAgentSessionWithSelection,
  type SelectWorkbenchAgentSession,
} from '../workbench/agentSessionCreation.ts';

type CreateAgentSessionFromRequestAction = (
  request: CreateNewAgentSessionRequest,
) => Promise<unknown> | unknown;

export function useAgentSessionActions(
  currentProjectId: string,
  createAgentSessionWithSelection: CreateWorkbenchAgentSessionWithSelection,
  selectAgentSession: SelectWorkbenchAgentSession,
  options?: {
    isActive?: boolean;
    createAgentSessionFromRequest?: CreateAgentSessionFromRequestAction;
  },
) {
  const isActive = options?.isActive ?? true;
  const createAgentSessionFromRequest = options?.createAgentSessionFromRequest;
  const currentProjectIdRef = useRef(currentProjectId);
  const createAgentSessionWithSelectionRef = useRef(createAgentSessionWithSelection);
  const selectAgentSessionRef = useRef(selectAgentSession);
  const createAgentSessionFromRequestRef = useRef(createAgentSessionFromRequest);

  useEffect(() => {
    currentProjectIdRef.current = currentProjectId;
    createAgentSessionWithSelectionRef.current = createAgentSessionWithSelection;
    selectAgentSessionRef.current = selectAgentSession;
    createAgentSessionFromRequestRef.current = createAgentSessionFromRequest;
  }, [
    createAgentSessionFromRequest,
    createAgentSessionWithSelection,
    currentProjectId,
    selectAgentSession,
  ]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const handleCreateNewAgentSession = async (request?: CreateNewAgentSessionRequest) => {
      const targetProjectId = request?.projectId?.trim() || currentProjectIdRef.current.trim();

      try {
        if (createAgentSessionFromRequestRef.current) {
          await createAgentSessionFromRequestRef.current({
            ...request,
            ...(targetProjectId ? { projectId: targetProjectId } : {}),
            source: request?.source ?? 'global-event',
          });
          return;
        }
        if (!targetProjectId) {
          return;
        }

        await createWorkbenchAgentSessionInProject({
          createAgentSessionWithSelection: createAgentSessionWithSelectionRef.current,
          projectId: targetProjectId,
          requestedEngineId: request?.engineId,
          requestedModelId: request?.modelId,
          selectAgentSession: selectAgentSessionRef.current,
          title: request?.title,
        });
      } catch (error) {
        console.error('Failed to create session', error);
      }
    };

    const unsubscribe = globalEventBus.on('createNewAgentSession', handleCreateNewAgentSession);
    return () => {
      unsubscribe();
    };
  }, [isActive]);
}
